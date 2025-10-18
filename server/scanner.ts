import { PolygonService, type PolygonOption } from './polygon';
import { type Opportunity } from '@shared/schema';

interface ExpirationGroup {
  date: string;
  dte: number;
  options: PolygonOption[];
  atmIV: number;
  avgOpenInterest: number;
  atmCallOI: number;
  atmPutOI: number;
  straddleOI: number;
  oiPutCallRatio: number;
  liquidityScore: number;
}

export const DEFAULT_TICKERS = [
  // High-Growth Tech
  'PLTR', 'SNOW', 'DDOG', 'NET', 'CRWD', 'ZS', 'OKTA', 'PANW', 'MDB', 'HUBS',
  'TEAM', 'ZM', 'DOCU', 'TWLO', 'ESTC',
  // Fintech & Payments
  'SQ', 'COIN', 'SOFI', 'AFRM', 'HOOD', 'NU', 'UPST',
  // E-commerce & Consumer
  'SHOP', 'ETSY', 'W', 'CHWY', 'DASH', 'ABNB', 'UBER', 'LYFT',
  // Semiconductors
  'ARM', 'MRVL', 'MPWR', 'ON', 'SWKS', 'QRVO',
  // Healthcare & Biotech
  'DXCM', 'ISRG', 'ILMN', 'VRTX', 'REGN', 'BIIB', 'MRNA',
  // Energy & Materials
  'FSLR', 'ENPH', 'RUN', 'PLUG', 'DVN', 'FANG', 'MRO', 'OXY',
  // Industrial & Defense
  'RIVN', 'LCID', 'NIO', 'XPEV', 'BA', 'LMT', 'RTX', 'GD',
  // Media & Entertainment
  'ROKU', 'SPOT', 'RBLX', 'U', 'PINS', 'SNAP',
  // Retail & Consumer Staples
  'LULU', 'NKE', 'SBUX', 'CMG', 'MCD', 'YUM',
  // REITs & Real Estate
  'AMT', 'CCI', 'EQIX', 'DLR', 'PSA',
  // Value/Cyclical
  'F', 'GM', 'AAL', 'UAL', 'DAL', 'CCL', 'NCLH', 'RCL', 'X', 'CLF', 'NUE', 'STLD'
];

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

  private calculateAvgOpenInterest(options: PolygonOption[], stockPrice: number): number {
    const atmOptions = options.filter(opt => 
      this.isATM(opt.strike_price, stockPrice) && opt.open_interest
    );

    if (atmOptions.length === 0) {
      return 0;
    }

    const avgOI = atmOptions.reduce((sum, opt) => sum + (opt.open_interest || 0), 0) / atmOptions.length;
    return Math.round(avgOI);
  }

  private calculateStraddleLiquidity(options: PolygonOption[], stockPrice: number): {
    atmCallOI: number;
    atmPutOI: number;
    straddleOI: number;
    oiPutCallRatio: number;
    liquidityScore: number;
  } {
    // Find ATM strike closest to stock price
    const uniqueStrikes = [...new Set(options.map(opt => opt.strike_price))];
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

    // Calculate ATM call and put OI
    const atmCallOI = atmCalls.reduce((sum, opt) => sum + (opt.open_interest || 0), 0) / Math.max(1, atmCalls.length);
    const atmPutOI = atmPuts.reduce((sum, opt) => sum + (opt.open_interest || 0), 0) / Math.max(1, atmPuts.length);
    
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
      const avgOpenInterest = this.calculateAvgOpenInterest(opts, stockPrice);
      const straddleLiquidity = this.calculateStraddleLiquidity(opts, stockPrice);
      
      if (atmIV > 0 && opts.length >= 3) {
        groups.push({ 
          date, 
          dte, 
          options: opts, 
          atmIV, 
          avgOpenInterest,
          atmCallOI: straddleLiquidity.atmCallOI,
          atmPutOI: straddleLiquidity.atmPutOI,
          straddleOI: straddleLiquidity.straddleOI,
          oiPutCallRatio: straddleLiquidity.oiPutCallRatio,
          liquidityScore: straddleLiquidity.liquidityScore
        });
      }
    });

    return groups.sort((a, b) => a.dte - b.dte);
  }

  private calculateForwardFactor(frontIV: number, backIV: number, frontDTE: number, backDTE: number): {
    forwardFactor: number;
    forwardVol: number;
  } {
    const dteDiff = backDTE - frontDTE;
    if (dteDiff <= 0) {
      return { forwardFactor: 0, forwardVol: 0 };
    }

    const frontVar = Math.pow(frontIV / 100, 2) * (frontDTE / 365);
    const backVar = Math.pow(backIV / 100, 2) * (backDTE / 365);
    const forwardVar = backVar - frontVar;

    if (forwardVar <= 0) {
      return { forwardFactor: 0, forwardVol: 0 };
    }

    const forwardVol = Math.sqrt(forwardVar / (dteDiff / 365)) * 100;
    const forwardFactor = ((frontIV - forwardVol) / forwardVol) * 100;

    return { forwardFactor, forwardVol };
  }

  async scanTicker(ticker: string, minFF: number = -100, maxFF: number = 100): Promise<Opportunity[]> {
    try {
      const options = await this.polygon.getOptionsContracts(ticker);
      
      if (options.length === 0) {
        return [];
      }

      const stockPrice = this.estimateStockPrice(options);
      const expirationGroups = this.groupByExpiration(options, stockPrice);

      if (expirationGroups.length < 2) {
        return [];
      }

      const opportunities: Opportunity[] = [];

      for (let i = 0; i < expirationGroups.length - 1; i++) {
        const front = expirationGroups[i];
        const back = expirationGroups[i + 1];

        const { forwardFactor, forwardVol } = this.calculateForwardFactor(
          front.atmIV,
          back.atmIV,
          front.dte,
          back.dte
        );

        if (forwardFactor !== 0 && forwardFactor >= minFF && forwardFactor <= maxFF) {
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
            avg_open_interest: front.avgOpenInterest,
            has_earnings_soon: false, // Will be populated by routes.ts
            // Straddle liquidity metrics from front expiration
            atm_call_oi: front.atmCallOI,
            atm_put_oi: front.atmPutOI,
            straddle_oi: front.straddleOI,
            oi_put_call_ratio: front.oiPutCallRatio,
            liquidity_score: front.liquidityScore,
          });
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
    onProgress?: (current: number, total: number, ticker: string) => void
  ): Promise<Opportunity[]> {
    const allOpportunities: Opportunity[] = [];
    const limitedTickers = tickers.slice(0, 30);

    // Scan 5 tickers in parallel for speed (with unlimited API plan)
    const batchSize = 5;
    
    for (let i = 0; i < limitedTickers.length; i += batchSize) {
      const batch = limitedTickers.slice(i, i + batchSize);
      
      // Scan batch in parallel
      const batchPromises = batch.map(async (ticker, index) => {
        if (onProgress) {
          onProgress(i + index + 1, limitedTickers.length, ticker);
        }
        return this.scanTicker(ticker, minFF, maxFF);
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
