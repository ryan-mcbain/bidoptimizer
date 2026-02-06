/**
 * BidOptimizer Game Theory Engine (Version 3.0)
 *
 * A TypeScript implementation of auction theory for real estate bidding,
 * incorporating insights from the 2020 Nobel Prize in Economics and
 * behavioral economics research.
 *
 * VERSION 3.0 UPDATES:
 * - Comps-centric valuation derivation (v_raw from Low/Mid/High comps)
 * - New winner's curse formula: Δ_WC = 0.85σ × √[(n-1)/2]
 * - Behavioral adjustment is ADDITIVE to value (not multiplier on bid)
 * - Financing strength now affects effective competition
 * - Escalation cap = min(budget, v_eff) per paper specification
 *
 * THEORETICAL FOUNDATION:
 *
 * Classical Auction Theory:
 * - First-Price Sealed-Bid (FPSB) Auction Theory (Vickrey 1961, Riley & Samuelson 1981)
 * - Winner's Curse Correction (Capen et al. 1971, Wilson 1977, Milgrom & Weber 1982)
 * - Risk-Averse Bidding with CRRA Utility (Cox et al. 1982, Maskin & Riley 1984)
 *
 * Behavioral Extensions:
 * - Reference-Dependent Preferences (Kőszegi & Rabin 2006, 2007)
 * - Expectations-Based Loss Aversion in Auctions (Lange & Ratan 2010, Rosato 2021)
 *
 * @author BidOptimizer Team
 * @version 3.0
 * @see {@link https://www.nobelprize.org/prizes/economic-sciences/2020/summary/}
 */

import {
  BidCalculationParams,
  BidOptimizationResult,
  EscalationStrategy,
  ModelParameters,
  WinProbabilities,
} from './types';

// =============================================================================
// STATISTICAL HELPER FUNCTIONS
// =============================================================================

/**
 * Standard Normal CDF approximation using Abramowitz & Stegun formula.
 * Maximum error: 1.5 × 10⁻⁷
 */
function normalCDF(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x) / Math.sqrt(2);
  const t = 1.0 / (1.0 + p * absX);
  const y =
    1.0 -
    ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);

  return 0.5 * (1.0 + sign * y);
}

// =============================================================================
// PHASE 1: NEW WINNER'S CURSE FORMULA
// =============================================================================

/**
 * Calculate winner's curse correction using the paper's formula.
 *
 * NEW FORMULA (v3.0): Δ_WC = 0.85 × σ × √((n-1)/2)
 *
 * Where:
 * - σ = (HighComp - LowComp) / 2.56 (assuming 10th/90th percentiles)
 * - n = number of bidders
 * - 0.85 is calibrated from empirical data (88% overestimation at n=3)
 *
 * This scales properly with both uncertainty (σ) and competition (n).
 *
 * @param numBidders - Number of competing bidders
 * @param sigma - Standard deviation of value estimates (derived from comps)
 * @returns Winner's curse adjustment in dollars
 */
export function calculateWinnersCurseAdjustment(
  numBidders: number,
  sigma: number
): number {
  if (numBidders <= 1) return 0;

  // Paper formula: Δ_WC = 0.85 × σ × √((n-1)/2)
  const n = Math.max(2, numBidders);
  return 0.85 * sigma * Math.sqrt((n - 1) / 2);
}

/**
 * Legacy function for backwards compatibility.
 * Returns multiplier in standard deviations (used for display).
 */
export function getWinnersCurseCorrection(n: number): number {
  if (n <= 1) return 0;
  // This returns the coefficient: 0.85 × √((n-1)/2)
  return 0.85 * Math.sqrt((n - 1) / 2);
}

// =============================================================================
// PHASE 3: COMPS-CENTRIC VALUATION
// =============================================================================

/**
 * Derive the buyer's raw valuation from comparable sales.
 *
 * NEW FORMULA (v3.0): v_raw = MidComp + [(Desire-5)/5] × (HighComp - MidComp)
 *
 * This anchors valuation to market data while allowing desire level to
 * shift the buyer's willingness to pay within the comps range:
 * - Desire = 1: Valuation at LowComp (only want a bargain)
 * - Desire = 5: Valuation at MidComp (neutral)
 * - Desire = 10: Valuation at HighComp (must-have, willing to pay top dollar)
 *
 * @param lowComp - Low comparable sale price
 * @param highComp - High comparable sale price
 * @param desireLevel - How much buyer wants this house (1-10)
 * @returns Raw private valuation
 */
