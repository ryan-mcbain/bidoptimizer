'use client';

import React, { useState } from 'react';
import { BidFormData } from '@/lib/types';
import { CurrencyInput, InfoBox } from '@/components/ui';
import { ScrapeResponse, ScrapedPropertyData } from '@/lib/scraper-types';

interface PropertyDetailsProps {
  /** Current form data */
  formData: BidFormData;
  /** Update a single field */
  updateField: <K extends keyof BidFormData>(field: K, value: BidFormData[K]) => void;
}

/**
 * Step 1: Property Details Form
 *
 * Collects basic information about the property:
 * - Optional: Zillow/Redfin URL for auto-fill
 * - Address
 * - List price
 * - Property type
 * - Days on market
 * - Price reduction status
 */
export function PropertyDetails({ formData, updateField }: PropertyDetailsProps) {
  const [listingUrl, setListingUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [scrapeError, setScrapeError] = useState<string | null>(null);
  const [scrapeSuccess, setScrapeSuccess] = useState(false);

  /**
   * Handle auto-fill from listing URL
   */
  const handleAutoFill = async () => {
    if (!listingUrl.trim()) {
      setScrapeError('Please enter a Zillow or Redfin URL');
      return;
    }

    setIsLoading(true);
    setScrapeError(null);
    setScrapeSuccess(false);

    try {
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: listingUrl.trim() }),
      });

      const result: ScrapeResponse = await response.json();

      if (result.success) {
        applyScrapedData(result.data);
        setScrapeSuccess(true);
        setTimeout(() => setScrapeSuccess(false), 5000);
      } else {
        setScrapeError(result.error);
      }
    } catch (error) {
      console.error('Scrape error:', error);
      setScrapeError('Failed to fetch listing data. Please try again or enter details manually.');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Apply scraped data to form fields
   */
  const applyScrapedData = (data: ScrapedPropertyData) => {
    if (data.address) updateField('address', data.address);
    if (data.listPrice) updateField('listPrice', data.listPrice);
    if (data.daysOnMarket) updateField('daysOnMarket', data.daysOnMarket);
    if (data.propertyType && data.propertyType !== 'other') {
      updateField('propertyType', data.propertyType);
    }
    updateField('priceReduced', data.priceReduced);

    // Also update estimated value if available
    if (data.estimatedValue) {
      updateField('estimatedValue', data.estimatedValue);
    } else if (data.listPrice) {
      // Default estimated value to list price as starting point
      updateField('estimatedValue', data.listPrice);
    }
  };

  /**
   * Detect if URL looks valid for scraping
   */
  const isValidListingUrl = (url: string): boolean => {
    const lower = url.toLowerCase();
    return lower.includes('zillow.com') || lower.includes('redfin.com');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Property Details</h2>
        <p className="text-slate-600 mt-1">
          Enter information about the property you&apos;re considering.
        </p>
      </div>

      {/* Auto-fill Section */}
      <div className="bg-gradient-to-r from-emerald-50 to-blue-50 border border-emerald-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">🔗</span>
          <h3 className="font-medium text-slate-800">Quick Import (Optional)</h3>
        </div>
        <p className="text-sm text-slate-600 mb-3">
          Paste a Zillow or Redfin listing URL to auto-fill property details
        </p>

        <div className="flex gap-2">
          <input
            type="url"
            value={listingUrl}
            onChange={(e) => {
              setListingUrl(e.target.value);
              setScrapeError(null);
            }}
            placeholder="https://www.zillow.com/homedetails/..."
            className="flex-1 p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
          />
          <button
            onClick={handleAutoFill}
            disabled={isLoading || !listingUrl.trim()}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all whitespace-nowrap
              ${isLoading
                ? 'bg-slate-300 text-slate-500 cursor-wait'
                : !listingUrl.trim()
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm'
              }`}
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Importing...
              </span>
            ) : (
              'Auto-fill'
            )}
          </button>
        </div>

        {/* URL validation hint */}
        {listingUrl && !isValidListingUrl(listingUrl) && (
          <p className="text-xs text-amber-600 mt-2">
            ⚠️ Please enter a Zillow or Redfin URL
          </p>
        )}

        {/* Error message */}
        {scrapeError && (
          <div className="mt-3">
            <InfoBox variant="error">
              {scrapeError}
            </InfoBox>
          </div>
        )}

        {/* Success message */}
        {scrapeSuccess && (
          <div className="mt-3">
            <InfoBox variant="success">
              ✓ Property details imported successfully! Review and adjust below.
            </InfoBox>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-200"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-4 bg-white text-slate-500">or enter manually</span>
        </div>
      </div>

      {/* Manual Entry Fields */}
      <div className="space-y-4">
        {/* Address */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Property Address
          </label>
          <input
            type="text"
            value={formData.address}
            onChange={(e) => updateField('address', e.target.value)}
            placeholder="123 Main St, Cambridge, MA"
            className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          />
        </div>

        {/* List Price */}
        <CurrencyInput
          label="List Price"
          value={formData.listPrice}
          onChange={(value) => updateField('listPrice', value)}
          placeholder="750000"
        />

        {/* Property Type */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Property Type
          </label>
          <select
            value={formData.propertyType}
            onChange={(e) => updateField('propertyType', e.target.value as BidFormData['propertyType'])}
            className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
          >
            <option value="single-family">Single Family</option>
            <option value="condo">Condo</option>
            <option value="townhouse">Townhouse</option>
            <option value="multi-family">Multi-Family</option>
          </select>
        </div>

        {/* Days on Market */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Days on Market
          </label>
          <input
            type="number"
            value={formData.daysOnMarket}
            onChange={(e) => updateField('daysOnMarket', parseInt(e.target.value) || 0)}
            min={0}
            className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          />
          <p className="text-xs text-slate-500 mt-1">
            Longer time on market signals a motivated seller → more negotiating leverage
          </p>
        </div>

        {/* Price Reduced */}
        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
          <input
            type="checkbox"
            id="priceReduced"
            checked={formData.priceReduced}
            onChange={(e) => updateField('priceReduced', e.target.checked)}
            className="h-5 w-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
          />
          <label htmlFor="priceReduced" className="text-sm text-slate-700">
            Price has been reduced from original listing
          </label>
        </div>
      </div>
    </div>
  );
}

export default PropertyDetails;
