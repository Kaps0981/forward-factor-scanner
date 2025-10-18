#!/usr/bin/env python3.11
"""
Forward Factor Scanner Scheduling Module

Handles scheduling logic and US trading holiday calendar
"""

import pandas_market_calendars as mcal
from datetime import datetime, time, timedelta
from typing import Optional

class TradingCalendar:
    """US Trading Calendar with holiday support"""
    
    def __init__(self):
        """Initialize NYSE calendar"""
        self.nyse = mcal.get_calendar('NYSE')
    
    def is_trading_day(self, date: Optional[datetime] = None) -> bool:
        """
        Check if a given date is a trading day
        
        Args:
            date: Date to check (defaults to today)
        
        Returns:
            True if trading day, False if holiday/weekend
        """
        if date is None:
            date = datetime.now()
        
        # Get date only (no time)
        check_date = date.date()
        
        # Get schedule for the date
        schedule = self.nyse.schedule(start_date=check_date, end_date=check_date)
        
        return len(schedule) > 0
    
    def get_next_trading_day(self, date: Optional[datetime] = None) -> datetime:
        """
        Get the next trading day after the given date
        
        Args:
            date: Starting date (defaults to today)
        
        Returns:
            Next trading day as datetime
        """
        if date is None:
            date = datetime.now()
        
        # Start checking from tomorrow
        check_date = (date + timedelta(days=1)).date()
        
        # Check up to 10 days ahead (handles long weekends)
        for i in range(10):
            if self.is_trading_day(datetime.combine(check_date, time())):
                return datetime.combine(check_date, time())
            check_date += timedelta(days=1)
        
        # Fallback: return date + 1 day
        return date + timedelta(days=1)
    
    def get_upcoming_holidays(self, days_ahead: int = 30) -> list:
        """
        Get list of upcoming holidays
        
        Args:
            days_ahead: Number of days to look ahead
        
        Returns:
            List of holiday dates
        """
        start_date = datetime.now().date()
        end_date = start_date + timedelta(days=days_ahead)
        
        # Get all dates in range
        all_dates = []
        current = start_date
        while current <= end_date:
            all_dates.append(current)
            current += timedelta(days=1)
        
        # Filter out trading days to get holidays
        holidays = []
        for date in all_dates:
            if not self.is_trading_day(datetime.combine(date, time())):
                # Skip regular weekends
                if date.weekday() < 5:  # Monday=0, Friday=4
                    holidays.append(date)
        
        return holidays
    
    def should_run_tonight(self) -> bool:
        """
        Determine if scanner should run tonight
        
        Scanner runs on weeknights (Mon-Fri) after market close,
        but only if the next day is a trading day
        
        Returns:
            True if scanner should run tonight
        """
        now = datetime.now()
        
        # Check if today is a weekday (Mon-Fri)
        if now.weekday() >= 5:  # Saturday=5, Sunday=6
            return False
        
        # Check if tomorrow is a trading day
        tomorrow = now + timedelta(days=1)
        if not self.is_trading_day(tomorrow):
            return False
        
        return True
    
    def get_run_schedule_info(self) -> dict:
        """
        Get information about the run schedule
        
        Returns:
            Dictionary with schedule information
        """
        now = datetime.now()
        
        return {
            'current_time': now.strftime('%Y-%m-%d %H:%M:%S'),
            'is_weekday': now.weekday() < 5,
            'is_trading_day': self.is_trading_day(now),
            'should_run_tonight': self.should_run_tonight(),
            'next_trading_day': self.get_next_trading_day(now).strftime('%Y-%m-%d'),
            'upcoming_holidays': [d.strftime('%Y-%m-%d') for d in self.get_upcoming_holidays(30)]
        }


def main():
    """Test the trading calendar"""
    calendar = TradingCalendar()
    
    print("=" * 80)
    print("TRADING CALENDAR TEST")
    print("=" * 80)
    
    # Get schedule info
    info = calendar.get_run_schedule_info()
    
    print(f"\nCurrent Time: {info['current_time']}")
    print(f"Is Weekday: {info['is_weekday']}")
    print(f"Is Trading Day: {info['is_trading_day']}")
    print(f"Should Run Tonight: {info['should_run_tonight']}")
    print(f"Next Trading Day: {info['next_trading_day']}")
    
    print(f"\nUpcoming Holidays (next 30 days):")
    if info['upcoming_holidays']:
        for holiday in info['upcoming_holidays']:
            print(f"  - {holiday}")
    else:
        print("  No holidays in the next 30 days")
    
    print("\n" + "=" * 80)
    
    # Test specific dates
    print("\nTesting specific dates:")
    test_dates = [
        datetime(2025, 12, 25),  # Christmas
        datetime(2025, 11, 28),  # Thanksgiving
        datetime(2025, 7, 4),    # Independence Day
        datetime(2025, 1, 1),    # New Year's Day
    ]
    
    for date in test_dates:
        is_trading = calendar.is_trading_day(date)
        print(f"  {date.strftime('%Y-%m-%d (%A)')}: {'Trading Day' if is_trading else 'Holiday/Weekend'}")


if __name__ == "__main__":
    main()

