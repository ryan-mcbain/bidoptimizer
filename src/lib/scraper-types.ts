/**
 * Types for the property scraper
 */

/**
 * Normalized property data extracted from listings
 */
export interface ScrapedPropertyData {
  /** Full property address */
  address: string;
  /** Current list price */
  listPrice: number;
  /** Number of days on market */
  daysOnMarket: number;
  /** Number of bedrooms */
  bedrooms: number;
  /** Number of bathrooms */
  bathrooms: number;
  /** Property type (single-family, condo, etc.) */
  propertyType: 'single-family' | 'condo' | 'townhouse' | 'multi-family' | 'other';
  /** Square footage */
  squareFeet?: number;
  /** Year built */
  yearBuilt?: number;
  /** Whether price has been reduced */
  priceReduced: boolean;
  /** Original list price (if reduced) */
  originalPrice?: number;
  /** Zillow Zestimate or Redfin estimate */
  estimatedValue?: number;
  /** Source of the data */
  source: 'zillow' | 'redfin';
  /** URL that was scraped */
  sourceUrl: string;
  /** Timestamp of scrape */
  scrapedAt: string;
}

/**
 * API response for successful scrape
 */
export interface ScrapeSuccessResponse {
  success: true;
  data: ScrapedPropertyData;
}

/**
 * API response for failed scrape
 */
export interface ScrapeErrorResponse {
  success: false;
  error: string;
  errorCode: 'INVALID_URL' | 'FETCH_FAILED' | 'PARSE_FAILED' | 'UNSUPPORTED_SITE';
}

export type ScrapeResponse = ScrapeSuccessResponse | ScrapeErrorResponse;
