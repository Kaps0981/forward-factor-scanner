import { PolygonService, type PolygonOption } from './polygon';
import { type Opportunity } from '@shared/schema';

interface ExpirationGroup {
  date: string;
  dte: number;
  options: PolygonOption[];
  atmIV: number;
  totalOpenInterest: number;
  atmCallOI: number;
  atmPutOI: number;
  straddleOI: number;
  oiPutCallRatio: number;
  liquidityScore: number;
  totalVolume: number;
}

export const DEFAULT_TICKERS = [
  // High-Growth Tech (20)
  'PLTR', 'SNOW', 'DDOG', 'NET', 'CRWD', 'ZS', 'OKTA', 'PANW', 'MDB', 'HUBS',
  'TEAM', 'ZM', 'DOCU', 'TWLO', 'ESTC', 'PATH', 'BILL', 'GTLB', 'S', 'CFLT',
  // Fintech & Payments (10)
  'SQ', 'COIN', 'SOFI', 'AFRM', 'HOOD', 'NU', 'UPST', 'PYPL', 'V', 'MA',
  // E-commerce & Consumer (12)
  'SHOP', 'ETSY', 'W', 'CHWY', 'DASH', 'ABNB', 'UBER', 'LYFT', 'CAVA', 'BROS', 'DPZ', 'WING',
  // Semiconductors (10)
  'ARM', 'MRVL', 'MPWR', 'ON', 'SWKS', 'QRVO', 'WOLF', 'SLAB', 'SMCI', 'ANET',
  // Healthcare & Biotech (10)
  'DXCM', 'ISRG', 'ILMN', 'VRTX', 'REGN', 'BIIB', 'MRNA', 'TDOC', 'VEEV', 'ALGN',
  // Energy & Materials (10)
  'FSLR', 'ENPH', 'RUN', 'PLUG', 'DVN', 'FANG', 'MRO', 'OXY', 'AR', 'CF',
  // Industrial & Defense (10)
  'RIVN', 'LCID', 'NIO', 'XPEV', 'BA', 'LMT', 'RTX', 'GD', 'NOC', 'HWM',
  // Media & Entertainment (8)
  'ROKU', 'SPOT', 'RBLX', 'U', 'PINS', 'SNAP', 'TTWO', 'EA',
  // Retail & Consumer (5)
  'LULU', 'NKE', 'SBUX', 'CMG', 'MCD',
  // REITs & Real Estate (5)
  'AMT', 'CCI', 'EQIX', 'DLR', 'PSA'
];

export const DTE_STRATEGIES = {
  '30-90': {
    frontDTEMin: 25,
    frontDTEMax: 35,
    backDTEMin: 85,
    backDTEMax: 95,
    minDTEDiff: 50,
    name: '30-90 Days (Optimal)',
    description: 'Highest Sharpe ratio strategy'
  },
  '30-60': {
    frontDTEMin: 25,
    frontDTEMax: 35,
    backDTEMin: 55,
    backDTEMax: 65,
    minDTEDiff: 20,
    name: '30-60 Days (Alternative)',
    description: 'More frequent trading'
  },
  '60-90': {
    frontDTEMin: 55,
    frontDTEMax: 65,
    backDTEMin: 85,
    backDTEMax: 95,
    minDTEDiff: 20,
    name: '60-90 Days (High Return)',
    description: 'Highest CAGR potential'
  },
  'all': {
    frontDTEMin: 0,
    frontDTEMax: 365,
    backDTEMin: 0,
    backDTEMax: 365,
    minDTEDiff: 7,
    name: 'All DTEs',
    description: 'No DTE filtering'
  }
} as const;

export type DTEStrategyType = keyof typeof DTE_STRATEGIES;

export class ForwardFactorScanner {
  private polygon: PolygonService;

  constructor(apiKey?: string) {
    this.polygon = new PolygonService(apiKey);
  }

  private calculateDTE(expirationDate: string): number {
    const expDate = new Date(expirationDate);
    const today = new Date();
    const diffTime = expDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }

