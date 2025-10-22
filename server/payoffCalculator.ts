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
   * BUY signal: Buy front month, sell back month (reverse calendar)
   * SELL signal: Sell front month, buy back month (calendar spread)
   */
  calculateCalendarSpreadPayoff(
    opportunity: Opportunity,
    currentStockPrice?: number
  ): PayoffAnalysis {
    const stockPrice = currentStockPrice || this.estimateStockPrice(opportunity);
    const strikePrice = stockPrice; // ATM strike
    
    const frontIV = opportunity.front_iv / 100;
    const backIV = opportunity.back_iv / 100;
    
    // Calculate initial position values
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

    // Net debit/credit calculation depends on signal type
    // BUY signal (negative FF): Buy front, sell back -> net cost = front - back (usually negative = we receive)
    // SELL signal (positive FF): Sell front, buy back -> net cost = back - front (usually positive = we pay)
    // Note: We always use absolute value for netDebit in P&L calculations
    const frontCost = frontPricing.straddlePrice;
    const backCost = backPricing.straddlePrice;
    
    // Calculate raw net cost (positive = we pay, negative = we receive)
    const rawNetCost = opportunity.signal === 'BUY' 
      ? frontCost - backCost  // Buy front, sell back
      : backCost - frontCost; // Sell front, buy back
    
    // For P&L calculations, we use the absolute value
    const netDebit = Math.abs(rawNetCost);
    const isNetCredit = rawNetCost < 0;
    
    console.log("=== Calendar Spread Calculation Debug ===");
    console.log("Signal Type:", opportunity.signal);
    console.log("Stock Price:", stockPrice);
    console.log("Strike Price:", strikePrice);
    console.log("Front IV:", opportunity.front_iv, "Back IV:", opportunity.back_iv);
    console.log("Front DTE:", opportunity.front_dte, "Back DTE:", opportunity.back_dte);
    console.log("Front Straddle Price:", frontCost.toFixed(2));
    console.log("Back Straddle Price:", backCost.toFixed(2));
    console.log(`Net ${isNetCredit ? 'Credit' : 'Debit'}: ${netDebit.toFixed(2)}`);
    console.log("Strategy:", opportunity.signal === 'BUY' ? 'REVERSE CALENDAR (Buy front, Sell back)' : 'CALENDAR (Sell front, Buy back)');
    
    // Calculate max profit at front expiration
    const daysRemainingInBack = opportunity.back_dte - opportunity.front_dte;
    const backValueAtFrontExp = BlackScholesModel.calculate({
      stockPrice: strikePrice,
      strikePrice,
      timeToExpiration: daysRemainingInBack / 365,
      volatility: backIV,
      riskFreeRate: this.riskFreeRate,
      dividendYield: 0
    });
    
    // Max profit calculation depends on signal type
    let maxProfitValue: number;
    if (opportunity.signal === 'BUY') {
      // For BUY (reverse calendar): max profit when stock moves far from strike
      // At expiration, front straddle we own has high value, back straddle we're short has less value
      // This is harder to calculate precisely, but roughly: front IV * stockPrice * sqrt(time) - netDebit
      const expectedMove = stockPrice * frontIV * Math.sqrt(opportunity.front_dte / 365);
      maxProfitValue = expectedMove * 0.8 - Math.abs(netDebit); // Conservative estimate
    } else {
      // For SELL (regular calendar): max profit when stock stays at strike
      // Front expires worthless, we still own back month
      maxProfitValue = backValueAtFrontExp.straddlePrice - Math.abs(netDebit);
    }
    
    // For calendar spreads, breakevens are more complex and depend on back month value
    // Approximate breakevens based on typical calendar spread characteristics
    const profitRange = backValueAtFrontExp.straddlePrice * 0.15; // Typical profit zone is about 15% of strike
    const upperBreakeven = strikePrice * (1 + profitRange / strikePrice);
    const lowerBreakeven = strikePrice * (1 - profitRange / strikePrice);
    
    // For calendar spreads, we focus on the front month expiration
    // The P&L profile changes significantly after front expiration
    const curves = this.generateCalendarCurves(
      stockPrice,
      strikePrice,
      frontIV,
      backIV,
      opportunity.front_dte,
      opportunity.back_dte,
      rawNetCost,  // Pass the raw cost (can be negative for credit)
      opportunity.signal
    );

    // Calculate probability of profit based on the spread characteristics
    const profitProbability = this.calculateCalendarProfitProbability(
      stockPrice,
      strikePrice,
      frontIV,
      backIV,
      opportunity.front_dte,
      opportunity.back_dte,
      opportunity.signal
    );

    // Calculate Greeks based on position type
    const greeks = opportunity.signal === 'BUY' 
      ? {
          // BUY: Long front, Short back
          currentDelta: frontPricing.straddleDelta - backPricing.straddleDelta,
          currentTheta: backPricing.straddleTheta - frontPricing.straddleTheta, // Negative theta (we own front)
          currentGamma: frontPricing.straddleGamma - backPricing.straddleGamma,
          currentVega: frontPricing.straddleVega - backPricing.straddleVega
        }
      : {
          // SELL: Short front, Long back
          currentDelta: backPricing.straddleDelta - frontPricing.straddleDelta,
          currentTheta: frontPricing.straddleTheta - backPricing.straddleTheta, // Positive theta (we're short front)
          currentGamma: backPricing.straddleGamma - frontPricing.straddleGamma,
          currentVega: backPricing.straddleVega - frontPricing.straddleVega
        };

    return {
      curves,
      metrics: {
        premium: Math.abs(netDebit),
        upperBreakeven,
        lowerBreakeven,
        maxLoss: Math.abs(netDebit),
        maxProfit: maxProfitValue.toFixed(2),
        profitProbability,
        ...greeks
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
    rawNetCost: number,  // Positive = we pay (debit), Negative = we receive (credit)
    signal: 'BUY' | 'SELL'
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
      
      // Debug logging for expiration curve
      const isExpirationCurve = timePoint.daysToFront === 0;
      let debugPnls: number[] = [];

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
        } else {
          // At front expiration, for calendar spreads (ATM options)
          // Front option expires worthless at strike, has intrinsic value away from strike
          // We use straddle intrinsic value which is the sum of call and put intrinsic values
          frontValue = Math.abs(stockPrice - strikePrice);
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

        // Calculate P&L based on signal type and initial cost/credit
        // rawNetCost: Positive = we paid (debit), Negative = we received (credit)
        
        let pnl: number;
        if (signal === 'BUY') {
          // Reverse calendar: long front, short back
          // Position value at any time = frontValue - backValue
          // P&L = Position value - initial cost (or + initial credit if negative)
          const positionValue = frontValue - backValue;
          pnl = positionValue - rawNetCost;
          // If rawNetCost is negative (credit), subtracting it adds to profit
          // If rawNetCost is positive (debit), subtracting it reduces profit
        } else {
          // Regular calendar: short front, long back  
          // Position value = backValue - frontValue
          // P&L = Position value - initial cost
          const positionValue = backValue - frontValue;
          pnl = positionValue - rawNetCost;
        }
        const percentMove = ((stockPrice - currentStockPrice) / currentStockPrice) * 100;

        dataPoints.push({
          stockPrice,
          pnl,
          percentMove
        });
        
        // Collect P&L values for debugging
        if (isExpirationCurve) {
          debugPnls.push(pnl);
        }
      }
      
      // Debug log for expiration curve shape
      if (isExpirationCurve) {
        const midIdx = Math.floor(debugPnls.length / 2);
        const leftIdx = Math.floor(debugPnls.length / 4);
        const rightIdx = Math.floor(3 * debugPnls.length / 4);
        
        console.log(`=== ${timePoint.label} Curve Shape Debug ===`);
        console.log(`P&L at 25% (${(minPrice + (maxPrice-minPrice)*0.25).toFixed(0)}): ${debugPnls[leftIdx]?.toFixed(2)}`);
        console.log(`P&L at 50% (${strikePrice.toFixed(0)}): ${debugPnls[midIdx]?.toFixed(2)}`);
        console.log(`P&L at 75% (${(minPrice + (maxPrice-minPrice)*0.75).toFixed(0)}): ${debugPnls[rightIdx]?.toFixed(2)}`);
        
        const isTentShaped = debugPnls[midIdx] > debugPnls[leftIdx] && 
                            debugPnls[midIdx] > debugPnls[rightIdx];
        console.log(`Is tent-shaped? ${isTentShaped ? '✓ YES' : '✗ NO'}`);
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
    backDTE: number,
    signal: 'BUY' | 'SELL'
  ): number {
    const frontTimeToExp = frontDTE / 365;
    const expectedMove = stockPrice * frontIV * Math.sqrt(frontTimeToExp);
    const volSqrtTime = frontIV * Math.sqrt(frontTimeToExp);
    
    if (signal === 'BUY') {
      // For reverse calendar (BUY), profit occurs when stock moves AWAY from strike
      // This is the inverse of regular calendar spread
      // Profit zone is outside ±1 standard deviation
      const profitZone = expectedMove * 0.7; // Slightly tighter than 1 std dev
      const upperBound = strikePrice + profitZone;
      const lowerBound = strikePrice - profitZone;
      
      // Calculate probability of stock moving outside the zone
      const d1Upper = (Math.log(stockPrice / upperBound) + 0.5 * frontIV * frontIV * frontTimeToExp) / volSqrtTime;
      const d1Lower = (Math.log(stockPrice / lowerBound) + 0.5 * frontIV * frontIV * frontTimeToExp) / volSqrtTime;
      
      // Probability of being outside bounds (moving significantly)
      const probability = 1 - Math.abs(d1Upper - d1Lower) / 2;
      
      return Math.min(Math.max(probability * 100, 10), 90); // Keep between 10-90%
    } else {
      // For regular calendar (SELL), profit occurs when stock stays near strike
      // Profit zone is approximately ±1 standard deviation
      const profitZone = expectedMove;
      const upperBound = strikePrice + profitZone;
      const lowerBound = strikePrice - profitZone;
      
      // Calculate probability of stock being within profit zone
      const d1Upper = (Math.log(stockPrice / upperBound) + 0.5 * frontIV * frontIV * frontTimeToExp) / volSqrtTime;
      const d1Lower = (Math.log(stockPrice / lowerBound) + 0.5 * frontIV * frontIV * frontTimeToExp) / volSqrtTime;
      
      // Probability of being within bounds
      const probability = Math.abs(d1Upper - d1Lower) / 2;
      
      return Math.min(Math.max(probability * 100, 10), 90); // Keep between 10-90%
    }
  }
}