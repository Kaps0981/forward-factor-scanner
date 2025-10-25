import axios from 'axios';

const POLYGON_BASE_URL = 'https://api.polygon.io';
const API_KEY = process.env.POLYGON_API_KEY;

export interface PolygonOption {
  strike_price: number;
  expiration_date: string;
  implied_volatility?: number;
  delta?: number;
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
  };
  open_interest?: number;
  day?: {
    volume?: number;
  };
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
      const url = `${POLYGON_BASE_URL}/v2/last/trade/${ticker}`;
      const response = await axios.get(url, {
        params: {
          apiKey: this.apiKey,
        },
        timeout: 10000,
      });

      return response.data.results?.p || 0;
    } catch (error) {
      return 0;
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
}
