'use client';

import React, { useState, useCallback } from 'react';
import { BidFormData, FullBidResult, DEFAULT_FORM_DATA } from '@/lib/types';
import { calculateOptimalBid, optimizeEscalation } from '@/lib/game-theory-engine';
import { StepIndicator } from '@/components/ui';
import {
  PropertyDetails,
  MarketConditions,
  BuyerPreferences,
  Results,
} from '@/components/forms';

const STEP_LABELS = ['Property', 'Market', 'Preferences', 'Results'];

/**
 * BidCalculator - Main Form Wizard Component
 *
 * Orchestrates the 4-step bid optimization process:
 * 1. Property Details - Basic property info
 * 2. Market Conditions - Competition and valuation
 * 3. Buyer Preferences - Risk tolerance and constraints
 * 4. Results - Calculated bid recommendations
 */
export function BidCalculator() {
  // Current wizard step (1-4)
  const [step, setStep] = useState(1);

  // Form state
  const [formData, setFormData] = useState<BidFormData>(DEFAULT_FORM_DATA);

  // Calculation results (populated when moving to step 4)
  const [results, setResults] = useState<FullBidResult | null>(null);

  /**
   * Update a single form field
   */
  const updateField = useCallback(
    <K extends keyof BidFormData>(field: K, value: BidFormData[K]) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  /**
   * Calculate bid recommendations
   */
  const calculateResults = useCallback(() => {
    const bidResult = calculateOptimalBid({
      listPrice: formData.listPrice,
      estimatedValue: formData.estimatedValue,
      lowComp: formData.compsLow,     // Lower bound of value distribution
      highComp: formData.compsHigh,   // Upper bound of value distribution
      numBidders: formData.numBidders,
      daysOnMarket: formData.daysOnMarket,
      marketHeat: formData.marketHeat,
      riskTolerance: formData.riskTolerance,
      financingStrength: formData.financingStrength,
      desireLevel: formData.desireLevel,
      priceReduced: formData.priceReduced,
    });

    // PHASE 5: Pass effective valuation to set proper escalation cap
    const escalation = optimizeEscalation(
      bidResult.optimalBid,
      formData.maxBudget,
      formData.numBidders,
      bidResult.modelParameters.adjustedValue  // v_eff for cap calculation
    );

    setResults({ ...bidResult, escalation });
  }, [formData]);

  /**
   * Handle next button click
   */
  const handleNext = () => {
    if (step === 3) {
      calculateResults();
    }
    setStep((prev) => Math.min(prev + 1, 4));
  };

  /**
   * Handle back button click
   */
  const handleBack = () => {
    setStep((prev) => Math.max(prev - 1, 1));
  };

  /**
   * Reset and start over
   */
  const handleStartOver = () => {
    setStep(1);
    setFormData(DEFAULT_FORM_DATA);
    setResults(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-emerald-50 p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center py-6">
          <div className="inline-flex items-center gap-2 bg-emerald-600 text-white px-4 py-1 rounded-full text-sm font-medium mb-4">
            🎓 Game Theory Powered
          </div>
          <h1 className="text-3xl font-bold text-slate-900">OfferEdge</h1>
          <p className="text-slate-600 mt-1">
            Optimal Home Bidding Backed by Auction Theory
          </p>
        </div>

        {/* Progress Steps */}
        <div className="mb-8">
          <StepIndicator
            currentStep={step}
            totalSteps={4}
            onStepClick={(s) => s < step && setStep(s)}
            labels={STEP_LABELS}
          />
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          {step === 1 && (
            <PropertyDetails formData={formData} updateField={updateField} />
          )}
          {step === 2 && (
            <MarketConditions formData={formData} updateField={updateField} />
          )}
          {step === 3 && (
            <BuyerPreferences formData={formData} updateField={updateField} />
          )}
          {step === 4 && results && (
            <Results formData={formData} results={results} />
          )}
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-between">
          {step > 1 && (
            <button
              onClick={handleBack}
              className="px-6 py-3 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors font-medium"
            >
              ← Back
            </button>
          )}

          {step < 4 ? (
            <button
              onClick={handleNext}
              className="ml-auto px-6 py-3 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors font-medium shadow-lg shadow-emerald-500/25"
            >
              {step === 3 ? 'Calculate Optimal Bid →' : 'Next →'}
            </button>
          ) : (
            <button
              onClick={handleStartOver}
              className="ml-auto px-6 py-3 rounded-lg bg-slate-600 text-white hover:bg-slate-700 transition-colors font-medium"
            >
              Start Over
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-slate-400 mt-8 pb-4">
          <p>
            OfferEdge incorporates research from the 2020 Nobel Prize in
            Economics
          </p>
          <p>
            (Milgrom & Wilson) and behavioral economics (Kőszegi & Rabin 2006,
            Choi et al. 2025)
          </p>
          <p className="mt-2">
            For educational and decision-support purposes only. Not financial
            advice.
          </p>
        </div>
      </div>
    </div>
  );
}

export default BidCalculator;
