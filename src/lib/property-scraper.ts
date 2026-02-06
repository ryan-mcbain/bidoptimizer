/**
 * Property Scraper for Zillow and Redfin (v2.0)
 *
 * AGGRESSIVE MULTI-STRATEGY APPROACH:
 * 1. Zillow API (using ZPID extracted from URL)
 * 2. JSON-LD structured data
 * 3. Embedded JavaScript data objects
 * 4. HTML meta tags parsing
 * 5. URL-based fallback extraction
 *
 * Zillow-specific strategies:
 * - Extract ZPID from URL and query internal API
 * - Multiple endpoint fallbacks
 * - User-Agent rotation
 */

import { ScrapedPropertyData } from './scraper-types';

// =============================================================================
// USER AGENT ROTATION (for anti-bot detection)
// =============================================================================

const USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
];

function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

export function detectSource(url: string): 'zillow' | 'redfin' | null {
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes('zillow.com')) return 'zillow';
  if (lowerUrl.includes('redfin.com')) return 'redfin';
  return null;
}

function parsePrice(priceStr: string | number | undefined | null): number {
  if (typeof priceStr === 'number') return priceStr;
  if (!priceStr) return 0;
  const cleaned = String(priceStr).replace(/[^0-9.]/g, '');
  return parseInt(cleaned) || 0;
}

function normalizePropertyType(
  typeStr: string | undefined | null
): ScrapedPropertyData['propertyType'] {
  if (!typeStr) return 'other';
  const lower = typeStr.toLowerCase();

  if (lower.includes('single') || lower.includes('house') || lower.includes('detached')) {
    return 'single-family';
  }
  if (lower.includes('condo') || lower.includes('apartment')) {
    return 'condo';
  }
  if (lower.includes('town') || lower.includes('row')) {
    return 'townhouse';
  }
  if (lower.includes('multi') || lower.includes('duplex') || lower.includes('triplex')) {
    return 'multi-family';
  }
  return 'other';
}

function extractNumber(str: string | undefined | null): number {
  if (!str) return 0;
  const match = String(str).match(/[\d.]+/);
  return match ? parseFloat(match[0]) : 0;
}

function completePropertyData(
  partial: Partial<ScrapedPropertyData>,
  source: 'zillow' | 'redfin',
  url: string
): ScrapedPropertyData {
  return {
    address: partial.address || 'Unknown Address',
    listPrice: partial.listPrice || 0,
    daysOnMarket: partial.daysOnMarket || 0,
    bedrooms: partial.bedrooms || 0,
    bathrooms: partial.bathrooms || 0,
    propertyType: partial.propertyType || 'other',
    squareFeet: partial.squareFeet,
    yearBuilt: partial.yearBuilt,
    priceReduced: partial.priceReduced || false,
    originalPrice: partial.originalPrice,
    estimatedValue: partial.estimatedValue,
    source,
    sourceUrl: url,
    scrapedAt: new Date().toISOString(),
  };
}

function hasRequiredData(partial: Partial<ScrapedPropertyData>): boolean {
  return Boolean(partial.address || partial.listPrice);
}

// =============================================================================
// ZILLOW-SPECIFIC: ZPID EXTRACTION & API ACCESS
// =============================================================================

/**
 * Extract ZPID (Zillow Property ID) from URL
 * Zillow URLs contain the ZPID in various formats
 */
function extractZpid(url: string): string | null {
  // Pattern 1: /homedetails/address/12345_zpid/
  const zpidMatch = url.match(/(\d+)_zpid/i);
  if (zpidMatch) return zpidMatch[1];

  // Pattern 2: zpid=12345 in query string
  const queryMatch = url.match(/[?&]zpid=(\d+)/i);
  if (queryMatch) return queryMatch[1];

  // Pattern 3: /homes/12345_rb/ (sometimes used)
  const altMatch = url.match(/\/homes\/(\d+)/i);
  if (altMatch) return altMatch[1];

  return null;
}

/**
 * Extract address components from Zillow URL
 */
