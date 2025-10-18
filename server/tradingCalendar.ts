/**
 * Trading Calendar for US Markets
 * Handles market hours, holidays, and trading day calculations
 */

export class TradingCalendar {
  // US Federal Holidays that affect NYSE/NASDAQ (2025-2027)
  private static readonly MARKET_HOLIDAYS = [
    // 2025
    '2025-01-01', // New Year's Day
    '2025-01-20', // MLK Day
    '2025-02-17', // Presidents Day
    '2025-04-18', // Good Friday
    '2025-05-26', // Memorial Day
    '2025-06-19', // Juneteenth
    '2025-07-04', // Independence Day
    '2025-09-01', // Labor Day
    '2025-11-27', // Thanksgiving
    '2025-12-25', // Christmas
    
    // 2026
    '2026-01-01', // New Year's Day
    '2026-01-19', // MLK Day
    '2026-02-16', // Presidents Day
    '2026-04-03', // Good Friday
    '2026-05-25', // Memorial Day
    '2026-06-19', // Juneteenth
    '2026-07-03', // Independence Day (observed)
    '2026-09-07', // Labor Day
    '2026-11-26', // Thanksgiving
    '2026-12-25', // Christmas
    
    // 2027
    '2027-01-01', // New Year's Day
    '2027-01-18', // MLK Day
    '2027-02-15', // Presidents Day
    '2027-03-26', // Good Friday
    '2027-05-31', // Memorial Day
    '2027-06-18', // Juneteenth (observed)
    '2027-07-05', // Independence Day (observed)
    '2027-09-06', // Labor Day
    '2027-11-25', // Thanksgiving
    '2027-12-24', // Christmas (observed)
  ];

  /**
   * Check if a given date is a trading day
   */
  static isTradingDay(date: Date = new Date()): boolean {
    // Check if weekend (Saturday = 6, Sunday = 0)
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return false;
    }
    
    // Check if holiday
    const dateStr = date.toISOString().split('T')[0];
    if (this.MARKET_HOLIDAYS.includes(dateStr)) {
      return false;
    }
    
    return true;
  }

  /**
   * Check if markets are currently open
   */
  static isMarketOpen(): boolean {
    const now = new Date();
    
    // First check if it's a trading day
    if (!this.isTradingDay(now)) {
      return false;
    }
    
    // Get current time in ET (Eastern Time)
    const etTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
    const hours = etTime.getHours();
    const minutes = etTime.getMinutes();
    const timeInMinutes = hours * 60 + minutes;
    
    // Market hours: 9:30 AM ET to 4:00 PM ET
    const marketOpen = 9 * 60 + 30; // 9:30 AM
    const marketClose = 16 * 60; // 4:00 PM
    
    return timeInMinutes >= marketOpen && timeInMinutes < marketClose;
  }

  /**
   * Get the next trading day
   */
  static getNextTradingDay(fromDate: Date = new Date()): Date {
    const nextDay = new Date(fromDate);
    nextDay.setDate(nextDay.getDate() + 1);
    
    // Keep incrementing until we find a trading day
    while (!this.isTradingDay(nextDay)) {
      nextDay.setDate(nextDay.getDate() + 1);
    }
    
    return nextDay;
  }

  /**
   * Get upcoming holidays in the next N days
   */
  static getUpcomingHolidays(daysAhead: number = 30): string[] {
    const today = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + daysAhead);
    
    return this.MARKET_HOLIDAYS.filter(holiday => {
      const holidayDate = new Date(holiday);
      return holidayDate >= today && holidayDate <= endDate;
    });
  }

  /**
   * Get market status information
   */
  static getMarketStatus(): {
    isOpen: boolean;
    isTradingDay: boolean;
    nextTradingDay: string;
    currentTime: string;
    upcomingHolidays: string[];
    message: string;
  } {
    const now = new Date();
    const isOpen = this.isMarketOpen();
    const isTradingDay = this.isTradingDay(now);
    const nextTradingDay = this.getNextTradingDay(now);
    const upcomingHolidays = this.getUpcomingHolidays(14); // Next 2 weeks
    
    let message = '';
    if (isOpen) {
      message = '🟢 Markets are OPEN';
    } else if (isTradingDay) {
      const etTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
      const hours = etTime.getHours();
      if (hours < 9 || (hours === 9 && etTime.getMinutes() < 30)) {
        message = '🟡 Markets open at 9:30 AM ET';
      } else {
        message = '🔴 Markets closed at 4:00 PM ET';
      }
    } else {
      const dayOfWeek = now.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        message = '🔴 Markets closed (Weekend)';
      } else {
        message = '🔴 Markets closed (Holiday)';
      }
    }
    
    return {
      isOpen,
      isTradingDay,
      nextTradingDay: nextTradingDay.toISOString().split('T')[0],
      currentTime: now.toISOString(),
      upcomingHolidays,
      message
    };
  }

  /**
   * Should scanner run tonight?
   * Runs on weeknights if tomorrow is a trading day
   */
  static shouldRunTonight(): boolean {
    const now = new Date();
    const dayOfWeek = now.getDay();
    
    // Skip weekends
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return false;
    }
    
    // Check if tomorrow is a trading day
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    return this.isTradingDay(tomorrow);
  }
}