  private isATM(strike: number, stockPrice: number, threshold: number = 0.10): boolean {
    const pctDiff = Math.abs((strike - stockPrice) / stockPrice);
    return pctDiff <= threshold;
  }

  private estimateStockPrice(options: PolygonOption[]): number {
    const callsWithDelta = options
      .filter(opt => opt.contract_type === 'call' && opt.delta && opt.delta > 0.4 && opt.delta < 0.6)
      .sort((a, b) => Math.abs((a.delta || 0) - 0.5) - Math.abs((b.delta || 0) - 0.5));

    if (callsWithDelta.length > 0) {
      return callsWithDelta[0].strike_price;
    }

    const midpoint = options.reduce((sum, opt) => sum + opt.strike_price, 0) / options.length;
    return midpoint;
  }

  private calculateATM_IV(options: PolygonOption[], stockPrice: number): number {
    const atmOptions = options.filter(opt => 
      this.isATM(opt.strike_price, stockPrice) && opt.implied_volatility
    );

    if (atmOptions.length === 0) {
      return 0;
    }

    const avgIV = atmOptions.reduce((sum, opt) => sum + (opt.implied_volatility || 0), 0) / atmOptions.length;
    return avgIV * 100;
  }

  private calculateTotalOpenInterest(options: PolygonOption[], stockPrice: number): number {
    const atmOptions = options.filter(opt => 
      this.isATM(opt.strike_price, stockPrice) && opt.open_interest
    );

    if (atmOptions.length === 0) {
      return 0;
    }

    const totalOI = atmOptions.reduce((sum, opt) => sum + (opt.open_interest || 0), 0);
    return Math.round(totalOI);
  }

  private calculateTotalVolume(options: PolygonOption[], stockPrice: number): number {
    // Calculate total volume for ATM options (within 10% of stock price)
    const atmOptions = options.filter(opt => 
      this.isATM(opt.strike_price, stockPrice) && opt.day_volume !== undefined
    );

    if (atmOptions.length === 0) {
      return 0;
    }

    // Sum up the volume across all ATM options
    const totalVolume = atmOptions.reduce((sum, opt) => sum + (opt.day_volume || 0), 0);
    return Math.round(totalVolume);
  }

  private calculateStraddleLiquidity(options: PolygonOption[], stockPrice: number): {
    atmCallOI: number;
    atmPutOI: number;
    straddleOI: number;
    oiPutCallRatio: number;
    liquidityScore: number;
  } {
    // Find ATM strike closest to stock price
    const uniqueStrikes = Array.from(new Set(options.map(opt => opt.strike_price)));
    const atmStrike = uniqueStrikes.reduce((prev, curr) => 
      Math.abs(curr - stockPrice) < Math.abs(prev - stockPrice) ? curr : prev
    );

    // Get ATM options at this strike
    const atmCalls = options.filter(opt => 
      opt.strike_price === atmStrike && opt.contract_type === 'call'
    );
    const atmPuts = options.filter(opt => 
      opt.strike_price === atmStrike && opt.contract_type === 'put'
    );

    // Calculate ATM call and put OI - SUM all OI at the ATM strike (don't average)
    const atmCallOI = atmCalls.reduce((sum, opt) => sum + (opt.open_interest || 0), 0);
    const atmPutOI = atmPuts.reduce((sum, opt) => sum + (opt.open_interest || 0), 0);
    
    // Calculate combined straddle OI
    const straddleOI = atmCallOI + atmPutOI;
    
    // Calculate put/call ratio (0 if no calls)
    const oiPutCallRatio = atmCallOI > 0 ? atmPutOI / atmCallOI : 0;
    
    // Calculate liquidity score (1-10 based on straddle OI)
    let liquidityScore = 1;
    if (straddleOI >= 10000) liquidityScore = 10;
    else if (straddleOI >= 5000) liquidityScore = 9;
    else if (straddleOI >= 2500) liquidityScore = 8;
    else if (straddleOI >= 1000) liquidityScore = 7;
    else if (straddleOI >= 500) liquidityScore = 6;
    else if (straddleOI >= 250) liquidityScore = 5;
    else if (straddleOI >= 100) liquidityScore = 4;
    else if (straddleOI >= 50) liquidityScore = 3;
    else if (straddleOI >= 25) liquidityScore = 2;
    
    return {
      atmCallOI: Math.round(atmCallOI),
      atmPutOI: Math.round(atmPutOI),
      straddleOI: Math.round(straddleOI),
      oiPutCallRatio: Math.round(oiPutCallRatio * 100) / 100,
      liquidityScore
    };
  }

