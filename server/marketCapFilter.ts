import axios from 'axios';

interface TickerDetails {
  ticker: string;
  name: string;
  market_cap: number;
}

export class MarketCapFilter {
  private apiKey: string;
  
  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }
  
  /**
   * Get stocks with market cap between min and max values
   * @param minMarketCap Minimum market cap in billions
   * @param maxMarketCap Maximum market cap in billions
   * @param limit Maximum number of stocks to return
   */
  async getStocksByMarketCap(
    minMarketCap: number = 2, 
    maxMarketCap: number = 15,
    limit: number = 50
  ): Promise<string[]> {
    try {
      // Convert billions to actual values
      const minCap = minMarketCap * 1_000_000_000;
      const maxCap = maxMarketCap * 1_000_000_000;
      
      // Fetch all active stocks from Polygon
      const response = await axios.get(`https://api.polygon.io/v3/reference/tickers`, {
        params: {
          active: true,
          market: 'stocks',
          type: 'CS', // Common Stock only
          limit: 1000, // Get more stocks to filter
          order: 'desc',
          sort: 'market_cap',
          'market_cap.gte': minCap,
          'market_cap.lte': maxCap,
          apiKey: this.apiKey
        }
      });
      
      if (response.data.status !== 'OK') {
        throw new Error('Failed to fetch tickers from Polygon');
      }
      
      // Extract tickers and filter by exact market cap range
      const tickers = response.data.results
        .filter((ticker: any) => {
          return ticker.market_cap >= minCap && 
                 ticker.market_cap <= maxCap &&
                 ticker.active === true &&
                 ticker.ticker && 
                 !ticker.ticker.includes('.') && // Exclude foreign stocks
                 !ticker.ticker.includes('-'); // Exclude preferred shares
        })
        .slice(0, limit)
        .map((ticker: any) => ticker.ticker);
      
      console.log(`Found ${tickers.length} stocks with market cap between $${minMarketCap}B and $${maxMarketCap}B`);
      
      return tickers;
    } catch (error) {
      console.error('Error fetching stocks by market cap:', error);
      // Fallback to a curated list of mid-cap stocks if API fails
      return this.getFallbackMidCapStocks();
    }
  }
  
  /**
   * Fallback list of quality mid-cap stocks (2-15B market cap)
   * Updated for Q4 2024 market caps
   */
  private getFallbackMidCapStocks(): string[] {
    return [
      // Tech mid-caps (2-15B)
      'SMCI', 'APP', 'ESTC', 'PATH', 'CFLT', 'ZI', 'TENB', 'BRZE', 'AI', 'NEWR',
      'PEGA', 'NCNO', 'ALTR', 'EXTR', 'ASAN', 'FIVN', 'PRCT', 'CWAN', 'BLKB', 'NICE',
      
      // Healthcare mid-caps
      'ACAD', 'BMRN', 'INCY', 'SRPT', 'ARWR', 'NBIX', 'SAGE', 'PTCT', 'FOLD', 'DNLI',
      'RARE', 'RVMD', 'CRNX', 'MDGL', 'CGEM', 'APLS', 'RYTM', 'INSM', 'MRTX', 'KRTX',
      
      // Financials & Fintech mid-caps  
      'HOOD', 'SOFI', 'UPST', 'AFRM', 'BILL', 'TOST', 'FLYW', 'VCTR', 'ENV', 'PAYO',
      'RPAY', 'VIRT', 'MKTX', 'STEP', 'FOUR', 'EEFT', 'EVTC', 'WEX', 'GPN', 'JKHY',
      
      // Consumer mid-caps
      'BROS', 'CAVA', 'WING', 'SHAK', 'SG', 'DPZ', 'TXRH', 'EAT', 'PLAY', 'BJRI',
      'CHWY', 'BARK', 'WOOF', 'PETQ', 'PETS', 'FIGS', 'BIRD', 'SKIN', 'OLLI', 'FIVE',
      
      // Energy & Materials mid-caps
      'RIG', 'VAL', 'NOV', 'WFRD', 'LBRT', 'HP', 'PTEN', 'WTTR', 'AROC', 'SM',
      'CEIX', 'ARCH', 'AMR', 'BTU', 'CTRA', 'MTDR', 'CNX', 'CRK', 'GPOR', 'MGY',
      
      // Industrial mid-caps  
      'JOBY', 'EVTL', 'LILM', 'ACHR', 'BLDE', 'VVX', 'FSS', 'HWM', 'SITE', 'GNRC',
      'AOS', 'MIDD', 'UFPI', 'TREX', 'AZEK', 'BWXT', 'CW', 'RBC', 'WCC', 'MLI'
    ];
  }
  
  /**
   * Get a single stock's market cap
   */
  async getStockMarketCap(ticker: string): Promise<number | null> {
    try {
      const response = await axios.get(`https://api.polygon.io/v3/reference/tickers/${ticker}`, {
        params: {
          apiKey: this.apiKey
        }
      });
      
      if (response.data.status === 'OK' && response.data.results) {
        return response.data.results.market_cap || null;
      }
      
      return null;
    } catch (error) {
      console.error(`Error fetching market cap for ${ticker}:`, error);
      return null;
    }
  }
}