export function deriveValuationFromComps(
  lowComp: number,
  highComp: number,
  desireLevel: number
): number {
  const midComp = (lowComp + highComp) / 2;
  const desireFactor = (desireLevel - 5) / 5; // -0.8 to +1.0

  // If desire > 5, shift toward high comp; if < 5, shift toward low comp
  if (desireFactor >= 0) {
    return midComp + desireFactor * (highComp - midComp);
  } else {
    return midComp + desireFactor * (midComp - lowComp);
  }
}

/**
 * Calculate the standard deviation (σ) of value estimates from comps.
 *
 * Assumes LowComp and HighComp represent approximately the 10th and 90th
 * percentiles of the value distribution, which span ±1.28σ.
 *
 * @param lowComp - Low comparable sale price
 * @param highComp - High comparable sale price
 * @returns Estimated standard deviation
 */
export function calculateCompsSigma(lowComp: number, highComp: number): number {
  // 90th - 10th percentile spans 2 × 1.28σ = 2.56σ
  return (highComp - lowComp) / 2.56;
}

// =============================================================================
// PHASE 2: BEHAVIORAL ADJUSTMENT (ADDITIVE)
// =============================================================================

/**
 * Calculate the behavioral regret adjustment (ADDITIVE to value).
 *
 * NEW APPROACH (v3.0): Δ_regret = coefficient × (desire-5) × (λ-1) × v_adj
 *
 * This is added to the valuation, not multiplied onto the bid.
 * The adjustment reflects the psychological cost of losing:
 * - High desire + high loss aversion = larger positive adjustment
 * - Low desire = negative adjustment (willing to walk away)
 *
 * @param desireLevel - How much buyer wants this house (1-10)
 * @param lossAversion - λ parameter (typically 2.0-2.5)
 * @param adjustedValue - Value after winner's curse correction
 * @returns Dollar adjustment to add to valuation
 */
export function calculateBehavioralAdjustment(
  desireLevel: number,
  lossAversion: number,
  adjustedValue: number
): number {
  // Coefficient calibrated to produce ~5% adjustment at desire=7, λ=2
  const behavCoeff = 0.025;

  // (desire - 5) ranges from -4 to +5
  // (λ - 1) is typically ~1.0 for standard loss aversion
  const delta = behavCoeff * (desireLevel - 5) * (lossAversion - 1) * adjustedValue;

  // Cap the adjustment at ±10% of value to prevent extreme bids
  const maxAdjustment = adjustedValue * 0.10;
  return Math.max(-maxAdjustment, Math.min(maxAdjustment, delta));
}

// =============================================================================
// PHASE 4: FINANCING STRENGTH
// =============================================================================

/**
 * Calculate effective number of bidders accounting for financing advantage.
 *
 * NEW (v3.0): Financing strength reduces effective competition.
 *
 * All-cash buyers have a significant advantage over financed buyers because:
 * - No appraisal contingency risk
 * - Faster closing
 * - Higher certainty of closing
 *
 * We model this as reducing the effective number of competitors.
 *
 * @param numBidders - Actual number of bidders
 * @param financingStrength - 0 (weak financing) to 1 (all cash)
 * @returns Effective number of competitors for bid calculation
 */
export function getEffectiveBidders(
  numBidders: number,
  financingStrength: number
): number {
  // All-cash (1.0) reduces effective competition by 0.5 bidders
  // Weak financing (0.0) adds 0.25 bidders (slight disadvantage)
  const financingAdjustment = -0.5 * financingStrength + 0.25 * (1 - financingStrength);

  // Ensure at least 2 effective bidders
  return Math.max(2, numBidders + financingAdjustment);
}

// =============================================================================
// CORE AUCTION THEORY FUNCTIONS
// =============================================================================

/**
 * Calculate the First-Price Sealed-Bid Auction equilibrium bid.
 *
 * Formula: b*(v) = β × v + (1-β) × L
 *
 * Where β = (n-1)/(n-1+α) is the bid shading factor.
 */
export function fpsbaEquilibriumBid(
  valuation: number,
  numBidders: number,
  lowComp: number,
  riskParam: number = 1
): number {
  const n = Math.max(2, numBidders);
  const alpha = Math.max(0.1, Math.min(1, riskParam));

  // Equilibrium bid shading factor β = (n-1)/(n-1+α)
  const beta = (n - 1) / (n - 1 + alpha);

  // b*(v) = β × v + (1-β) × L
  return beta * valuation + (1 - beta) * lowComp;
}

/**
 * Calculate the probability of winning with a given bid.
 */
