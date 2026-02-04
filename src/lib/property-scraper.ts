/**
 * Property Scraper for Zillow and Redfin
 *
 * Extracts property data from listing URLs using multiple parsing strategies:
 * 1. JSON-LD structured data (most reliable)
 * 2. Embedded JavaScript data objects
 * 3. HTML meta tags and content parsing (fallback)
 */

import { ScrapedPropertyData } from './scraper-types';

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Detect the source website from URL
 */
export function detectSource(url: string): 'zillow' | 'redfin' | null {
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes('zillow.com')) return 'zillow';
  if (lowerUrl.includes('redfin.com')) return 'redfin';
  return null;
}

/**
 * Parse a price string to number
 */
function parsePrice(priceStr: string | number | undefined | null): number {
  if (typeof priceStr === 'number') return priceStr;
  if (!priceStr) return 0;
  const cleaned = String(priceStr).replace(/[^0-9.]/g, '');
  return parseInt(cleaned) || 0;
}

/**
 * Normalize property type string
 */
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

/**
 * Extract number from string
 */
function extractNumber(str: string | undefined | null): number {
  if (!str) return 0;
  const match = String(str).match(/[\d.]+/);
  return match ? parseFloat(match[0]) : 0;
}

/**
 * Convert partial scraped data to full ScrapedPropertyData with defaults
 */
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

/**
 * Check if partial data has enough information to be useful
 */
function hasRequiredData(partial: Partial<ScrapedPropertyData>): boolean {
  // Need at least an address or a price to be useful
  return Boolean(partial.address || partial.listPrice);
}

// =============================================================================
// ZILLOW SCRAPER
// =============================================================================

/**
 * Parse Zillow listing page
 */
