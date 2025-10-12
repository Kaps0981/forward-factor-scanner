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

export interface PolygonOptionsResponse {
  results?: PolygonOption[];
  status: string;
  next_url?: string;
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
      const url = `${POLYGON_BASE_URL}/v3/reference/options/contracts`;
      const response = await axios.get<PolygonOptionsResponse>(url, {
        params: {
          underlying_ticker: ticker,
          limit: 250,
          apiKey: this.apiKey,
        },
        timeout: 30000,
      });

      return response.data.results || [];
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
