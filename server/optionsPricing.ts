/**
 * Options Pricing Service
 * Implements Black-Scholes model for option pricing and Greeks calculation
 */

/**
 * Cumulative normal distribution function
 */
function cumulativeNormalDistribution(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp(-x * x / 2);
  const probability = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  
  if (x > 0) {
    return 1 - probability;
  } else {
    return probability;
  }
}

/**
 * Standard normal probability density function
 */
function normalDensity(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

export interface OptionPricingParams {
  stockPrice: number;      // Current stock price
  strikePrice: number;     // Strike price
  timeToExpiration: number; // Time to expiration in years
  volatility: number;      // Implied volatility (annualized)
  riskFreeRate: number;    // Risk-free interest rate
  dividendYield?: number;  // Dividend yield (optional)
}

export interface OptionGreeks {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho: number;
}

export interface OptionPricingResult {
  callPrice: number;
  putPrice: number;
  callGreeks: OptionGreeks;
  putGreeks: OptionGreeks;
  straddlePrice: number;
  straddleDelta: number;
  straddleTheta: number;
  straddleGamma: number;
  straddleVega: number;
}

/**
 * Black-Scholes Option Pricing Model
 */
export class BlackScholesModel {
  /**
   * Calculate option prices and Greeks using Black-Scholes model
   */
  static calculate(params: OptionPricingParams): OptionPricingResult {
    const {
      stockPrice,
      strikePrice,
      timeToExpiration,
      volatility,
      riskFreeRate,
      dividendYield = 0
    } = params;

    // Avoid division by zero for expired options
    if (timeToExpiration <= 0) {
      const intrinsicCallValue = Math.max(0, stockPrice - strikePrice);
      const intrinsicPutValue = Math.max(0, strikePrice - stockPrice);
      
      return {
        callPrice: intrinsicCallValue,
        putPrice: intrinsicPutValue,
        callGreeks: {
          delta: intrinsicCallValue > 0 ? 1 : 0,
          gamma: 0,
          theta: 0,
          vega: 0,
          rho: 0
        },
        putGreeks: {
          delta: intrinsicPutValue > 0 ? -1 : 0,
          gamma: 0,
          theta: 0,
          vega: 0,
          rho: 0
        },
        straddlePrice: intrinsicCallValue + intrinsicPutValue,
        straddleDelta: (intrinsicCallValue > 0 ? 1 : 0) + (intrinsicPutValue > 0 ? -1 : 0),
        straddleTheta: 0,
        straddleGamma: 0,
        straddleVega: 0
      };
    }

    // Calculate d1 and d2
    const sqrtTime = Math.sqrt(timeToExpiration);
    const d1 = (Math.log(stockPrice / strikePrice) + 
                (riskFreeRate - dividendYield + 0.5 * volatility * volatility) * timeToExpiration) / 
               (volatility * sqrtTime);
    const d2 = d1 - volatility * sqrtTime;

    // Calculate probabilities
    const nd1 = cumulativeNormalDistribution(d1);
    const nd2 = cumulativeNormalDistribution(d2);
    const nNegD1 = cumulativeNormalDistribution(-d1);
    const nNegD2 = cumulativeNormalDistribution(-d2);
    const nPrimeD1 = normalDensity(d1);

    // Calculate option prices
    const discountFactor = Math.exp(-riskFreeRate * timeToExpiration);
    const dividendDiscountFactor = Math.exp(-dividendYield * timeToExpiration);
    
    const callPrice = stockPrice * dividendDiscountFactor * nd1 - strikePrice * discountFactor * nd2;
    const putPrice = strikePrice * discountFactor * nNegD2 - stockPrice * dividendDiscountFactor * nNegD1;

    // Calculate Greeks
    // Delta
    const callDelta = dividendDiscountFactor * nd1;
    const putDelta = -dividendDiscountFactor * nNegD1;

    // Gamma (same for call and put)
    const gamma = (dividendDiscountFactor * nPrimeD1) / (stockPrice * volatility * sqrtTime);

    // Theta (per day)
    const callTheta = (
      -stockPrice * dividendDiscountFactor * nPrimeD1 * volatility / (2 * sqrtTime) -
      riskFreeRate * strikePrice * discountFactor * nd2 +
      dividendYield * stockPrice * dividendDiscountFactor * nd1
    ) / 365;
    
    const putTheta = (
      -stockPrice * dividendDiscountFactor * nPrimeD1 * volatility / (2 * sqrtTime) +
      riskFreeRate * strikePrice * discountFactor * nNegD2 -
      dividendYield * stockPrice * dividendDiscountFactor * nNegD1
    ) / 365;

    // Vega (per 1% change in volatility)
    const vega = stockPrice * dividendDiscountFactor * nPrimeD1 * sqrtTime / 100;

    // Rho (per 1% change in interest rate)
    const callRho = strikePrice * timeToExpiration * discountFactor * nd2 / 100;
    const putRho = -strikePrice * timeToExpiration * discountFactor * nNegD2 / 100;

    // Straddle values (combination of call and put)
    const straddlePrice = callPrice + putPrice;
    const straddleDelta = callDelta + putDelta;
    const straddleTheta = callTheta + putTheta;
    const straddleGamma = gamma * 2; // Same gamma for call and put
    const straddleVega = vega * 2; // Same vega for call and put

    return {
      callPrice,
      putPrice,
      callGreeks: {
        delta: callDelta,
        gamma,
        theta: callTheta,
        vega,
        rho: callRho
      },
      putGreeks: {
        delta: putDelta,
        gamma,
        theta: putTheta,
        vega,
        rho: putRho
      },
      straddlePrice,
      straddleDelta,
      straddleTheta,
      straddleGamma,
      straddleVega
    };
  }

  /**
   * Calculate option price at different times to expiration
   * Useful for generating P&L curves at various dates
   */
  static calculateAtTime(
    params: OptionPricingParams,
    daysToExpiration: number
  ): OptionPricingResult {
    return this.calculate({
      ...params,
      timeToExpiration: daysToExpiration / 365
    });
  }

  /**
   * Estimate implied volatility from option prices using Newton-Raphson method
   * This is useful when we need to derive IV from market prices
   */
  static impliedVolatility(
    optionPrice: number,
    stockPrice: number,
    strikePrice: number,
    timeToExpiration: number,
    riskFreeRate: number,
    optionType: 'call' | 'put',
    dividendYield: number = 0
  ): number {
    let iv = 0.3; // Initial guess
    const tolerance = 0.00001;
    const maxIterations = 100;

    for (let i = 0; i < maxIterations; i++) {
      const result = this.calculate({
        stockPrice,
        strikePrice,
        timeToExpiration,
        volatility: iv,
        riskFreeRate,
        dividendYield
      });

      const theoreticalPrice = optionType === 'call' ? result.callPrice : result.putPrice;
      const vega = optionType === 'call' ? result.callGreeks.vega : result.putGreeks.vega;

      const priceDiff = theoreticalPrice - optionPrice;

      if (Math.abs(priceDiff) < tolerance) {
        return iv;
      }

      // Newton-Raphson update
      iv = iv - priceDiff / (vega * 100); // vega is per 1% change

      // Ensure IV stays within reasonable bounds
      iv = Math.max(0.001, Math.min(5, iv));
    }

    return iv; // Return best guess if convergence not achieved
  }

  /**
   * Calculate probability of profit for a straddle position
   * Based on the assumption of log-normal distribution of stock prices
   */
  static probabilityOfProfit(
    currentPrice: number,
    strikePrice: number,
    straddlePremium: number,
    volatility: number,
    timeToExpiration: number
  ): number {
    // Breakeven points for straddle
    const upperBreakeven = strikePrice + straddlePremium;
    const lowerBreakeven = strikePrice - straddlePremium;

    // Calculate probability of stock price being outside breakeven points
    const sqrtTime = Math.sqrt(timeToExpiration);
    const volSqrtTime = volatility * sqrtTime;

    // Probability of stock > upper breakeven
    const d1Upper = (Math.log(currentPrice / upperBreakeven) + 0.5 * volatility * volatility * timeToExpiration) / volSqrtTime;
    const probUpper = cumulativeNormalDistribution(d1Upper);

    // Probability of stock < lower breakeven
    const d1Lower = (Math.log(currentPrice / lowerBreakeven) + 0.5 * volatility * volatility * timeToExpiration) / volSqrtTime;
    const probLower = 1 - cumulativeNormalDistribution(d1Lower);

    // Total probability of profit
    return probUpper + probLower;
  }
}

/**
 * Simplified straddle premium calculator
 * Uses approximation formula for quick estimates
 */
export function estimateStraddlePremium(
  stockPrice: number,
  impliedVolatility: number,
  daysToExpiration: number
): number {
  // Approximation: Straddle Premium ≈ Stock Price × IV × √(DTE/365) × 0.8
  // The 0.8 factor accounts for the at-the-money premium multiplier
  const timeToExpiration = daysToExpiration / 365;
  const premium = stockPrice * impliedVolatility * Math.sqrt(timeToExpiration) * 0.8;
  return premium;
}

/**
 * Calculate key metrics for a straddle position
 */
export interface StraddleMetrics {
  premium: number;
  upperBreakeven: number;
  lowerBreakeven: number;
  maxLoss: number;
  maxProfit: string; // "Unlimited"
  profitProbability: number;
  delta: number;
  theta: number;
  gamma: number;
  vega: number;
}

export function calculateStraddleMetrics(
  stockPrice: number,
  strikePrice: number,
  impliedVolatility: number,
  daysToExpiration: number,
  riskFreeRate: number = 0.05
): StraddleMetrics {
  const timeToExpiration = daysToExpiration / 365;
  
  const pricing = BlackScholesModel.calculate({
    stockPrice,
    strikePrice,
    timeToExpiration,
    volatility: impliedVolatility,
    riskFreeRate,
    dividendYield: 0
  });

  const profitProbability = BlackScholesModel.probabilityOfProfit(
    stockPrice,
    strikePrice,
    pricing.straddlePrice,
    impliedVolatility,
    timeToExpiration
  );

  return {
    premium: pricing.straddlePrice,
    upperBreakeven: strikePrice + pricing.straddlePrice,
    lowerBreakeven: strikePrice - pricing.straddlePrice,
    maxLoss: pricing.straddlePrice,
    maxProfit: "Unlimited",
    profitProbability: profitProbability * 100, // Convert to percentage
    delta: pricing.straddleDelta,
    theta: pricing.straddleTheta,
    gamma: pricing.straddleGamma,
    vega: pricing.straddleVega
  };
}