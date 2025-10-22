import axios from "axios";

const POLYGON_BASE_URL = "https://api.polygon.io";
const API_KEY = process.env.POLYGON_API_KEY;

export interface NewsArticle {
  id: string;
  title: string;
  author: string;
  published_utc: string;
  article_url: string;
  tickers: string[];
  description?: string;
  keywords?: string[];
  insights?: NewsInsight[];
  publisher?: {
    name: string;
    homepage_url?: string;
  };
}

export interface NewsInsight {
  ticker: string;
  sentiment: "positive" | "negative" | "neutral";
  sentiment_reasoning?: string;
}

export interface NewsAnalysis {
  ticker: string;
  articles: NewsArticle[];
  favorable_count: number;
  unfavorable_count: number;
  neutral_count: number;
  overall_sentiment: "positive" | "negative" | "neutral";
  key_favorable: string[];
  key_unfavorable: string[];
  impact_assessment: string;
}

export class NewsService {
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || API_KEY || '';
    if (!this.apiKey) {
      throw new Error('Polygon API key not configured');
    }
  }

  /**
   * Fetch recent news articles for a ticker
   */
  async getTickerNews(ticker: string, days: number = 7): Promise<NewsArticle[]> {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      
      const response = await axios.get(`${POLYGON_BASE_URL}/v2/reference/news`, {
        params: {
          ticker: ticker,
          published_utc_gte: startDate.toISOString().split('T')[0],
          published_utc_lte: endDate.toISOString().split('T')[0],
          order: 'desc',
          limit: 20,
          apiKey: this.apiKey
        },
        timeout: 10000,
      });

      return response.data.results || [];
    } catch (error) {
      console.error(`Error fetching news for ${ticker}:`, error);
      return [];
    }
  }

  /**
   * Analyze sentiment based on keywords and title
   */
  private analyzeSentiment(article: NewsArticle): "positive" | "negative" | "neutral" {
    const text = `${article.title} ${article.description || ''}`.toLowerCase();
    
    // Negative keywords for options trading
    const negativeKeywords = [
      'crash', 'plunge', 'sell-off', 'decline', 'fall', 'drop', 'loss', 'weak',
      'concern', 'fear', 'risk', 'warning', 'downgrade', 'miss', 'disappointing',
      'lawsuit', 'investigation', 'scandal', 'bankruptcy', 'layoff', 'cut',
      'recession', 'bear', 'volatile', 'uncertainty', 'tumble', 'slump'
    ];
    
    // Positive keywords
    const positiveKeywords = [
      'surge', 'rally', 'gain', 'rise', 'climb', 'jump', 'soar', 'upgrade',
      'beat', 'exceed', 'record', 'high', 'profit', 'growth', 'expansion',
      'breakthrough', 'innovation', 'success', 'bull', 'optimistic', 'strong'
    ];
    
    let positiveScore = 0;
    let negativeScore = 0;
    
    positiveKeywords.forEach(keyword => {
      if (text.includes(keyword)) positiveScore++;
    });
    
    negativeKeywords.forEach(keyword => {
      if (text.includes(keyword)) negativeScore++;
    });
    
    if (positiveScore > negativeScore) return "positive";
    if (negativeScore > positiveScore) return "negative";
    return "neutral";
  }

  /**
   * Analyze news impact for a ticker position
   */
  async analyzeNewsImpact(
    ticker: string, 
    signal: "BUY" | "SELL",
    frontExpiry: string,
    backExpiry: string
  ): Promise<NewsAnalysis> {
    const articles = await this.getTickerNews(ticker, 14);
    
    let favorableCount = 0;
    let unfavorableCount = 0;
    let neutralCount = 0;
    const keyFavorable: string[] = [];
    const keyUnfavorable: string[] = [];
    
    articles.forEach(article => {
      const sentiment = this.analyzeSentiment(article);
      
      // For BUY signal (expecting volatility expansion), high volatility news is favorable
      // For SELL signal (expecting volatility contraction), stable news is favorable
      if (signal === "BUY") {
        // BUY positions benefit from increased volatility
        if (sentiment === "negative" || sentiment === "positive") {
          // Both very positive and very negative news increase volatility
          favorableCount++;
          keyFavorable.push(`${article.title.substring(0, 60)}... (volatility driver)`);
        } else {
          neutralCount++;
        }
      } else {
        // SELL positions benefit from decreased volatility
        if (sentiment === "neutral") {
          favorableCount++;
          keyFavorable.push(`${article.title.substring(0, 60)}... (stability)`);
        } else {
          unfavorableCount++;
          keyUnfavorable.push(`${article.title.substring(0, 60)}... (volatility risk)`);
        }
      }
      
      // Check for earnings or major events
      const text = article.title.toLowerCase();
      if (text.includes('earnings') || text.includes('guidance')) {
        if (signal === "BUY") {
          keyFavorable.push("Earnings event - increases IV");
        } else {
          keyUnfavorable.push("Earnings event - IV crush risk");
        }
      }
    });
    
    // Determine overall sentiment
    let overallSentiment: "positive" | "negative" | "neutral" = "neutral";
    if (favorableCount > unfavorableCount * 1.5) {
      overallSentiment = "positive";
    } else if (unfavorableCount > favorableCount * 1.5) {
      overallSentiment = "negative";
    }
    
    // Generate impact assessment
    let impactAssessment = "";
    const daysToFrontExpiry = Math.floor((new Date(frontExpiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    
    if (signal === "BUY") {
      if (overallSentiment === "positive") {
        impactAssessment = `FAVORABLE: News flow showing increased volatility drivers. ${favorableCount} articles indicate potential IV expansion, supporting your BUY position. With ${daysToFrontExpiry} days to front expiry, volatility events are working in your favor.`;
      } else if (overallSentiment === "negative") {
        impactAssessment = `UNFAVORABLE: Limited volatility catalysts in recent news. Market appears stable, which could lead to IV contraction hurting your BUY position. Consider monitoring for upcoming catalysts.`;
      } else {
        impactAssessment = `NEUTRAL: Mixed news flow. Some volatility drivers present but not decisive. Monitor for earnings announcements or major events before front expiry.`;
      }
    } else {
      if (overallSentiment === "positive") {
        impactAssessment = `FAVORABLE: Stable news environment supports your SELL position. Limited volatility events mean IV likely to contract, benefiting your short volatility stance.`;
      } else if (overallSentiment === "negative") {
        impactAssessment = `UNFAVORABLE: High volatility in news flow. ${unfavorableCount} articles show market uncertainty, which could maintain or increase IV, working against your SELL position.`;
      } else {
        impactAssessment = `NEUTRAL: Moderate news activity. Some volatility events but overall manageable for a SELL position. Watch for surprise announcements.`;
      }
    }
    
    return {
      ticker,
      articles: articles.slice(0, 10), // Return top 10 most recent
      favorable_count: favorableCount,
      unfavorable_count: unfavorableCount,
      neutral_count: neutralCount,
      overall_sentiment: overallSentiment,
      key_favorable: keyFavorable.slice(0, 3),
      key_unfavorable: keyUnfavorable.slice(0, 3),
      impact_assessment: impactAssessment
    };
  }

  /**
   * Get market-wide news that could affect all positions
   */
  async getMarketNews(): Promise<NewsArticle[]> {
    try {
      const response = await axios.get(`${POLYGON_BASE_URL}/v2/reference/news`, {
        params: {
          ticker: 'SPY', // Use SPY as proxy for market news
          order: 'desc',
          limit: 10,
          apiKey: this.apiKey
        },
        timeout: 10000,
      });

      return response.data.results || [];
    } catch (error) {
      console.error('Error fetching market news:', error);
      return [];
    }
  }
}