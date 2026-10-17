import express from 'express';
import path from 'path';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { createServer as createViteServer } from 'vite';
import { deleteLead, listLeads, updateLead, upsertLead } from './persistence.js';

process.loadEnvFile?.('.env');

const DEFAULT_PORT = 3000;
const PAGE_SIZE = 50;
const MAX_2GIS_PAGES = Math.min(Math.max(Number(process.env.TWOGIS_MAX_PAGES ?? 20), 1), 100);
const MAX_RESULTS = Math.min(Math.max(Number(process.env.TWOGIS_MAX_RESULTS ?? 500), 20), 500);
const CACHE_MS = 5 * 60_000;
const regionCache = new Map<string, { expiresAt: number; id: string }>();
const rubricCache = new Map<string, { expiresAt: number; id: string }>();
const searchCache = new Map<string, { expiresAt: number; value: SearchResult }>();
const execFileAsync = promisify(execFile);

type ApiPhone = { raw: string; normalized?: string; type: 'mobile' | 'landline' | 'unknown'; source: '2gis' };
type SearchResult = { leads: unknown[]; total: number; fetched: number; pages: number; pageSize: number; truncated: boolean; regionId: string; rubricId: string; contactGroupsAccess: boolean };
const socialHost = /(?:instagram\.com|facebook\.com|tiktok\.com|t\.me|telegram\.me|wa\.me|whatsapp\.com|2gis\.|google\.(?:com|ru)|maps\.)/i;
const normalizePhone = (raw: string) => {
  const digits = raw.replace(/\D/g, '');
  if (/^8\d{10}$/.test(digits)) return `+7${digits.slice(1)}`;
  if (/^7\d{10}$/.test(digits)) return `+${digits}`;
  if (/^7\d{9}$/.test(digits)) return `+7${digits}`;
  return undefined;
};
const phoneType = (normalized?: string): ApiPhone['type'] => !normalized ? 'unknown' : /^\+7(?:0|4|5|6|7)\d{9}$/.test(normalized) ? 'mobile' : /^\+7\d{10}$/.test(normalized) ? 'landline' : 'unknown';
const isWebsite = (url?: string) => { try { return Boolean(url && /^https?:$/.test(new URL(url).protocol) && !socialHost.test(new URL(url).hostname)); } catch { return false; } };
const normalizedText = (value: string) => value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

async function request2gis(endpoint: string, params: Record<string, string>) {
  const key = process.env.TWOGIS_API_KEY;
  if (!key) throw new Error('2GIS API key is not configured');
  const url = new URL(`https://catalog.api.2gis.com${endpoint}`);
  Object.entries({ ...params, key }).forEach(([name, value]) => url.searchParams.set(name, value));
  const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  const payload: any = await response.json();
  if (!response.ok || payload?.meta?.code >= 400) throw new Error(`2GIS provider error (${response.status}): ${payload?.meta?.error?.message ?? 'unknown error'}`);
  return payload;
}

async function resolveRegion(city: string) {
  const cacheKey = normalizedText(city);
  const cached = regionCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.id;
  const payload = await request2gis('/2.0/region/search', { q: city });
  const items = payload?.result?.items ?? [];
  const exact = items.find((item: any) => normalizedText(item.name ?? '') === cacheKey) ?? items[0];
  if (!exact?.id) throw new Error(`2GIS region was not found for ${city}`);
  const id = String(exact.id);
  regionCache.set(cacheKey, { id, expiresAt: Date.now() + CACHE_MS });
  return id;
}

async function resolveRubric(regionId: string, category: string) {
  const cacheKey = `${regionId}|${normalizedText(category)}`;
  const cached = rubricCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.id;
  const payload = await request2gis('/2.0/catalog/rubric/search', { q: category, region_id: regionId, page_size: '50' });
  const categoryText = normalizedText(category);
  const categoryStem = categoryText.slice(0, Math.max(4, categoryText.length - 2));
  const items = (payload?.result?.items ?? []).filter((item: any) => normalizedText(item.name ?? '').includes(categoryText) || normalizedText(item.name ?? '').includes(categoryStem));
  const selected = items.sort((left: any, right: any) => Number(right.branch_count ?? 0) - Number(left.branch_count ?? 0))[0];
  if (!selected?.id) throw new Error(`2GIS rubric was not found for ${category}`);
  const id = String(selected.id);
  rubricCache.set(cacheKey, { id, expiresAt: Date.now() + CACHE_MS });
  return id;
}

