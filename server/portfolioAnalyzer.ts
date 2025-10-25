/**
 * Portfolio-level risk management and Greek aggregation
 * Institutional-grade portfolio analysis for options trading
 */

import { Opportunity } from '@shared/schema';

export interface PortfolioRisk {
  totalDelta: number;
  totalGamma: number;
  totalTheta: number;
  totalVega: number;
  totalRho: number;
  sectorExposure: Record<string, number>;
  correlationMatrix: number[][];
  maxDrawdown: number;
  sharpeRatio: number;
  portfolioHeat: number; // 0-100 scale of risk utilization
  concentrationRisk: Record<string, number>; // % of portfolio per ticker
}

export interface RiskCheck {
  approved: boolean;
  reason?: string;
  warnings: string[];
  suggestedSizeAdjustment?: number;
  portfolioImpact: {
    deltaChange: number;
    vegaChange: number;
    concentrationChange: number;
  };
}

export interface PositionSize {
  contracts: number;
  percentOfPortfolio: number;
  dollarAmount: number;
  kellyFraction: number;
}

export class PortfolioAnalyzer {
  private readonly MAX_POSITION_SIZE_PERCENT = 5; // Max 5% per position
  private readonly MAX_SECTOR_EXPOSURE = 30; // Max 30% per sector  
  private readonly MAX_PORTFOLIO_HEAT = 75; // Max 75% heat
  private readonly TARGET_DELTA_NEUTRAL = 0.1; // Target delta ±0.1
  
  /**
   * Calculate aggregated Greeks across all positions
   */
  calculatePortfolioGreeks(opportunities: Opportunity[]): PortfolioRisk {
    let totalDelta = 0;
    let totalGamma = 0;
    let totalTheta = 0;
    let totalVega = 0;
    let totalRho = 0;
    
    const sectorExposure: Record<string, number> = {};
    const tickerExposure: Record<string, number> = {};
    const totalValue = opportunities.reduce((sum, opp) => sum + (opp.estimated_cost || 0), 0);
    
    for (const opp of opportunities) {
      // Aggregate Greeks (accounting for position direction)
      const multiplier = opp.signal === 'BUY' ? 1 : -1;
      totalDelta += (opp.delta || 0) * multiplier;
      totalGamma += (opp.gamma || 0) * multiplier;
      totalTheta += (opp.theta || 0) * multiplier;
      totalVega += (opp.vega || 0) * multiplier;
      totalRho += (opp.rho || 0) * multiplier;
      
      // Track sector exposure
      const sector = opp.sector || 'Unknown';
      sectorExposure[sector] = (sectorExposure[sector] || 0) + (opp.estimated_cost || 0);
      
      // Track ticker concentration
      tickerExposure[opp.ticker] = (tickerExposure[opp.ticker] || 0) + (opp.estimated_cost || 0);
    }
    
    // Calculate concentration risk (% of portfolio per ticker)
    const concentrationRisk: Record<string, number> = {};
    for (const [ticker, exposure] of Object.entries(tickerExposure)) {
      concentrationRisk[ticker] = totalValue > 0 ? (exposure / totalValue) * 100 : 0;
    }
    
    // Convert sector exposure to percentages
    for (const sector of Object.keys(sectorExposure)) {
      sectorExposure[sector] = totalValue > 0 ? (sectorExposure[sector] / totalValue) * 100 : 0;
    }
    
    // Calculate portfolio heat (risk utilization)
    const portfolioHeat = this.calculatePortfolioHeat(
      totalDelta,
      totalVega,
      Object.values(concentrationRisk)
    );
    
    // Calculate risk metrics
    const maxDrawdown = this.estimateMaxDrawdown(totalDelta, totalGamma, totalVega);
    const sharpeRatio = this.estimateSharpeRatio(opportunities);
    
    // Simplified correlation matrix (would need historical data for accurate calculation)
    const correlationMatrix = this.estimateCorrelationMatrix(opportunities);
    
    return {
      totalDelta,
      totalGamma,
      totalTheta,
      totalVega,
      totalRho,
      sectorExposure,
      correlationMatrix,
      maxDrawdown,
      sharpeRatio,
      portfolioHeat,
      concentrationRisk
    };
  }
  
