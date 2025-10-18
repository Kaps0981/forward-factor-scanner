import { type Opportunity } from '@shared/schema';

export interface QualityAnalysis {
  isQuality: boolean;
  rejectionReasons: string[];
  rating: number; // 1-10
  probability: number; // 50-85%
  riskReward: number; // 2-5x
}

/**
 * Apply strict quality filters to eliminate false signals
 * Based on proven methodology from Python analysis
 */
export function analyzeOpportunityQuality(opp: Opportunity): QualityAnalysis {
  const rejectionReasons: string[] = [];
  let rating = 5; // Base rating
  
  const absFF = Math.abs(opp.forward_factor);
  const isInverted = opp.front_iv > opp.back_iv;
  
  // Filter 1: Minimum |FF| threshold (30% for quality)
  if (absFF < 30) {
    rejectionReasons.push(`Forward Factor too low: ${opp.forward_factor.toFixed(1)}% (need |FF| > 30%)`);
    rating -= 2;
  } else if (absFF >= 60) {
    rating += 2; // Excellent signal
  } else if (absFF >= 40) {
    rating += 1; // Good signal
  }
  
  // Filter 2: Reject inverted structures with earnings (common false signal)
  if (isInverted && opp.has_earnings_soon) {
    if (absFF < 40) {
      rejectionReasons.push(
        `FALSE SIGNAL: Inverted term structure (front IV ${opp.front_iv.toFixed(1)}% > back IV ${opp.back_iv.toFixed(1)}%) ` +
        `with earnings soon. This typically indicates post-earnings IV decay, not genuine mispricing.`
      );
      rating = 0; // Reject completely
    }
  } else if (isInverted && absFF < 50) {
    // Inverted without earnings still suspicious
    rejectionReasons.push(
      `WARNING: Inverted term structure without confirmed catalyst. Verify no events between expirations.`
    );
    rating -= 1;
  }
  
  // Filter 3: DTE range (optimal 7-180 days)
  if (opp.front_dte < 7) {
    rejectionReasons.push(`Front DTE too short: ${opp.front_dte} days (need >= 7 for theta management)`);
    rating -= 2;
  } else if (opp.front_dte > 180) {
    rejectionReasons.push(`Front DTE too long: ${opp.front_dte} days (liquidity concerns beyond 180)`);
    rating -= 1;
  }
  
  // Filter 4: IV range sanity check
  if (opp.front_iv < 15) {
    rejectionReasons.push(`Front IV too low: ${opp.front_iv.toFixed(1)}% (need >= 15% for meaningful edge)`);
    rating -= 1;
  } else if (opp.front_iv > 150) {
    rejectionReasons.push(`Front IV extremely high: ${opp.front_iv.toFixed(1)}% (event risk likely)`);
    rating -= 1;
  }
  
  // Filter 5: DTE spread (need reasonable time between expirations)
  const dteDiff = opp.back_dte - opp.front_dte;
  if (dteDiff < 3) {
    rejectionReasons.push(`DTE spread too narrow: ${dteDiff} days (need >= 3 for calendar spreads)`);
    rating -= 2;
  }
  
  // Filter 6: Liquidity check
  if (opp.avg_open_interest !== undefined && opp.avg_open_interest !== null && opp.avg_open_interest < 100) {
    rejectionReasons.push(`Low liquidity: Avg OI = ${opp.avg_open_interest} (prefer >= 100)`);
    rating -= 1;
  }
  
  // Calculate probability based on |FF| magnitude
  let probability = 50; // Base
  if (absFF >= 80) probability = 85;
  else if (absFF >= 60) probability = 80;
  else if (absFF >= 40) probability = 75;
  else if (absFF >= 30) probability = 70;
  else if (absFF >= 20) probability = 65;
  else probability = 60;
  
  // Adjust probability for risk factors
  if (opp.has_earnings_soon) probability *= 0.85;
  if (isInverted && !opp.has_earnings_soon) probability *= 0.9;
  
  // Calculate risk/reward ratio
  let riskReward = 2.0; // Base
  if (absFF >= 80) riskReward = 5.0;
  else if (absFF >= 60) riskReward = 4.0;
  else if (absFF >= 40) riskReward = 3.5;
  else if (absFF >= 30) riskReward = 3.0;
  else riskReward = 2.5;
  
  // Final quality determination
  const isQuality = rejectionReasons.length === 0 && rating >= 6;
  
  return {
    isQuality,
    rejectionReasons,
    rating: Math.max(0, Math.min(10, rating)),
    probability: Math.round(probability),
    riskReward: Math.round(riskReward * 10) / 10
  };
}

/**
 * Generate trading thesis based on opportunity analysis
 */
export function generateTradingThesis(opp: Opportunity, analysis: QualityAnalysis): string {
  const absFF = Math.abs(opp.forward_factor);
  
  if (opp.forward_factor > 0) {
    // Positive FF: Front is overpriced
    return `The front-month contract (${opp.front_dte}d) shows implied volatility of ${opp.front_iv.toFixed(1)}%, ` +
           `significantly elevated compared to the forward volatility of ${opp.forward_vol.toFixed(1)}%. ` +
           `This ${absFF.toFixed(1)}% premium suggests the front contract is overpriced relative to the back contract ` +
           `(${opp.back_dte}d at ${opp.back_iv.toFixed(1)}% IV). ` +
           `Consider SELLING front-month volatility through straddles/strangles or buying calendar spreads. ` +
           `Probability of profit: ${analysis.probability}%, Risk/Reward: ${analysis.riskReward}:1`;
  } else {
    // Negative FF: Front is underpriced
    return `The front-month contract (${opp.front_dte}d) shows implied volatility of ${opp.front_iv.toFixed(1)}%, ` +
           `significantly discounted compared to the forward volatility of ${opp.forward_vol.toFixed(1)}%. ` +
           `This ${absFF.toFixed(1)}% discount suggests the front contract is underpriced relative to the back contract ` +
           `(${opp.back_dte}d at ${opp.back_iv.toFixed(1)}% IV). ` +
           `Consider BUYING front-month volatility through straddles/strangles or selling reverse calendar spreads. ` +
           `Probability of profit: ${analysis.probability}%, Risk/Reward: ${analysis.riskReward}:1`;
  }
}