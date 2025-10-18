#!/usr/bin/env python3.11
"""
Free Earnings Calendar Integration using Finnhub API

Finnhub offers a free tier with 60 API calls/minute
No API key required for basic earnings calendar
"""

import requests
from datetime import datetime, timedelta
from typing import Optional, Dict
import time

class FreeEarningsCalendar:
    """Free earnings calendar using Finnhub API"""
    
    def __init__(self):
        """Initialize with free Finnhub API"""
        # Finnhub free API - demo token (public)
        self.api_key = "demo"  # Free demo key
        self.base_url = "https://finnhub.io/api/v1"
        self.cache = {}  # Cache earnings data
    
    def get_earnings_date(self, ticker: str) -> Optional[str]:
        """
        Get next earnings date for a ticker
        
        Args:
            ticker: Stock ticker symbol
        
        Returns:
            Earnings date in YYYY-MM-DD format or None
        """
        # Check cache first
        if ticker in self.cache:
            return self.cache[ticker]
        
        try:
            # Get company earnings calendar
            # Use earnings calendar endpoint for next 30 days
            today = datetime.now()
            from_date = today.strftime('%Y-%m-%d')
            to_date = (today + timedelta(days=90)).strftime('%Y-%m-%d')
            
            url = f"{self.base_url}/calendar/earnings"
            params = {
                'symbol': ticker,
                'from': from_date,
                'to': to_date,
                'token': self.api_key
            }
            
            response = requests.get(url, params=params, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                
                # Check if we have earnings data
                if 'earningsCalendar' in data and len(data['earningsCalendar']) > 0:
                    # Get the first (next) earnings date
                    earnings_date = data['earningsCalendar'][0].get('date')
                    if earnings_date:
                        self.cache[ticker] = earnings_date
                        return earnings_date
            
            # If no data found, try company profile endpoint
            url = f"{self.base_url}/stock/profile2"
            params = {
                'symbol': ticker,
                'token': self.api_key
            }
            
            response = requests.get(url, params=params, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                # Some profiles have earnings announcement date
                if 'earningsAnnouncement' in data:
                    earnings_date = data['earningsAnnouncement']
                    self.cache[ticker] = earnings_date
                    return earnings_date
            
            # Rate limit: sleep briefly between requests
            time.sleep(0.1)
            
            return None
            
        except Exception as e:
            print(f"Error fetching earnings for {ticker}: {e}")
            return None
    
    def get_earnings_info(self, ticker: str, front_date: str, back_date: str) -> Dict:
        """
        Get earnings info relative to option expiration dates
        
        Args:
            ticker: Stock ticker
            front_date: Front contract expiration (YYYY-MM-DD)
            back_date: Back contract expiration (YYYY-MM-DD)
        
        Returns:
            Dict with earnings info
        """
        earnings_date = self.get_earnings_date(ticker)
        
        if not earnings_date:
            return {
                'earnings_date': None,
                'front_is_pre_earnings': False,
                'back_is_post_earnings': False,
                'both_post_earnings': False
            }
        
        # Parse dates
        try:
            earnings_dt = datetime.strptime(earnings_date, '%Y-%m-%d')
            front_dt = datetime.strptime(front_date, '%Y-%m-%d')
            back_dt = datetime.strptime(back_date, '%Y-%m-%d')
        except:
            return {
                'earnings_date': earnings_date,
                'front_is_pre_earnings': False,
                'back_is_post_earnings': False,
                'both_post_earnings': False
            }
        
        # Determine position relative to earnings
        front_is_pre = front_dt < earnings_dt
        back_is_post = back_dt > earnings_dt
        both_post = front_dt > earnings_dt and back_dt > earnings_dt
        
        return {
            'earnings_date': earnings_date,
            'front_is_pre_earnings': front_is_pre,
            'back_is_post_earnings': back_is_post,
            'both_post_earnings': both_post
        }


def test_earnings_calendar():
    """Test the free earnings calendar"""
    calendar = FreeEarningsCalendar()
    
    print("=" * 80)
    print("FREE EARNINGS CALENDAR TEST")
    print("=" * 80)
    print()
    
    # Test some tickers
    test_tickers = ['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'NVDA']
    
    for ticker in test_tickers:
        earnings_date = calendar.get_earnings_date(ticker)
        if earnings_date:
            print(f"✓ {ticker}: Next earnings on {earnings_date}")
        else:
            print(f"✗ {ticker}: No earnings date found")
        time.sleep(0.2)  # Rate limit
    
    print()
    print("=" * 80)


if __name__ == "__main__":
    test_earnings_calendar()