  /**
   * Validate a new position against portfolio risk limits
   */
  validateNewPosition(
    newOpp: Opportunity, 
    existingOpps: Opportunity[],
    portfolioValue: number = 100000
  ): RiskCheck {
    const warnings: string[] = [];
    let approved = true;
    let suggestedSizeAdjustment: number | undefined;
    
    // Calculate current portfolio Greeks
    const currentRisk = this.calculatePortfolioGreeks(existingOpps);
    
    // Simulate adding the new position
    const withNewPosition = [...existingOpps, newOpp];
    const newRisk = this.calculatePortfolioGreeks(withNewPosition);
    
    // Check concentration limits
    const newPositionPercent = (newOpp.estimated_cost || 0) / portfolioValue * 100;
    if (newPositionPercent > this.MAX_POSITION_SIZE_PERCENT) {
      warnings.push(`Position size ${newPositionPercent.toFixed(1)}% exceeds ${this.MAX_POSITION_SIZE_PERCENT}% limit`);
      suggestedSizeAdjustment = this.MAX_POSITION_SIZE_PERCENT / newPositionPercent;
      approved = false;
    }
    
    // Check ticker concentration
    const tickerConcentration = newRisk.concentrationRisk[newOpp.ticker] || 0;
    if (tickerConcentration > 10) {
      warnings.push(`${newOpp.ticker} concentration ${tickerConcentration.toFixed(1)}% is high`);
      if (tickerConcentration > 15) {
        approved = false;
        suggestedSizeAdjustment = Math.min(suggestedSizeAdjustment || 1, 10 / tickerConcentration);
      }
    }
    
    // Check sector exposure
    const sector = newOpp.sector || 'Unknown';
    const sectorExposure = newRisk.sectorExposure[sector] || 0;
    if (sectorExposure > this.MAX_SECTOR_EXPOSURE) {
      warnings.push(`${sector} sector exposure ${sectorExposure.toFixed(1)}% exceeds ${this.MAX_SECTOR_EXPOSURE}% limit`);
      approved = false;
      suggestedSizeAdjustment = Math.min(
        suggestedSizeAdjustment || 1, 
        this.MAX_SECTOR_EXPOSURE / sectorExposure
      );
    }
    
    // Check portfolio heat
    if (newRisk.portfolioHeat > this.MAX_PORTFOLIO_HEAT) {
      warnings.push(`Portfolio heat ${newRisk.portfolioHeat.toFixed(0)}% exceeds ${this.MAX_PORTFOLIO_HEAT}% limit`);
      if (newRisk.portfolioHeat > 90) {
        approved = false;
        suggestedSizeAdjustment = Math.min(suggestedSizeAdjustment || 1, 0.5);
      }
    }
    
    // Check delta neutrality
    const deltaChange = Math.abs(newRisk.totalDelta - currentRisk.totalDelta);
    if (Math.abs(newRisk.totalDelta) > this.TARGET_DELTA_NEUTRAL) {
      warnings.push(`Portfolio delta ${newRisk.totalDelta.toFixed(3)} deviates from neutral`);
    }
    
    // Check vega exposure
    const vegaChange = Math.abs(newRisk.totalVega - currentRisk.totalVega);
    if (Math.abs(newRisk.totalVega) > 50) {
      warnings.push(`High vega exposure: ${newRisk.totalVega.toFixed(1)}`);
    }
    
    return {
      approved,
      reason: approved ? undefined : warnings[0],
      warnings,
      suggestedSizeAdjustment,
      portfolioImpact: {
        deltaChange,
        vegaChange,
        concentrationChange: tickerConcentration - (currentRisk.concentrationRisk[newOpp.ticker] || 0)
      }
    };
  }
  
  /**
   * Calculate optimal position size using Kelly Criterion with adjustments
   */
  calculateOptimalPositionSize(
    opp: Opportunity, 
    portfolioValue: number,
    portfolioHeat: number,
    winRate: number = 0.55
  ): PositionSize {
    // Kelly formula: f = (p*b - q) / b
    // where p = probability of win, q = probability of loss, b = win/loss ratio
    const p = winRate;
    const q = 1 - winRate;
    const b = opp.risk_reward || 2; // Use risk/reward ratio
    
    let kellyFraction = (p * b - q) / b;
    
    // Apply portfolio heat adjustment (reduce size as portfolio gets hotter)
    const heatAdjustment = 1 - (portfolioHeat / 200); // 50% reduction at 100% heat
    kellyFraction *= heatAdjustment;
    
    // Apply volatility adjustment (reduce size for higher IV)
    const ivAdjustment = Math.max(0.5, 1 - (opp.front_iv || 0) / 200);
    kellyFraction *= ivAdjustment;
    
    // Cap at maximum position size
    kellyFraction = Math.min(kellyFraction, this.MAX_POSITION_SIZE_PERCENT / 100);
    kellyFraction = Math.max(kellyFraction, 0.005); // Minimum 0.5% position
    
    // Calculate actual position metrics
    const dollarAmount = portfolioValue * kellyFraction;
    const optionPrice = opp.estimated_cost || 100;
    const contracts = Math.max(1, Math.floor(dollarAmount / optionPrice));
    const percentOfPortfolio = (contracts * optionPrice) / portfolioValue * 100;
    
    return {
      contracts,
      percentOfPortfolio,
      dollarAmount: contracts * optionPrice,
      kellyFraction
    };
  }
  
