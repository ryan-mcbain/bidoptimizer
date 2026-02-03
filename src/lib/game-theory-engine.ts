/**
 * BidOptimizer Game Theory Engine (Version 2.0)
 *
 * A TypeScript implementation of auction theory for real estate bidding,
 * incorporating insights from the 2020 Nobel Prize in Economics and
 * behavioral economics research.
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
 * Empirical Validation:
 * - Choi et al. (2025): 14M home sales show winner's curse costs buyers ~1.3% annually
 *
 * @author BidOptimizer Team
 * @version 2.0
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
// WINNER'S CURSE LOOKUP TABLE
// =============================================================================

/**
 * Expected value of the maximum order statistic from a standard normal distribution.
 *
 * When n bidders each have noisy estimates of a property's value, the winner
 * tends to be the one with the most optimistic (often overestimated) valuation.
 * This table provides correction factors based on the number of bidders.
 *
 * Source: Table 20.1, Saylor Foundation "Introduction to Economic Analysis"
 *
 * @example
 * // With 5 bidders, the highest estimate exceeds the mean by ~1.16 standard deviations
 * const correction = WINNERS_CURSE_TABLE[5]; // 1.16
 */
const WINNERS_CURSE_TABLE: Record<number, number> = {
  1: 0.0,
  2: 0.56,
  3: 0.85,
  4: 1.03,
  5: 1.16,
  6: 1.27,
  7: 1.35,
  8: 1.42,
  9: 1.49,
  10: 1.54,
  12: 1.63,
  15: 1.74,
  20: 1.87,
  25: 1.97,
  30: 2.04,
};

// =============================================================================
// STATISTICAL HELPER FUNCTIONS
// =============================================================================

/**
 * Standard Normal CDF approximation using Abramowitz & Stegun formula.
 *
 * This is a highly accurate polynomial approximation of the cumulative
 * distribution function for the standard normal distribution.
 * Maximum error: 1.5 × 10⁻⁷
 *
 * Used for calculating win probabilities based on bid distributions.
 *
 * @param x - The z-score to evaluate
 * @returns Probability that a standard normal variable is less than x
 *
 * @example
 * normalCDF(0);    // 0.5 (50% below the mean)
 * normalCDF(1.96); // ~0.975 (97.5% below 1.96 std devs)
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
// CORE AUCTION THEORY FUNCTIONS
// =============================================================================

/**
 * Get the winner's curse correction factor for n bidders.
 *
 * The winner's curse occurs because the winning bidder in a common-value
 * auction is likely the one who overestimated the item's value the most.
 * This function returns how many standard deviations to adjust downward.
 *
 * For values not in the lookup table, uses linear interpolation.
 * For n > 30, uses asymptotic approximation: √(2 ln n)
 *
 * @param n - Number of bidders
 * @returns Correction factor in standard deviations
 *
 * @example
 * getWinnersCurseCorrection(5);  // 1.16
 * getWinnersCurseCorrection(50); // ~2.8 (asymptotic)
 */
export function getWinnersCurseCorrection(n: number): number {
  if (n <= 1) return 0;
  if (WINNERS_CURSE_TABLE[n] !== undefined) return WINNERS_CURSE_TABLE[n];

  // Linear interpolation for unlisted values
  const keys = Object.keys(WINNERS_CURSE_TABLE)
    .map(Number)
    .sort((a, b) => a - b);

  for (let i = 0; i < keys.length - 1; i++) {
    if (n > keys[i] && n < keys[i + 1]) {
      const ratio = (n - keys[i]) / (keys[i + 1] - keys[i]);
      return (
        WINNERS_CURSE_TABLE[keys[i]] +
        ratio * (WINNERS_CURSE_TABLE[keys[i + 1]] - WINNERS_CURSE_TABLE[keys[i]])
      );
    }
  }

  // For n > 30, use asymptotic approximation: √(2 ln n)
  return Math.sqrt(2 * Math.log(n));
}

