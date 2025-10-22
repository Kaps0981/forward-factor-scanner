/**
 * Payoff Calculation Service
 * Calculates P&L curves for straddle positions at different times and stock prices
 */

import { BlackScholesModel, calculateStraddleMetrics, type OptionPricingParams } from './optionsPricing';
import type { Opportunity } from '@shared/schema';

export interface PayoffDataPoint {
  stockPrice: number;
  pnl: number;
  percentMove: number;
}

export interface PayoffCurve {
  date: string;
  daysToExpiration: number;
  dataPoints: PayoffDataPoint[];
  isExpiration: boolean;
}

export interface PayoffAnalysis {
  curves: PayoffCurve[];
  metrics: {
    premium: number;
    upperBreakeven: number;
    lowerBreakeven: number;
    maxLoss: number;
    maxProfit: string;
    profitProbability: number;
    currentDelta: number;
    currentTheta: number;
    currentGamma: number;
    currentVega: number;
  };
  currentStockPrice: number;
  strikePrice: number;
  frontIV: number;
  backIV: number;
  frontDTE: number;
  backDTE: number;
  signal: 'BUY' | 'SELL';
  forwardFactor: number;
}

export class PayoffCalculator {
  private riskFreeRate: number = 0.05; // 5% Treasury rate

  /**
   * Calculate complete payoff analysis for a Forward Factor opportunity
   */
  calculatePayoffAnalysis(opportunity: Opportunity, currentStockPrice?: number): PayoffAnalysis {
    // Estimate current stock price if not provided
    const stockPrice = currentStockPrice || this.estimateStockPrice(opportunity);
    const strikePrice = stockPrice; // ATM strike
    
    // Use front month IV for the initial position (we're selling front, buying back)
    const frontIV = opportunity.front_iv / 100; // Convert to decimal
    const backIV = opportunity.back_iv / 100;
    
    // Calculate straddle metrics for the position
    const metrics = calculateStraddleMetrics(
      stockPrice,
      strikePrice,
      frontIV,
      opportunity.front_dte,
      this.riskFreeRate
    );

    // Generate P&L curves for different dates
    const curves = this.generatePayoffCurves(
      stockPrice,
      strikePrice,
      frontIV,
      opportunity.front_dte,
      metrics.premium
    );

    return {
      curves,
      metrics: {
        premium: metrics.premium,
        upperBreakeven: metrics.upperBreakeven,
        lowerBreakeven: metrics.lowerBreakeven,
        maxLoss: metrics.maxLoss,
        maxProfit: metrics.maxProfit,
        profitProbability: metrics.profitProbability,
        currentDelta: metrics.delta,
        currentTheta: metrics.theta,
        currentGamma: metrics.gamma,
        currentVega: metrics.vega
      },
      currentStockPrice: stockPrice,
      strikePrice,
      frontIV: opportunity.front_iv,
      backIV: opportunity.back_iv,
      frontDTE: opportunity.front_dte,
      backDTE: opportunity.back_dte,
      signal: opportunity.signal,
      forwardFactor: opportunity.forward_factor
    };
  }

  /**
   * Generate P&L curves for multiple dates between now and expiration
   */
  private generatePayoffCurves(
    currentStockPrice: number,
    strikePrice: number,
    impliedVolatility: number,
    daysToExpiration: number,
    initialPremium: number
  ): PayoffCurve[] {
    const curves: PayoffCurve[] = [];

    // Define time points: 0% (now), 25%, 50%, 75%, 100% (expiration) of DTE
    const timePoints = [
      { percent: 0, label: 'Current' },
      { percent: 0.25, label: '25% to Exp' },
      { percent: 0.5, label: '50% to Exp' },
      { percent: 0.75, label: '75% to Exp' },
      { percent: 1, label: 'Expiration' }
    ];

    for (const timePoint of timePoints) {
      const daysRemaining = Math.max(0, daysToExpiration * (1 - timePoint.percent));
      const isExpiration = timePoint.percent === 1;
      
      const curve = this.generateSingleCurve(
        currentStockPrice,
        strikePrice,
        impliedVolatility,
        daysRemaining,
        initialPremium,
        isExpiration,
        timePoint.label
      );
      
      curves.push(curve);
    }

    return curves;
  }