  /**
   * Calculate portfolio heat (overall risk utilization)
   */
  private calculatePortfolioHeat(
    totalDelta: number,
    totalVega: number,
    concentrations: number[]
  ): number {
    // Delta component (0-30 points)
    const deltaHeat = Math.min(30, Math.abs(totalDelta) * 100);
    
    // Vega component (0-30 points)
    const vegaHeat = Math.min(30, Math.abs(totalVega) / 2);
    
    // Concentration component (0-40 points)
    const maxConcentration = Math.max(...concentrations, 0);
    const concentrationHeat = Math.min(40, maxConcentration * 2);
    
    return deltaHeat + vegaHeat + concentrationHeat;
  }
  
  /**
   * Estimate maximum drawdown based on Greeks
   */
  private estimateMaxDrawdown(
    delta: number,
    gamma: number,
    vega: number
  ): number {
    // Simplified drawdown estimation
    // Assumes 2-sigma move in underlying and 30% IV crush
    const deltaDrawdown = Math.abs(delta) * 0.02 * 100; // 2% underlying move
    const gammaDrawdown = Math.abs(gamma) * 0.0004 * 100; // Gamma impact
    const vegaDrawdown = Math.abs(vega) * 0.3; // 30% IV reduction
    
    return deltaDrawdown + gammaDrawdown + vegaDrawdown;
  }
  
  /**
   * Estimate Sharpe ratio for the portfolio
   */
  private estimateSharpeRatio(opportunities: Opportunity[]): number {
    if (opportunities.length === 0) return 0;
    
    // Simplified Sharpe estimation based on quality scores and risk/reward
    const avgQuality = opportunities.reduce((sum, opp) => sum + (opp.quality_score || 5), 0) / opportunities.length;
    const avgRiskReward = opportunities.reduce((sum, opp) => sum + (opp.risk_reward || 1), 0) / opportunities.length;
    
    // Estimate annualized return and volatility
    const estimatedReturn = (avgQuality / 10) * (avgRiskReward / 2) * 0.15; // 15% base return
    const estimatedVolatility = 0.20; // 20% volatility assumption
    const riskFreeRate = 0.045; // 4.5% risk-free rate
    
    return (estimatedReturn - riskFreeRate) / estimatedVolatility;
  }
  
  /**
   * Estimate correlation matrix for positions
   */
  private estimateCorrelationMatrix(opportunities: Opportunity[]): number[][] {
    const n = opportunities.length;
    const matrix: number[][] = [];
    
    for (let i = 0; i < n; i++) {
      matrix[i] = [];
      for (let j = 0; j < n; j++) {
        if (i === j) {
          matrix[i][j] = 1;
        } else {
          // Simplified correlation based on same ticker or sector
          const opp1 = opportunities[i];
          const opp2 = opportunities[j];
          
          if (opp1.ticker === opp2.ticker) {
            matrix[i][j] = 0.9; // High correlation for same ticker
          } else if (opp1.sector === opp2.sector) {
            matrix[i][j] = 0.5; // Moderate correlation for same sector
          } else {
            matrix[i][j] = 0.2; // Low correlation for different sectors
          }
        }
      }
    }
    
    return matrix;
  }
  
  /**
   * Generate position sizing recommendation with risk adjustments
   */
  generateSizeRecommendation(
    opp: Opportunity,
    portfolioValue: number,
    existingPositions: Opportunity[]
  ): string {
    const currentRisk = this.calculatePortfolioGreeks(existingPositions);
    const optimalSize = this.calculateOptimalPositionSize(
      opp,
      portfolioValue,
      currentRisk.portfolioHeat
    );
    
    const validation = this.validateNewPosition(opp, existingPositions, portfolioValue);
    
    let recommendation = `Recommended: ${optimalSize.contracts} contracts (${optimalSize.percentOfPortfolio.toFixed(1)}% of portfolio)`;
    
    if (!validation.approved && validation.suggestedSizeAdjustment) {
      const adjustedContracts = Math.max(1, Math.floor(optimalSize.contracts * validation.suggestedSizeAdjustment));
      recommendation += `\nAdjusted: ${adjustedContracts} contracts due to risk limits`;
    }
    
    if (validation.warnings.length > 0) {
      recommendation += '\nWarnings: ' + validation.warnings.join(', ');
    }
    
    return recommendation;
  }
}