function extractAddressFromZillowUrl(url: string): string {
  try {
    // Pattern: /homedetails/123-Main-St-City-State-12345/zpid
    const pathMatch = url.match(/\/homedetails\/([^/]+)\//i);
    if (pathMatch) {
      // Convert hyphens to spaces and clean up
      let address = pathMatch[1]
        .replace(/-/g, ' ')
        .replace(/_/g, ' ')
        .replace(/\d+\s*zpid$/i, '')
        .trim();

      // Capitalize properly
      address = address.replace(/\b\w/g, l => l.toUpperCase());

      return address;
    }
  } catch {
    // Ignore errors
  }
  return '';
}

/**
 * Try to get data from Zillow's GraphQL/internal API
 * This is more reliable than scraping HTML
 */
async function fetchZillowFromApi(zpid: string): Promise<Partial<ScrapedPropertyData> | null> {
  try {
    // Zillow's property details API endpoint
    const apiUrl = `https://www.zillow.com/graphql/?zpid=${zpid}&operationName=ForSaleShopperPlatformFullRenderQuery`;

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'User-Agent': getRandomUserAgent(),
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': `https://www.zillow.com/homedetails/${zpid}_zpid/`,
        'Origin': 'https://www.zillow.com',
      },
    });

    if (response.ok) {
      const data = await response.json();
      return extractFromZillowApiResponse(data);
    }
  } catch {
    // API call failed, continue to other strategies
  }

  // Try alternative API endpoint
  try {
    const altApiUrl = `https://www.zillow.com/homedetails/${zpid}_zpid/`;
    const response = await fetch(altApiUrl, {
      headers: {
        'User-Agent': getRandomUserAgent(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      },
    });

    if (response.ok) {
      const html = await response.text();

      // Look for embedded data in the page
      const dataMatch = html.match(/<!--({[\s\S]*?"zpid"\s*:\s*\d+[\s\S]*?})-->/);
      if (dataMatch) {
        try {
          const data = JSON.parse(dataMatch[1]);
          const property = data.property || data.listing || data;
          if (property.zpid || property.price || property.address) {
            return extractPropertyFields(property);
          }
        } catch {
          // Continue
        }
      }
    }
  } catch {
    // Alternative API also failed
  }

  return null;
}

function extractFromZillowApiResponse(data: Record<string, unknown>): Partial<ScrapedPropertyData> | null {
  try {
    // Navigate the GraphQL response structure
    const property = (data.data as Record<string, unknown>)?.property as Record<string, unknown>
      || (data.property as Record<string, unknown>)
      || data;

    if (!property) return null;

    return extractPropertyFields(property);
  } catch {
    return null;
  }
}

// =============================================================================
// ZILLOW HTML SCRAPER (Multi-Strategy)
// =============================================================================

