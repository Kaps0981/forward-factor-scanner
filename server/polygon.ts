import axios from 'axios';

const POLYGON_BASE_URL = 'https://api.polygon.io';
const API_KEY = process.env.POLYGON_API_KEY;

export interface PolygonOption {
  strike_price: number;
  expiration_date: string;
  implied_volatility?: number;
  delta?: number;
  gamma?: number;
  theta?: number;
  vega?: number;
  contract_type: 'call' | 'put';
  last_trade?: {
    price: number;
  };
  open_interest?: number;
  day_volume?: number;
}

export interface PolygonSnapshotOption {
  details?: {
    strike_price?: number;
    expiration_date?: string;
    contract_type?: string;
  };
  greeks?: {
    delta?: number;
    gamma?: number;
    theta?: number;
    vega?: number;
  };
  implied_volatility?: number;
  last_quote?: {
    bid?: number;
    ask?: number;
    bid_size?: number;
    ask_size?: number;
  };
  open_interest?: number;
  day?: {
    volume?: number;
  };
}

export interface BidAskData {
  strike: number;
  expiration: string;
  contractType: 'call' | 'put';
  bid: number;
  ask: number;
  spread: number;
  spreadPercent: number;
  bidSize?: number;
  askSize?: number;
  midPrice: number;
  liquidityScore: number; // 0-100 based on spread, volume, OI
}

export interface OptimalStrike {
  strike: number;
  stockPrice: number;
  moneyness: number; // % from ATM
  liquidityScore: number;
  executionCost: number; // Expected slippage in dollars
  recommendation: 'optimal' | 'acceptable' | 'avoid';
}

export interface PolygonOptionsResponse {
  results?: PolygonOption[];
  status: string;
  next_url?: string;
}

export interface PolygonSnapshotResponse {
  results?: PolygonSnapshotOption[];
  status: string;
}

export interface PolygonTickerDetails {
  ticker: string;
  name?: string;
  market_cap?: number;
  dividend_yield?: number; // Annual dividend yield as DECIMAL (e.g., 0.02 for 2%)
  description?: string;
  primary_exchange?: string;
  market?: string;
  next_earnings_date?: string;
  // Note: Earnings confirmation status requires separate Benzinga Earnings API
}

