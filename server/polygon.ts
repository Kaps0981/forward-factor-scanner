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
          }));

        allOptions.push(...pageOptions);
        nextUrl = response.data.next_url;
        pageCount++;

        // Small delay between pagination requests
        if (nextUrl) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      console.log(`Fetched ${allOptions.length} options for ${ticker} (${pageCount} pages), ${allOptions.filter(o => o.implied_volatility).length} with IV`);
      
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
}
