'use client';

import React from 'react';
import { BidFormData } from '@/lib/types';
import { Slider, CurrencyInput } from '@/components/ui';

interface BuyerPreferencesProps {
  /** Current form data */
  formData: BidFormData;
  /** Update a single field */
  updateField: <K extends keyof BidFormData>(field: K, value: BidFormData[K]) => void;
}

/**
 * Step 3: Buyer Preferences Form
 *
 * Collects information about the buyer's preferences and constraints:
 * - Risk tolerance
 * - Desire level for this specific property
 * - Financing strength
 * - Maximum budget
 */
export function BuyerPreferences({ formData, updateField }: BuyerPreferencesProps) {
  // Calculate CRRA parameter for display
  const crraAlpha = (0.3 + formData.riskTolerance * 0.7).toFixed(2);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Your Preferences</h2>
        <p className="text-slate-600 mt-1">
          Tell us about your risk tolerance and constraints.
        </p>
      </div>

      <div className="space-y-6">
        {/* Risk Tolerance */}
        <div>
          <Slider
            label="Risk Tolerance"
            value={formData.riskTolerance * 100}
            onChange={(value) => updateField('riskTolerance', value / 100)}
            min={0}
            max={100}
            step={5}
            leftLabel="🛡️ Conservative"
            centerLabel="⚖️ Balanced"
            rightLabel="🎯 Aggressive"
            helperText={`Maps to CRRA parameter α = ${crraAlpha} (1.0 = risk-neutral, lower = more risk-averse)`}
          />
        </div>

        {/* Desire Level */}
        <Slider
          label="How much do you want THIS specific house?"
          value={formData.desireLevel}
          onChange={(value) => updateField('desireLevel', value)}
          min={1}
          max={10}
          step={1}
          leftLabel="1 (meh)"
          rightLabel="10 (must have!)"
          showValue
          formatValue={(v) => `${v}/10`}
        />

        {/* Financing Strength */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Financing Strength
          </label>
          <select
            value={formData.financingStrength}
            onChange={(e) => updateField('financingStrength', parseFloat(e.target.value))}
            className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
          >
            <option value={1.0}>💰 All Cash</option>
            <option value={0.9}>✅ Pre-approved, 20%+ down</option>
            <option value={0.7}>📋 Pre-approved, 10-20% down</option>
            <option value={0.5}>📝 Pre-qualified only</option>
            <option value={0.3}>⏳ Still working on financing</option>
          </select>
          <p className="text-xs text-slate-500 mt-1">
            Stronger financing makes your offer more competitive
          </p>
        </div>

        {/* Maximum Budget */}
        <CurrencyInput
          label="Maximum Budget (Absolute Cap)"
          value={formData.maxBudget}
          onChange={(value) => updateField('maxBudget', value)}
          helperText="We will never recommend a bid above this amount"
        />

        {/* Budget Warning */}
        {formData.maxBudget < formData.estimatedValue && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
            ⚠️ Your budget (${(formData.maxBudget / 1000).toFixed(0)}K) is below
            your estimated value (${(formData.estimatedValue / 1000).toFixed(0)}K).
            This may limit your competitiveness.
          </div>
        )}
      </div>
    </div>
  );
}

export default BuyerPreferences;
