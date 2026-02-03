/**
 * BidOptimizer Type Definitions
 *
 * These types define the data structures used throughout the application,
 * ensuring type safety for all calculations and UI components.
 */

// =============================================================================
// INPUT TYPES - What the user provides
// =============================================================================

/**
 * Parameters for calculating an optimal bid
 *
 * @example
 * const params: BidCalculationParams = {
 *   listPrice: 750000,
 *   estimatedValue: 760000,
 *   numBidders: 5,
 *   daysOnMarket: 14,
 *   marketHeat: 0.6,
 *   riskTolerance: 0.5,
 *   financingStrength: 0.8,
 *   desireLevel: 7,
 *   priceReduced: false,
 *   lossAversion: 2.0
 * };
 */
export interface BidCalculationParams {
  /** The current asking price of the property */
  listPrice: number;

  /** Your estimate of the property's true market value based on comps */
  estimatedValue: number;

  /** Estimated number of competing bidders (1-30) */
  numBidders: number;

  /** How many days the property has been listed */
  daysOnMarket: number;

  /** Market temperature: 0 = buyer's market, 1 = seller's market */
  marketHeat: number;

  /** Your risk tolerance: 0 = conservative, 1 = aggressive */
  riskTolerance: number;

  /** Financing strength: 0 = weak, 1 = all cash */
  financingStrength: number;

  /** How much you want this specific house (1-10) */
  desireLevel: number;

  /** Has the listing price been reduced? */
  priceReduced: boolean;

  /**
   * Kőszegi-Rabin loss aversion parameter (λ)
   * Default: 2.0 (from behavioral economics literature)
   * Higher values = more loss averse
   */
  lossAversion?: number;
}

// =============================================================================
// OUTPUT TYPES - What the engine returns
// =============================================================================

/**
 * Win probabilities for each bid strategy
 */
export interface WinProbabilities {
  /** Probability of winning with conservative bid */
  conservative: number;

  /** Probability of winning with optimal bid */
  optimal: number;

  /** Probability of winning with aggressive bid */
  aggressive: number;
}

/**
 * Model parameters exposed for transparency
 * (shown in "Show Math" section)
 */
export interface ModelParameters {
  /** CRRA risk aversion parameter α (0.3-1.0) */
  crraAlpha: string;

  /** Winner's curse correction in standard deviations */
  winnersCurseCorrection: string;

  /** Bid shading factor: (n-1)/(n-1+α) */
  bidShadingFactor: string;

  /** Value after market signal adjustments */
  adjustedValue: number;

  /** Loss aversion λ parameter */
  lossAversionLambda: string;

  /** Final loss aversion multiplier */
  lossAversionFactor: string;

  /** Behavioral adjustment as percentage */
  behavioralAdjustment: string;
}

/**
 * Escalation clause recommendation
 */
export interface EscalationStrategy {
  /** Initial bid amount */
  startingBid: number;

  /** Amount to outbid competitors by */
  increment: number;

  /** Maximum bid cap */
  cap: number;

  /** Human-readable explanation */
  rationale: string;
}

/**
 * Complete result from bid optimization
 */
export interface BidOptimizationResult {
  /** The game-theoretically optimal bid */
  optimalBid: number;

  /** A more conservative bid (5% lower) */
  conservativeBid: number;

  /** A more aggressive bid (up to 8% higher) */
  aggressiveBid: number;

  /** Win probabilities for each strategy */
  winProbabilities: WinProbabilities;

  /** Expected profit if you win at optimal bid */
  expectedSurplus: number;

  /** Internal model parameters for transparency */
  modelParameters: ModelParameters;
}

/**
 * Complete result including escalation strategy
 */
export interface FullBidResult extends BidOptimizationResult {
  /** Recommended escalation clause parameters */
  escalation: EscalationStrategy;
}

// =============================================================================
// FORM STATE TYPE - For the multi-step form
// =============================================================================

/**
 * Complete form state for the bid calculator UI
 */
export interface BidFormData {
  // Property details
  listPrice: number;
  address: string;
  propertyType: 'single-family' | 'condo' | 'townhouse' | 'multi-family';

  // Market signals
  daysOnMarket: number;
  priceReduced: boolean;
  numBidders: number;
  marketHeat: number;

  // Buyer preferences
  riskTolerance: number;
  desireLevel: number;
  financingStrength: number;
  maxBudget: number;

  // Valuation
  estimatedValue: number;
  compsLow: number;
  compsHigh: number;
}

/**
 * Default values for the form
 */
export const DEFAULT_FORM_DATA: BidFormData = {
  listPrice: 750000,
  address: '',
  propertyType: 'single-family',
  daysOnMarket: 14,
  priceReduced: false,
  numBidders: 3,
  marketHeat: 0.6,
  riskTolerance: 0.5,
  desireLevel: 7,
  financingStrength: 0.8,
  maxBudget: 800000,
  estimatedValue: 760000,
  compsLow: 720000,
  compsHigh: 790000,
};
