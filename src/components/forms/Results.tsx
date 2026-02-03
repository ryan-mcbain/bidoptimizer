'use client';

import React, { useState } from 'react';
import { BidFormData, FullBidResult } from '@/lib/types';

interface ResultsProps {
  /** Current form data */
  formData: BidFormData;
  /** Calculated results */
  results: FullBidResult;
}

/**
 * Format a number as USD currency
 */
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Format a decimal as percentage
 */
function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

/**
 * Step 4: Results Display
 *
 * Shows the bid optimization results:
 * - Three bid recommendations (conservative, optimal, aggressive)
 * - Win probabilities for each
 * - Expected surplus
 * - Escalation clause strategy
 * - "Show Math" toggle for technical details
 * - Plain English summary
 */
export function Results({ formData, results }: ResultsProps) {
  const [showMath, setShowMath] = useState(false);

  const bidVsListPrice = results.optimalBid - formData.listPrice;
  const riskProfile =
    formData.riskTolerance < 0.4
      ? 'conservative'
      : formData.riskTolerance > 0.6
        ? 'aggressive'
        : 'moderate';
  const marketCondition =
    formData.marketHeat < 0.4
      ? 'cool'
      : formData.marketHeat > 0.6
        ? 'hot'
        : 'balanced';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-slate-900">
          Your Optimal Bid Strategy
        </h2>
        <p className="text-slate-600">
          Based on Bayesian Nash Equilibrium analysis
        </p>
      </div>

      {/* Main Recommendation Cards */}
      <div className="grid grid-cols-3 gap-3">
        {/* Conservative */}
        <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 text-center">
          <div className="text-xs text-blue-600 font-medium uppercase tracking-wide">
            Conservative
          </div>
          <div className="text-xl sm:text-2xl font-bold text-blue-800 mt-1">
            {formatCurrency(results.conservativeBid)}
          </div>
          <div className="text-sm text-blue-600 mt-1">
            Win: {formatPercent(results.winProbabilities.conservative)}
          </div>
          <div className="text-xs text-slate-500 mt-2 hidden sm:block">
            Lower risk, lower chance
          </div>
        </div>

        {/* Optimal - Highlighted */}
        <div className="bg-emerald-50 border-2 border-emerald-400 rounded-xl p-4 text-center shadow-lg transform scale-105">
          <div className="text-xs text-emerald-600 font-medium uppercase tracking-wide">
            ⭐ Recommended
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-emerald-800 mt-1">
            {formatCurrency(results.optimalBid)}
          </div>
          <div className="text-sm text-emerald-600 mt-1">
            Win: {formatPercent(results.winProbabilities.optimal)}
          </div>
          <div className="text-xs text-slate-500 mt-2 hidden sm:block">
            Game-theoretic optimum
          </div>
        </div>

        {/* Aggressive */}
        <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-4 text-center">
          <div className="text-xs text-orange-600 font-medium uppercase tracking-wide">
            Aggressive
          </div>
          <div className="text-xl sm:text-2xl font-bold text-orange-800 mt-1">
            {formatCurrency(results.aggressiveBid)}
          </div>
          <div className="text-sm text-orange-600 mt-1">
            Win: {formatPercent(results.winProbabilities.aggressive)}
          </div>
          <div className="text-xs text-slate-500 mt-2 hidden sm:block">
            Higher chance, less surplus
          </div>
        </div>
      </div>

      {/* Expected Surplus */}
      <div className="bg-slate-50 rounded-xl p-4">
        <div className="flex justify-between items-center">
          <div>
            <div className="text-sm text-slate-600">
              Expected Surplus (if you win)
            </div>
            <div className="text-xl font-bold text-slate-900">
              {formatCurrency(results.expectedSurplus)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-slate-600">vs. List Price</div>
            <div
              className={`text-xl font-bold ${
                bidVsListPrice > 0 ? 'text-red-600' : 'text-emerald-600'
              }`}
            >
              {bidVsListPrice > 0 ? '+' : ''}
              {formatCurrency(bidVsListPrice)}
            </div>
          </div>
        </div>
      </div>

      {/* Escalation Clause Strategy */}
      <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
        <h3 className="font-bold text-purple-900 flex items-center gap-2">
          📈 Escalation Clause Strategy
        </h3>
        <p className="text-sm text-purple-700 mt-2">
          If using an escalation clause:
        </p>
        <div className="mt-3 grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-xs text-purple-600">Starting Bid</div>
            <div className="font-bold text-purple-900">
              {formatCurrency(results.escalation.startingBid)}
            </div>
          </div>
          <div>
            <div className="text-xs text-purple-600">Increment</div>
            <div className="font-bold text-purple-900">
              {formatCurrency(results.escalation.increment)}
            </div>
          </div>
          <div>
            <div className="text-xs text-purple-600">Cap</div>
            <div className="font-bold text-purple-900">
              {formatCurrency(results.escalation.cap)}
            </div>
          </div>
        </div>
      </div>

      {/* Show/Hide Math Toggle */}
      <button
        onClick={() => setShowMath(!showMath)}
        className="w-full py-2 text-sm text-emerald-600 hover:text-emerald-800 flex items-center justify-center gap-2 transition-colors"
      >
        {showMath ? '▼ Hide' : '▶ Show'} Game Theory Details
      </button>

      {/* Math Details Panel */}
      {showMath && (
        <div className="bg-slate-800 text-slate-100 rounded-xl p-5 font-mono text-sm space-y-4">
          <div className="text-slate-400 text-xs uppercase tracking-wide">
            Model Parameters (v2.0)
          </div>

          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-400">CRRA Risk Parameter (α):</span>
              <span className="text-green-400">
                {results.modelParameters.crraAlpha}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Winner&apos;s Curse Correction:</span>
              <span className="text-yellow-400">
                {results.modelParameters.winnersCurseCorrection}σ
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Bid Shading Factor:</span>
              <span className="text-blue-400">
                {results.modelParameters.bidShadingFactor}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Adjusted Valuation:</span>
              <span className="text-purple-400">
                {formatCurrency(results.modelParameters.adjustedValue)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Loss Aversion (λ):</span>
              <span className="text-orange-400">
                {results.modelParameters.lossAversionLambda}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Behavioral Adjustment:</span>
              <span className="text-pink-400">
                +{results.modelParameters.behavioralAdjustment}
              </span>
            </div>
          </div>

          <div className="border-t border-slate-600 pt-4">
            <div className="text-slate-400 text-xs uppercase tracking-wide mb-2">
              Key Equations
            </div>
            <div className="space-y-2 text-xs">
              <div>
                <span className="text-slate-400">FPSBA Equilibrium: </span>
                <span className="text-cyan-400">
                  b*(v) = ((n-1)/(n-1+α)) × v
                </span>
              </div>
              <div>
                <span className="text-slate-400">Win Probability: </span>
                <span className="text-cyan-400">P(win|b) ≈ F(v(b))^(n-1)</span>
              </div>
              <div>
                <span className="text-slate-400">K-R Loss Aversion: </span>
                <span className="text-cyan-400">
                  U = m(c) + n(c|r), n(x)=λx if x&lt;0
                </span>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-600 pt-4 text-xs text-slate-500">
            Based on: 2020 Nobel (Milgrom & Wilson), Vickrey (1961), Riley &
            Samuelson (1981), Kőszegi & Rabin (2006, 2007), Choi et al. (2025)
          </div>
        </div>
      )}

      {/* Plain English Summary */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h3 className="font-bold text-slate-900 mb-3">📝 Plain English Summary</h3>
        <div className="text-sm text-slate-700 space-y-3">
          <p>
            Based on your inputs, we estimate that{' '}
            <strong>{formData.numBidders} bidders</strong> are competing for
            this property worth approximately{' '}
            <strong>{formatCurrency(formData.estimatedValue)}</strong>.
          </p>
          <p>
            Given your <strong>{riskProfile}</strong> risk profile and the{' '}
            <strong>{marketCondition}</strong> market conditions, our
            game-theoretic model recommends bidding{' '}
            <strong>{formatCurrency(results.optimalBid)}</strong>.
          </p>
          <p>
            This bid &quot;shades&quot; below your valuation by{' '}
            <strong>
              {formatPercent(1 - results.optimalBid / formData.estimatedValue)}
            </strong>{' '}
            to account for the winner&apos;s curse and strategic competition—the
            same principle used by professional bidders in oil lease auctions
            and corporate procurement.
          </p>
          <p className="text-slate-500 italic">
            At this bid, you have approximately a{' '}
            <strong>{formatPercent(results.winProbabilities.optimal)}</strong>{' '}
            chance of winning, with an expected surplus of{' '}
            <strong>{formatCurrency(results.expectedSurplus)}</strong> if
            successful.
          </p>
        </div>
      </div>
    </div>
  );
}

export default Results;