async function search2gisApi(city: string, category: string): Promise<SearchResult> {
  const cacheKey = `${normalizedText(city)}|${normalizedText(category)}`;
  const cached = searchCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const regionId = await resolveRegion(city);
  const rubricId = await resolveRubric(regionId, category);
  const items: any[] = [];
  let total = 0;
  let pages = 0;
  let contactGroupsAccess = false;
  let pageSize = PAGE_SIZE;
  let truncated = false;

  for (let page = 1; page <= MAX_2GIS_PAGES; page += 1) {
    const params = () => ({ region_id: regionId, rubric_id: rubricId, page: String(page), page_size: String(pageSize), fields: 'items.region_id,items.point,items.reviews,items.contact_groups,items.rubrics,items.schedule' });
    let payload: any;
    try { payload = await request2gis('/3.0/items', params()); }
    catch (error) {
      if (page === 1 && pageSize > 10 && error instanceof Error && error.message.includes("page_size")) {
        pageSize = 10;
        payload = await request2gis('/3.0/items', params());
      } else if (error instanceof Error && error.message.includes("parameter 'page'")) {
        truncated = true;
        break;
      } else throw error;
    }
    const pageItems = payload?.result?.items ?? [];
    total = Number(payload?.result?.total ?? total);
    pages = page;
    items.push(...pageItems);
    if (pageItems.some((item: any) => Array.isArray(item.contact_groups))) contactGroupsAccess = true;
    if (!pageItems.length || items.length >= total || pageItems.length < pageSize) break;
  }

  const leads = items.map((item: any) => {
    const contacts = Array.isArray(item.contact_groups) ? item.contact_groups.flatMap((group: any) => group.contacts ?? []) : [];
    const phones: ApiPhone[] = contacts.filter((contact: any) => contact.type === 'phone').map((contact: any) => {
      const raw = String(contact.value ?? contact.text ?? ''); const normalized = normalizePhone(raw);
      return { raw, normalized, type: phoneType(normalized), source: '2gis' };
    }).filter((phone: ApiPhone) => phone.raw);
    const urls = contacts.map((contact: any) => String(contact.value ?? contact.url ?? '')).filter(Boolean);
    const website = urls.find(isWebsite) ?? '';
    const whatsappUrl = urls.find((value: string) => /(?:wa\.me|whatsapp\.com)/i.test(value));
    const socials = Object.fromEntries(urls.filter((value: string) => /(?:instagram\.com|facebook\.com|tiktok\.com|t\.me|telegram\.me)/i.test(value)).map((value: string) => [new URL(value).hostname, value]));
    return {
      id: `2gis-${item.id}`, name: item.name ?? 'Без названия', phone: phones[0]?.raw ?? '', phones,
      address: item.address_name ?? item.address ?? '', website, hasWebsite: Boolean(website),
      rating: Number(item.reviews?.general_rating ?? item.rating ?? 0), reviews: Number(item.reviews?.general_review_count ?? item.review_count ?? 0),
      maps_url: item.link ?? `https://2gis.ru/search/${encodeURIComponent(item.name ?? '')}`,
      city, category, source: '2gis', sources: ['2gis'], providerIds: { '2gis': String(item.id) },
      scrapedAt: new Date().toISOString(), leadQuality: 'warm', status: 'new',
      whatsappStatus: whatsappUrl ? 'available' : 'unknown', messengers: whatsappUrl ? { whatsapp: { url: whatsappUrl, source: '2gis' } } : undefined,
      emails: contacts.filter((contact: any) => contact.type === 'email').map((contact: any) => String(contact.value ?? contact.text)).filter(Boolean), socials,
      raw: { id: item.id, region_id: item.region_id, rubrics: item.rubrics, reviews: item.reviews, point: item.point, schedule: item.schedule, contact_groups: item.contact_groups }
    };
  });
  const value = { leads, total, fetched: items.length, pages, pageSize, truncated, regionId, rubricId, contactGroupsAccess };
  searchCache.set(cacheKey, { value, expiresAt: Date.now() + CACHE_MS });
  return value;
}

async function search2gisPlaywright(city: string, category: string): Promise<SearchResult> {
  const cacheKey = `playwright|${normalizedText(city)}|${normalizedText(category)}`;
  const cached = searchCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const { stdout } = await execFileAsync('python', ['scrapers/two_gis.py', city, category, String(MAX_RESULTS)], { cwd: process.cwd(), timeout: 900_000, maxBuffer: 4_000_000 });
  const events = stdout.trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
  const result = events.find((event) => event.event === 'complete')?.result;
  if (!result) throw new Error('2GIS Playwright provider did not return a result');
  if (result.verificationRequired) throw new Error('2GIS требует подтверждение. Пройдите проверку в открытом окне.');
  if (result.error) throw new Error(result.error);
  const items = Array.isArray(result.items) ? result.items : [];
  const leads = items.map((item: any) => playwrightItemToLead(item, city, category));
  const value = { leads, total: Number(result.total ?? leads.length), fetched: leads.length, pages: 2, pageSize: leads.length, truncated: leads.length < Number(result.total ?? leads.length), regionId: '', rubricId: '', contactGroupsAccess: false };
  searchCache.set(cacheKey, { value, expiresAt: Date.now() + CACHE_MS });
  return value;
}

