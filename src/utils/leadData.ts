import { BusinessLead, LeadPhone, LeadSource, WhatsAppStatus } from '../types';

const SOCIAL_HOSTS = /(?:instagram\.com|facebook\.com|tiktok\.com|t\.me|telegram\.me|wa\.me|whatsapp\.com|2gis\.|google\.(?:com|ru)|maps\.)/i;

export function normalizeKazakhstanPhone(raw: string): string | undefined {
  const compact = raw.replace(/[^\d+]/g, '');
  const digits = compact.replace(/\D/g, '');
  if (/^8\d{10}$/.test(digits)) return `+7${digits.slice(1)}`;
  if (/^7\d{10}$/.test(digits)) return `+${digits}`;
  if (/^\d{10}$/.test(digits) && digits.startsWith('7')) return `+7${digits}`;
  return undefined;
}

export function classifyKazakhstanPhone(normalized?: string): LeadPhone['type'] {
  if (!normalized || !/^\+7\d{10}$/.test(normalized)) return 'unknown';
  // Kazakhstan mobile prefixes in the national number begin with 70/74/75/76/77.
  return /^\+7(?:0|4|5|6|7)\d{9}$/.test(normalized) ? 'mobile' : 'landline';
}

export function isBusinessWebsite(url?: string): boolean {
  if (!url) return false;
  try { return /^https?:$/i.test(new URL(url).protocol) && !SOCIAL_HOSTS.test(new URL(url).hostname); }
  catch { return false; }
}

export function leadContacts(phone: string | undefined, source: LeadSource): LeadPhone[] {
  if (!phone?.trim()) return [];
  const normalized = normalizeKazakhstanPhone(phone);
  return [{ raw: phone, normalized, type: classifyKazakhstanPhone(normalized), source }];
}

export function contactabilityOf(lead: Pick<BusinessLead, 'hasWebsite' | 'phones' | 'whatsappStatus' | 'emails' | 'socials'>): 'high' | 'medium' | 'low' {
  const phones = lead.phones ?? [];
  const hasChannel = lead.whatsappStatus === 'available' || Boolean(lead.emails?.length || Object.keys(lead.socials ?? {}).length);
  if (!lead.hasWebsite && phones.some((phone) => phone.type === 'mobile') && hasChannel) return 'high';
  if (!lead.hasWebsite && phones.length) return 'medium';
  return 'low';
}

export function hydrateLead(lead: BusinessLead): BusinessLead {
  const source = lead.source;
  const phones = lead.phones?.length ? lead.phones : leadContacts(lead.phone, source);
  const website = isBusinessWebsite(lead.website) ? lead.website : '';
  const whatsappStatus: WhatsAppStatus = lead.whatsappStatus ?? (lead.messengers?.whatsapp?.url ? 'available' : 'unknown');
  const hydrated = { ...lead, website, hasWebsite: Boolean(website), phones, whatsappStatus, sources: lead.sources?.length ? lead.sources : [source] };
  return { ...hydrated, contactability: lead.contactability ?? contactabilityOf(hydrated) };
}

const normalizeText = (value?: string) => (value ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
export function mergeLeads(leads: BusinessLead[]): BusinessLead[] {
  const merged: BusinessLead[] = [];
  for (const candidateValue of leads) {
    const candidate = hydrateLead(candidateValue);
    const candidatePhones = candidate.phones?.map((phone) => phone.normalized).filter(Boolean) ?? [];
    const index = merged.findIndex((existing) => {
      const idsMatch = Object.entries(candidate.providerIds ?? {}).some(([source, id]) => id && existing.providerIds?.[source as LeadSource] === id);
      const phonesMatch = candidatePhones.some((phone) => existing.phones?.some((value) => value.normalized === phone));
      const websiteMatch = Boolean(candidate.website && existing.website && normalizeText(candidate.website) === normalizeText(existing.website));
      const candidateName = normalizeText(candidate.name);
      const existingName = normalizeText(existing.name);
      const candidateAddress = normalizeText(candidate.address);
      const existingAddress = normalizeText(existing.address);
      const identityMatch = Boolean(candidateName && existingName && candidateAddress && existingAddress) && candidateName === existingName && candidateAddress === existingAddress;
      return idsMatch || phonesMatch || websiteMatch || identityMatch;
    });
    if (index < 0) { merged.push(candidate); continue; }
    const existing = merged[index];
    const preferCandidate = candidate.sources?.includes('2gis') && !existing.sources?.includes('2gis');
    const phones = [...(existing.phones ?? []), ...(candidate.phones ?? [])].filter((phone, i, all) => all.findIndex((item) => item.normalized === phone.normalized && item.raw === phone.raw) === i);
    const base = preferCandidate ? candidate : existing;
    merged[index] = hydrateLead({ ...base, phones, sources: Array.from(new Set([...(existing.sources ?? []), ...(candidate.sources ?? [])])), providerIds: { ...existing.providerIds, ...candidate.providerIds }, website: base.website || existing.website || candidate.website, rating: Math.max(existing.rating || 0, candidate.rating || 0), reviews: Math.max(existing.reviews || 0, candidate.reviews || 0), category: Array.from(new Set([existing.category, candidate.category].filter(Boolean))).join(', '), whatsappStatus: existing.whatsappStatus === 'available' || candidate.whatsappStatus === 'available' ? 'available' : (existing.whatsappStatus === 'unavailable' && candidate.whatsappStatus === 'unavailable' ? 'unavailable' : 'unknown') });
  }
  return merged;
}