/**
 * Calculate the First-Price Sealed-Bid Auction equilibrium bid.
 *
 * In a FPSBA with n symmetric bidders and CRRA utility u(x) = x^α,
 * the Bayesian Nash Equilibrium bidding strategy is:
 *
 *   b*(v) = ((n-1)/(n-1+α)) × v
 *
 * Where:
 * - v = bidder's private valuation
 * - n = number of bidders
 * - α = CRRA parameter (1 = risk-neutral, <1 = risk-averse)
 *
 * Key insight: Risk-averse bidders (α < 1) shade their bids LESS than
 * risk-neutral bidders. This is counterintuitive but correct: risk-averse
 * bidders weight the certain disutility of losing more heavily than the
 * uncertain benefit of winning at a lower price.
 *
 * @param valuation - Your private value estimate for the property
 * @param numBidders - Number of competing bidders
 * @param riskParam - CRRA parameter α ∈ (0, 1], default 1 (risk-neutral)
 * @returns Optimal bid amount
 *
 * @example
 * // Risk-neutral with 5 bidders: bid 80% of valuation
 * fpsbaEquilibriumBid(500000, 5, 1.0); // 400,000
 *
 * // Risk-averse (α=0.5) with 5 bidders: bid ~89% of valuation
 * fpsbaEquilibriumBid(500000, 5, 0.5); // ~444,444
 */
export function fpsbaEquilibriumBid(
  valuation: number,
  numBidders: number,
  riskParam: number = 1
): number {
  const n = Math.max(2, numBidders);
  const alpha = Math.max(0.1, Math.min(1, riskParam));

  // Equilibrium bid shading factor
  const shadingFactor = (n - 1) / (n - 1 + alpha);

  return valuation * shadingFactor;
}

/**
 * Calculate the probability of winning with a given bid.
 *
 * Assumes competing bids follow the equilibrium strategy with valuations
 * drawn from a truncated normal distribution around market value.
 *
 * The formula:
 *   P(win | bid b) ≈ F(v(b))^(n-1)
 *
 * Where F is the CDF of a single competitor's bid and v(b) is the
 * valuation implied by bid b under equilibrium strategy.
 *
 * @param bid - Your proposed bid amount
 * @param marketValue - Estimated market value of the property
 * @param numBidders - Number of competing bidders
 * @param marketHeat - Market temperature (0=cold, 1=hot)
 * @returns Win probability between 0 and 1
 *
 * @example
 * calculateWinProbability(500000, 480000, 5, 0.6); // ~0.75
 */
export function calculateWinProbability(
  bid: number,
  marketValue: number,
  numBidders: number,
  marketHeat: number = 0.5
): number {
  const n = Math.max(2, numBidders);

  // Estimate distribution of competing bids
  // In hot markets, distribution shifts up; in cool markets, down
  const heatAdjustment = 1 + (marketHeat - 0.5) * 0.1; // ±5% shift
  const expectedCompetingMax = marketValue * heatAdjustment * ((n - 1) / n);

  // Standard deviation of bid distribution (calibrated to ~5% of market value)
  const sigma = marketValue * 0.05;

  // CDF of highest competing bid (order statistic)
  const z = (bid - expectedCompetingMax) / sigma;
  const singleBidderProb = normalCDF(z);

  // Probability of beating all (n-1) competitors
  return Math.pow(singleBidderProb, n - 1);
}

/**
 * Calculate expected surplus (profit) from winning at a given bid.
 *
 * Formula:
 *   E[Surplus] = P(win) × (V - b) - Risk Penalty
 *
 * The risk penalty accounts for:
 * 1. Winner's curse (overpaying relative to true value)
 * 2. Appraisal gap risk
 * 3. Variance in outcomes for risk-averse bidders
 *
 * @param bid - Proposed bid amount
 * @param valuation - Your estimated property value
 * @param winProb - Probability of winning
 * @param riskParam - CRRA risk parameter (lower = more risk-averse)
 * @returns Expected dollar surplus
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
  // Higher risk aversion (lower α) penalizes uncertain outcomes more
  const riskPenalty = (1 - riskParam) * winProb * (1 - winProb) * surplus * 0.5;

  return expectedSurplus - riskPenalty;
}

// =============================================================================
// BEHAVIORAL ECONOMICS FUNCTIONS
// =============================================================================

/**
 * Calculate the Kőszegi-Rabin loss aversion adjustment factor.
 *
 * Based on Kőszegi & Rabin (2006, 2007) expectations-based reference-dependent
 * preferences and their application to auctions (Lange & Ratan 2010, Rosato 2021).
 *
 * Key insight: As expected win probability increases, losing becomes
 * psychologically more costly due to the "attachment effect" - the bidder
 * begins to feel psychological ownership of the expected outcome.
 *
 * Neuroimaging evidence (Delgado et al. 2008) suggests the "fear of losing"
 * rather than "joy of winning" drives overbidding.
 *
 * @param lossAversion - λ parameter, typically 2.0-2.5 (Kahneman-Tversky)
 * @param winProbability - P(win) ∈ [0, 1]
 * @param desireLevel - Subjective desire for property (1-10)
 * @returns Behavioral adjustment multiplier (1.0 to 1.10)
 *
 * @example
 * // High desire + high win prob = more adjustment
 * calculateLossAversionFactor(2.0, 0.7, 9); // ~1.063
 */