export class PolygonService {
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || API_KEY || '';
    if (!this.apiKey) {
      throw new Error('Polygon API key not configured');
    }
  }

  async getOptionsContracts(ticker: string): Promise<PolygonOption[]> {
    try {
      const allOptions: PolygonOption[] = [];
      let nextUrl: string | undefined = `${POLYGON_BASE_URL}/v3/snapshot/options/${ticker}`;
      let pageCount = 0;
      const maxPages = 50; // Limit to prevent infinite loops (~500 options max)

      // Paginate through all options
      while (nextUrl && pageCount < maxPages) {
        // Add API key to next_url for pagination
        const requestUrl = pageCount === 0 
          ? nextUrl 
          : (nextUrl.includes('?') ? `${nextUrl}&apiKey=${this.apiKey}` : `${nextUrl}?apiKey=${this.apiKey}`);

        const response = await axios.get<PolygonSnapshotResponse>(requestUrl, {
          params: pageCount === 0 ? {
            apiKey: this.apiKey,
            limit: 250, // Max per page
          } : {},
          timeout: 30000,
        });

        const pageOptions = (response.data.results || [])
          .filter(opt => opt.details?.strike_price && opt.details?.expiration_date)
          .map(opt => ({
            strike_price: opt.details!.strike_price!,
            expiration_date: opt.details!.expiration_date!,
            implied_volatility: opt.implied_volatility,
            delta: opt.greeks?.delta,
            gamma: opt.greeks?.gamma,
            theta: opt.greeks?.theta,
            vega: opt.greeks?.vega,
            contract_type: (opt.details!.contract_type?.toLowerCase() === 'call' ? 'call' : 'put') as 'call' | 'put',
            open_interest: opt.open_interest,
            day_volume: opt.day?.volume,
          }));

        allOptions.push(...pageOptions);
        nextUrl = response.data.next_url;
        pageCount++;

        // Tiny delay between pagination requests (unlimited plan)
        if (nextUrl) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }

      return allOptions;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 429) {
          throw new Error('Rate limit exceeded. Please wait and try again.');
        }
        throw new Error(`Failed to fetch options for ${ticker}: ${error.message}`);
      }
      throw error;
    }
  }

  async getLastQuote(ticker: string): Promise<number> {
    try {
      // Use snapshot endpoint for Stocks plan - more reliable and comprehensive
      const snapshotUrl = `${POLYGON_BASE_URL}/v2/snapshot/locale/us/markets/stocks/tickers/${ticker}`;
      
      try {
        const snapshotResponse = await axios.get(snapshotUrl, {
          params: {
            apiKey: this.apiKey,
          },
          timeout: 10000,
        });
        
        // Get price from snapshot (uses day close or previous close)
        const snapshot = snapshotResponse.data.ticker;
        if (snapshot) {
          const price = snapshot.day?.c || snapshot.prevDay?.c || snapshot.day?.o || snapshot.prevDay?.o;
          if (price) {
            console.log(`Got stock price for ${ticker} from snapshot: $${price.toFixed(2)}`);
            return price;
          }
        }
      } catch (snapshotError) {
        // Fall back to last trade endpoint if snapshot fails
        console.log(`Snapshot failed for ${ticker}, trying last trade endpoint`);
      }
      
      // Fallback to last trade endpoint
      const url = `${POLYGON_BASE_URL}/v2/last/trade/${ticker}`;
      const response = await axios.get(url, {
        params: {
          apiKey: this.apiKey,
        },
        timeout: 10000,
      });

      const price = response.data.results?.p || response.data.results?.price;
      if (price) {
        console.log(`Got stock price for ${ticker} from last trade: $${price.toFixed(2)}`);
        return price;
      }
      
      console.warn(`No price data available for ${ticker}`);
      return 0;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error(`Failed to fetch stock price for ${ticker}: ${error.response?.status} - ${error.response?.data?.status || error.message}`);
      } else {
        console.error(`Failed to fetch stock price for ${ticker}:`, error);
      }
      return 0;
    }
  }

  async getPreviousClose(ticker: string): Promise<{ price: number; change: number; changePercent: number } | null> {
    try {
      const url = `${POLYGON_BASE_URL}/v2/aggs/ticker/${ticker}/prev`;
      const response = await axios.get(url, {
        params: {
          apiKey: this.apiKey,
          adjusted: true,
        },
        timeout: 10000,
      });

      const result = response.data.results?.[0];
      if (result) {
        const currentPrice = await this.getLastQuote(ticker);
        const prevClose = result.c;
        const change = currentPrice - prevClose;
        const changePercent = (change / prevClose) * 100;
        
        return {
          price: prevClose,
          change: change,
          changePercent: changePercent
        };
      }
      return null;
    } catch (error) {
      console.error(`Failed to fetch previous close for ${ticker}:`, error);
      return null;
    }
  }

  async waitForRateLimit(seconds: number = 12): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, seconds * 1000));
  }

  async getTickerDetails(ticker: string): Promise<PolygonTickerDetails | null> {
    try {
      const url = `${POLYGON_BASE_URL}/v3/reference/tickers/${ticker}`;
      const response = await axios.get(url, {
        params: {
          apiKey: this.apiKey,
        },
        timeout: 10000,
      });

      const results = response.data.results;
      if (!results) {
        return null;
      }

      // Extract relevant data from API response
      return {
        ticker: results.ticker || ticker,
        name: results.name,
        market_cap: results.market_cap,
        dividend_yield: results.dividend_yield, // Annual yield as DECIMAL (e.g., 0.02 = 2%)
        description: results.description,
        primary_exchange: results.primary_exchange,
        market: results.market,
        next_earnings_date: results.earnings_announcement?.next_earnings_date,
        // Note: Earnings confirmation requires separate Benzinga Earnings API call
      };
    } catch (error) {
      console.error(`Failed to fetch ticker details for ${ticker}:`, error);
      return null;
    }
  }

  async checkEarningsSoon(ticker: string, daysThreshold: number = 7): Promise<boolean> {
    try {
      const url = `${POLYGON_BASE_URL}/v3/reference/tickers/${ticker}`;
      const response = await axios.get(url, {
        params: {
          apiKey: this.apiKey,
        },
        timeout: 10000,
      });

      // Check if there's a next earnings date
      const earningsDate = response.data.results?.earnings_announcement?.next_earnings_date;
      if (!earningsDate) {
        return false;
      }

      // Calculate days until earnings
      const earningsTime = new Date(earningsDate).getTime();
      const today = new Date().getTime();
      const daysUntil = Math.ceil((earningsTime - today) / (1000 * 60 * 60 * 24));

      return daysUntil >= 0 && daysUntil <= daysThreshold;
    } catch (error) {
      // If API call fails or ticker details unavailable, assume no earnings soon
      return false;
    }
  }

  /**
   * Fetch real-time bid-ask spreads for specific strikes
   * Essential for accurate execution cost estimation
   */
  async getLiveBidAskSpreads(
    ticker: string, 
    strikes: number[], 
    expirations: string[]
  ): Promise<BidAskData[]> {
    try {
      const bidAskData: BidAskData[] = [];
      const url = `${POLYGON_BASE_URL}/v3/snapshot/options/${ticker}`;
      
      // Fetch all options data for ticker
      const response = await axios.get<PolygonSnapshotResponse>(url, {
        params: {
          apiKey: this.apiKey,
          limit: 250,
        },
        timeout: 30000,
      });

      const options = response.data.results || [];
      
      // Filter for requested strikes and expirations
      for (const option of options) {
        if (!option.details?.strike_price || !option.details?.expiration_date) continue;
        
        const strike = option.details.strike_price;
        const expiration = option.details.expiration_date;
        
        if (strikes.includes(strike) && expirations.includes(expiration)) {
          const bid = option.last_quote?.bid || 0;
          const ask = option.last_quote?.ask || 0;
          const spread = ask - bid;
          const midPrice = (bid + ask) / 2;
          const spreadPercent = midPrice > 0 ? (spread / midPrice) * 100 : 999;
          
          // Calculate liquidity score based on spread, volume, and OI
          const volume = option.day?.volume || 0;
          const oi = option.open_interest || 0;
          
          const liquidityScore = this.calculateLiquidityScore(
            spreadPercent,
            volume,
            oi
          );
          
          bidAskData.push({
            strike,
            expiration,
            contractType: (option.details.contract_type?.toLowerCase() === 'call' ? 'call' : 'put') as 'call' | 'put',
            bid,
            ask,
            spread,
            spreadPercent,
            bidSize: option.last_quote?.bid_size,
            askSize: option.last_quote?.ask_size,
            midPrice,
            liquidityScore,
          });
        }
      }
      
      return bidAskData;
    } catch (error) {
      console.error(`Failed to fetch bid-ask spreads for ${ticker}:`, error);
      return [];
    }
  }

  /**
   * Calculate liquidity score based on spread, volume, and open interest
   * Returns 0-100 score (higher is better)
   */
  private calculateLiquidityScore(
    spreadPercent: number, 
    volume: number, 
    openInterest: number
  ): number {
    // Spread component (0-40 points)
    let spreadScore = 40;
    if (spreadPercent <= 2) spreadScore = 40;
    else if (spreadPercent <= 5) spreadScore = 30;
    else if (spreadPercent <= 10) spreadScore = 20;
    else if (spreadPercent <= 20) spreadScore = 10;
    else spreadScore = 0;
    
    // Volume component (0-30 points)
    let volumeScore = 0;
    if (volume >= 1000) volumeScore = 30;
    else if (volume >= 500) volumeScore = 25;
    else if (volume >= 100) volumeScore = 20;
    else if (volume >= 50) volumeScore = 15;
    else if (volume >= 10) volumeScore = 10;
    else if (volume > 0) volumeScore = 5;
    
    // Open Interest component (0-30 points)
    let oiScore = 0;
    if (openInterest >= 5000) oiScore = 30;
    else if (openInterest >= 1000) oiScore = 25;
    else if (openInterest >= 500) oiScore = 20;
    else if (openInterest >= 100) oiScore = 15;
    else if (openInterest >= 50) oiScore = 10;
    else if (openInterest > 0) oiScore = 5;
    
    return spreadScore + volumeScore + oiScore;
  }

  /**
   * Find optimal strikes based on market depth and liquidity
   * Returns strikes with best execution characteristics
   */
  async getOptimalStrikes(
    ticker: string,
    stockPrice: number, 
    options: PolygonOption[]
  ): Promise<OptimalStrike[]> {
    const optimalStrikes: OptimalStrike[] = [];
    
    // Group options by strike
    const strikeMap = new Map<number, PolygonOption[]>();
    for (const option of options) {
      const strike = option.strike_price;
      if (!strikeMap.has(strike)) {
        strikeMap.set(strike, []);
      }
      strikeMap.get(strike)!.push(option);
    }
    
    // Analyze each strike
    for (const [strike, strikeOptions] of strikeMap) {
      // Calculate moneyness (% from ATM)
      const moneyness = ((strike - stockPrice) / stockPrice) * 100;
      
      // Aggregate liquidity metrics across all expirations for this strike
      let totalVolume = 0;
      let totalOI = 0;
      let avgIV = 0;
      let count = 0;
      
      for (const opt of strikeOptions) {
        totalVolume += opt.day_volume || 0;
        totalOI += opt.open_interest || 0;
        if (opt.implied_volatility) {
          avgIV += opt.implied_volatility;
          count++;
        }
      }
      
      if (count > 0) avgIV /= count;
      
      // Estimate execution cost based on typical spreads
      const typicalSpread = this.estimateTypicalSpread(moneyness, totalVolume, totalOI);
      const executionCost = stockPrice * typicalSpread / 100;
      
      // Calculate overall liquidity score
      const liquidityScore = this.calculateLiquidityScore(typicalSpread, totalVolume, totalOI);
      
      // Determine recommendation
      let recommendation: 'optimal' | 'acceptable' | 'avoid' = 'avoid';
      if (Math.abs(moneyness) <= 5 && liquidityScore >= 70) {
        recommendation = 'optimal';
      } else if (Math.abs(moneyness) <= 10 && liquidityScore >= 50) {
        recommendation = 'acceptable';
      }
      
      optimalStrikes.push({
        strike,
        stockPrice,
        moneyness,
        liquidityScore,
        executionCost,
        recommendation,
      });
    }
    
    // Sort by liquidity score (descending)
    return optimalStrikes.sort((a, b) => b.liquidityScore - a.liquidityScore);
  }

  /**
   * Estimate typical spread based on moneyness and liquidity
   */
  private estimateTypicalSpread(
    moneyness: number, 
    volume: number, 
    openInterest: number
  ): number {
    // Base spread increases with distance from ATM
    let baseSpread = 2; // 2% for ATM
    const absMoneyness = Math.abs(moneyness);
    
    if (absMoneyness <= 5) baseSpread = 2;
    else if (absMoneyness <= 10) baseSpread = 5;
    else if (absMoneyness <= 20) baseSpread = 10;
    else baseSpread = 20;
    
    // Adjust for liquidity
    if (volume >= 1000 && openInterest >= 1000) {
      baseSpread *= 0.7; // 30% reduction for high liquidity
    } else if (volume >= 100 && openInterest >= 100) {
      baseSpread *= 0.9; // 10% reduction for moderate liquidity
    } else if (volume < 10 || openInterest < 10) {
      baseSpread *= 1.5; // 50% increase for low liquidity
    }
    
    return baseSpread;
  }

  // Get option spreads for real-time monitoring
  async getOptionSpreads(ticker: string): Promise<any[]> {
    try {
      const contracts = await this.getOptionsSnapshot(ticker);
      if (!contracts || contracts.length === 0) return [];

      // Process contracts to extract spread information
      const spreads = contracts
        .filter((c: any) => c.details && c.details.bid && c.details.ask)
        .map((contract: any) => {
          const bid = contract.details.bid;
          const ask = contract.details.ask;
          const mid = (bid + ask) / 2;
          const spread = ask - bid;
          const spread_pct = mid > 0 ? (spread / mid) * 100 : 0;

          return {
            ticker: contract.underlying_ticker || ticker,
            expiration: contract.details.expiration_date,
            strike: contract.details.strike_price,
            option_type: contract.details.contract_type,
            bid,
            ask,
            mid,
            spread,
            spread_pct,
            volume: contract.day?.volume || 0,
            open_interest: contract.open_interest || 0,
            iv: contract.implied_volatility || 0,
            delta: contract.greeks?.delta || 0,
            gamma: contract.greeks?.gamma || 0,
            theta: contract.greeks?.theta || 0,
            vega: contract.greeks?.vega || 0
          };
        })
        .sort((a: any, b: any) => b.volume - a.volume); // Sort by volume descending

      return spreads;
    } catch (error) {
      console.error(`Error getting option spreads for ${ticker}:`, error);
      return [];
    }
  }
}
