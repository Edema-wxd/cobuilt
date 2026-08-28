export interface SearchOptions {
  q: string;
  limit: number;
  offset: number;
  filters?: {
    status?: string;
    sector?: string;
    location?: string;
    category?: string;
  };
}

export interface SearchHit {
  id: string;
  type: 'project' | 'news' | 'faq';
  title: string;
  slug: string;
  excerpt: string | null;
  url: string;
  publishedAt: Date | string | null;
  score: number;
}

export interface SearchResponse {
  results: SearchHit[];
  total: number;
  page: number;
  pageSize: number;
  /** Which backend answered — surfaced so a silent fallback is observable. */
  engine: 'meilisearch' | 'postgres';
}
