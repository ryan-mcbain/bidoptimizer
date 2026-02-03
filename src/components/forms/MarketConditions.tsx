'use client';

import React from 'react';
import { BidFormData } from '@/lib/types';
import { Slider, CurrencyInput, InfoBox } from '@/components/ui';

interface MarketConditionsProps {
  /** Current form data */
  formData: BidFormData;
  /** Update a single field */
  updateField: <K extends keyof BidFormData>(field: K, value: BidFormData[K]) => void;
}

/**
 * Step 2: Market Conditions Form
 *
 * Collects information about the competitive landscape:
 * - Number of competing bidders
 * - Market temperature
 * - Comparable sales / estimated value
 */
export function MarketConditions({ formData, updateField }: MarketConditionsProps) {
  // Calculate winner's curse probability for display
  const winnersCurseProbability = Math.round(
    (1 - Math.pow(0.5, formData.numBidders)) * 100
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Market Conditions</h2>
        <p className="text-slate-600 mt-1">
          Help us understand the competitive landscape.
        </p>
      </div>

      <div className="space-y-6">
        {/* Number of Bidders */}
        <div>
          <Slider
            label="Estimated Number of Competing Bidders"
            value={formData.numBidders}
            onChange={(value) => updateField('numBidders', value)}
            min={1}
            max={15}
            step={1}
            leftLabel="1 (just you)"
            rightLabel="15+"
            showValue
            formatValue={(v) => `${v} bidders`}
          />

          <div className="mt-3">
            <InfoBox variant="warning" title="Winner's Curse Alert:">
              With {formData.numBidders} bidders, the highest estimate exceeds
              true value ~{winnersCurseProbability}% of the time. Our algorithm
              automatically corrects for this.
            </InfoBox>
          </div>
        </div>

        {/* Market Heat */}
        <Slider
          label="Market Temperature"
          value={formData.marketHeat * 100}
          onChange={(value) => updateField('marketHeat', value / 100)}
          min={0}
          max={100}
          step={5}
          leftLabel="❄️ Buyer's Market"
          centerLabel="⚖️ Balanced"
          rightLabel="🔥 Seller's Market"
          gradientClass="bg-gradient-to-r from-blue-400 via-yellow-400 to-red-500"
        />

        {/* Comparable Sales / Valuation */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-3">
            Your Estimated Fair Market Value
          </label>
          <p className="text-xs text-slate-500 mb-3">
            Based on recent comparable sales in the area
          </p>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-slate-500 block mb-1">Low Comp</label>
              <CurrencyInput
                label=""
                value={formData.compsLow}
                onChange={(value) => updateField('compsLow', value)}
              />
            </div>

            <div>
              <label className="text-xs text-slate-500 font-medium block mb-1">
                Your Estimate ⭐
              </label>
              <CurrencyInput
                label=""
                value={formData.estimatedValue}
                onChange={(value) => updateField('estimatedValue', value)}
                highlighted
              />
            </div>

            <div>
              <label className="text-xs text-slate-500 block mb-1">High Comp</label>
              <CurrencyInput
                label=""
                value={formData.compsHigh}
                onChange={(value) => updateField('compsHigh', value)}
              />
            </div>
          </div>

          {/* Visual indicator of estimate position */}
          <div className="mt-4 h-2 bg-slate-200 rounded-full relative">
            {formData.compsHigh > formData.compsLow && (
              <div
                className="absolute top-0 h-2 w-3 bg-emerald-500 rounded-full transform -translate-x-1/2"
                style={{
                  left: `${Math.min(100, Math.max(0,
                    ((formData.estimatedValue - formData.compsLow) /
                      (formData.compsHigh - formData.compsLow)) * 100
                  ))}%`,
                }}
              />
            )}
          </div>
          <div className="flex justify-between text-xs text-slate-400 mt-1">
            <span>${(formData.compsLow / 1000).toFixed(0)}K</span>
            <span>${(formData.compsHigh / 1000).toFixed(0)}K</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MarketConditions;
