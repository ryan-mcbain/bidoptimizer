'use client';

import React from 'react';
import { BidFormData } from '@/lib/types';
import { CurrencyInput } from '@/components/ui';

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
 * - Address
 * - List price
 * - Property type
 * - Days on market
 * - Price reduction status
 */
export function PropertyDetails({ formData, updateField }: PropertyDetailsProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Property Details</h2>
        <p className="text-slate-600 mt-1">
          Enter information about the property you&apos;re considering.
        </p>
      </div>

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
