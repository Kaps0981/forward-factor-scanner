import { type Opportunity } from '@shared/schema';

export interface QualityAnalysis {
  isQuality: boolean;
  rejectionReasons: string[];
  rating: number; // 1-10
  probability: number; // 50-85%
  riskReward: number; // 2-5x
}

/**
 * Calculate recommended position size based on minimum liquidity between front and back months
 * Returns number of contracts recommended (5-10% of smaller OI)
 */
export function calculatePositionSize(opp: Opportunity): number {
  // Get front and back month straddle OI
  const frontOI = opp.straddle_oi || 0;
  const backOI = opp.back_straddle_oi || 0;
  
  // Use the MINIMUM of front and back OI as the bottleneck
  const minOI = Math.min(frontOI, backOI);
  
  // If either is 0, return 0 (no position recommended)
  if (minOI === 0) return 0;
  
  // Calculate position size as 5-10% of minimum OI
  // Use 5% for lower liquidity, 10% for higher liquidity
  let percentage = 0.05; // Default 5%
  
  if (minOI >= 1000) {
    percentage = 0.10; // 10% for high liquidity
  } else if (minOI >= 500) {
    percentage = 0.075; // 7.5% for medium liquidity
  } else if (minOI >= 250) {
    percentage = 0.06; // 6% for lower medium liquidity
  }
  // else keep at 5% for low liquidity
  
  // Calculate position size and round down (conservative)
  const positionSize = Math.floor(minOI * percentage);
  
  // Cap at reasonable maximums based on liquidity tiers
  if (minOI < 100) return Math.min(positionSize, 5); // Max 5 contracts for very low liquidity
  if (minOI < 250) return Math.min(positionSize, 10); // Max 10 contracts for low liquidity
  if (minOI < 500) return Math.min(positionSize, 25); // Max 25 contracts for medium liquidity
  if (minOI < 1000) return Math.min(positionSize, 50); // Max 50 contracts for good liquidity
  
  return positionSize; // No cap for excellent liquidity (>1000 OI)
}

/**
 * Generate execution warnings based on liquidity and market conditions
 */