export function parseZillowHtml(html: string, url: string): ScrapedPropertyData | null {
  try {
    // Strategy 1: JSON-LD structured data
    const jsonLdMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
    if (jsonLdMatch) {
      for (const match of jsonLdMatch) {
        const jsonContent = match.replace(/<script[^>]*>|<\/script>/gi, '');
        try {
          const data = JSON.parse(jsonContent);
          if (data['@type'] === 'SingleFamilyResidence' || data['@type'] === 'Product' || data['@type'] === 'RealEstateListing') {
            return parseZillowJsonLd(data, url);
          }
        } catch {
          // Continue
        }
      }
    }

    // Strategy 2: Look for __NEXT_DATA__
    const nextDataMatch = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
    if (nextDataMatch) {
      try {
        const nextData = JSON.parse(nextDataMatch[1]);
        const propertyData = extractZillowFromNextData(nextData);
        if (propertyData && hasRequiredData(propertyData)) {
          return completePropertyData(propertyData, 'zillow', url);
        }
      } catch {
        // Continue
      }
    }

    // Strategy 3: Look for preloaded state
    const preloadedStatePatterns = [
      /window\.__PRELOADED_STATE__\s*=\s*"([^"]+)"/i,
      /window\.__PRELOADED_STATE__\s*=\s*({[\s\S]*?});?\s*<\/script>/i,
      /"apiCache"\s*:\s*"([^"]+)"/i,
    ];

    for (const pattern of preloadedStatePatterns) {
      const match = html.match(pattern);
      if (match) {
        try {
          let decoded = match[1];
          // Check if it's URI encoded
          if (decoded.includes('%')) {
            decoded = decodeURIComponent(decoded);
          }
          const data = typeof decoded === 'string' && decoded.startsWith('{')
            ? JSON.parse(decoded)
            : JSON.parse(`{${decoded}}`);
          const propertyData = extractZillowFromPreloadedState(data);
          if (propertyData && hasRequiredData(propertyData)) {
            return completePropertyData(propertyData, 'zillow', url);
          }
        } catch {
          // Continue
        }
      }
    }

    // Strategy 4: Look for inline property data in various formats
    const inlinePatterns = [
      /<!--({[\s\S]*?"streetAddress"[\s\S]*?})-->/i,
      /<!--({[\s\S]*?"zpid"\s*:\s*\d+[\s\S]*?})-->/i,
      /"props"\s*:\s*({[\s\S]*?"property"[\s\S]*?})\s*,\s*"page"/i,
      /data-zrr-shared-data-key="[^"]*"[^>]*>([^<]+)</i,
    ];

    for (const pattern of inlinePatterns) {
      const match = html.match(pattern);
      if (match) {
        try {
          let content = match[1];
          // Remove HTML comments if present
          content = content.replace(/<!--/g, '').replace(/-->/g, '');
          const data = JSON.parse(content);
          const property = data.property || data.apiCache?.property || data;
          if (property) {
            const propertyData = extractPropertyFields(property);
            if (hasRequiredData(propertyData)) {
              return completePropertyData(propertyData, 'zillow', url);
            }
          }
        } catch {
          // Continue
        }
      }
    }

    // Strategy 5: Look for Apollo state
    const apolloMatch = html.match(/window\.__APOLLO_STATE__\s*=\s*({[\s\S]*?});?\s*(?:<\/script>|window\.)/i);
    if (apolloMatch) {
      try {
        const apolloData = JSON.parse(apolloMatch[1]);
        const propertyData = extractZillowFromApollo(apolloData);
        if (propertyData && hasRequiredData(propertyData)) {
          return completePropertyData(propertyData, 'zillow', url);
        }
      } catch {
        // Continue
      }
    }

    // Strategy 6: Direct regex extraction from HTML (last resort)
    return parseZillowFromHtmlRegex(html, url);

  } catch (error) {
    console.error('Zillow parsing error:', error);
    return null;
  }
}