  /**
   * Generate a single P&L curve for a specific date
   */
  private generateSingleCurve(
    currentStockPrice: number,
    strikePrice: number,
    impliedVolatility: number,
    daysToExpiration: number,
    initialPremium: number,
    isExpiration: boolean,
    label: string
  ): PayoffCurve {
    const dataPoints: PayoffDataPoint[] = [];
    
    // Generate stock price points from -50% to +50% of current price
    const minPrice = currentStockPrice * 0.5;
    const maxPrice = currentStockPrice * 1.5;
    const priceStep = (maxPrice - minPrice) / 100; // 100 data points

    for (let stockPrice = minPrice; stockPrice <= maxPrice; stockPrice += priceStep) {
      const pnl = this.calculatePnL(
        stockPrice,
        strikePrice,
        impliedVolatility,
        daysToExpiration,
        initialPremium,
        isExpiration
      );

      const percentMove = ((stockPrice - currentStockPrice) / currentStockPrice) * 100;

      dataPoints.push({
        stockPrice,
        pnl,
        percentMove
      });
    }

    return {
      date: label,
      daysToExpiration: Math.round(daysToExpiration),
      dataPoints,
      isExpiration
    };
  }

  /**
   * Calculate P&L at a specific stock price and time
   */
  private calculatePnL(
    stockPrice: number,
    strikePrice: number,
    impliedVolatility: number,
    daysToExpiration: number,
    initialPremium: number,
    isExpiration: boolean
  ): number {
    if (isExpiration || daysToExpiration === 0) {
      // At expiration, P&L is intrinsic value minus premium paid
      const intrinsicValue = Math.abs(stockPrice - strikePrice);
      return intrinsicValue - initialPremium;
    } else {
      // Before expiration, calculate theoretical value
      const pricing = BlackScholesModel.calculate({
        stockPrice,
        strikePrice,
        timeToExpiration: daysToExpiration / 365,
        volatility: impliedVolatility,
        riskFreeRate: this.riskFreeRate,
        dividendYield: 0
      });

      // P&L is current straddle value minus initial premium
      return pricing.straddlePrice - initialPremium;
    }
  }

  /**
   * Estimate current stock price from option data
   * In real trading, we'd use actual stock price, but for demo we estimate
   */
  private estimateStockPrice(opportunity: Opportunity): number {
    // Simple estimation based on typical option pricing patterns
    // In production, we'd fetch actual stock price from Polygon
    // For now, assume ATM strike is close to current price
    
    // Use a base price that makes sense for the IV levels
    // Higher IV typically corresponds to higher priced stocks
    const avgIV = (opportunity.front_iv + opportunity.back_iv) / 2;
    
    // Estimate stock price based on IV levels
    // This is a rough approximation for demo purposes
    if (avgIV > 100) {
      return 150; // High volatility stocks (e.g., meme stocks)
    } else if (avgIV > 60) {
      return 250; // Medium-high volatility (e.g., tech stocks)
    } else if (avgIV > 40) {
      return 350; // Medium volatility (e.g., large cap tech)
    } else {
      return 450; // Low volatility (e.g., mega caps)
    }
  }

  /**
   * Calculate payoff for a calendar spread (more complex Forward Factor trade)
   * This sells front month and buys back month
   */
  calculateCalendarSpreadPayoff(
    opportunity: Opportunity,
    currentStockPrice?: number
  ): PayoffAnalysis {
    const stockPrice = currentStockPrice || this.estimateStockPrice(opportunity);
    const strikePrice = stockPrice; // ATM strike
    
    const frontIV = opportunity.front_iv / 100;
    const backIV = opportunity.back_iv / 100;
    
    // Calculate initial position value (sell front, buy back)
    const frontPricing = BlackScholesModel.calculate({
      stockPrice,
      strikePrice,
      timeToExpiration: opportunity.front_dte / 365,
      volatility: frontIV,
      riskFreeRate: this.riskFreeRate,
      dividendYield: 0
    });

    const backPricing = BlackScholesModel.calculate({
      stockPrice,
      strikePrice,
      timeToExpiration: opportunity.back_dte / 365,
      volatility: backIV,
      riskFreeRate: this.riskFreeRate,
      dividendYield: 0
    });

    // Net debit for calendar spread (pay more for back month)
    const netDebit = backPricing.straddlePrice - frontPricing.straddlePrice;
    
    // For calendar spreads, we focus on the front month expiration
    // The P&L profile changes significantly after front expiration
    const curves = this.generateCalendarCurves(
      stockPrice,
      strikePrice,
      frontIV,
      backIV,
      opportunity.front_dte,
      opportunity.back_dte,
      netDebit
    );

    // Calculate probability of profit based on the spread characteristics
    const profitProbability = this.calculateCalendarProfitProbability(
      stockPrice,
      strikePrice,
      frontIV,
      backIV,
      opportunity.front_dte,
      opportunity.back_dte
    );

    return {
      curves,
      metrics: {
        premium: Math.abs(netDebit),
        upperBreakeven: strikePrice + Math.abs(netDebit),
        lowerBreakeven: strikePrice - Math.abs(netDebit),
        maxLoss: Math.abs(netDebit),
        maxProfit: "Limited",
        profitProbability,
        currentDelta: backPricing.straddleDelta - frontPricing.straddleDelta,
        currentTheta: frontPricing.straddleTheta - backPricing.straddleTheta, // Positive theta
        currentGamma: backPricing.straddleGamma - frontPricing.straddleGamma,
        currentVega: backPricing.straddleVega - frontPricing.straddleVega
      },
      currentStockPrice: stockPrice,
      strikePrice,
      frontIV: opportunity.front_iv,
      backIV: opportunity.back_iv,
      frontDTE: opportunity.front_dte,
      backDTE: opportunity.back_dte,
      signal: opportunity.signal,
      forwardFactor: opportunity.forward_factor
    };
  }