export function calculateWinProbability(
  bid: number,
  marketValue: number,
  numBidders: number,
  marketHeat: number = 0.5
): number {
  const n = Math.max(2, numBidders);

  // In hot markets, competitors bid higher
  const heatAdjustment = 1 + (marketHeat - 0.5) * 0.1;
  const expectedCompetingMax = marketValue * heatAdjustment * ((n - 1) / n);

  // Standard deviation of competing bids (~5% of market value)
  const sigma = marketValue * 0.05;

  // CDF of highest competing bid
  const z = (bid - expectedCompetingMax) / sigma;
  const singleBidderProb = normalCDF(z);

  // Probability of beating all (n-1) competitors
  return Math.pow(singleBidderProb, n - 1);
}

/**
 * Calculate expected surplus from winning at a given bid.
 */
export function calculateExpectedSurplus(
  bid: number,
  valuation: number,
  winProb: number,
  riskParam: number
): number {
  const surplus = valuation - bid;
  const expectedSurplus = winProb * surplus;

  // Risk adjustment for variance in outcomes
  const riskPenalty = (1 - riskParam) * winProb * (1 - winProb) * surplus * 0.5;

  return expectedSurplus - riskPenalty;
}

// =============================================================================
// MAIN OPTIMIZATION FUNCTION (UPDATED v3.0)
// =============================================================================

/**
 * Calculate the optimal bid for a property.
 *
 * VERSION 3.0 CALCULATION FLOW:
 *
 * 1. Derive v_raw from comps using desire level
 * 2. Apply market signal adjustments (DOM, price reduction)
 * 3. Calculate σ from comps spread
 * 4. Apply winner's curse correction: v_adj = v_raw - Δ_WC
 * 5. Apply behavioral adjustment (ADDITIVE): v_eff = v_adj + Δ_regret
 * 6. Account for financing strength (adjust effective n)
 * 7. Calculate equilibrium bid: b* = β × v_eff + (1-β) × L
 * 8. Apply market heat adjustment
 * 9. Generate variants and probabilities
 */
export function calculateOptimalBid(
  params: BidCalculationParams
): BidOptimizationResult {
  const {
    estimatedValue,
    lowComp,
    highComp,
    numBidders,
    daysOnMarket,
    marketHeat,
    riskTolerance,
    financingStrength,
    desireLevel,
    priceReduced,
    lossAversion = 2.0,
  } = params;

  // -------------------------------------------------------------------------
  // PHASE 3: Derive valuation from comps (or use provided estimate)
  // -------------------------------------------------------------------------
  const compsBasedValue = deriveValuationFromComps(lowComp, highComp, desireLevel);

  // Use the higher of comps-derived or user-provided estimate
  // This respects user expertise while anchoring to market data
  let v_raw = Math.max(compsBasedValue, estimatedValue * 0.95);

  // If user estimate is significantly higher, blend with comps
  if (estimatedValue > compsBasedValue * 1.05) {
    v_raw = compsBasedValue * 0.7 + estimatedValue * 0.3;
  }

  // -------------------------------------------------------------------------
  // Step 1: Apply market signal adjustments
  // -------------------------------------------------------------------------
  // Days on market signal: longer = weaker seller position
  const domFactor = Math.max(0.95, 1 - (daysOnMarket / 365) * 0.1);

  // Price reduction signal: indicates motivated seller
  const reductionFactor = priceReduced ? 0.97 : 1.0;

  const signalAdjustedValue = v_raw * domFactor * reductionFactor;

  // -------------------------------------------------------------------------
  // Step 2: Convert risk tolerance to CRRA parameter
  // -------------------------------------------------------------------------
  // riskTolerance 0→1 maps to α 0.3→1.0
  const alpha = 0.3 + riskTolerance * 0.7;

  // -------------------------------------------------------------------------
  // PHASE 1: Apply NEW winner's curse correction
  // -------------------------------------------------------------------------
  const sigma = calculateCompsSigma(lowComp, highComp);
  const winnersCurseAdjustment = calculateWinnersCurseAdjustment(numBidders, sigma);
  const v_adj = Math.max(lowComp, signalAdjustedValue - winnersCurseAdjustment);

  // -------------------------------------------------------------------------
  // PHASE 2: Apply behavioral adjustment (ADDITIVE to value)
  // -------------------------------------------------------------------------
  const behavioralDelta = calculateBehavioralAdjustment(desireLevel, lossAversion, v_adj);
  const v_eff = v_adj + behavioralDelta;

  // -------------------------------------------------------------------------
  // PHASE 4: Account for financing strength
  // -------------------------------------------------------------------------
  const effectiveN = getEffectiveBidders(numBidders, financingStrength);

  // -------------------------------------------------------------------------
  // Step 3: Calculate equilibrium bid with CRRA
  // -------------------------------------------------------------------------
  let optimalBid = fpsbaEquilibriumBid(v_eff, effectiveN, lowComp, alpha);

  // -------------------------------------------------------------------------
  // Step 4: Apply market heat adjustment
  // -------------------------------------------------------------------------
  // Hot markets require higher bids; cold markets allow lower bids
  const heatMultiplier = 1 + (marketHeat - 0.5) * 0.06; // ±3% max
  optimalBid *= heatMultiplier;

  // -------------------------------------------------------------------------
  // Step 5: Calculate win probability and expected surplus
  // -------------------------------------------------------------------------
  const winProbability = calculateWinProbability(
    optimalBid,
    v_raw,
    numBidders,
    marketHeat
  );

  const expectedSurplus = calculateExpectedSurplus(
    optimalBid,
    v_eff,
    winProbability,
    alpha
  );

  // -------------------------------------------------------------------------
  // Step 6: Generate Conservative and Aggressive variants
  // -------------------------------------------------------------------------
  const conservativeBid = optimalBid * 0.95;
  const aggressiveBid = Math.min(optimalBid * 1.08, highComp * 1.02);

  // -------------------------------------------------------------------------
  // Prepare result
  // -------------------------------------------------------------------------
  const winProbabilities: WinProbabilities = {
    conservative: calculateWinProbability(conservativeBid, v_raw, numBidders, marketHeat),
    optimal: winProbability,
    aggressive: calculateWinProbability(aggressiveBid, v_raw, numBidders, marketHeat),
  };

  // Calculate behavioral adjustment percentage for display
  const behavioralPct = v_adj > 0 ? (behavioralDelta / v_adj) * 100 : 0;

  const modelParameters: ModelParameters = {
    crraAlpha: alpha.toFixed(2),
    winnersCurseCorrection: (winnersCurseAdjustment / 1000).toFixed(1) + 'k',
    bidShadingFactor: ((effectiveN - 1) / (effectiveN - 1 + alpha)).toFixed(3),
    adjustedValue: Math.round(v_eff),
    lossAversionLambda: lossAversion.toFixed(1),
    lossAversionFactor: (1 + behavioralPct / 100).toFixed(3),
    behavioralAdjustment: (behavioralPct >= 0 ? '+' : '') + behavioralPct.toFixed(1) + '%',
  };

  return {
    optimalBid: Math.round(optimalBid),
    conservativeBid: Math.round(conservativeBid),
    aggressiveBid: Math.round(aggressiveBid),
    winProbabilities,
    expectedSurplus: Math.round(expectedSurplus),
    modelParameters,
  };
}