  private groupByExpiration(options: PolygonOption[], stockPrice: number): ExpirationGroup[] {
    const expirations = new Map<string, PolygonOption[]>();

    options.forEach(option => {
      const date = option.expiration_date;
      if (!expirations.has(date)) {
        expirations.set(date, []);
      }
      expirations.get(date)!.push(option);
    });

    const groups: ExpirationGroup[] = [];

    expirations.forEach((opts, date) => {
      const dte = this.calculateDTE(date);
      const atmIV = this.calculateATM_IV(opts, stockPrice);
      const totalOpenInterest = this.calculateTotalOpenInterest(opts, stockPrice);
      const straddleLiquidity = this.calculateStraddleLiquidity(opts, stockPrice);
      const totalVolume = this.calculateTotalVolume(opts, stockPrice);
      
      if (atmIV > 0 && opts.length >= 3) {
        groups.push({ 
          date, 
          dte, 
          options: opts, 
          atmIV, 
          totalOpenInterest,
          atmCallOI: straddleLiquidity.atmCallOI,
          atmPutOI: straddleLiquidity.atmPutOI,
          straddleOI: straddleLiquidity.straddleOI,
          oiPutCallRatio: straddleLiquidity.oiPutCallRatio,
          liquidityScore: straddleLiquidity.liquidityScore,
          totalVolume
        });
      }
    });

    return groups.sort((a, b) => a.dte - b.dte);
  }

  /**
   * Calculate Implied Volatility Rank (IVR) based on current IV levels.
   * This is a mock implementation until we have access to historical IV data.
   * 
   * Full IVR calculation would require 52-week IV history:
   * IVR = (Current IV - 52-week Low) / (52-week High - 52-week Low) * 100
   * 
   * For now, we use a simplified estimation based on absolute IV levels:
   * - IV < 20% → IVR ~20 (low volatility regime)
   * - IV 20-40% → IVR ~50 (normal volatility regime)
   * - IV 40-60% → IVR ~70 (elevated volatility regime)
   * - IV > 60% → IVR ~85 (high volatility regime)
   * 
   * @param currentIV The current implied volatility percentage
   * @returns Estimated IVR value (0-100)
   */
  private calculateIVR(currentIV: number): number {
    // NOTE: This is a placeholder implementation until we have historical IV data
    // A proper IVR calculation requires 52-week historical IV data from the API
    
    if (currentIV < 20) {
      // Low volatility regime - IVR around 20
      return Math.round(15 + (currentIV / 20) * 5);
    } else if (currentIV < 40) {
      // Normal volatility regime - IVR around 50
      const normalized = (currentIV - 20) / 20;
      return Math.round(20 + normalized * 30);
    } else if (currentIV < 60) {
      // Elevated volatility regime - IVR around 70
      const normalized = (currentIV - 40) / 20;
      return Math.round(50 + normalized * 20);
    } else {
      // High volatility regime - IVR around 85
      const normalized = Math.min((currentIV - 60) / 40, 1);
      return Math.round(70 + normalized * 15);
    }
  }

  /**
   * Get IVR context string based on IVR value
   * @param ivr The IVR value (0-100)
   * @returns Context string describing the volatility regime
   */
  private getIVRContext(ivr: number): string {
    if (ivr < 30) {
      return "Low volatility regime";
    } else if (ivr < 50) {
      return "Normal volatility regime";
    } else if (ivr < 70) {
      return "Elevated volatility regime";
    } else {
      return "High volatility regime";
    }
  }

