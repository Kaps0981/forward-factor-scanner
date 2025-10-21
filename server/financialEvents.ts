import { PolygonService } from './polygon';

export interface FinancialEvent {
  type: 'earnings' | 'fed_meeting' | 'economic_data';
  date: string;
  description: string;
  importance: 'high' | 'medium' | 'low';
  ticker?: string; // For earnings events
}

// Hardcoded FOMC meeting dates for 2024-2025
// Source: https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm
const FOMC_MEETINGS = [
  // 2024 Meetings (remaining)
  { date: '2024-12-17', description: 'FOMC Meeting - December 2024' },
  { date: '2024-12-18', description: 'FOMC Meeting - December 2024' },
  
  // 2025 Meetings
  { date: '2025-01-28', description: 'FOMC Meeting - January 2025' },
  { date: '2025-01-29', description: 'FOMC Meeting - January 2025' },
  { date: '2025-03-18', description: 'FOMC Meeting - March 2025' },
  { date: '2025-03-19', description: 'FOMC Meeting - March 2025' },
  { date: '2025-05-06', description: 'FOMC Meeting - May 2025' },
  { date: '2025-05-07', description: 'FOMC Meeting - May 2025' },
  { date: '2025-06-17', description: 'FOMC Meeting - June 2025' },
  { date: '2025-06-18', description: 'FOMC Meeting - June 2025' },
  { date: '2025-07-29', description: 'FOMC Meeting - July 2025' },
  { date: '2025-07-30', description: 'FOMC Meeting - July 2025' },
  { date: '2025-09-16', description: 'FOMC Meeting - September 2025' },
  { date: '2025-09-17', description: 'FOMC Meeting - September 2025' },
  { date: '2025-11-04', description: 'FOMC Meeting - November 2025' },
  { date: '2025-11-05', description: 'FOMC Meeting - November 2025' },
  { date: '2025-12-16', description: 'FOMC Meeting - December 2025' },
  { date: '2025-12-17', description: 'FOMC Meeting - December 2025' },
];

// Cache for earnings data to avoid repeated API calls
interface EarningsCache {
  [ticker: string]: {
    date: string | null;
    fetchedAt: number;
  };
}

export class FinancialEventsService {
  private polygon: PolygonService;
  private earningsCache: EarningsCache = {};
  private readonly CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

  constructor(apiKey?: string) {
    this.polygon = new PolygonService(apiKey);
  }

