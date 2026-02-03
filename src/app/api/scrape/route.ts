/**
 * Property Scraping API Route
 *
 * POST /api/scrape
 * Body: { url: string }
 *
 * Returns property data from Zillow or Redfin listings
 */

import { NextRequest, NextResponse } from 'next/server';
import { scrapeProperty, detectSource } from '@/lib/property-scraper';
import { ScrapeResponse } from '@/lib/scraper-types';

export async function POST(request: NextRequest): Promise<NextResponse<ScrapeResponse>> {
  try {
    const body = await request.json();
    const { url } = body;

    // Validate URL
    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'Please provide a valid URL',
          errorCode: 'INVALID_URL',
        },
        { status: 400 }
      );
    }

    // Check if it's a supported site
    const source = detectSource(url);
    if (!source) {
      return NextResponse.json(
        {
          success: false,
          error: 'Only Zillow and Redfin URLs are supported',
          errorCode: 'UNSUPPORTED_SITE',
        },
        { status: 400 }
      );
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid URL format',
          errorCode: 'INVALID_URL',
        },
        { status: 400 }
      );
    }

    // Scrape the property
    const data = await scrapeProperty(url);

    if (!data) {
      return NextResponse.json(
        {
          success: false,
          error: 'Could not extract property data from this listing. The page format may have changed.',
          errorCode: 'PARSE_FAILED',
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
    });

  } catch (error) {
    console.error('Scraping error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (errorMessage === 'UNSUPPORTED_SITE') {
      return NextResponse.json(
        {
          success: false,
          error: 'Only Zillow and Redfin URLs are supported',
          errorCode: 'UNSUPPORTED_SITE',
        },
        { status: 400 }
      );
    }

    if (errorMessage === 'FETCH_FAILED') {
      return NextResponse.json(
        {
          success: false,
          error: 'Could not fetch the listing page. The URL may be invalid or the site may be blocking requests.',
          errorCode: 'FETCH_FAILED',
        },
        { status: 502 }
      );
    }

    if (errorMessage === 'PARSE_FAILED') {
      return NextResponse.json(
        {
          success: false,
          error: 'Could not extract property data from this listing.',
          errorCode: 'PARSE_FAILED',
        },
        { status: 422 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'An unexpected error occurred. Please try again.',
        errorCode: 'PARSE_FAILED',
      },
      { status: 500 }
    );
  }
}
