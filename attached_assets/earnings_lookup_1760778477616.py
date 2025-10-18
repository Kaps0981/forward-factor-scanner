#!/usr/bin/env python3.11
"""
Earnings date lookup utility using Yahoo Finance API
"""

import sys
sys.path.append('/opt/.manus/.sandbox-runtime')

from data_api import ApiClient
from datetime import datetime
from typing import Optional, Dict, Any

def get_earnings_date(ticker: str) -> Optional[str]:
    """
    Get the next earnings date for a ticker using Yahoo Finance API
    
    Returns: Earnings date in YYYY-MM-DD format or None
    """
    try:
        client = ApiClient()
        
        # Get calendar events which includes earnings
        response = client.call_api('YahooFinance/get_calendar_events', query={'symbol': ticker})
        
        if not response:
            return None
        
        # Check for earnings date in response
        if 'earnings' in response:
            earnings = response['earnings']
            if isinstance(earnings, dict):
                # Try different possible keys
                for key in ['earningsDate', 'earnings_date', 'nextEarningsDate', 'date']:
                    if key in earnings:
                        date_value = earnings[key]
                        if isinstance(date_value, list) and date_value:
                            date_value = date_value[0]
                        if date_value:
                            # Parse and format date
                            try:
                                if isinstance(date_value, str):
                                    # Try to parse various date formats
                                    for fmt in ['%Y-%m-%d', '%Y-%m-%dT%H:%M:%S', '%m/%d/%Y']:
                                        try:
                                            dt = datetime.strptime(date_value.split('T')[0] if 'T' in date_value else date_value, fmt)
                                            return dt.strftime('%Y-%m-%d')
                                        except:
                                            continue
                                elif isinstance(date_value, int):
                                    # Unix timestamp
                                    dt = datetime.fromtimestamp(date_value)
                                    return dt.strftime('%Y-%m-%d')
                            except:
                                pass
        
        # Try alternative approach - get stock insights which may have earnings info
        insights_response = client.call_api('YahooFinance/get_stock_insights', query={'symbol': ticker})
        
        if insights_response and 'insights' in insights_response:
            insights = insights_response['insights']
            # Look for earnings-related data
            for key in ['upcomingEvents', 'events', 'calendar']:
                if key in insights:
                    events = insights[key]
                    if isinstance(events, dict) and 'earnings' in events:
                        earnings_data = events['earnings']
                        if isinstance(earnings_data, dict) and 'earningsDate' in earnings_data:
                            date_value = earnings_data['earningsDate']
                            if isinstance(date_value, list) and date_value:
                                date_value = date_value[0]
                            if date_value:
                                try:
                                    dt = datetime.fromtimestamp(date_value) if isinstance(date_value, int) else datetime.strptime(date_value.split('T')[0], '%Y-%m-%d')
                                    return dt.strftime('%Y-%m-%d')
                                except:
                                    pass
        
        return None
        
    except Exception as e:
        print(f"Error fetching earnings for {ticker}: {e}")
        return None


def test_earnings_lookup():
    """Test the earnings lookup function"""
    test_tickers = ['UPST', 'SOFI', 'PLTR', 'AAPL']
    
    for ticker in test_tickers:
        earnings_date = get_earnings_date(ticker)
        if earnings_date:
            print(f"{ticker}: Next earnings on {earnings_date}")
        else:
            print(f"{ticker}: No earnings date found")


if __name__ == "__main__":
    test_earnings_lookup()

