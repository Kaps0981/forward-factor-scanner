#!/usr/bin/env python3.11
"""
Earnings date lookup using web scraping as fallback
"""

import requests
from datetime import datetime
from typing import Optional
import re

def get_earnings_date_yahoo(ticker: str) -> Optional[str]:
    """
    Scrape earnings date from Yahoo Finance
    
    Returns: Earnings date in YYYY-MM-DD format or None
    """
    try:
        url = f"https://finance.yahoo.com/quote/{ticker}"
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        
        # Look for earnings date in the HTML
        # Yahoo Finance shows it in various formats
        patterns = [
            r'Earnings Date["\s:]+([A-Za-z]+\s+\d{1,2},\s+\d{4})',
            r'"earningsTimestamp":\s*(\d+)',
            r'earningsDate["\s:]+(\d{4}-\d{2}-\d{2})'
        ]
        
        for pattern in patterns:
            matches = re.findall(pattern, response.text)
            if matches:
                date_str = matches[0]
                
                # Try to parse the date
                try:
                    # Unix timestamp
                    if date_str.isdigit():
                        dt = datetime.fromtimestamp(int(date_str))
                        return dt.strftime('%Y-%m-%d')
                    
                    # Already in YYYY-MM-DD format
                    if re.match(r'\d{4}-\d{2}-\d{2}', date_str):
                        return date_str
                    
                    # "Month DD, YYYY" format
                    dt = datetime.strptime(date_str, '%B %d, %Y')
                    return dt.strftime('%Y-%m-%d')
                except:
                    continue
        
        return None
        
    except Exception as e:
        print(f"Error scraping earnings for {ticker}: {e}")
        return None


def test_earnings_scraper():
    """Test the earnings scraper"""
    test_tickers = ['AAPL', 'MSFT', 'GOOGL', 'UPST', 'SOFI']
    
    for ticker in test_tickers:
        earnings_date = get_earnings_date_yahoo(ticker)
        if earnings_date:
            print(f"{ticker}: Next earnings on {earnings_date}")
        else:
            print(f"{ticker}: No earnings date found")


if __name__ == "__main__":
    test_earnings_scraper()