// =============================================================================
// PHASE 5: UPDATED ESCALATION CLAUSE OPTIMIZER
// =============================================================================

/**
 * Determine optimal escalation clause parameters.
 *
 * UPDATED (v3.0): Cap = min(budget, effective valuation)
 *
 * The cap should be the buyer's true walk-away price, not arbitrarily
 * set at 98% of budget. If effective valuation is less than budget,
 * cap at the valuation to avoid irrational overpaying.
 */
export function optimizeEscalation(
  optimalBid: number,
  maxBudget: number,
  numBidders: number,
  effectiveValuation?: number
): EscalationStrategy {
  // PHASE 5: Cap = min(budget, v_eff)
  // If effective valuation provided, use it as potential cap
  const valuationCap = effectiveValuation || maxBudget;
  const cap = Math.min(maxBudget, Math.round(valuationCap * 1.02)); // Allow 2% above v_eff

  // Increment: ~1-2% of property value, between $5k and $10k
  const baseIncrement = optimalBid * 0.015; // 1.5% of bid
  const increment = Math.round(baseIncrement / 1000) * 1000; // Round to nearest $1000
  const boundedIncrement = Math.max(5000, Math.min(10000, increment));

  return {
    startingBid: optimalBid,
    increment: boundedIncrement,
    cap,
    rationale: `Start at $${optimalBid.toLocaleString()}, escalate by $${boundedIncrement.toLocaleString()} increments, cap at $${cap.toLocaleString()}`,
  };
}

// =============================================================================
// CONVENIENCE EXPORTS
// =============================================================================

/**
 * GameTheoryEngine object for backwards compatibility.
 */
export const GameTheoryEngine = {
  deriveValuationFromComps,
  calculateCompsSigma,
  calculateWinnersCurseAdjustment,
  getWinnersCurseCorrection,
  calculateBehavioralAdjustment,
  getEffectiveBidders,
  fpsbaEquilibriumBid,
  calculateWinProbability,
  calculateExpectedSurplus,
  calculateOptimalBid,
  optimizeEscalation,
  normalCDF,
};

export default GameTheoryEngine;