function playwrightItemToLead(item: any, city: string, category: string) {
    const phones: ApiPhone[] = (item.phones ?? []).map((raw: string) => {
      const normalized = normalizePhone(raw);
      return { raw, normalized, type: phoneType(normalized), source: '2gis' };
    }).filter((phone: ApiPhone) => phone.raw).filter((phone: ApiPhone, index: number, all: ApiPhone[]) => all.findIndex((value) => value.normalized === phone.normalized && value.raw === phone.raw) === index);
    const urls = (item.links ?? []).filter((url: unknown): url is string => typeof url === 'string');
    const website = isWebsite(item.website) ? item.website : (urls.find(isWebsite) ?? '');
    const whatsappUrl = urls.find((url) => /(?:wa\.me|whatsapp\.com)/i.test(url));
    const whatsappAvailable = item.whatsappExplicit === true || Boolean(whatsappUrl);
    const socials = Object.fromEntries((item.socials ?? []).filter((name: unknown): name is string => typeof name === 'string').map((name: string) => [name, 'shown in 2GIS']));
    return { id: `2gis-${item.providerId}`, name: item.name ?? 'Без названия', phone: phones[0]?.raw ?? '', phones, address: item.address ?? '', website, hasWebsite: Boolean(website), rating: Number(item.rating ?? 0), reviews: Number(item.reviews ?? 0), maps_url: item.url ?? '', city, category, source: '2gis', sources: ['2gis'], providerIds: { '2gis': String(item.providerId) }, scrapedAt: new Date().toISOString(), leadQuality: 'warm', status: 'new', whatsappStatus: whatsappAvailable ? 'available' : 'unknown', messengers: whatsappAvailable ? { whatsapp: { url: whatsappUrl, source: '2gis' } } : undefined, socials, raw: { providerId: item.providerId, links: urls, websiteLabel: item.website ?? '', socialLabels: item.socials ?? [], whatsappExplicit: whatsappAvailable } };
}

function getPort(): number {
  const configuredPort = Number(process.env.PORT ?? DEFAULT_PORT);
  return Number.isInteger(configuredPort) && configuredPort > 0 && configuredPort < 65536 ? configuredPort : DEFAULT_PORT;
}