export function calculateLossAversionFactor(
  lossAversion: number,
  winProbability: number,
  desireLevel: number
): number {
  // Higher win probability → stronger attachment → more loss aversion
  // Higher desire → higher psychological stakes
  const attachmentEffect = winProbability * (desireLevel / 10);

  // Loss aversion adjustment: bounded to prevent extreme overbidding
  const factor = 1 + (lossAversion - 1) * attachmentEffect * 0.1;

  // Cap at 10% adjustment to counteract but not amplify irrational overbidding
  return Math.min(factor, 1.1);
}

// =============================================================================
// MAIN OPTIMIZATION FUNCTION
// =============================================================================

/**
 * Calculate the optimal bid for a property.
 *
 * This is the main entry point that integrates all the auction theory:
 *
 * 1. Process market signals (days on market, price reductions)
 * 2. Convert risk tolerance to CRRA parameter
 * 3. Apply winner's curse correction (2020 Nobel Prize: Milgrom-Wilson)
 * 4. Calculate equilibrium bid with risk aversion
 * 5. Adjust for market heat
 * 6. Apply Kőszegi-Rabin loss aversion adjustment
 * 7. Generate conservative and aggressive variants
 *
 * @param params - All input parameters for the calculation
 * @returns Complete bid optimization result with three strategies
 *
 * @example
 * const result = calculateOptimalBid({
 *   listPrice: 750000,
 *   estimatedValue: 760000,
 *   numBidders: 5,
 *   daysOnMarket: 14,
 *   marketHeat: 0.6,
 *   riskTolerance: 0.5,
 *   financingStrength: 0.8,
 *   desireLevel: 7,
 *   priceReduced: false,
 * });
 *
 * console.log(result.optimalBid); // e.g., 725000
 */
