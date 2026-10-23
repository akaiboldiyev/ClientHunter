export interface BusinessLead {
  id: string;
  name: string;
  phone: string;
  address: string;
  website: string;
  rating: number;
  reviews: number;
  maps_url: string;
  city: string;
  category: string;
  source: '2gis' | 'manual';
  scrapedAt: string;
  hasWebsite: boolean;
  leadQuality: 'hot' | 'warm' | 'cold' | 'verified';
  status: 'new' | 'contacted' | 'meeting' | 'negotiation' | 'won' | 'lost';
  notes?: string;
  customPitch?: string;
  /** Normalized contacts. `phone` is retained for compatibility with existing exports. */
  phones?: LeadPhone[];
  emails?: string[];
  socials?: Record<string, string>;
  messengers?: { whatsapp?: { url?: string; source: LeadSource } };
  whatsappStatus?: WhatsAppStatus;
  sources?: LeadSource[];
  providerIds?: Partial<Record<LeadSource, string>>;
  contactability?: 'high' | 'medium' | 'low';
  raw?: Record<string, unknown>;
}

export type LeadSource = '2gis' | 'manual';
export type WhatsAppStatus = 'unknown' | 'available' | 'unavailable';

export interface LeadPhone {
  raw: string;
  normalized?: string;
  type: 'mobile' | 'landline' | 'unknown';
  source: LeadSource;
}

export interface SearchQuery {
  city: string;
  categories: string[];
  source: '2gis';
  onlyWithoutWebsite: boolean;
  minRating: number;
  hasPhoneOnly: boolean;
  limit: number;
}

export interface ScrapingProgress {
  isScraping: boolean;
  stage: 'idle' | 'initializing' | 'searching' | 'parsing_places' | 'detecting_websites' | 'extracting_contacts' | 'completed' | 'error';
  progress: number;
  currentQuery: string;
  foundCount: number;
  withoutWebsiteCount: number;
  statusMessage: string;
  completedCategories?: string[];
  failedCategories?: string[];
  phoneCount?: number;
  mobileCount?: number;
  confirmedWhatsAppCount?: number;
  rawCount?: number;
  deduplicatedCount?: number;
  processedCount?: number;
  totalAvailable?: number;
  suitableCount?: number;
  currentCategory?: string;
  categoryIndex?: number;
  totalCategories?: number;
}

export interface LeadFilter {
  search: string;
  websiteFilter: 'all' | 'without_website' | 'with_website';
  phoneOnly: boolean;
  minRating: number;
  quality: 'all' | 'hot' | 'warm' | 'cold';
  status: 'all' | 'new' | 'contacted' | 'meeting' | 'negotiation' | 'won' | 'lost';
  category: string;
  categories?: string[];
  source?: 'all' | '2gis';
  contact?: 'all' | 'mobile' | 'phone' | 'whatsapp_available' | 'whatsapp_unknown';
  city: string;
  sortBy: 'relevance' | 'rating_desc' | 'reviews_desc' | 'name_asc' | 'date_desc';
}