  private calculateForwardFactor(
    frontIV: number, 
    backIV: number, 
    frontDTE: number, 
    backDTE: number,
    options?: {
      excludeEarnings?: boolean;
      hasEarningsInFront?: boolean;
      earningsIVPremium?: number;
    }
  ): {
    forwardFactor: number;
    forwardVol: number;
  } {
    const dteDiff = backDTE - frontDTE;
    if (dteDiff <= 0) {
      return { forwardFactor: 0, forwardVol: 0 };
    }

    // Adjust for earnings if requested
    let adjustedFrontIV = frontIV;
    if (options?.excludeEarnings && options?.hasEarningsInFront) {
      // Default earnings premium is 15% based on historical data
      const earningsPremium = options.earningsIVPremium || 15;
      adjustedFrontIV = Math.max(frontIV - earningsPremium, frontIV * 0.7); // Don't reduce by more than 30%
    }

    const frontVar = Math.pow(adjustedFrontIV / 100, 2) * (frontDTE / 365);
    const backVar = Math.pow(backIV / 100, 2) * (backDTE / 365);
    const forwardVar = backVar - frontVar;

    if (forwardVar <= 0) {
      return { forwardFactor: 0, forwardVol: 0 };
    }

    const forwardVol = Math.sqrt(forwardVar / (dteDiff / 365)) * 100;
    const forwardFactor = ((adjustedFrontIV - forwardVol) / forwardVol) * 100;

    return { forwardFactor, forwardVol };
  }

  /**
   * Apply quality filters to opportunities to maximize Sharpe ratio
   * @param opportunities Array of raw opportunities from scanning
   * @param strategyType Optional strategy type ('30-90' or '60-90') for DTE window matching
   * @returns Filtered and scored opportunities
   */
  applyQualityFilters(opportunities: Opportunity[], strategyType?: '30-90' | '60-90'): Opportunity[] {
    return opportunities.map(opp => {
      const absFF = Math.abs(opp.forward_factor);
      
      // Calculate base quality score from |FF| magnitude
      let qualityScore = 0;
      if (absFF < 30) {
        qualityScore = 0; // Below minimum threshold
      } else if (absFF <= 40) {
        qualityScore = 50 + (absFF - 30) * 2; // Linear scaling 50-70
      } else if (absFF <= 50) {
        qualityScore = 70 + (absFF - 40) * 2; // Linear scaling 70-90
      } else {
        qualityScore = 90 + Math.min(10, absFF - 50); // Cap at 100
      }

      // Calculate liquidity bonuses
      const frontOI = opp.straddle_oi || 0;
      const backOI = opp.back_straddle_oi || 0;
      const totalOI = frontOI + backOI;
      const frontVolume = opp.front_volume || 0;
      const backVolume = opp.back_volume || 0;
      const totalVolume = frontVolume + backVolume;

      // Add OI bonus
      if (totalOI > 5000) {
        qualityScore += 10;
      } else if (totalOI > 2000) {
        qualityScore += 5;
      }

      // Add volume bonus
      if (totalVolume > 2000) {
        qualityScore += 5;
      }

      // Check DTE windows for strategy matching
      const meets30_90Criteria = opp.front_dte >= 25 && opp.front_dte <= 35 && 
                                opp.back_dte >= 85 && opp.back_dte <= 95;
      const meets60_90Criteria = opp.front_dte >= 55 && opp.front_dte <= 65 && 
                                opp.back_dte >= 85 && opp.back_dte <= 95;

      // Add DTE match bonus if strategy is specified
      if (strategyType === '30-90' && meets30_90Criteria) {
        qualityScore += 10;
      } else if (strategyType === '60-90' && meets60_90Criteria) {
        qualityScore += 10;
      }

      // Cap quality score at 100
      qualityScore = Math.min(100, Math.max(0, qualityScore));

      // Determine liquidity rating
      let liquidityRating: 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH' = 'LOW';
      if (totalOI >= 10000 && totalVolume >= 5000) {
        liquidityRating = 'VERY_HIGH';
      } else if (totalOI >= 5000 && totalVolume >= 2000) {
        liquidityRating = 'HIGH';
      } else if (totalOI >= 2000 && totalVolume >= 1000) {
        liquidityRating = 'MEDIUM';
      } else {
        liquidityRating = 'LOW';
      }

      // Determine Kelly sizing recommendation
      let kellySizing: string;
      if (qualityScore > 80) {
        kellySizing = 'Quarter Kelly';
      } else if (qualityScore >= 60) {
        kellySizing = 'Half Kelly';
      } else {
        kellySizing = 'Minimum position';
      }

      // Apply minimum liquidity filters (OI >= 1000, volume >= 500)
      // Only include if meets minimum requirements OR if quality score is very high
      const meetsMinimumLiquidity = totalOI >= 1000 && totalVolume >= 500;
      
      // Return the opportunity with quality fields added
      return {
        ...opp,
        quality_score: Math.round(qualityScore),
        meets_30_90_criteria: meets30_90Criteria,
        meets_60_90_criteria: meets60_90Criteria,
        liquidity_rating: liquidityRating,
        kelly_sizing_recommendation: kellySizing,
        // Mark as filtered if doesn't meet minimum requirements
        is_quality: meetsMinimumLiquidity && absFF >= 30
      };
    })
    // Filter out opportunities that don't meet minimum quality standards
    .filter(opp => {
      const absFF = Math.abs(opp.forward_factor);
      const totalOI = (opp.straddle_oi || 0) + (opp.back_straddle_oi || 0);
      const totalVolume = (opp.front_volume || 0) + (opp.back_volume || 0);
      
      // Must meet minimum |FF| threshold of 30% AND minimum liquidity requirements
      return absFF >= 30 && totalOI >= 1000 && totalVolume >= 500;
    })
    // Sort by quality score descending
    .sort((a, b) => (b.quality_score || 0) - (a.quality_score || 0));
  }