export function parseZillowHtml(html: string, url: string): ScrapedPropertyData | null {
  try {
    // Strategy 1: Look for JSON-LD structured data
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
          // Continue to next match
        }
      }
    }

    // Strategy 2: Look for embedded __NEXT_DATA__ or similar
    const nextDataMatch = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
    if (nextDataMatch) {
      try {
        const nextData = JSON.parse(nextDataMatch[1]);
        const propertyData = extractZillowFromNextData(nextData);
        if (propertyData && hasRequiredData(propertyData)) {
          return completePropertyData(propertyData, 'zillow', url);
        }
      } catch {
        // Continue to fallback
      }
    }

    // Strategy 3: Look for preloaded state (Zillow's primary data source)
    const preloadedStateMatch = html.match(/window\.__PRELOADED_STATE__\s*=\s*"([^"]+)"/i);
    if (preloadedStateMatch) {
      try {
        // Zillow encodes this as a URI-encoded JSON string
        const decoded = decodeURIComponent(preloadedStateMatch[1]);
        const preloadedData = JSON.parse(decoded);
        const propertyData = extractZillowFromPreloadedState(preloadedData);
        if (propertyData && hasRequiredData(propertyData)) {
          return completePropertyData(propertyData, 'zillow', url);
        }
      } catch {
        // Continue to fallback
      }
    }

    // Strategy 4: Look for data in data-zrr-shared-data-key attribute
    const sharedDataMatch = html.match(/data-zrr-shared-data-key="[^"]*"[^>]*>([^<]+)</i);
    if (sharedDataMatch) {
      try {
        const decoded = sharedDataMatch[1].replace(/<!--/g, '').replace(/-->/g, '');
        const sharedData = JSON.parse(decoded);
        const propertyData = extractZillowFromSharedData(sharedData);
        if (propertyData && hasRequiredData(propertyData)) {
          return completePropertyData(propertyData, 'zillow', url);
        }
      } catch {
        // Continue to fallback
      }
    }

    // Strategy 5: Look for preloaded Apollo state or similar data
    const apolloMatch = html.match(/window\.__APOLLO_STATE__\s*=\s*({[\s\S]*?});?\s*(?:<\/script>|window\.)/i);
    if (apolloMatch) {
      try {
        const apolloData = JSON.parse(apolloMatch[1]);
        const propertyData = extractZillowFromApollo(apolloData);
        if (propertyData && hasRequiredData(propertyData)) {
          return completePropertyData(propertyData, 'zillow', url);
        }
      } catch {
        // Continue to fallback
      }
    }

    // Strategy 6: Look for gdpClientCache (newer Zillow pages)
    const gdpCacheMatch = html.match(/gdpClientCache\s*[=:]\s*({[\s\S]*?})\s*[,;]?\s*(?:<\/script>|window\.|var\s)/i);
    if (gdpCacheMatch) {
      try {
        const cacheData = JSON.parse(gdpCacheMatch[1]);
        const propertyData = extractZillowFromGdpCache(cacheData);
        if (propertyData && hasRequiredData(propertyData)) {
          return completePropertyData(propertyData, 'zillow', url);
        }
      } catch {
        // Continue to fallback
      }
    }

    // Strategy 7: Look for inline script with property data
    const inlineDataMatch = html.match(/(?:zpid|propertyData|listingData)\s*[=:]\s*({[\s\S]*?})\s*[,;]/i);
    if (inlineDataMatch) {
      try {
        const data = JSON.parse(inlineDataMatch[1]);
        return parseZillowInlineData(data, url);
      } catch {
        // Continue to fallback
      }
    }

    // Strategy 8: HTML parsing fallback (enhanced)
    return parseZillowFromHtml(html, url);

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
      daysOnMarket: 0, // JSON-LD usually doesn't have this
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
    // Navigate through Next.js data structure
    const props = data.props as Record<string, unknown>;
    const pageProps = props?.pageProps as Record<string, unknown>;
    const initialData = pageProps?.initialData as Record<string, unknown> | undefined;
    const property = (pageProps?.property || initialData?.property) as Record<string, unknown>;

    if (!property) return null;

    // Check for price history to determine if price was reduced
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
    // Look for property data in Apollo cache
    for (const [key, value] of Object.entries(data)) {
      if (key.includes('Property') && typeof value === 'object' && value !== null) {
        const prop = value as Record<string, unknown>;
        if (prop.streetAddress || prop.price) {
          return {
            address: prop.streetAddress as string || 'Unknown',
            listPrice: parsePrice(prop.price as string),
            daysOnMarket: extractNumber(prop.daysOnZillow as string),
            bedrooms: extractNumber(prop.bedrooms as string),
            bathrooms: extractNumber(prop.bathrooms as string),
            propertyType: normalizePropertyType(prop.homeType as string),
            squareFeet: extractNumber(prop.livingArea as string),
            yearBuilt: extractNumber(prop.yearBuilt as string),
            priceReduced: false,
            estimatedValue: parsePrice(prop.zestimate as string),
          };
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
    // Navigate through Zillow's preloaded state structure
    // Try multiple possible paths where property data might be
    const gdp = data.gdp as Record<string, unknown>;
    const building = gdp?.building as Record<string, unknown>;
    const property = (building || gdp?.property || data.property) as Record<string, unknown>;

    if (!property) {
      // Try to find property in cache
      const cache = data.cache as Record<string, unknown>;
      if (cache) {
        for (const value of Object.values(cache)) {
          if (typeof value === 'object' && value !== null) {
            const obj = value as Record<string, unknown>;
            if (obj.streetAddress || obj.price || obj.zpid) {
              return extractPropertyFields(obj);
            }
          }
        }
      }
      return null;
    }

    return extractPropertyFields(property);
  } catch {
    return null;
  }
}

function extractZillowFromSharedData(data: Record<string, unknown>): Partial<ScrapedPropertyData> | null {
  try {
    // Zillow shared data can have various structures
    const apiCache = data.apiCache as string;
    if (apiCache) {
      try {
        const cacheData = JSON.parse(apiCache);
        for (const value of Object.values(cacheData)) {
          if (typeof value === 'object' && value !== null) {
            const obj = value as Record<string, unknown>;
            const property = obj.property as Record<string, unknown>;
            if (property) {
              return extractPropertyFields(property);
            }
          }
        }
      } catch {
        // Continue
      }
    }

    // Direct property access
    const property = data.property as Record<string, unknown>;
    if (property) {
      return extractPropertyFields(property);
    }

    return null;
  } catch {
    return null;
  }
}

function extractZillowFromGdpCache(data: Record<string, unknown>): Partial<ScrapedPropertyData> | null {
  try {
    // gdpClientCache contains stringified JSON values
    for (const value of Object.values(data)) {
      if (typeof value === 'string') {
        try {
          const parsed = JSON.parse(value);
          const property = parsed.property as Record<string, unknown>;
          if (property) {
            return extractPropertyFields(property);
          }
        } catch {
          // Continue
        }
      } else if (typeof value === 'object' && value !== null) {
        const obj = value as Record<string, unknown>;
        const property = obj.property as Record<string, unknown>;
        if (property) {
          return extractPropertyFields(property);
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Helper to extract common property fields from various Zillow data structures
 */
function extractPropertyFields(property: Record<string, unknown>): Partial<ScrapedPropertyData> {
  // Handle nested address object or direct address string
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

  // Handle price which may be nested
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

  // Check for price reduction
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

function parseZillowInlineData(data: Record<string, unknown>, url: string): ScrapedPropertyData | null {
  try {
    return {
      address: (data.streetAddress || data.address || 'Unknown') as string,
      listPrice: parsePrice(data.price as string || data.listPrice as string),
      daysOnMarket: extractNumber(data.daysOnZillow as string || data.timeOnZillow as string),
      bedrooms: extractNumber(data.bedrooms as string || data.beds as string),
      bathrooms: extractNumber(data.bathrooms as string || data.baths as string),
      propertyType: normalizePropertyType(data.homeType as string),
      squareFeet: extractNumber(data.livingArea as string || data.sqft as string),
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

function parseZillowFromHtml(html: string, url: string): ScrapedPropertyData | null {
  try {
    // Extract price from multiple patterns (Zillow uses various formats)
    let price = 0;
    const pricePatterns = [
      /class="[^"]*price[^"]*"[^>]*>\s*\$?([\d,]+)/i,
      /data-testid="[^"]*price[^"]*"[^>]*>\s*\$?([\d,]+)/i,
      /\$\s*([\d,]+(?:,\d{3})*)/,
      /"price"\s*:\s*"?\$?([\d,]+)/i,
      /itemprop="price"[^>]*content="([\d,]+)"/i,
    ];
    for (const pattern of pricePatterns) {
      const match = html.match(pattern);
      if (match) {
        price = parsePrice(match[1]);
        if (price > 10000) break; // Likely a real price, not a count
      }
    }

    // Extract address from multiple sources
    let address = '';
    const addressPatterns = [
      /<title[^>]*>([^|<]+)/i,
      /class="[^"]*address[^"]*"[^>]*>([^<]+)/i,
      /data-testid="[^"]*address[^"]*"[^>]*>([^<]+)/i,
      /"streetAddress"\s*:\s*"([^"]+)"/i,
      /itemprop="streetAddress"[^>]*>([^<]+)/i,
      /<h1[^>]*>([^<]+(?:St|Ave|Rd|Dr|Ln|Ct|Blvd|Way|Pl)[^<]*)</i,
    ];
    for (const pattern of addressPatterns) {
      const match = html.match(pattern);
      if (match && match[1].trim().length > 5) {
        address = match[1].trim().split('|')[0].split('-')[0].trim();
        break;
      }
    }

    // Extract beds from multiple patterns
    let beds = 0;
    const bedsPatterns = [
      /(\d+)\s*(?:bd|bed|bedroom|br)\b/i,
      /"bedrooms?"\s*:\s*(\d+)/i,
      /data-testid="[^"]*bed[^"]*"[^>]*>(\d+)/i,
    ];
    for (const pattern of bedsPatterns) {
      const match = html.match(pattern);
      if (match) {
        beds = parseInt(match[1]);
        if (beds > 0 && beds < 20) break;
      }
    }

    // Extract baths from multiple patterns
    let baths = 0;
    const bathsPatterns = [
      /(\d+(?:\.\d+)?)\s*(?:ba|bath|bathroom)\b/i,
      /"bathrooms?"\s*:\s*(\d+(?:\.\d+)?)/i,
      /data-testid="[^"]*bath[^"]*"[^>]*>(\d+(?:\.\d+)?)/i,
    ];
    for (const pattern of bathsPatterns) {
      const match = html.match(pattern);
      if (match) {
        baths = parseFloat(match[1]);
        if (baths > 0 && baths < 20) break;
      }
    }

    // Extract days on market
    let dom = 0;
    const domPatterns = [
      /(\d+)\s*days?\s*(?:on\s*)?zillow/i,
      /(\d+)\s*days?\s*(?:on\s*)?market/i,
      /"daysOnZillow"\s*:\s*(\d+)/i,
      /"timeOnZillow"\s*:\s*"(\d+)/i,
    ];
    for (const pattern of domPatterns) {
      const match = html.match(pattern);
      if (match) {
        dom = parseInt(match[1]);
        break;
      }
    }

    // Extract sqft
    let sqft: number | undefined;
    const sqftPatterns = [
      /([\d,]+)\s*(?:sq\.?\s*ft|sqft|square\s*feet)/i,
      /"livingArea"\s*:\s*([\d,]+)/i,
      /"livingAreaValue"\s*:\s*([\d,]+)/i,
    ];
    for (const pattern of sqftPatterns) {
      const match = html.match(pattern);
      if (match) {
        sqft = parseInt(match[1].replace(/,/g, ''));
        if (sqft > 100) break;
      }
    }

    // Need at least price or address to be useful
    if (!price && !address) {
      return null;
    }

    return {
      address: address || 'Address from URL',
      listPrice: price,
      daysOnMarket: dom,
      bedrooms: beds,
      bathrooms: baths,
      propertyType: 'other',
      squareFeet: sqft,
      priceReduced: html.toLowerCase().includes('price cut') || html.toLowerCase().includes('reduced') || html.toLowerCase().includes('price drop'),
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

/**
 * Parse Redfin listing page
 */
export function parseRedfinHtml(html: string, url: string): ScrapedPropertyData | null {
  try {
    // Strategy 1: Look for JSON-LD structured data
    const jsonLdMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
    if (jsonLdMatch) {
      for (const match of jsonLdMatch) {
        const jsonContent = match.replace(/<script[^>]*>|<\/script>/gi, '');
        try {
          const data = JSON.parse(jsonContent);
          if (data['@type'] === 'SingleFamilyResidence' || data['@type'] === 'Product' || data['@type'] === 'Residence') {
            return parseRedfinJsonLd(data, url);
          }
          // Redfin sometimes wraps in array
          if (Array.isArray(data)) {
            for (const item of data) {
              if (item['@type']?.includes('Residence') || item['@type'] === 'Product') {
                return parseRedfinJsonLd(item, url);
              }
            }
          }
        } catch {
          // Continue to next match
        }
      }
    }

    // Strategy 2: Look for Redfin's embedded data
    const redfinDataMatch = html.match(/window\.__reactServerState\s*=\s*({[\s\S]*?});?\s*<\/script>/i);
    if (redfinDataMatch) {
      try {
        const data = JSON.parse(redfinDataMatch[1]);
        const propertyData = extractRedfinFromServerState(data);
        if (propertyData && hasRequiredData(propertyData)) {
          return completePropertyData(propertyData, 'redfin', url);
        }
      } catch {
        // Continue to fallback
      }
    }

    // Strategy 3: Look for initialData or propertyData
    const initialDataMatch = html.match(/(?:initialData|propertyData|listingData)\s*[=:]\s*({[\s\S]*?})\s*[,;]/i);
    if (initialDataMatch) {
      try {
        const data = JSON.parse(initialDataMatch[1]);
        return parseRedfinInlineData(data, url);
      } catch {
        // Continue to fallback
      }
    }

    // Strategy 4: HTML parsing fallback
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
    // Navigate Redfin's data structure (varies by page type)
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

    // Extract nested price info
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
    // Extract price
    const priceMatch = html.match(/\$[\d,]+(?:\.\d{2})?/);
    const price = priceMatch ? parsePrice(priceMatch[0]) : 0;

    // Extract address from title or specific Redfin elements
    const titleMatch = html.match(/<title[^>]*>([^<]+)</i);
    const addressFromTitle = titleMatch ? titleMatch[1].split('|')[0].split('-')[0].trim() : '';

    // Extract beds/baths
    const bedsMatch = html.match(/(\d+)\s*(?:bed|br|bedroom)/i);
    const bathsMatch = html.match(/(\d+(?:\.\d+)?)\s*(?:bath|ba|bathroom)/i);

    // Extract days on Redfin
    const domMatch = html.match(/(\d+)\s*days?\s*(?:on\s*)?redfin/i);

    // Extract sqft
    const sqftMatch = html.match(/([\d,]+)\s*(?:sq\.?\s*ft|sqft|square\s*feet)/i);

    if (!price && !addressFromTitle) {
      return null;
    }

    return {
      address: addressFromTitle || 'Address from URL',
      listPrice: price,
      daysOnMarket: domMatch ? parseInt(domMatch[1]) : 0,
      bedrooms: bedsMatch ? parseInt(bedsMatch[1]) : 0,
      bathrooms: bathsMatch ? parseFloat(bathsMatch[1]) : 0,
      propertyType: 'other',
      squareFeet: sqftMatch ? parseInt(sqftMatch[1].replace(/,/g, '')) : undefined,
      priceReduced: html.toLowerCase().includes('price drop') || html.toLowerCase().includes('reduced'),
      source: 'redfin',
      sourceUrl: url,
      scrapedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

// =============================================================================
// MAIN SCRAPER FUNCTION
// =============================================================================

/**
 * Scrape property data from a Zillow or Redfin URL
 */
export async function scrapeProperty(url: string): Promise<ScrapedPropertyData | null> {
  const source = detectSource(url);

  if (!source) {
    throw new Error('UNSUPPORTED_SITE');
  }

  // Fetch the page with appropriate headers
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Cache-Control': 'max-age=0',
    },
  });

  if (!response.ok) {
    throw new Error('FETCH_FAILED');
  }

  const html = await response.text();

  // Parse based on source
  let data: ScrapedPropertyData | null = null;

  if (source === 'zillow') {
    data = parseZillowHtml(html, url);
  } else if (source === 'redfin') {
    data = parseRedfinHtml(html, url);
  }

  if (!data) {
    throw new Error('PARSE_FAILED');
  }

  return data;
}