function parseZillowJsonLd(data: Record<string, unknown>, url: string): ScrapedPropertyData | null {
  try {
    const address = (data.address as Record<string, string>) || {};
    const fullAddress = [
      address.streetAddress,
      address.addressLocality,
      address.addressRegion,
      address.postalCode
    ].filter(Boolean).join(', ');

    return {
      address: fullAddress || 'Unknown Address',
      listPrice: parsePrice((data.offers as Record<string, unknown>)?.price as string || data.price as string),
      daysOnMarket: 0,
      bedrooms: extractNumber(data.numberOfRooms as string),
      bathrooms: extractNumber(data.numberOfBathroomsTotal as string),
      propertyType: normalizePropertyType(data['@type'] as string),
      squareFeet: extractNumber(data.floorSize as string),
      yearBuilt: extractNumber(data.yearBuilt as string),
      priceReduced: false,
      source: 'zillow',
      sourceUrl: url,
      scrapedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function extractZillowFromNextData(data: Record<string, unknown>): Partial<ScrapedPropertyData> | null {
  try {
    const props = data.props as Record<string, unknown>;
    const pageProps = props?.pageProps as Record<string, unknown>;
    const initialData = pageProps?.initialData as Record<string, unknown> | undefined;
    const property = (pageProps?.property || initialData?.property) as Record<string, unknown>;

    if (!property) return null;

    const priceHistory = property.priceHistory as unknown[] | undefined;
    const hasPriceReduction = Array.isArray(priceHistory) && priceHistory.length > 1;

    return {
      address: property.streetAddress as string || property.address as string || 'Unknown',
      listPrice: parsePrice(property.price as string || property.listPrice as string),
      daysOnMarket: extractNumber(property.daysOnZillow as string || property.timeOnZillow as string),
      bedrooms: extractNumber(property.bedrooms as string || property.beds as string),
      bathrooms: extractNumber(property.bathrooms as string || property.baths as string),
      propertyType: normalizePropertyType(property.homeType as string || property.propertyType as string),
      squareFeet: extractNumber(property.livingArea as string || property.sqft as string),
      yearBuilt: extractNumber(property.yearBuilt as string),
      priceReduced: hasPriceReduction,
      estimatedValue: parsePrice(property.zestimate as string),
    };
  } catch {
    return null;
  }
}

function extractZillowFromApollo(data: Record<string, unknown>): Partial<ScrapedPropertyData> | null {
  try {
    for (const [key, value] of Object.entries(data)) {
      if (key.includes('Property') && typeof value === 'object' && value !== null) {
        const prop = value as Record<string, unknown>;
        if (prop.streetAddress || prop.price) {
          return extractPropertyFields(prop);
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

function extractZillowFromPreloadedState(data: Record<string, unknown>): Partial<ScrapedPropertyData> | null {
  try {
    // Try multiple paths
    const paths = [
      data.gdp?.building,
      data.gdp?.property,
      data.property,
      data.cache,
    ];

    for (const path of paths) {
      if (path && typeof path === 'object') {
        const obj = path as Record<string, unknown>;
        if (obj.streetAddress || obj.price || obj.zpid) {
          return extractPropertyFields(obj);
        }
        // Check nested values
        for (const value of Object.values(obj)) {
          if (typeof value === 'object' && value !== null) {
            const nested = value as Record<string, unknown>;
            if (nested.streetAddress || nested.price || nested.zpid) {
              return extractPropertyFields(nested);
            }
          }
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

function extractPropertyFields(property: Record<string, unknown>): Partial<ScrapedPropertyData> {
  let address = 'Unknown';
  const addressObj = property.address as Record<string, unknown>;
  if (addressObj && typeof addressObj === 'object') {
    address = [
      addressObj.streetAddress,
      addressObj.city,
      addressObj.state,
      addressObj.zipcode
    ].filter(Boolean).join(', ') || 'Unknown';
  } else if (property.streetAddress) {
    address = property.streetAddress as string;
  } else if (property.fullAddress) {
    address = property.fullAddress as string;
  }

  let price = 0;
  if (property.price) {
    price = parsePrice(property.price as string);
  } else if (property.listPrice) {
    price = parsePrice(property.listPrice as string);
  } else {
    const priceObj = property.priceHistory as unknown[];
    if (Array.isArray(priceObj) && priceObj.length > 0) {
      const latest = priceObj[0] as Record<string, unknown>;
      price = parsePrice(latest.price as string);
    }
  }

  const priceHistory = property.priceHistory as unknown[];
  const hasPriceReduction = Array.isArray(priceHistory) && priceHistory.length > 1;

  return {
    address,
    listPrice: price,
    daysOnMarket: extractNumber(property.daysOnZillow as string || property.timeOnZillow as string || property.dom as string),
    bedrooms: extractNumber(property.bedrooms as string || property.beds as string),
    bathrooms: extractNumber(property.bathrooms as string || property.baths as string),
    propertyType: normalizePropertyType(property.homeType as string || property.propertyType as string || property.homeStatus as string),
    squareFeet: extractNumber(property.livingArea as string || property.livingAreaValue as string || property.sqft as string),
    yearBuilt: extractNumber(property.yearBuilt as string),
    priceReduced: hasPriceReduction,
    estimatedValue: parsePrice(property.zestimate as string || property.rentZestimate as string),
  };
}

function parseZillowFromHtmlRegex(html: string, url: string): ScrapedPropertyData | null {
  try {
    // Aggressive price extraction
    let price = 0;
    const pricePatterns = [
      /\$\s*([\d,]+)(?:,000)?/g,
      /"price"\s*:\s*"?\$?([\d,]+)/gi,
      /class="[^"]*price[^"]*"[^>]*>\s*\$?([\d,]+)/gi,
      /data-testid="[^"]*price[^"]*"[^>]*>\s*\$?([\d,]+)/gi,
      /itemprop="price"[^>]*content="([\d,]+)"/gi,
    ];

    for (const pattern of pricePatterns) {
      const matches = html.matchAll(pattern);
      for (const match of matches) {
        const parsed = parsePrice(match[1]);
        if (parsed > 50000 && parsed < 100000000) { // Reasonable home price range
          price = parsed;
          break;
        }
      }
      if (price > 0) break;
    }

    // Aggressive address extraction
    let address = '';
    const addressPatterns = [
      /<title[^>]*>([^|<]+)/i,
      /"streetAddress"\s*:\s*"([^"]+)"/i,
      /class="[^"]*address[^"]*"[^>]*>([^<]+)/i,
      /<h1[^>]*>([^<]*(?:St|Ave|Rd|Dr|Ln|Ct|Blvd|Way|Pl|Circle|Court)[^<]*)</i,
      /itemprop="streetAddress"[^>]*>([^<]+)/i,
    ];

    for (const pattern of addressPatterns) {
      const match = html.match(pattern);
      if (match && match[1].trim().length > 5) {
        address = match[1].trim().split('|')[0].split(' - ')[0].trim();
        // Clean up common suffixes
        address = address.replace(/\s*[|]\s*Zillow.*$/i, '').trim();
        if (address.length > 5) break;
      }
    }

    // If still no address, try URL extraction
    if (!address) {
      address = extractAddressFromZillowUrl(url);
    }

    // Extract beds/baths/sqft
    let beds = 0, baths = 0, sqft: number | undefined;

    const bedsMatch = html.match(/(\d+)\s*(?:bd|bed|bedroom|br)\b/i);
    if (bedsMatch) beds = parseInt(bedsMatch[1]);

    const bathsMatch = html.match(/(\d+(?:\.\d+)?)\s*(?:ba|bath|bathroom)\b/i);
    if (bathsMatch) baths = parseFloat(bathsMatch[1]);

    const sqftMatch = html.match(/([\d,]+)\s*(?:sq\.?\s*ft|sqft|square\s*feet)/i);
    if (sqftMatch) sqft = parseInt(sqftMatch[1].replace(/,/g, ''));

    // Days on market
    let dom = 0;
    const domMatch = html.match(/(\d+)\s*days?\s*(?:on\s*)?(?:zillow|market)/i);
    if (domMatch) dom = parseInt(domMatch[1]);

    // Need at least some useful data
    if (!price && !address) {
      return null;
    }

    return {
      address: address || 'Unknown Address',
      listPrice: price,
      daysOnMarket: dom,
      bedrooms: beds,
      bathrooms: baths,
      propertyType: 'other',
      squareFeet: sqft,
      priceReduced: /price\s*(cut|drop|reduced)/i.test(html),
      source: 'zillow',
      sourceUrl: url,
      scrapedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

// =============================================================================
// REDFIN SCRAPER
// =============================================================================

export function parseRedfinHtml(html: string, url: string): ScrapedPropertyData | null {
  try {
    // Strategy 1: JSON-LD
    const jsonLdMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
    if (jsonLdMatch) {
      for (const match of jsonLdMatch) {
        const jsonContent = match.replace(/<script[^>]*>|<\/script>/gi, '');
        try {
          const data = JSON.parse(jsonContent);
          if (data['@type'] === 'SingleFamilyResidence' || data['@type'] === 'Product' || data['@type'] === 'Residence') {
            return parseRedfinJsonLd(data, url);
          }
          if (Array.isArray(data)) {
            for (const item of data) {
              if (item['@type']?.includes('Residence') || item['@type'] === 'Product') {
                return parseRedfinJsonLd(item, url);
              }
            }
          }
        } catch {
          // Continue
        }
      }
    }

    // Strategy 2: Redfin server state
    const serverStateMatch = html.match(/window\.__reactServerState\s*=\s*({[\s\S]*?});?\s*<\/script>/i);
    if (serverStateMatch) {
      try {
        const data = JSON.parse(serverStateMatch[1]);
        const propertyData = extractRedfinFromServerState(data);
        if (propertyData && hasRequiredData(propertyData)) {
          return completePropertyData(propertyData, 'redfin', url);
        }
      } catch {
        // Continue
      }
    }

    // Strategy 3: Inline data
    const inlineMatch = html.match(/(?:initialData|propertyData)\s*[=:]\s*({[\s\S]*?})\s*[,;]/i);
    if (inlineMatch) {
      try {
        const data = JSON.parse(inlineMatch[1]);
        return parseRedfinInlineData(data, url);
      } catch {
        // Continue
      }
    }

    // Strategy 4: HTML fallback
    return parseRedfinFromHtml(html, url);

  } catch (error) {
    console.error('Redfin parsing error:', error);
    return null;
  }
}

function parseRedfinJsonLd(data: Record<string, unknown>, url: string): ScrapedPropertyData | null {
  try {
    const address = (data.address as Record<string, string>) || {};
    const fullAddress = [
      address.streetAddress,
      address.addressLocality,
      address.addressRegion,
      address.postalCode
    ].filter(Boolean).join(', ');

    const offers = data.offers as Record<string, unknown>;

    return {
      address: fullAddress || 'Unknown Address',
      listPrice: parsePrice(offers?.price as string || data.price as string),
      daysOnMarket: extractNumber(data.daysOnMarket as string),
      bedrooms: extractNumber(data.numberOfBedrooms as string || data.numberOfRooms as string),
      bathrooms: extractNumber(data.numberOfBathroomsTotal as string || data.numberOfFullBathrooms as string),
      propertyType: normalizePropertyType(data['@type'] as string || data.propertyType as string),
      squareFeet: extractNumber((data.floorSize as Record<string, string>)?.value || data.floorSize as string),
      yearBuilt: extractNumber(data.yearBuilt as string),
      priceReduced: false,
      source: 'redfin',
      sourceUrl: url,
      scrapedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function extractRedfinFromServerState(data: Record<string, unknown>): Partial<ScrapedPropertyData> | null {
  try {
    const findProperty = (obj: Record<string, unknown>): Record<string, unknown> | null => {
      if (obj.propertyId || obj.listingId || obj.streetAddress) {
        return obj;
      }
      for (const value of Object.values(obj)) {
        if (typeof value === 'object' && value !== null) {
          const result = findProperty(value as Record<string, unknown>);
          if (result) return result;
        }
      }
      return null;
    };

    const property = findProperty(data);
    if (!property) return null;

    const priceInfo = property.priceInfo as Record<string, unknown> | undefined;
    const avm = property.avm as Record<string, unknown> | undefined;

    return {
      address: (property.streetAddress || property.address || property.fullAddress) as string || 'Unknown',
      listPrice: parsePrice(property.price as string || property.listPrice as string || priceInfo?.amount as string),
      daysOnMarket: extractNumber(property.dom as string || property.daysOnMarket as string || property.timeOnRedfin as string),
      bedrooms: extractNumber(property.beds as string || property.numBeds as string),
      bathrooms: extractNumber(property.baths as string || property.numBaths as string),
      propertyType: normalizePropertyType(property.propertyType as string || property.homeType as string),
      squareFeet: extractNumber(property.sqFt as string || property.sqft as string || property.livingArea as string),
      yearBuilt: extractNumber(property.yearBuilt as string),
      priceReduced: Boolean(property.priceDropInfo || property.isPriceDrop),
      estimatedValue: parsePrice(avm?.price as string || property.redfinEstimate as string),
    };
  } catch {
    return null;
  }
}

function parseRedfinInlineData(data: Record<string, unknown>, url: string): ScrapedPropertyData | null {
  try {
    return {
      address: (data.streetAddress || data.address || data.fullAddress || 'Unknown') as string,
      listPrice: parsePrice(data.price as string || data.listPrice as string),
      daysOnMarket: extractNumber(data.dom as string || data.daysOnMarket as string),
      bedrooms: extractNumber(data.beds as string || data.numBeds as string),
      bathrooms: extractNumber(data.baths as string || data.numBaths as string),
      propertyType: normalizePropertyType(data.propertyType as string),
      squareFeet: extractNumber(data.sqFt as string || data.sqft as string),
      yearBuilt: extractNumber(data.yearBuilt as string),
      priceReduced: Boolean(data.priceDropInfo),
      source: 'redfin',
      sourceUrl: url,
      scrapedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function parseRedfinFromHtml(html: string, url: string): ScrapedPropertyData | null {
  try {
    const priceMatch = html.match(/\$[\d,]+(?:\.\d{2})?/);
    const price = priceMatch ? parsePrice(priceMatch[0]) : 0;

    const titleMatch = html.match(/<title[^>]*>([^<]+)</i);
    const addressFromTitle = titleMatch ? titleMatch[1].split('|')[0].split('-')[0].trim() : '';

    const bedsMatch = html.match(/(\d+)\s*(?:bed|br|bedroom)/i);
    const bathsMatch = html.match(/(\d+(?:\.\d+)?)\s*(?:bath|ba|bathroom)/i);
    const domMatch = html.match(/(\d+)\s*days?\s*(?:on\s*)?redfin/i);
    const sqftMatch = html.match(/([\d,]+)\s*(?:sq\.?\s*ft|sqft|square\s*feet)/i);

    if (!price && !addressFromTitle) return null;

    return {
      address: addressFromTitle || 'Address from URL',
      listPrice: price,
      daysOnMarket: domMatch ? parseInt(domMatch[1]) : 0,
      bedrooms: bedsMatch ? parseInt(bedsMatch[1]) : 0,
      bathrooms: bathsMatch ? parseFloat(bathsMatch[1]) : 0,
      propertyType: 'other',
      squareFeet: sqftMatch ? parseInt(sqftMatch[1].replace(/,/g, '')) : undefined,
      priceReduced: /price\s*(drop|reduced)/i.test(html),
      source: 'redfin',
      sourceUrl: url,
      scrapedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

// =============================================================================
// MAIN SCRAPER FUNCTION (AGGRESSIVE MULTI-STRATEGY)
// =============================================================================

export async function scrapeProperty(url: string): Promise<ScrapedPropertyData | null> {
  const source = detectSource(url);

  if (!source) {
    throw new Error('UNSUPPORTED_SITE');
  }

  // For Zillow, try API-first approach
  if (source === 'zillow') {
    const zpid = extractZpid(url);

    // Strategy 1: Try Zillow API with ZPID
    if (zpid) {
      const apiData = await fetchZillowFromApi(zpid);
      if (apiData && hasRequiredData(apiData)) {
        return completePropertyData(apiData, 'zillow', url);
      }
    }
  }

  // Strategy 2: Fetch and parse HTML with rotating user agents
  const userAgents = [...USER_AGENTS];
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const userAgent = userAgents[attempt % userAgents.length];

      const response = await fetch(url, {
        headers: {
          'User-Agent': userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
        },
      });

      if (!response.ok) {
        if (response.status === 403 || response.status === 429) {
          // Rate limited or blocked, try next user agent
          await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
          continue;
        }
        throw new Error('FETCH_FAILED');
      }

      const html = await response.text();

      // Check if we got a captcha/blocked page
      if (html.includes('captcha') || html.includes('blocked') || html.includes('Access Denied')) {
        await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
        continue;
      }

      // Parse based on source
      let data: ScrapedPropertyData | null = null;

      if (source === 'zillow') {
        data = parseZillowHtml(html, url);
      } else if (source === 'redfin') {
        data = parseRedfinHtml(html, url);
      }

      if (data) {
        return data;
      }
    } catch (error) {
      lastError = error as Error;
    }
  }

  // Strategy 3: For Zillow, try URL-based fallback
  if (source === 'zillow') {
    const addressFromUrl = extractAddressFromZillowUrl(url);
    if (addressFromUrl) {
      return {
        address: addressFromUrl,
        listPrice: 0, // User will need to enter manually
        daysOnMarket: 0,
        bedrooms: 0,
        bathrooms: 0,
        propertyType: 'other',
        priceReduced: false,
        source: 'zillow',
        sourceUrl: url,
        scrapedAt: new Date().toISOString(),
        // Flag that this is partial data
      } as ScrapedPropertyData;
    }
  }

  if (lastError) {
    throw lastError;
  }

  throw new Error('PARSE_FAILED');
}