  async scanTicker(
    ticker: string, 
    minFF: number = -100, 
    maxFF: number = 100,
    dteStrategy: DTEStrategyType = '30-90',
    ffCalculationMode: 'raw' | 'ex-earnings' = 'raw'
  ): Promise<Opportunity[]> {
    try {
      const options = await this.polygon.getOptionsContracts(ticker);
      
      if (options.length === 0) {
        return [];
      }

      // Fetch actual stock price and ticker details from Polygon API
      let stockPrice = await this.polygon.getLastQuote(ticker);
      const tickerDetails = await this.polygon.getTickerDetails(ticker);
      
      // Fallback to estimation if API fails
      if (!stockPrice || stockPrice === 0) {
        console.warn(`Failed to fetch stock price for ${ticker}, using estimation`);
        stockPrice = this.estimateStockPrice(options);
      } else {
        console.log(`Fetched actual stock price for ${ticker}: $${stockPrice.toFixed(2)}`);
      }
      
      // Log dividend yield if available
      if (tickerDetails?.dividend_yield) {
        console.log(`${ticker} dividend yield: ${tickerDetails.dividend_yield}%`);
      }
      
      const expirationGroups = this.groupByExpiration(options, stockPrice);

      if (expirationGroups.length < 2) {
        return [];
      }

      // Get DTE configuration
      const dteConfig = DTE_STRATEGIES[dteStrategy];
      const opportunities: Opportunity[] = [];

      // Filter expiration pairs by DTE ranges
      for (let i = 0; i < expirationGroups.length - 1; i++) {
        const front = expirationGroups[i];
        const back = expirationGroups[i + 1];
        
        // Check if DTEs are within strategy ranges
        const frontInRange = front.dte >= dteConfig.frontDTEMin && front.dte <= dteConfig.frontDTEMax;
        const backInRange = back.dte >= dteConfig.backDTEMin && back.dte <= dteConfig.backDTEMax;
        const dteDiff = back.dte - front.dte;
        const diffInRange = dteDiff >= dteConfig.minDTEDiff;
        
        // Only process pairs that match the DTE strategy
        if (frontInRange && backInRange && diffInRange) {
          // For ex-earnings mode, we need to check if earnings is within front month
          // This will be populated later in routes.ts when financial events are checked
          // For now, we'll pass the calculation mode through
          const { forwardFactor, forwardVol } = this.calculateForwardFactor(
            front.atmIV,
            back.atmIV,
            front.dte,
            back.dte,
            {
              excludeEarnings: ffCalculationMode === 'ex-earnings',
              hasEarningsInFront: false, // Will be determined in routes.ts when earnings date is known
              earningsIVPremium: 15 // Based on historical average
            }
          );

          // Use absolute value filtering for FF
          const absFF = Math.abs(forwardFactor);
          if (forwardFactor !== 0 && absFF >= minFF && absFF <= maxFF) {
            // Calculate IVR for both front and back months
            const frontIVR = this.calculateIVR(front.atmIV);
            const backIVR = this.calculateIVR(back.atmIV);
            // Use the average IVR for context (or could use front month as primary)
            const avgIVR = Math.round((frontIVR + backIVR) / 2);
            const ivrContext = this.getIVRContext(avgIVR);
            
            // Log volume calculation for debugging
            if (front.totalVolume > 0 || back.totalVolume > 0) {
              console.log(`${ticker}: Volumes calculated - Front: ${front.totalVolume}, Back: ${back.totalVolume}`);
            }
            
            // Extract Greeks from Polygon data for ATM options
            let greeks = {
              delta: 0,
              gamma: 0,
              theta: 0,
              vega: 0,
              rho: 0
            };

            // Get Greeks from Polygon data if available
            if (stockPrice && stockPrice > 0 && front.options && front.options.length > 0) {
              try {
                // Find ATM options for the front expiration (within 10% of stock price)
                const atmCall = front.options.find(opt => 
                  opt.contract_type === 'call' && 
                  this.isATM(opt.strike_price, stockPrice, 0.10) &&
                  (opt.delta !== undefined || opt.gamma !== undefined || opt.theta !== undefined || opt.vega !== undefined)
                );
                
                const atmPut = front.options.find(opt => 
                  opt.contract_type === 'put' && 
                  this.isATM(opt.strike_price, stockPrice, 0.10) &&
                  (opt.delta !== undefined || opt.gamma !== undefined || opt.theta !== undefined || opt.vega !== undefined)
                );

                // For a straddle position, combine call and put Greeks
                if (atmCall || atmPut) {
                  const callDelta = atmCall?.delta || 0;
                  const putDelta = atmPut?.delta || 0;
                  const callGamma = atmCall?.gamma || 0;
                  const putGamma = atmPut?.gamma || 0;
                  const callTheta = atmCall?.theta || 0;
                  const putTheta = atmPut?.theta || 0;
                  const callVega = atmCall?.vega || 0;
                  const putVega = atmPut?.vega || 0;
                  
                  greeks = {
                    delta: Math.round((callDelta + putDelta) * 100) / 100,
                    gamma: Math.round((callGamma + putGamma) * 1000) / 1000,
                    theta: Math.round((callTheta + putTheta) * 100) / 100, // Negative for long position
                    vega: Math.round((callVega + putVega) * 100) / 100,
                    rho: 0 // Polygon doesn't provide rho
                  };
                  
                  console.log(`${ticker}: Using Greeks from Polygon data - Delta: ${greeks.delta}, Gamma: ${greeks.gamma}, Theta: ${greeks.theta}, Vega: ${greeks.vega}`);
                } else if (stockPrice > 0) {
                  // Fallback to Black-Scholes calculation if Polygon doesn't have Greeks
                  const { BlackScholesModel } = require('./optionsPricing');
                  
                  const frontPricing = BlackScholesModel.calculate({
                    stockPrice: stockPrice,
                    strikePrice: stockPrice, // ATM
                    timeToExpiration: front.dte / 365,
                    volatility: front.atmIV / 100,
                    riskFreeRate: 0.05,
                    dividendYield: tickerDetails?.dividend_yield || 0
                  });

                  greeks = {
                    delta: Math.round((frontPricing.straddleDelta || 0) * 100) / 100,
                    gamma: Math.round((frontPricing.straddleGamma || 0) * 1000) / 1000,
                    theta: Math.round((frontPricing.straddleTheta || 0) * 100) / 100,
                    vega: Math.round((frontPricing.straddleVega || 0) * 100) / 100,
                    rho: Math.round(((frontPricing.callGreeks.rho + frontPricing.putGreeks.rho) || 0) * 100) / 100
                  };
                  
                  console.log(`${ticker}: Calculated Greeks with Black-Scholes (no Polygon Greeks available)`);
                }
              } catch (error) {
                console.error(`Error extracting Greeks for ${ticker}:`, error);
              }
            }
            
            opportunities.push({
              ticker,
              forward_factor: Math.round(forwardFactor * 100) / 100,
              signal: forwardFactor > 0 ? 'SELL' : 'BUY',
              front_date: front.date,
              front_dte: front.dte,
              front_iv: Math.round(front.atmIV * 100) / 100,
              back_date: back.date,
              back_dte: back.dte,
              back_iv: Math.round(back.atmIV * 100) / 100,
              forward_vol: Math.round(forwardVol * 100) / 100,
              avg_open_interest: front.totalOpenInterest,
              has_earnings_soon: false, // Will be populated by routes.ts
              // Front month straddle liquidity metrics
              atm_call_oi: front.atmCallOI,
              atm_put_oi: front.atmPutOI,
              straddle_oi: front.straddleOI,
              oi_put_call_ratio: front.oiPutCallRatio,
              liquidity_score: front.liquidityScore,
              // Back month straddle liquidity metrics
              back_atm_call_oi: back.atmCallOI,
              back_atm_put_oi: back.atmPutOI,
              back_straddle_oi: back.straddleOI,
              back_liquidity_score: back.liquidityScore,
              // Volume fields for liquidity assessment
              front_volume: front.totalVolume,
              back_volume: back.totalVolume,
              // Option Greeks
              delta: greeks.delta,
              gamma: greeks.gamma,
              theta: greeks.theta,
              vega: greeks.vega,
              rho: greeks.rho,
              // IVR fields
              front_ivr: frontIVR,
              back_ivr: backIVR,
              ivr_context: ivrContext,
              // DTE strategy field
              dte_strategy: dteStrategy,
              // FF calculation mode fields
              ff_calculation_mode: ffCalculationMode,
              is_ex_earnings: ffCalculationMode === 'ex-earnings',
              // Stock fundamentals from Polygon API
              stock_price: stockPrice,
              dividend_yield: tickerDetails?.dividend_yield || 0, // Already in decimal format from Polygon
              // Earnings date information  
              earnings_date: tickerDetails?.next_earnings_date,
              // Mark as estimated since Ticker Details API doesn't provide confirmation status
              // (would need separate Benzinga Earnings API call for confirmation)
              earnings_estimated: tickerDetails?.next_earnings_date ? true : undefined,
            });
          }
        }
      }

      return opportunities;
    } catch (error) {
      console.error(`Error scanning ${ticker}:`, error);
      return [];
    }
  }

