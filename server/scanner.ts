import { PolygonService, type PolygonOption } from './polygon';
import { type Opportunity } from '@shared/schema';

interface ExpirationGroup {
  date: string;
  dte: number;
  options: PolygonOption[];
  atmIV: number;
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
      // Debug: Check why no ATM options found
      const optionsWithIV = options.filter(opt => opt.implied_volatility);
      const atmOptionsNoIV = options.filter(opt => this.isATM(opt.strike_price, stockPrice));
      console.log(`    ⚠️  No ATM options with IV. Total options: ${options.length}, With IV: ${optionsWithIV.length}, ATM (±10%): ${atmOptionsNoIV.length}`);
      return 0;
    }

    const avgIV = atmOptions.reduce((sum, opt) => sum + (opt.implied_volatility || 0), 0) / atmOptions.length;
    return avgIV * 100;
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
      
      if (atmIV > 0 && opts.length >= 3) {
        groups.push({ date, dte, options: opts, atmIV });
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
      
      console.log(`[${ticker}] Fetched ${options.length} options contracts`);
      
      if (options.length === 0) {
        console.log(`[${ticker}] No options data available`);
        return [];
      }

      const stockPrice = this.estimateStockPrice(options);
      console.log(`[${ticker}] Estimated stock price: $${stockPrice.toFixed(2)}`);
      
      const expirationGroups = this.groupByExpiration(options, stockPrice);
      console.log(`[${ticker}] Found ${expirationGroups.length} valid expiration groups`);

      if (expirationGroups.length < 2) {
        console.log(`[${ticker}] Need at least 2 expirations, only found ${expirationGroups.length}`);
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

        console.log(`[${ticker}] ${front.date} (${front.dte}d, ${front.atmIV.toFixed(1)}%) vs ${back.date} (${back.dte}d, ${back.atmIV.toFixed(1)}%) → FF: ${forwardFactor.toFixed(1)}%`);

        if (forwardFactor !== 0 && forwardFactor >= minFF && forwardFactor <= maxFF) {
          console.log(`[${ticker}] ✓ Found opportunity: FF=${forwardFactor.toFixed(1)}%`);
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
          });
        }
      }
      
      console.log(`[${ticker}] Total opportunities found: ${opportunities.length}`);

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

    for (let i = 0; i < limitedTickers.length; i++) {
      const ticker = limitedTickers[i];
      
      if (onProgress) {
        onProgress(i + 1, limitedTickers.length, ticker);
      }

      const opportunities = await this.scanTicker(ticker, minFF, maxFF);
      allOpportunities.push(...opportunities);
      
      if (i < limitedTickers.length - 1) {
        await this.polygon.waitForRateLimit(12);
      }
    }

    return allOpportunities.sort((a, b) => Math.abs(b.forward_factor) - Math.abs(a.forward_factor));
  }
}
