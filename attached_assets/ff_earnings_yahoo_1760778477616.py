#!/usr/bin/env python3.11
"""
Free Earnings Calendar using Yahoo Finance (no API key required)

Scrapes earnings dates from Yahoo Finance public pages
"""

import requests
from datetime import datetime
from typing import Optional, Dict
import re
import json

class YahooEarningsCalendar:
    """Free earnings calendar using Yahoo Finance scraping"""
    
    def __init__(self):
        """Initialize Yahoo Finance scraper"""
        self.cache = {}
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
    
    def get_earnings_date(self, ticker: str) -> Optional[str]:
        """
        Get next earnings date for a ticker from Yahoo Finance
        
        Args:
            ticker: Stock ticker symbol
        
        Returns:
            Earnings date in YYYY-MM-DD format or None
        """
        # Check cache
        if ticker in self.cache:
            return self.cache[ticker]
        
        try:
            # Yahoo Finance quote page has earnings date
            url = f"https://finance.yahoo.com/quote/{ticker}"
            response = requests.get(url, headers=self.headers, timeout=10)
            
            if response.status_code != 200:
                return None
            
            html = response.text
            
            # Look for earnings date in various formats
            # Pattern 1: "earningsTimestamp":1234567890
            timestamp_match = re.search(r'"earningsTimestamp":\{"raw":(\d+)', html)
            if timestamp_match:
                timestamp = int(timestamp_match.group(1))
                earnings_date = datetime.fromtimestamp(timestamp).strftime('%Y-%m-%d')
                self.cache[ticker] = earnings_date
                return earnings_date
            
            # Pattern 2: Look for earnings date in JSON data
            json_match = re.search(r'root\.App\.main\s*=\s*({.*?});', html, re.DOTALL)
            if json_match:
                try:
                    json_str = json_match.group(1)
                    data = json.loads(json_str)
                    
                    # Navigate through the JSON structure
                    if 'context' in data and 'dispatcher' in data['context']:
                        stores = data['context']['dispatcher']['stores']
                        if 'QuoteSummaryStore' in stores:
                            summary = stores['QuoteSummaryStore']
                            
                            # Check earnings date
                            if 'calendarEvents' in summary and 'earnings' in summary['calendarEvents']:
                                earnings_info = summary['calendarEvents']['earnings']
                                if 'earningsDate' in earnings_info and len(earnings_info['earningsDate']) > 0:
                                    timestamp = earnings_info['earningsDate'][0]['raw']
                                    earnings_date = datetime.fromtimestamp(timestamp).strftime('%Y-%m-%d')
                                    self.cache[ticker] = earnings_date
                                    return earnings_date
                except:
                    pass
            
            # Pattern 3: Simple text search for earnings date
            date_patterns = [
                r'Earnings Date[^<]*?(\w+ \d{1,2}, \d{4})',
                r'Next Earnings Date[^<]*?(\w+ \d{1,2}, \d{4})'
            ]
            
            for pattern in date_patterns:
                match = re.search(pattern, html, re.IGNORECASE)
                if match:
                    try:
                        date_str = match.group(1)
                        earnings_date = datetime.strptime(date_str, '%b %d, %Y').strftime('%Y-%m-%d')
                        self.cache[ticker] = earnings_date
                        return earnings_date
                    except:
                        pass
            
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


def test_yahoo_earnings():
    """Test Yahoo Finance earnings scraper"""
    calendar = YahooEarningsCalendar()
    
    print("=" * 80)
    print("YAHOO FINANCE EARNINGS CALENDAR TEST")
    print("=" * 80)
    print()
    
    # Test tickers from the scanner
    test_tickers = ['UPST', 'SOFI', 'PLTR', 'HOOD', 'NU']
    
    for ticker in test_tickers:
        print(f"Testing {ticker}...", end=" ")
        earnings_date = calendar.get_earnings_date(ticker)
        if earnings_date:
            print(f"✓ Next earnings: {earnings_date}")
        else:
            print(f"✗ No earnings date found")
    
    print()
    print("=" * 80)


if __name__ == "__main__":
    test_yahoo_earnings()