export function calculateOptimalBid(
  params: BidCalculationParams
): BidOptimizationResult {
  const {
    estimatedValue,
    numBidders,
    daysOnMarket,
    marketHeat,
    riskTolerance,
    desireLevel,
    priceReduced,
    lossAversion = 2.0, // Default from behavioral economics literature
  } = params;

  // -------------------------------------------------------------------------
  // Step 1: Estimate true market value considering signals (Linkage Principle)
  // -------------------------------------------------------------------------
  let adjustedValue = estimatedValue;

  // Days on market signal: longer = weaker seller position
  const domFactor = Math.max(0.95, 1 - (daysOnMarket / 365) * 0.1);

  // Price reduction signal: indicates motivated seller
  const reductionFactor = priceReduced ? 0.97 : 1.0;

  adjustedValue = estimatedValue * domFactor * reductionFactor;

  // -------------------------------------------------------------------------
  // Step 2: Convert risk tolerance to CRRA parameter
  // -------------------------------------------------------------------------
  // riskTolerance 0→1 maps to α 0.3→1.0
  const alpha = 0.3 + riskTolerance * 0.7;

  // -------------------------------------------------------------------------
  // Step 3: Apply winner's curse correction (2020 Nobel Prize: Milgrom-Wilson)
  // -------------------------------------------------------------------------
  const curseCorrection = getWinnersCurseCorrection(numBidders);
  const valueUncertainty = estimatedValue * 0.05; // 5% estimation error
  const curseCorrectedValue = adjustedValue - curseCorrection * valueUncertainty;

  // -------------------------------------------------------------------------
  // Step 4: Calculate equilibrium bid with CRRA
  // -------------------------------------------------------------------------
  let optimalBid = fpsbaEquilibriumBid(curseCorrectedValue, numBidders, alpha);

  // -------------------------------------------------------------------------
  // Step 5: Adjust for market heat
  // -------------------------------------------------------------------------
  const heatMultiplier = 1 + (marketHeat - 0.5) * 0.08;
  optimalBid *= heatMultiplier;

  // -------------------------------------------------------------------------
  // Step 6: Calculate initial win probability
  // -------------------------------------------------------------------------
  const initialWinProb = calculateWinProbability(
    optimalBid,
    estimatedValue,
    numBidders,
    marketHeat
  );

  // -------------------------------------------------------------------------
  // Step 7: Apply Kőszegi-Rabin loss aversion adjustment
  // -------------------------------------------------------------------------
  const lossAversionFactor = calculateLossAversionFactor(
    lossAversion,
    initialWinProb,
    desireLevel
  );
  optimalBid *= lossAversionFactor;

  // -------------------------------------------------------------------------
  // Step 8: Calculate final win probability and expected surplus
  // -------------------------------------------------------------------------
  const winProbability = calculateWinProbability(
    optimalBid,
    estimatedValue,
    numBidders,
    marketHeat
  );

  const expectedSurplus = calculateExpectedSurplus(
    optimalBid,
    adjustedValue,
    winProbability,
    alpha
  );

  // -------------------------------------------------------------------------
  // Step 9: Generate Conservative and Aggressive variants
  // -------------------------------------------------------------------------
  const conservativeBid = optimalBid * 0.95;
  const aggressiveBid = Math.min(optimalBid * 1.08, estimatedValue * 1.02);

  // -------------------------------------------------------------------------
  // Prepare result
  // -------------------------------------------------------------------------
  const winProbabilities: WinProbabilities = {
    conservative: calculateWinProbability(
      conservativeBid,
      estimatedValue,
      numBidders,
      marketHeat
    ),
    optimal: winProbability,
    aggressive: calculateWinProbability(
      aggressiveBid,
      estimatedValue,
      numBidders,
      marketHeat
    ),
  };

  const modelParameters: ModelParameters = {
    crraAlpha: alpha.toFixed(2),
    winnersCurseCorrection: curseCorrection.toFixed(2),
    bidShadingFactor: ((numBidders - 1) / (numBidders - 1 + alpha)).toFixed(3),
    adjustedValue: Math.round(adjustedValue),
    lossAversionLambda: lossAversion.toFixed(1),
    lossAversionFactor: lossAversionFactor.toFixed(3),
    behavioralAdjustment: ((lossAversionFactor - 1) * 100).toFixed(1) + '%',
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
// ESCALATION CLAUSE OPTIMIZER
// =============================================================================

/**
 * Determine optimal escalation clause parameters.
 *
 * An escalation clause commits the buyer to match competing bids up to a
 * specified cap. From a mechanism design perspective (Milgrom 2004), this
 * is strategically equivalent to bidding min(cap, second_highest_bid + increment).
 *
 * This preserves surplus against weak competition while ensuring
 * competitiveness against strong opponents.
 *
 * @param optimalBid - The calculated optimal starting bid
 * @param maxWTP - Maximum willingness to pay (absolute budget cap)
 * @param numBidders - Number of competing bidders
 * @returns Escalation clause strategy
 *
 * @example
 * optimizeEscalation(500000, 550000, 5);
 * // { startingBid: 500000, increment: 8000, cap: 539000, rationale: "..." }
 */
export function optimizeEscalation(
  optimalBid: number,
  maxWTP: number,
  numBidders: number
): EscalationStrategy {
  // Increment should be large enough to deter, small enough to not overpay
  // Optimal: approximately 1/(n-1) of the gap between bid and max
  const gap = maxWTP - optimalBid;
  const increment = Math.round(gap / (numBidders + 1) / 1000) * 1000; // Round to nearest $1000

  // Cap at max WTP minus small buffer for appraisal risk
  const cap = Math.round(maxWTP * 0.98);

  // Bound increment to reasonable range
  const boundedIncrement = Math.max(1000, Math.min(10000, increment));

  return {
    startingBid: optimalBid,
    increment: boundedIncrement,
    cap,
    rationale: `Start at $${optimalBid.toLocaleString()}, escalate by $${boundedIncrement.toLocaleString()} increments, cap at $${cap.toLocaleString()}`,
  };
}

// =============================================================================
// CONVENIENCE EXPORT: GameTheoryEngine object (for backwards compatibility)
// =============================================================================

/**
 * GameTheoryEngine object for backwards compatibility with prototype.
 *
 * Provides the same interface as the original JavaScript implementation.
 */
export const GameTheoryEngine = {
  winnersCurseTable: WINNERS_CURSE_TABLE,
  getWinnersCurseCorrection,
  fpsbaEquilibriumBid,
  calculateWinProbability,
  calculateExpectedSurplus,
  calculateLossAversionFactor,
  calculateOptimalBid,
  optimizeEscalation,
  normalCDF,
};

export default GameTheoryEngine;