  /**
   * Generate P&L curves for calendar spread
   */
  private generateCalendarCurves(
    currentStockPrice: number,
    strikePrice: number,
    frontIV: number,
    backIV: number,
    frontDTE: number,
    backDTE: number,
    netDebit: number
  ): PayoffCurve[] {
    const curves: PayoffCurve[] = [];
    
    // Time points relative to front expiration
    const timePoints = [
      { daysToFront: frontDTE, label: 'Current' },
      { daysToFront: frontDTE * 0.75, label: '25% to Front Exp' },
      { daysToFront: frontDTE * 0.5, label: '50% to Front Exp' },
      { daysToFront: frontDTE * 0.25, label: '75% to Front Exp' },
      { daysToFront: 0, label: 'Front Expiration' }
    ];

    for (const timePoint of timePoints) {
      const dataPoints: PayoffDataPoint[] = [];
      const minPrice = currentStockPrice * 0.5;
      const maxPrice = currentStockPrice * 1.5;
      const priceStep = (maxPrice - minPrice) / 100;

      for (let stockPrice = minPrice; stockPrice <= maxPrice; stockPrice += priceStep) {
        const daysToBack = backDTE - (frontDTE - timePoint.daysToFront);
        
        // Calculate values for both legs
        let frontValue = 0;
        let backValue = 0;

        if (timePoint.daysToFront > 0) {
          const frontPricing = BlackScholesModel.calculate({
            stockPrice,
            strikePrice,
            timeToExpiration: timePoint.daysToFront / 365,
            volatility: frontIV,
            riskFreeRate: this.riskFreeRate,
            dividendYield: 0
          });
          frontValue = frontPricing.straddlePrice;
        }

        if (daysToBack > 0) {
          const backPricing = BlackScholesModel.calculate({
            stockPrice,
            strikePrice,
            timeToExpiration: daysToBack / 365,
            volatility: backIV,
            riskFreeRate: this.riskFreeRate,
            dividendYield: 0
          });
          backValue = backPricing.straddlePrice;
        }

        // P&L = Back value - Front value - Initial debit
        const pnl = backValue - frontValue - netDebit;
        const percentMove = ((stockPrice - currentStockPrice) / currentStockPrice) * 100;

        dataPoints.push({
          stockPrice,
          pnl,
          percentMove
        });
      }

      curves.push({
        date: timePoint.label,
        daysToExpiration: Math.round(timePoint.daysToFront),
        dataPoints,
        isExpiration: timePoint.daysToFront === 0
      });
    }

    return curves;
  }

  /**
   * Calculate probability of profit for calendar spread
   */
  private calculateCalendarProfitProbability(
    stockPrice: number,
    strikePrice: number,
    frontIV: number,
    backIV: number,
    frontDTE: number,
    backDTE: number
  ): number {
    // For calendar spreads, profit occurs when stock stays near strike
    // Use normal distribution to estimate probability
    const frontTimeToExp = frontDTE / 365;
    const expectedMove = stockPrice * frontIV * Math.sqrt(frontTimeToExp);
    
    // Profit zone is approximately ±1 standard deviation
    const profitZone = expectedMove;
    const upperBound = strikePrice + profitZone;
    const lowerBound = strikePrice - profitZone;
    
    // Calculate probability of stock being within profit zone
    const volSqrtTime = frontIV * Math.sqrt(frontTimeToExp);
    
    const d1Upper = (Math.log(stockPrice / upperBound) + 0.5 * frontIV * frontIV * frontTimeToExp) / volSqrtTime;
    const d1Lower = (Math.log(stockPrice / lowerBound) + 0.5 * frontIV * frontIV * frontTimeToExp) / volSqrtTime;
    
    // Probability of being within bounds
    const probability = Math.abs(d1Upper - d1Lower) / 2;
    
    return Math.min(Math.max(probability * 100, 10), 90); // Keep between 10-90%
  }
}