import crypto from 'crypto';
import type { DataSource, WebSearchCache } from '@shared/schema';

interface GoogleSearchResult {
  title: string;
  link: string;
  snippet: string;
  displayLink?: string;
}

interface GoogleSearchResponse {
  items?: GoogleSearchResult[];
  searchInformation?: {
    totalResults: string;
    searchTime: number;
  };
}

interface NormalizedSearchResult {
  source: 'google_search';
  sourceId: string;
  title: string;
  url: string;
  snippet: string;
  relevanceScore: number;
  timestamp: string;
}

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const GOOGLE_CSE_ID = process.env.GOOGLE_CSE_ID;
const CACHE_DURATION_HOURS = 24;

export class GoogleSearchWorker {
  async search(
    query: string,
    options: {
      maxResults?: number;
      useCache?: boolean;
      db?: any;
    } = {}
  ): Promise<NormalizedSearchResult[]> {
    const { maxResults = 5, useCache = true, db } = options;

    if (!GOOGLE_API_KEY || !GOOGLE_CSE_ID) {
      console.warn('Google Search API credentials not configured');
      return [];
    }

    const queryHash = this.hashQuery(query);

    if (useCache && db) {
      const cached = await this.getCachedResults(queryHash, db);
      if (cached) {
        console.log(`Using cached Google Search results for: ${query}`);
        return cached;
      }
    }

    try {
      const results = await this.fetchGoogleSearch(query, maxResults);
      const normalized = this.normalizeResults(results);

      if (useCache && db) {
        await this.cacheResults(queryHash, query, normalized, db);
      }

      return normalized;
    } catch (error) {
      console.error('Google Search API error:', error);
      return [];
    }
  }

  private async fetchGoogleSearch(
    query: string,
    maxResults: number
  ): Promise<GoogleSearchResult[]> {
    const url = new URL('https://www.googleapis.com/customsearch/v1');
    url.searchParams.set('key', GOOGLE_API_KEY!);
    url.searchParams.set('cx', GOOGLE_CSE_ID!);
    url.searchParams.set('q', query);
    url.searchParams.set('num', Math.min(maxResults, 10).toString());

    const response = await fetch(url.toString());
    
    if (!response.ok) {
      throw new Error(`Google Search API returned ${response.status}: ${response.statusText}`);
    }

    const data: GoogleSearchResponse = await response.json();
    return data.items || [];
  }

  private normalizeResults(results: GoogleSearchResult[]): NormalizedSearchResult[] {
    return results.map((result, index) => ({
      source: 'google_search' as const,
      sourceId: `google_${this.hashQuery(result.link).substring(0, 12)}`,
      title: result.title,
      url: result.link,
      snippet: result.snippet,
      relevanceScore: 1.0 - (index * 0.1),
      timestamp: new Date().toISOString(),
    }));
  }

  private hashQuery(query: string): string {
    return crypto.createHash('sha256').update(query.toLowerCase().trim()).digest('hex');
  }

  private async getCachedResults(
    queryHash: string,
    db: any
  ): Promise<NormalizedSearchResult[] | null> {
    try {
      const { webSearchCache } = await import('@shared/schema');
      const { eq, and, gt } = await import('drizzle-orm');
      
      const cached = await db
        .select()
        .from(webSearchCache)
        .where(
          and(
            eq(webSearchCache.queryHash, queryHash),
            gt(webSearchCache.expiresAt, new Date())
          )
        )
        .limit(1);

      if (cached.length > 0) {
        return cached[0].results as NormalizedSearchResult[];
      }
      return null;
    } catch (error) {
      console.error('Error retrieving cached search results:', error);
      return null;
    }
  }

  private async cacheResults(
    queryHash: string,
    query: string,
    results: NormalizedSearchResult[],
    db: any
  ): Promise<void> {
    try {
      const { webSearchCache } = await import('@shared/schema');
      
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + CACHE_DURATION_HOURS);

      await db.insert(webSearchCache).values({
        queryHash,
        query,
        results: results as any,
        expiresAt,
      }).onConflictDoUpdate({
        target: webSearchCache.queryHash,
        set: {
          results: results as any,
          expiresAt,
        },
      });

      console.log(`Cached Google Search results for: ${query}`);
    } catch (error) {
      console.error('Error caching search results:', error);
    }
  }
}

export const googleSearchWorker = new GoogleSearchWorker();