  async scanMultiple(
    tickers: string[],
    minFF: number = -100,
    maxFF: number = 100,
    dteStrategy: DTEStrategyType = '30-90',
    ffCalculationMode: 'raw' | 'ex-earnings' = 'raw',
    onProgress?: (current: number, total: number, ticker: string) => void
  ): Promise<Opportunity[]> {
    const allOpportunities: Opportunity[] = [];
    const limitedTickers = tickers.slice(0, 100);

    // Scan 5 tickers in parallel for speed (with unlimited API plan)
    const batchSize = 5;
    
    for (let i = 0; i < limitedTickers.length; i += batchSize) {
      const batch = limitedTickers.slice(i, i + batchSize);
      
      // Scan batch in parallel
      const batchPromises = batch.map(async (ticker, index) => {
        if (onProgress) {
          onProgress(i + index + 1, limitedTickers.length, ticker);
        }
        return this.scanTicker(ticker, minFF, maxFF, dteStrategy, ffCalculationMode);
      });

      const batchResults = await Promise.all(batchPromises);
      batchResults.forEach(opportunities => {
        allOpportunities.push(...opportunities);
      });

      // Small delay between batches (0.5s instead of 12s)
      if (i + batchSize < limitedTickers.length) {
        await this.polygon.waitForRateLimit(0.5);
      }
    }

    return allOpportunities.sort((a, b) => Math.abs(b.forward_factor) - Math.abs(a.forward_factor));
  }
}