export function generateExecutionWarnings(opp: Opportunity): string[] {
  const warnings: string[] = [];
  
  // Always include critical strike verification warning
  warnings.push("VERIFY EXACT STRIKES: Average OI may be misleading, check specific ATM strikes before trading");
  
  // Check back month liquidity
  const backOI = opp.back_straddle_oi || 0;
  if (backOI < 100) {
    warnings.push(`CRITICAL - BACK MONTH LIQUIDITY: Back month has only ${backOI} straddle OI - verify exact strikes and consider reducing position size`);
  } else if (backOI < 250) {
    warnings.push(`CHECK BACK MONTH: Back month shows ${backOI} straddle OI - expect wider spreads on back leg`);
  }
  
  // Compare front and back liquidity
  const frontOI = opp.straddle_oi || 0;
  if (backOI > 0 && frontOI > 0) {
    const liquidityRatio = backOI / frontOI;
    if (liquidityRatio < 0.5) {
      warnings.push(`LIQUIDITY IMBALANCE: Back month has ${Math.round(liquidityRatio * 100)}% of front month liquidity - back leg will be harder to execute`);
    }
  }
  
  // Add slippage warning for low liquidity
  const minOI = Math.min(frontOI, backOI);
  if (minOI < 50) {
    warnings.push("EXTREME SLIPPAGE RISK: Expected slippage 20-30% with very low liquidity - use limit orders only");
  } else if (minOI < 100) {
    warnings.push("HIGH SLIPPAGE RISK: Expected slippage 15-20% with low liquidity - avoid market orders");
  } else if (minOI < 250) {
    warnings.push("SLIPPAGE WARNING: Expected slippage 10-15% - use careful order management");
  }
  
  // Warn about put/call imbalance
  if (opp.oi_put_call_ratio !== undefined && opp.oi_put_call_ratio !== null) {
    if (opp.oi_put_call_ratio > 2.5) {
      warnings.push("PUT SKEW ALERT: Heavy put positioning may indicate hedging activity - expect put premiums to be elevated");
    } else if (opp.oi_put_call_ratio < 0.4) {
      warnings.push("CALL SKEW ALERT: Heavy call positioning may indicate speculation - expect call premiums to be elevated");
    }
  }
  
  // Warn about very short front DTE
  if (opp.front_dte < 14) {
    warnings.push(`SHORT DTE WARNING: Front month expires in ${opp.front_dte} days - gamma risk increases rapidly near expiration`);
  }
  
  // Warn about earnings if applicable
  if (opp.has_earnings_soon) {
    warnings.push("EARNINGS WARNING: Upcoming earnings may cause significant IV changes - monitor closely");
  }
  
  return warnings;
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
  
  // Get IVR values for analysis
  const frontIVR = opp.front_ivr || 50; // Default to normal if not available
  const backIVR = opp.back_ivr || 50;
  const avgIVR = (frontIVR + backIVR) / 2;
  
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
  
  // Filter 6: Enhanced liquidity check using BOTH front and back month straddle analysis
  const frontOI = opp.straddle_oi || 0;
  const backOI = opp.back_straddle_oi || 0;
  const minOI = Math.min(frontOI, backOI);
  
  // Check FRONT month liquidity
  if (frontOI !== undefined && frontOI !== null) {
    if (frontOI < 100) {
      rejectionReasons.push(`CRITICAL: Insufficient FRONT month straddle liquidity: Combined OI = ${frontOI} (minimum 100 required for effective trading)`);
      rating -= 3; // Heavy penalty for poor liquidity
    } else if (frontOI < 250) {
      rejectionReasons.push(`WARNING: Low FRONT month straddle liquidity: Combined OI = ${frontOI} (prefer >= 250 for smoother execution)`);
      rating -= 1;
    }
  }
  
  // Check BACK month liquidity (even more critical for calendar spreads)
  if (backOI !== undefined && backOI !== null) {
    if (backOI < 100) {
      rejectionReasons.push(`CRITICAL: Insufficient BACK month straddle liquidity: Combined OI = ${backOI} (minimum 100 required - back leg is the bottleneck!)`);
      rating -= 3; // Heavy penalty for poor back month liquidity
    } else if (backOI < 250) {
      rejectionReasons.push(`WARNING: Low BACK month straddle liquidity: Combined OI = ${backOI} (prefer >= 250 - expect wider spreads on back leg)`);
      rating -= 1;
    }
  }
  
  // Use MINIMUM liquidity for scoring (both legs must be tradeable)
  if (minOI > 0) {
    if (minOI < 100) {
      rejectionReasons.push(`REJECT: Minimum liquidity across both months = ${minOI} OI (need >= 100 for both legs)`);
      rating = Math.max(0, rating - 4); // Severe penalty
    } else if (minOI >= 1000) {
      // Excellent liquidity in BOTH months
      rating += 2;
    } else if (minOI >= 500) {
      // Good liquidity in both months
      rating += 1;
    }
    
    // Check liquidity imbalance between months
    if (frontOI > 0 && backOI > 0) {
      const imbalanceRatio = backOI / frontOI;
      if (imbalanceRatio < 0.25) {
        rejectionReasons.push(`SEVERE LIQUIDITY IMBALANCE: Back month has only ${Math.round(imbalanceRatio * 100)}% of front month liquidity - back leg execution will be very difficult`);
        rating -= 2;
      } else if (imbalanceRatio < 0.5) {
        rejectionReasons.push(`LIQUIDITY IMBALANCE: Back month has ${Math.round(imbalanceRatio * 100)}% of front month liquidity - expect challenges with back leg`);
        rating -= 1;
      }
    }
  }

  // Check put/call ratio for market sentiment (front month)
  if (opp.oi_put_call_ratio !== undefined && opp.oi_put_call_ratio !== null) {
    if (opp.oi_put_call_ratio > 2.0) {
      rejectionReasons.push(`CAUTION: Heavily skewed put interest (P/C ratio: ${opp.oi_put_call_ratio.toFixed(2)}) - potential downside hedge demand`);
    } else if (opp.oi_put_call_ratio < 0.5) {
      rejectionReasons.push(`CAUTION: Heavily skewed call interest (P/C ratio: ${opp.oi_put_call_ratio.toFixed(2)}) - potential upside speculation`);
    }
  }

  // IVR-based strategy recommendations
  if (avgIVR > 70 && opp.forward_factor > 0) {
    // High IVR + Positive FF = Aligned signal (SELL premium in high vol)
    rejectionReasons.push(`PREMIUM SELL OPPORTUNITY: High volatility regime (IVR: ${avgIVR.toFixed(0)}) aligns with sell signal - favorable conditions for selling premium`);
    rating += 1; // Boost rating for aligned signals
  } else if (avgIVR < 30 && opp.forward_factor < 0) {
    // Low IVR + Negative FF = Aligned signal (BUY premium in low vol)
    rejectionReasons.push(`PREMIUM BUY OPPORTUNITY: Low volatility regime (IVR: ${avgIVR.toFixed(0)}) aligns with buy signal - favorable conditions for buying premium`);
    rating += 1; // Boost rating for aligned signals
  } else if (avgIVR > 70 && opp.forward_factor < 0) {
    // High IVR + Negative FF = Conflicting signals
    rejectionReasons.push(`CAUTION: Mixed signals - High IVR (${avgIVR.toFixed(0)}) suggests sell, but FF indicates buy. Consider reduced position size.`);
    rating -= 1; // Reduce rating for conflicting signals
  } else if (avgIVR < 30 && opp.forward_factor > 0) {
    // Low IVR + Positive FF = Conflicting signals
    rejectionReasons.push(`CAUTION: Mixed signals - Low IVR (${avgIVR.toFixed(0)}) suggests buy, but FF indicates sell. Consider reduced position size.`);
    rating -= 1; // Reduce rating for conflicting signals
  }

  // Use minimum liquidity score for rating adjustment
  const minLiquidityScore = Math.min(
    opp.liquidity_score || 0,
    opp.back_liquidity_score || 0
  );
  if (minLiquidityScore > 0) {
    if (minLiquidityScore < 4) {
      rating -= 2; // Poor liquidity in at least one month
    } else if (minLiquidityScore >= 7) {
      rating += 1; // Excellent liquidity in both months
    }
  }
  
  // Fallback to average OI if straddle metrics not available
  if (frontOI === 0 && backOI === 0 && opp.avg_open_interest !== undefined && opp.avg_open_interest !== null) {
    if (opp.avg_open_interest < 100) {
      rejectionReasons.push(`Low liquidity: Avg OI = ${opp.avg_open_interest} (prefer >= 100)`);
      rating -= 1;
    }
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
  
  // Get IVR values for context
  const frontIVR = opp.front_ivr || 50;
  const backIVR = opp.back_ivr || 50;
  const avgIVR = (frontIVR + backIVR) / 2;
  
  // Build IVR context and position sizing recommendation
  let ivrAssessment = '';
  if (avgIVR > 70) {
    ivrAssessment = `HIGH VOLATILITY REGIME (IVR: ${avgIVR.toFixed(0)}): Market is in elevated volatility. `;
    if (opp.forward_factor > 0) {
      ivrAssessment += `This aligns perfectly with selling premium strategies. `;
    } else {
      ivrAssessment += `Caution: High IVR typically favors selling, conflicting with buy signal. `;
    }
    ivrAssessment += `Consider smaller positions due to elevated volatility risk. `;
  } else if (avgIVR < 30) {
    ivrAssessment = `LOW VOLATILITY REGIME (IVR: ${avgIVR.toFixed(0)}): Market is in compressed volatility. `;
    if (opp.forward_factor < 0) {
      ivrAssessment += `This aligns well with buying premium strategies. `;
    } else {
      ivrAssessment += `Caution: Low IVR typically favors buying, conflicting with sell signal. `;
    }
    ivrAssessment += `Potential for volatility expansion - size positions accordingly. `;
  } else {
    ivrAssessment = `NORMAL VOLATILITY REGIME (IVR: ${avgIVR.toFixed(0)}): Market volatility is within typical ranges. `;
    ivrAssessment += `Standard position sizing appropriate. `;
  }
  
  // Build liquidity assessment string
  let liquidityAssessment = '';
  if (opp.straddle_oi !== undefined && opp.liquidity_score !== undefined) {
    if (opp.liquidity_score >= 7) {
      liquidityAssessment = `EXCELLENT LIQUIDITY: ATM straddle OI of ${opp.straddle_oi.toLocaleString()} (Calls: ${opp.atm_call_oi?.toLocaleString() || 'N/A'}, Puts: ${opp.atm_put_oi?.toLocaleString() || 'N/A'}) provides deep liquidity for efficient execution. `;
    } else if (opp.liquidity_score >= 4) {
      liquidityAssessment = `ADEQUATE LIQUIDITY: ATM straddle OI of ${opp.straddle_oi.toLocaleString()} (Calls: ${opp.atm_call_oi?.toLocaleString() || 'N/A'}, Puts: ${opp.atm_put_oi?.toLocaleString() || 'N/A'}) should allow reasonable fills with careful order management. `;
    } else {
      liquidityAssessment = `LIMITED LIQUIDITY WARNING: ATM straddle OI of only ${opp.straddle_oi.toLocaleString()} may result in wide bid-ask spreads and slippage. Consider smaller position sizes. `;
    }
    
    // Add P/C ratio insight if available
    if (opp.oi_put_call_ratio !== undefined && opp.oi_put_call_ratio !== null) {
      if (opp.oi_put_call_ratio > 1.5) {
        liquidityAssessment += `Put-heavy positioning (P/C: ${opp.oi_put_call_ratio.toFixed(2)}) suggests defensive sentiment. `;
      } else if (opp.oi_put_call_ratio < 0.7) {
        liquidityAssessment += `Call-heavy positioning (P/C: ${opp.oi_put_call_ratio.toFixed(2)}) indicates bullish speculation. `;
      }
    }
  }
  
  if (opp.forward_factor > 0) {
    // Positive FF: Front is overpriced
    return `The front-month contract (${opp.front_dte}d) shows implied volatility of ${opp.front_iv.toFixed(1)}%, ` +
           `significantly elevated compared to the forward volatility of ${opp.forward_vol.toFixed(1)}%. ` +
           `This ${absFF.toFixed(1)}% premium suggests the front contract is overpriced relative to the back contract ` +
           `(${opp.back_dte}d at ${opp.back_iv.toFixed(1)}% IV). ` +
           ivrAssessment +
           liquidityAssessment +
           `Consider SELLING front-month volatility through straddles/strangles or buying calendar spreads. ` +
           `Probability of profit: ${analysis.probability}%, Risk/Reward: ${analysis.riskReward}:1`;
  } else {
    // Negative FF: Front is underpriced
    return `The front-month contract (${opp.front_dte}d) shows implied volatility of ${opp.front_iv.toFixed(1)}%, ` +
           `significantly discounted compared to the forward volatility of ${opp.forward_vol.toFixed(1)}%. ` +
           `This ${absFF.toFixed(1)}% discount suggests the front contract is underpriced relative to the back contract ` +
           `(${opp.back_dte}d at ${opp.back_iv.toFixed(1)}% IV). ` +
           ivrAssessment +
           liquidityAssessment +
           `Consider BUYING front-month volatility through straddles/strangles or selling reverse calendar spreads. ` +
           `Probability of profit: ${analysis.probability}%, Risk/Reward: ${analysis.riskReward}:1`;
  }
}