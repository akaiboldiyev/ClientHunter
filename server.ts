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
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist'); app.use(express.static(distPath)); app.get('*', (_, res) => res.sendFile(path.join(distPath, 'index.html')));
  }
  app.listen(port, '0.0.0.0', () => console.log(`LeadScout server is running on http://0.0.0.0:${port}`));
}

startServer().catch((error) => { console.error('Failed to start server:', error); process.exit(1); });