async function startServer() {
  const app = express();
  const port = getPort();
  app.disable('x-powered-by');
  app.use((_, res, next) => { res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('X-Frame-Options', 'DENY'); res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin'); next(); });
  app.use(express.json({ limit: '100kb' }));
  app.get('/api/health', (_, res) => res.json({ status: 'ok', service: 'LeadScout - ClientHunter', timestamp: new Date().toISOString() }));
  app.get('/api/info', (_, res) => res.json({ name: 'LeadScout', description: '2GIS business lead finder', version: '1.0.0' }));
  app.get('/api/leads', (_, res) => res.json({ leads: listLeads() }));
  app.post('/api/leads', (req, res) => {
    if (!req.body?.id || !req.body?.name) return res.status(400).json({ error: 'Укажите id и название лида.' });
    return res.status(201).json({ lead: upsertLead(req.body) });
  });
  app.patch('/api/leads/:id', (req, res) => {
    const lead = updateLead(req.params.id, req.body ?? {});
    if (!lead) return res.status(404).json({ error: 'Лид не найден.' });
    return res.json({ lead });
  });
  app.delete('/api/leads/:id', (req, res) => res.status(deleteLead(req.params.id) ? 204 : 404).end());

  // NDJSON keeps the existing Playwright provider but exposes every completed
  // card immediately. No parallel category fan-out, proxying, or CAPTCHA bypass.
  app.post('/api/search/2gis/stream', (req, res) => {
    const { city, category, limit } = req.body ?? {};
    if (typeof city !== 'string' || typeof category !== 'string' || !city.trim() || !category.trim()) return res.status(400).json({ error: 'Укажите город и категорию.' });
    if (process.env.TWOGIS_PROVIDER === 'api') return res.status(409).json({ error: 'Потоковый MVP требует реальный Playwright provider. Уберите TWOGIS_PROVIDER=api.' });
    const requestedLimit = Math.min(Math.max(Number(limit) || 20, 1), MAX_RESULTS);
    res.status(200).set({ 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive' });
    res.flushHeaders();
    const child = spawn('python', ['scrapers/two_gis.py', city.trim(), category.trim(), String(requestedLimit)], { cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'] });
    let buffer = '';
    let stderr = '';
    let closed = false;
    const send = (payload: Record<string, unknown>) => { if (!closed) res.write(`${JSON.stringify(payload)}\n`); };
    const stop = () => { closed = true; if (!child.killed) child.kill(); };
    // `req.close` fires after a normal POST body is fully read in some Node
    // versions; observe the response instead so only a disconnected client
    // cancels the Playwright child.
    res.on('close', () => { if (!res.writableEnded) stop(); });
    child.stdout.on('data', (chunk: Buffer) => {
      buffer += chunk.toString('utf8');
      const lines = buffer.split(/\r?\n/); buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const event = JSON.parse(line);
          if (event.event === 'lead' && event.item) {
            const lead = upsertLead(playwrightItemToLead(event.item, city.trim(), category.trim()));
            send({ event: 'lead', lead, openedCards: event.openedCards, total: event.total });
          } else if (event.event === 'verification_required') send({ event: 'verification_required' });
          else if (event.event === 'complete') send({ event: 'complete', result: { ...event.result, items: undefined } });
        } catch { send({ event: 'error', error: 'Некорректный ответ Playwright provider.' }); }
      }
    });
    child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString('utf8'); });
    child.on('error', (error) => { send({ event: 'error', error: error.message }); res.end(); });
    child.on('close', (code) => {
      if (!closed && code !== 0) send({ event: 'error', error: stderr.trim() || 'Playwright provider завершился с ошибкой.' });
      if (!closed) res.end();
    });
    return undefined;
  });
  app.post('/api/search/2gis', async (req, res) => {
    const { city, category } = req.body ?? {};
    if (typeof city !== 'string' || typeof category !== 'string' || !city.trim() || !category.trim()) return res.status(400).json({ error: 'Укажите город и категорию.' });
    try {
      const provider = process.env.TWOGIS_PROVIDER === 'api' ? 'api' : 'playwright';
      const result = provider === 'api' ? await search2gisApi(city.trim(), category.trim()) : await search2gisPlaywright(city.trim(), category.trim());
      const leads = (result.leads as Record<string, unknown>[]).map(upsertLead);
      return res.json({ provider: `2gis-${provider}`, meta: { total: result.total, fetched: result.fetched, pages: result.pages, pageSize: result.pageSize, truncated: result.truncated, regionId: result.regionId, rubricId: result.rubricId, contactGroupsAccess: result.contactGroupsAccess, openedCards: provider === 'playwright' ? result.fetched : undefined }, leads });
    } catch (error) {
      const message = error instanceof Error ? error.message : '2GIS provider error';
      if (message === '2GIS API key is not configured') return res.status(503).json({ error: message, code: 'CONFIGURATION_ERROR' });
      return res.status(502).json({ error: message, code: 'PROVIDER_ERROR' });
    }
  });
  // --- AUTOMATION & COMMUNICATION BACKEND ---
  let automateStatus: 'idle' | 'running' | 'paused' | 'completed' | 'error' = 'idle';
  let automateErrors = 0;
  let automateMethod: 'template' | 'ollama' = 'template';

  let campaignTemplate = `Здравствуйте! Пишу по поводу компании {name} в г. {city}.
{proof}
{no_website}
Могу подготовить для вас краткий концепт современного сайта и варианты привлечения клиентов.
Подскажите, было бы вам интересно посмотреть?`;

  const fillLeadTemplate = (template: string, lead: any): string => {
    const name = lead.name?.trim() || 'Коллеги';
    const city = lead.city?.trim() || '';
    const category = lead.category?.trim() || 'бизнес';

    // Rating & reviews: strictly only if present and rating > 0
    let proof = '';
    if (lead.rating && Number(lead.rating) > 0) {
      proof = `Обратили внимание на ваш высокий рейтинг на картах (${lead.rating}★${lead.reviews ? `, ${lead.reviews} отзывов` : ''}).`;
    }

    // No website: strictly only if confirmed without website
    let noWebsite = '';
    if (lead.hasWebsite === false) {
      noWebsite = 'В карточке компании не указан официальный сайт.';
    }

    return template
      .replace(/\{name\}/g, name)
      .replace(/\{city\}/g, city)
      .replace(/\{category\}/g, category)
      .replace(/\{proof\}/g, proof)
      .replace(/\{no_website\}/g, noWebsite)
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      .trim();
  };

  const getStats = () => {
    const leads = listLeads();
    const totalWithWhatsApp = leads.filter((l: any) => l.whatsappStatus === 'available').length;
    // Ready to send: prepared with customPitch, WA available, not yet confirmed sent and not lost
    const readyToSend = leads.filter((l: any) =>
      (l.status === 'prepared' || Boolean(l.customPitch)) &&
      l.whatsappStatus === 'available' &&
      !l.whatsappSentAt &&
      l.status !== 'contacted' &&
      l.status !== 'lost'
    ).length;
    // Confirmed sent: explicitly has whatsappSentAt or marked contacted
    const confirmedSent = leads.filter((l: any) => Boolean(l.whatsappSentAt) || l.status === 'contacted').length;
    // Awaiting preparation: new leads with WA that have no pitch yet
    const waitingProcessing = leads.filter((l: any) => l.status === 'new' && l.whatsappStatus === 'available' && !l.customPitch).length;
    const processed = leads.filter((l: any) => l.status === 'prepared' || Boolean(l.customPitch)).length;

    return {
      readyToSend,
      confirmedSent,
      waitingSending: readyToSend,
      waitingProcessing,
      processed,
      totalWithWhatsApp,
      newLeads: waitingProcessing,
      totalAvailable: totalWithWhatsApp,
      errors: automateErrors,
    };
  };

  const processNextLead = async () => {
    if (automateStatus !== 'running') return;
    const leads = listLeads();
    const available = leads.filter((l: any) => l.status === 'new' && l.whatsappStatus === 'available' && !l.customPitch);

    if (available.length === 0) {
      automateStatus = 'completed';
      return;
    }

    const lead = available[0];
    try {
      if (automateMethod === 'template') {
        const pitch = fillLeadTemplate(campaignTemplate, lead);
        updateLead(lead.id, { customPitch: pitch, status: 'prepared' });
      } else {
        // Ollama local generation with strict rules
        const response = await fetch('http://127.0.0.1:11434/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'qwen3:14b',
            stream: false,
            messages: [
              {
                role: 'system',
                content: 'Ты — Джарвис, вежливый B2B консультант. Не выдумывай факты (цены, сроки, несуществующие кейсы). Составь очень короткое (2-4 предложения) приветливое первое сообщение в WhatsApp для компании без сайта. Предложи бесплатный краткий концепт страницы. Выведи только текст сообщения без кавычек.'
              },
              {
                role: 'user',
                content: `Компания: ${lead.name}, Город: ${lead.city || 'Актау'}, Сфера: ${lead.category}, Рейтинг: ${lead.rating || 0}, Отзывов: ${lead.reviews || 0}, Сайт: ${lead.hasWebsite ? 'есть' : 'нет'}`
              }
            ]
          }),
          signal: AbortSignal.timeout(30_000)
        });

        if (response.ok) {
          const data: any = await response.json();
          const pitch = (data.message?.content || '').replace(/^["']|["']$/g, '').trim();
          updateLead(lead.id, { customPitch: pitch || fillLeadTemplate(campaignTemplate, lead), status: 'prepared' });
        } else {
          automateErrors++;
          // Fallback to template so work is not blocked
          const pitch = fillLeadTemplate(campaignTemplate, lead);
          updateLead(lead.id, { customPitch: pitch, status: 'prepared' });
        }
      }
    } catch {
      automateErrors++;
      // Fallback to template
      try {
        const pitch = fillLeadTemplate(campaignTemplate, lead);
        updateLead(lead.id, { customPitch: pitch, status: 'prepared' });
      } catch {
        // Ignore secondary error
      }
    }

    if (automateStatus === 'running') {
      setTimeout(processNextLead, automateMethod === 'template' ? 200 : 3000);
    }
  };

  // State and Campaign Controls
  app.get('/api/automate/state', (_, res) => res.json({
    status: automateStatus,
    method: automateMethod,
    stats: getStats(),
    template: campaignTemplate
  }));

  app.post('/api/automate/start', (req, res) => {
    const { method } = req.body ?? {};
    if (method === 'ollama' || method === 'template') {
      automateMethod = method;
    }
    const currentStats = getStats();
    if (currentStats.waitingProcessing === 0) {
      automateStatus = 'completed';
      return res.json({ status: automateStatus, stats: currentStats });
    }
    if (automateStatus !== 'running') {
      automateStatus = 'running';
      processNextLead();
    }
    return res.json({ status: automateStatus, stats: getStats() });
  });

  app.post('/api/automate/pause', (_, res) => {
    automateStatus = 'paused';
    res.json({ status: automateStatus, stats: getStats() });
  });

  app.post('/api/automate/stop', (_, res) => {
    automateStatus = 'idle';
    res.json({ status: automateStatus, stats: getStats() });
  });

  // Template Management
  app.get('/api/automate/template', (_, res) => res.json({ template: campaignTemplate }));
  app.post('/api/automate/template', (req, res) => {
    if (typeof req.body?.template === 'string' && req.body.template.trim()) {
      campaignTemplate = req.body.template.trim();
    }
    return res.json({ template: campaignTemplate });
  });

  // Apply template immediately to leads needing pitches (without overwriting existing customPitches)
  app.post('/api/automate/apply-template', (req, res) => {
    const leads = listLeads();
    const targetIds: string[] = Array.isArray(req.body?.leadIds) ? req.body.leadIds : [];
    let updatedCount = 0;

    for (const lead of leads) {
      // If targetIds provided, only those; otherwise all new leads with WA that have no pitch yet
      const shouldUpdate = targetIds.length > 0
        ? targetIds.includes(lead.id) && !lead.customPitch
        : lead.status === 'new' && lead.whatsappStatus === 'available' && !lead.customPitch;

      if (shouldUpdate) {
        const pitch = fillLeadTemplate(campaignTemplate, lead);
        updateLead(lead.id, { customPitch: pitch, status: 'prepared' });
        updatedCount++;
      }
    }

    return res.json({ updatedCount, stats: getStats() });
  });

  // Confirm WhatsApp sending (Manual Confirmation)
  app.post('/api/leads/:id/confirm-sent', (req, res) => {
    const id = req.params.id;
    const lead = listLeads().find((l: any) => l.id === id);
    if (!lead) return res.status(404).json({ error: 'Лид не найден.' });

    const now = new Date().toISOString();
    const existingHistory = Array.isArray(lead.conversationHistory) ? lead.conversationHistory : [];
    const hasInitialMessage = existingHistory.some((m: any) => m.sender === 'user');

    const updatedHistory = hasInitialMessage
      ? existingHistory
      : [
          ...existingHistory,
          {
            id: `msg-${Date.now()}`,
            sender: 'user',
            text: lead.customPitch || 'Первичное обращение отправлено в WhatsApp.',
            timestamp: lead.whatsappSentAt || now
          }
        ];

    const updated = updateLead(id, {
      whatsappSentAt: lead.whatsappSentAt || now,
      status: 'contacted',
      conversationStatus: lead.conversationStatus && lead.conversationStatus !== 'unverified'
        ? lead.conversationStatus
        : 'awaiting_reply',
      conversationHistory: updatedHistory,
      nextRecommendedAction: lead.nextRecommendedAction || 'Ожидайте ответ клиента в WhatsApp'
    });

    return res.json({ lead: updated });
  });

  // Record WhatsApp link open (does NOT mark as sent)
  app.post('/api/leads/:id/open-whatsapp', (req, res) => {
    const id = req.params.id;
    const lead = listLeads().find((l: any) => l.id === id);
    if (!lead) return res.status(404).json({ error: 'Лид не найден.' });

    const updated = updateLead(id, {
      whatsappOpenedAt: new Date().toISOString()
    });
    return res.json({ lead: updated });
  });

  // Approve lead pitch for sending (Transition prepared -> approved)
  app.post('/api/leads/:id/approve', (req, res) => {
    const id = req.params.id;
    const lead = listLeads().find((l: any) => l.id === id);
    if (!lead) return res.status(404).json({ error: 'Лид не найден.' });

    const { customPitch } = req.body ?? {};
    const updated = updateLead(id, {
      status: 'approved',
      customPitch: typeof customPitch === 'string' && customPitch.trim() ? customPitch.trim() : lead.customPitch
    });
    return res.json({ lead: updated });
  });

  // Accurate diagnostics of sales funnel and data quality
  app.get('/api/leads/diagnostics', (_, res) => {
    const leads = listLeads();
    const total = leads.length;
    const needQualification = leads.filter((l: any) => l.status === 'new' && !l.customPitch).length;
    const prepared = leads.filter((l: any) => (l.status === 'prepared' || Boolean(l.customPitch)) && l.status !== 'approved' && l.status !== 'contacted' && l.status !== 'lost').length;
    const approved = leads.filter((l: any) => l.status === 'approved' && !l.whatsappSentAt).length;
    const confirmedSent = leads.filter((l: any) => Boolean(l.whatsappSentAt) || (l.status === 'contacted' && Array.isArray(l.conversationHistory) && l.conversationHistory.length > 0)).length;
    const actualRepliesReceived = leads.filter((l: any) => Array.isArray(l.conversationHistory) && l.conversationHistory.some((m: any) => m.sender === 'client')).length;
    const needsAttention = leads.filter((l: any) => l.conversationStatus === 'needs_reply' || l.conversationStatus === 'has_reply').length;
    const interested = leads.filter((l: any) => l.conversationStatus === 'interested' || l.conversationStatus === 'discussing_terms' || l.status === 'negotiation').length;
    const refused = leads.filter((l: any) => l.status === 'lost' || l.conversationStatus === 'refused' || l.isRefused).length;
    const unverifiedLegacy = leads.filter((l: any) => l.status === 'contacted' && !l.whatsappSentAt && (!Array.isArray(l.conversationHistory) || l.conversationHistory.length === 0)).length;

    return res.json({
      total,
      needQualification,
      prepared,
      approved,
      confirmedSent,
      actualRepliesReceived,
      needsAttention,
      interested,
      refused,
      unverifiedLegacy
    });
  });

  // Helper to resolve working Ollama host
  const getOllamaHost = async (): Promise<string> => {
    const hosts = [process.env.OLLAMA_HOST, 'http://127.0.0.1:11434', 'http://localhost:11434'].filter(Boolean) as string[];
    for (const host of hosts) {
      try {
        const check = await fetch(`${host}/api/tags`, { signal: AbortSignal.timeout(1500) });
        if (check.ok) return host;
      } catch {
        // try next
      }
    }
    return 'http://127.0.0.1:11434';
  };

  // Jarvis Ollama Status Check
  app.get('/api/jarvis/status', async (_, res) => {
    const host = await getOllamaHost();
    try {
      const startTime = Date.now();
      const response = await fetch(`${host}/api/tags`, {
        signal: AbortSignal.timeout(4000)
      });
      if (!response.ok) {
        return res.json({ available: false, model: 'qwen3:14b', host, error: `Ollama вернул код ${response.status}` });
      }
      const data: any = await response.json();
      const models: string[] = (data.models || []).map((m: any) => m.name || m.model);
      const hasQwen = models.some((m) => m.includes('qwen3:14b') || m.includes('qwen3-coder:30b') || m.includes('qwen'));
      return res.json({
        available: true,
        model: models.find((m) => m.includes('qwen3:14b')) || models[0] || 'qwen3:14b',
        models,
        hasPreferredModel: hasQwen,
        host,
        pingMs: Date.now() - startTime
      });
    } catch (e: any) {
      return res.json({
        available: false,
        model: 'qwen3:14b',
        host,
        error: `Сервис Ollama недоступен на ${host} (${e.message})`
      });
    }
  });

  // Jarvis Live Inference Ping Test
  app.post('/api/jarvis/ping', async (_, res) => {
    const host = await getOllamaHost();
    const startTime = Date.now();
    try {
      const response = await fetch(`${host}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'qwen3:14b',
          stream: false,
          messages: [{ role: 'user', content: 'Ответь кратко: Готов.' }]
        }),
        signal: AbortSignal.timeout(15_000)
      });
      if (!response.ok) {
        return res.status(503).json({ error: `Ollama вернула код ${response.status}` });
      }
      const data: any = await response.json();
      return res.json({
        ok: true,
        model: 'qwen3:14b',
        reply: data.message?.content?.trim() || 'Готов',
        latencyMs: Date.now() - startTime,
        host
      });
    } catch (e: any) {
      return res.status(503).json({
        error: `Тестовый запрос к Ollama не удался: ${e.message}`,
        host
      });
    }
  });

  // Jarvis Ollama Negotiation & Analysis
  app.post('/api/jarvis/analyze', async (req, res) => {
    const { leadId, clientMessage, context } = req.body ?? {};
    if (!clientMessage || typeof clientMessage !== 'string' || !clientMessage.trim()) {
      return res.status(400).json({ error: 'Укажите текст сообщения клиента.' });
    }

    const host = await getOllamaHost();
    const lead = leadId ? listLeads().find((l: any) => l.id === leadId) : null;
    const companyContext = lead
      ? `Компания: "${lead.name}", Сфера: "${lead.category}", Город: "${lead.city || 'Актау'}", Рейтинг: ${lead.rating || 0}★, Сайт: ${lead.hasWebsite ? 'есть' : 'нет'}, Ранее отправленный питч: "${lead.customPitch || ''}"`
      : 'Контекст: Веб-разработка и маркетинг для B2B клиентов.';

    const systemPrompt = `Ты — Джарвис, профессиональный локальный B2B переговорщик и ассистент по продажам сайтов и веб-услуг.
Твоя цель: помочь менеджеру корректно ответить на сообщение клиента в WhatsApp.

ЖЁСТКИЕ ТРЕБОВАНИЯ:
1. Не выдумывай факты о компании, ценах, сроках, договоре, предоплате, скидках или гарантиях.
2. Если клиент спрашивает о цене, сроках или условиях разработки: запроси решение менеджера и предложи вежливо объяснить, что точная стоимость зависит от задач, предложив коротко созвониться или обсудить структуру.
3. Не используй манипуляции, давление, ложную срочность или обещания "золотых гор".
4. Если клиент заинтересован: помоги выяснить потребность, предложи следующий шаг (показать демонстрацию концепта или созвониться на 5 минут).
5. Если клиент отказывается, просит больше не писать или шлёт спам-блокировку: зафиксируй отказ, предложи вежливый прощальный ответ без навязчивости и отметь отказ.
6. Язык ответа: русский (или язык, на котором написал клиент, если это казахский или английский).

Верни СТРОГО валидный JSON следующей структуры без пояснений и без markdown кавычек:
{
  "category": "проявил интерес" | "запросил цену" | "запросил примеры работ" | "попросил объяснить предложение" | "сомневается" | "попросил связаться позже" | "отказался" | "сообщение неясное" | "требуется вмешательство человека",
  "intent": "краткое описание намерения клиента в 1 предложении",
  "keyPoints": "выделенные вопросы, потребности или возражения",
  "recommendedAction": "объяснение рекомендуемого следующего шага для менеджера",
  "proposedReply": "готовый краткий и естественный текст ответа для отправки в WhatsApp",
  "status": "interested" | "discussing_terms" | "refused" | "needs_reply" | "completed" | "awaiting_reply",
  "isRefusal": false
}`;

    const userPrompt = `${companyContext}
Дополнительный контекст: ${context || 'нет'}
Сообщение от клиента:
"${clientMessage.trim()}"`;

    try {
      const response = await fetch(`${host}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'qwen3:14b',
          stream: false,
          format: 'json',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ]
        }),
        signal: AbortSignal.timeout(45_000)
      });

      if (!response.ok) {
        throw new Error(`Ollama вернула статус ${response.status}`);
      }

      const data: any = await response.json();
      const rawContent = data.message?.content || '{}';
      let parsed: any;
      try {
        parsed = JSON.parse(rawContent);
      } catch {
        // Fallback cleanup if model wrapped in codeblock
        const cleaned = rawContent.replace(/```(?:json)?/g, '').trim();
        parsed = JSON.parse(cleaned);
      }

      // Sanitize fields
      const result = {
        category: parsed.category || 'сообщение неясное',
        intent: parsed.intent || 'Ответ клиента в мессенджере',
        keyPoints: parsed.keyPoints || 'Вопрос или реакция клиента',
        recommendedAction: parsed.recommendedAction || 'Проверить сообщение и отправить ответ',
        proposedReply: parsed.proposedReply || 'Здравствуйте! Спасибо за ответ. Подскажите, какие задачи для вас сейчас в приоритете?',
        status: (['interested', 'discussing_terms', 'refused', 'needs_reply', 'completed', 'awaiting_reply'].includes(parsed.status)
          ? parsed.status
          : (parsed.isRefusal || parsed.category === 'отказался' ? 'refused' : 'needs_reply')),
        isRefusal: Boolean(parsed.isRefusal || parsed.category === 'отказался')
      };

      return res.json({ analysis: result });
    } catch (e: any) {
      return res.status(503).json({
        error: 'Не удалось получить анализ от локальной модели Ollama (qwen3:14b).',
        details: e.message
      });
    }
  });

  // Record conversation message and update lead state
  app.post('/api/leads/:id/conversation', (req, res) => {
    const id = req.params.id;
    const lead = listLeads().find((l: any) => l.id === id);
    if (!lead) return res.status(404).json({ error: 'Лид не найден.' });

    const { message, status, recommendedAction, isRefusal } = req.body ?? {};
    const now = new Date().toISOString();
    const existingHistory = Array.isArray(lead.conversationHistory) ? [...lead.conversationHistory] : [];

    if (message && typeof message.text === 'string' && message.text.trim()) {
      existingHistory.push({
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        sender: message.sender || 'client',
        text: message.text.trim(),
        timestamp: now,
        category: message.category,
        intent: message.intent,
        recommendedAction: message.recommendedAction
      });
    }

    const isClientRefused = Boolean(isRefusal || status === 'refused');
    const newStatus = isClientRefused ? 'lost' : (lead.status === 'new' ? 'contacted' : lead.status);
    const newConversationStatus = isClientRefused ? 'refused' : (status || lead.conversationStatus || 'needs_reply');

    const patch: any = {
      conversationHistory: existingHistory,
      conversationStatus: newConversationStatus,
      status: newStatus,
      isRefused: isClientRefused || Boolean(lead.isRefused),
      nextRecommendedAction: recommendedAction ?? lead.nextRecommendedAction
    };

    if (message?.sender === 'client') {
      patch.lastClientMessage = message.text.trim();
      patch.lastClientMessageAt = now;
    }

    const updated = updateLead(id, patch);
    return res.json({ lead: updated });
  });
  // ------------------------------------------

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist'); app.use(express.static(distPath)); app.get('*', (_, res) => res.sendFile(path.join(distPath, 'index.html')));
  }
  app.listen(port, '0.0.0.0', () => console.log(`LeadScout server is running on http://0.0.0.0:${port}`));
}

startServer().catch((error) => { console.error('Failed to start server:', error); process.exit(1); });