  /**
   * Get earnings date for a ticker (if within specified days)
   */
  async getEarningsDate(ticker: string, daysAhead: number = 30): Promise<string | null> {
    // Check cache first
    const cached = this.earningsCache[ticker];
    if (cached && (Date.now() - cached.fetchedAt < this.CACHE_DURATION_MS)) {
      if (!cached.date) return null;
      
      // Check if still within the days ahead window
      const earningsTime = new Date(cached.date).getTime();
      const daysUntil = Math.ceil((earningsTime - Date.now()) / (1000 * 60 * 60 * 24));
      if (daysUntil > daysAhead || daysUntil < 0) return null;
      return cached.date;
    }

    try {
      // Use the Polygon API to get ticker details
      const url = `https://api.polygon.io/v3/reference/tickers/${ticker}`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${process.env.POLYGON_API_KEY}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch ticker details: ${response.statusText}`);
      }

      const data = await response.json();
      const earningsDate = data.results?.next_earnings_date;
      
      // Cache the result
      this.earningsCache[ticker] = {
        date: earningsDate || null,
        fetchedAt: Date.now(),
      };

      if (!earningsDate) return null;

      // Check if within the specified days ahead window
      const earningsTime = new Date(earningsDate).getTime();
      const daysUntil = Math.ceil((earningsTime - Date.now()) / (1000 * 60 * 60 * 24));
      
      if (daysUntil > daysAhead || daysUntil < 0) return null;
      return earningsDate;
    } catch (error) {
      console.error(`Error fetching earnings for ${ticker}:`, error);
      // Cache the failure to avoid repeated failed API calls
      this.earningsCache[ticker] = {
        date: null,
        fetchedAt: Date.now(),
      };
      return null;
    }
  }

  /**
   * Get Fed events between two dates
   */
  getFedEventsBetween(startDate: string, endDate: string): FinancialEvent[] {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    return FOMC_MEETINGS
      .filter(meeting => {
        const meetingDate = new Date(meeting.date);
        return meetingDate >= start && meetingDate <= end;
      })
      .map(meeting => ({
        type: 'fed_meeting' as const,
        date: meeting.date,
        description: meeting.description,
        importance: 'high' as const,
      }));
  }

  /**
   * Get the next Fed meeting date from today
   */
  getNextFedMeeting(): FinancialEvent | null {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset to start of day
    
    const futureMeetings = FOMC_MEETINGS
      .filter(meeting => new Date(meeting.date) >= today)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    if (futureMeetings.length === 0) return null;
    
    const next = futureMeetings[0];
    return {
      type: 'fed_meeting',
      date: next.date,
      description: next.description,
      importance: 'high',
    };
  }

  /**
   * Check for all financial events that could affect an option position
   */
  async checkFinancialEvents(
    ticker: string,
    frontExpirationDate: string,
    backExpirationDate: string
  ): Promise<{
    earnings_date: string | null;
    fed_events: string[];
    event_warnings: string[];
  }> {
    const warnings: string[] = [];
    
    // Check for earnings
    const earningsDate = await this.getEarningsDate(ticker, 30);
    
    // Check if earnings fall between front and back expiration
    if (earningsDate) {
      const earningsTime = new Date(earningsDate).getTime();
      const frontTime = new Date(frontExpirationDate).getTime();
      const backTime = new Date(backExpirationDate).getTime();
      
      if (earningsTime >= frontTime && earningsTime <= backTime) {
        warnings.push(`⚠️ EARNINGS on ${earningsDate} between expirations - HIGH RISK`);
      } else if (earningsTime < frontTime) {
        const daysBeforeFront = Math.ceil((frontTime - earningsTime) / (1000 * 60 * 60 * 24));
        if (daysBeforeFront <= 7) {
          warnings.push(`📅 Earnings ${daysBeforeFront} days before front expiration`);
        }
      }
    }
    
    // Check for Fed meetings between expirations
    const fedEvents = this.getFedEventsBetween(frontExpirationDate, backExpirationDate);
    const fedEventDescriptions = fedEvents.map(e => `${e.date}: ${e.description}`);
    
    if (fedEvents.length > 0) {
      warnings.push(`🏛️ ${fedEvents.length} Fed meeting(s) between expirations`);
      fedEvents.forEach(event => {
        warnings.push(`   • ${event.date}: FOMC Meeting`);
      });
    }
    
    // Check for Fed meetings near front expiration (within 3 days)
    const frontDate = new Date(frontExpirationDate);
    const threeDaysBeforeFront = new Date(frontDate);
    threeDaysBeforeFront.setDate(frontDate.getDate() - 3);
    
    const nearFrontFedEvents = this.getFedEventsBetween(
      threeDaysBeforeFront.toISOString().split('T')[0],
      frontExpirationDate
    );
    
    if (nearFrontFedEvents.length > 0) {
      warnings.push(`⚠️ Fed meeting within 3 days of front expiration`);
    }
    
    return {
      earnings_date: earningsDate,
      fed_events: fedEventDescriptions,
      event_warnings: warnings,
    };
  }

  /**
   * Get a summary of upcoming events for display
   */
  async getUpcomingEventsSummary(tickers: string[]): Promise<{
    next_fed_meeting: FinancialEvent | null;
    earnings_this_week: Array<{ ticker: string; date: string }>;
  }> {
    const nextFed = this.getNextFedMeeting();
    
    // Get earnings for the next 7 days for all tickers
    const earningsPromises = tickers.map(async (ticker) => {
      const date = await this.getEarningsDate(ticker, 7);
      return date ? { ticker, date } : null;
    });
    
    const earningsResults = await Promise.all(earningsPromises);
    const earningsThisWeek = earningsResults
      .filter((e): e is { ticker: string; date: string } => e !== null)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    return {
      next_fed_meeting: nextFed,
      earnings_this_week: earningsThisWeek,
    };
  }
}