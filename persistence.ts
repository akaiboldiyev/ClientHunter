import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

/**
 * Small local persistence layer for the single-server MVP. The file stays in
 * runtime/ (gitignored); migration is intentionally automatic and idempotent.
 */
export type StoredLead = Record<string, any>;

const runtimeDir = path.join(process.cwd(), 'runtime');
mkdirSync(runtimeDir, { recursive: true });
const db = new DatabaseSync(path.join(runtimeDir, 'leadscout.sqlite'));

db.exec(`
  CREATE TABLE IF NOT EXISTS leads (
    id TEXT PRIMARY KEY,
    two_gis_id TEXT,
    normalized_phone TEXT,
    website_key TEXT,
    name_address_key TEXT,
    payload TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_leads_two_gis_id ON leads(two_gis_id);
  CREATE INDEX IF NOT EXISTS idx_leads_normalized_phone ON leads(normalized_phone);
  CREATE INDEX IF NOT EXISTS idx_leads_website_key ON leads(website_key);
  CREATE INDEX IF NOT EXISTS idx_leads_name_address_key ON leads(name_address_key);
`);

const normalizeText = (value = '') => value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const normalizeWebsite = (value = '') => {
  try { return new URL(value).hostname.toLowerCase().replace(/^www\./, ''); } catch { return ''; }
};
const leadKeys = (lead: StoredLead) => ({
  twoGisId: String(lead.providerIds?.['2gis'] ?? lead.twoGisId ?? '') || null,
  phone: (lead.phones ?? []).map((phone: any) => phone.normalized).find(Boolean) ?? null,
  website: normalizeWebsite(lead.website),
  nameAddress: `${normalizeText(lead.name)}|${normalizeText(lead.address)}`,
  hasNameAndAddress: Boolean(normalizeText(lead.name) && normalizeText(lead.address)),
});

const parse = (row: { payload: string }) => JSON.parse(row.payload) as StoredLead;
const allRows = () => db.prepare('SELECT payload FROM leads ORDER BY updated_at DESC').all() as { payload: string }[];

function findExisting(lead: StoredLead): StoredLead | undefined {
  const keys = leadKeys(lead);
  // Required matching order: 2GIS id → phone → website → name + address.
  if (keys.twoGisId) {
    const row = db.prepare('SELECT payload FROM leads WHERE two_gis_id = ? LIMIT 1').get(keys.twoGisId) as { payload: string } | undefined;
    if (row) return parse(row);
  }
  if (keys.phone) {
    const row = db.prepare('SELECT payload FROM leads WHERE normalized_phone = ? LIMIT 1').get(keys.phone) as { payload: string } | undefined;
    if (row) return parse(row);
  }
  if (keys.website) {
    const row = db.prepare('SELECT payload FROM leads WHERE website_key = ? LIMIT 1').get(keys.website) as { payload: string } | undefined;
    if (row) return parse(row);
  }
  if (keys.hasNameAndAddress) {
    const row = db.prepare('SELECT payload FROM leads WHERE name_address_key = ? LIMIT 1').get(keys.nameAddress) as { payload: string } | undefined;
    if (row) return parse(row);
  }
  return undefined;
}

function merge(existing: StoredLead, incoming: StoredLead): StoredLead {
  const seen = new Set<string>();
  const phones = [...(existing.phones ?? []), ...(incoming.phones ?? [])].filter((phone) => {
    const key = phone.normalized || phone.raw;
    if (!key || seen.has(key)) return false;
    seen.add(key); return true;
  });
  const now = new Date().toISOString();
  return {
    ...incoming,
    id: existing.id,
    phones,
    phone: incoming.phone || existing.phone || phones[0]?.raw || '',
    website: incoming.website || existing.website || '',
    hasWebsite: Boolean(incoming.website || existing.website),
    category: Array.from(new Set([existing.category, incoming.category].filter(Boolean))).join(', '),
    sources: Array.from(new Set([...(existing.sources ?? [existing.source]), ...(incoming.sources ?? [incoming.source])])),
    providerIds: { ...existing.providerIds, ...incoming.providerIds },
    rating: Math.max(existing.rating ?? 0, incoming.rating ?? 0),
    reviews: Math.max(existing.reviews ?? 0, incoming.reviews ?? 0),
    whatsappStatus: existing.whatsappStatus === 'available' || incoming.whatsappStatus === 'available' ? 'available' : (incoming.whatsappStatus ?? existing.whatsappStatus ?? 'unknown'),
    // CRM fields belong to the user and must survive a provider refresh.
    status: existing.status ?? incoming.status ?? 'new',
    notes: existing.notes ?? incoming.notes,
    createdAt: existing.createdAt ?? now,
    updatedAt: now,
  };
}

export function listLeads(): StoredLead[] { return allRows().map(parse); }

export function upsertLead(incoming: StoredLead): StoredLead {
  const existing = findExisting(incoming);
  const now = new Date().toISOString();
  const lead = existing ? merge(existing, incoming) : { ...incoming, createdAt: incoming.createdAt ?? now, updatedAt: now };
  const keys = leadKeys(lead);
  db.prepare(`INSERT INTO leads (id, two_gis_id, normalized_phone, website_key, name_address_key, payload, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET two_gis_id=excluded.two_gis_id, normalized_phone=excluded.normalized_phone,
      website_key=excluded.website_key, name_address_key=excluded.name_address_key, payload=excluded.payload, updated_at=excluded.updated_at`)
    .run(lead.id, keys.twoGisId, keys.phone, keys.website || null, keys.nameAddress, JSON.stringify(lead), lead.createdAt, lead.updatedAt);
  return lead;
}

export function updateLead(id: string, patch: StoredLead): StoredLead | undefined {
  const row = db.prepare('SELECT payload FROM leads WHERE id = ?').get(id) as { payload: string } | undefined;
  if (!row) return undefined;
  const current = parse(row);
  // Update uses the same upsert path to keep indexes consistent.
  db.prepare('DELETE FROM leads WHERE id = ?').run(id);
  return upsertLead({ ...current, ...patch, id, createdAt: current.createdAt, updatedAt: new Date().toISOString() });
}

export function deleteLead(id: string): boolean { return db.prepare('DELETE FROM leads WHERE id = ?').run(id).changes > 0; }
