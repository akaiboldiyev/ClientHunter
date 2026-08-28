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
  source: 'google_maps' | '2gis' | 'manual' | 'ai_search';
  scrapedAt: string;
  hasWebsite: boolean;
  leadQuality: 'hot' | 'warm' | 'cold' | 'verified';
  status: 'new' | 'contacted' | 'meeting' | 'negotiation' | 'won' | 'lost';
  notes?: string;
  customPitch?: string;
}

export interface SearchQuery {
  city: string;
  category: string;
  source: 'google_maps' | '2gis' | 'both';
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
}

export interface LeadFilter {
  search: string;
  websiteFilter: 'all' | 'without_website' | 'with_website';
  phoneOnly: boolean;
  minRating: number;
  quality: 'all' | 'hot' | 'warm' | 'cold';
  status: 'all' | 'new' | 'contacted' | 'meeting' | 'negotiation' | 'won' | 'lost';
  category: string;
  city: string;
  sortBy: 'relevance' | 'rating_desc' | 'reviews_desc' | 'name_asc' | 'date_desc';
}
