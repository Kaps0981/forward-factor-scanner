#!/usr/bin/env python3
"""
Forward Factor Scanner
Scans multiple stocks using Polygon.io API to find Forward Factor trading opportunities
"""

import os
import sys
import requests
import json
from datetime import datetime, timedelta
from collections import defaultdict
import time

# Configuration
POLYGON_API_KEY = os.environ.get('POLYGON_API_KEY')
if not POLYGON_API_KEY:
    print("ERROR: POLYGON_API_KEY environment variable not set")
    print("Please set it with: export POLYGON_API_KEY='your_key_here'")
    sys.exit(1)

# Default stock list - Quality mid-caps with retail edge
# Criteria: $2B-$50B market cap, liquid options, long-term potential
# Categories: Growth, Value, Cyclical, Defensive
DEFAULT_TICKERS = [
    # High-Growth Tech (Mid-Cap)
    'PLTR', 'SNOW', 'DDOG', 'NET', 'CRWD', 'ZS', 'OKTA', 'PANW',
    'MDB', 'HUBS', 'TEAM', 'ZM', 'DOCU', 'TWLO', 'ESTC',
    
    # Fintech & Payments
    'SQ', 'COIN', 'SOFI', 'AFRM', 'HOOD', 'NU', 'UPST',
    
    # E-commerce & Consumer
    'SHOP', 'ETSY', 'W', 'CHWY', 'DASH', 'ABNB', 'UBER', 'LYFT',
    
    # Semiconductors (Mid-Cap)
    'ARM', 'MRVL', 'MPWR', 'ON', 'SWKS', 'QRVO',
    
    # Healthcare & Biotech
    'DXCM', 'ISRG', 'ILMN', 'VRTX', 'REGN', 'BIIB', 'MRNA',
    
    # Energy & Materials
    'FSLR', 'ENPH', 'RUN', 'PLUG', 'DVN', 'FANG', 'MRO', 'OXY',
    
    # Industrial & Defense
    'RIVN', 'LCID', 'NIO', 'XPEV', 'BA', 'LMT', 'RTX', 'GD',
    
    # Media & Entertainment
    'ROKU', 'SPOT', 'RBLX', 'U', 'PINS', 'SNAP',
    
    # Retail & Consumer Staples
    'LULU', 'NKE', 'SBUX', 'CMG', 'MCD', 'YUM',
    
    # REITs & Real Estate
    'AMT', 'CCI', 'EQIX', 'DLR', 'PSA',
    
    # Value/Cyclical
    'F', 'GM', 'AAL', 'UAL', 'DAL', 'CCL', 'NCLH', 'RCL',
    'X', 'CLF', 'NUE', 'STLD',
]

class ForwardFactorScanner:
    def __init__(self, api_key):
        self.api_key = api_key
        self.base_url = 'https://api.polygon.io/v3/snapshot/options'
        
    def fetch_options_chain(self, ticker, max_results=250):
        """Fetch options chain snapshot for a ticker"""
        url = f'{self.base_url}/{ticker.upper()}'
        params = {
            'apiKey': self.api_key,
            'limit': max_results
        }
        
        try:
            response = requests.get(url, params=params, timeout=10)
            if response.status_code == 200:
                data = response.json()
                return data.get('results', [])
            elif response.status_code == 429:
                print(f"  ⚠️  Rate limit hit for {ticker}, waiting 60s...")
                time.sleep(60)
                return self.fetch_options_chain(ticker, max_results)
            else:
                print(f"  ❌ Error fetching {ticker}: HTTP {response.status_code}")
                return []
        except Exception as e:
            print(f"  ❌ Exception fetching {ticker}: {str(e)}")
            return []
    
    def get_stock_price(self, ticker):
        """Get current stock price from the first option's underlying price"""
        # We'll estimate from the options data
        return None
    
    def parse_expiration_date(self, exp_date_str):
        """Parse expiration date from YYYY-MM-DD format"""
        try:
            return datetime.strptime(exp_date_str, '%Y-%m-%d').date()
        except:
            return None
    
    def calculate_dte(self, expiration_date):
        """Calculate days to expiration"""
        if not expiration_date:
            return None
        today = datetime.now().date()
        delta = expiration_date - today
        return delta.days
    
    def group_by_expiration(self, options_data):
        """Group options by expiration date and calculate average IV (ATM options only)"""
        expirations = defaultdict(list)
        
        # First, estimate the stock price from the options with highest delta
        stock_price = None
        for option in options_data:
            try:
                if 'greeks' in option and option['greeks'].get('delta'):
                    delta = abs(option['greeks']['delta'])
                    if 0.45 <= delta <= 0.55:  # Near ATM
                        strike = option['details']['strike_price']
                        stock_price = strike
                        break
            except:
                continue
        
        # If we couldn't find stock price, skip this ticker
        if not stock_price:
            return {}
        
        for option in options_data:
            try:
                # Get expiration date from details
                exp_date_str = option['details']['expiration_date']
                exp_date = self.parse_expiration_date(exp_date_str)
                if not exp_date:
                    continue
                
                # Get strike price
                strike = option['details']['strike_price']
                
                # Filter for ATM options only (within 10% of stock price)
                if abs(strike - stock_price) / stock_price > 0.10:
                    continue
                
                # Get implied volatility (already in percentage form from Polygon)
                iv = option.get('implied_volatility')
                if iv is None or iv <= 0 or iv > 500:  # Filter out bad data
                    continue
                
                # Store IV for this expiration
                expirations[exp_date].append(iv)
            except (KeyError, TypeError) as e:
                continue
        
        # Calculate average IV for each expiration
        result = {}
        for exp_date, iv_list in expirations.items():
            if len(iv_list) >= 3:  # Need at least 3 ATM options
                avg_iv = sum(iv_list) / len(iv_list)
                dte = self.calculate_dte(exp_date)
                if dte and dte > 0:
                    result[exp_date] = {
                        'iv': avg_iv,  # Already in percentage form
                        'dte': dte,
                        'count': len(iv_list)
                    }
        
        return result
    
    def calculate_forward_factor(self, front_iv, front_dte, back_iv, back_dte):
        """Calculate Forward Factor"""
        try:
            # Convert to years
            T1 = front_dte / 365.0
            T2 = back_dte / 365.0
            
            # Convert IV to decimal
            sigma1 = front_iv / 100.0
            sigma2 = back_iv / 100.0
            
            # Calculate forward variance
            forward_var = ((sigma2 ** 2) * T2 - (sigma1 ** 2) * T1) / (T2 - T1)
            
            if forward_var < 0:
                return None, None, "Negative forward variance"
            
            # Calculate forward volatility
            forward_vol = (forward_var ** 0.5) * 100  # Convert back to percentage
            
            # Calculate forward factor
            forward_factor = ((sigma1 - (forward_var ** 0.5)) / (forward_var ** 0.5)) * 100
            
            return forward_vol, forward_factor, None
        except Exception as e:
            return None, None, str(e)
    
    def find_best_pairs(self, expirations):
        """Find the best front/back contract pairs"""
        # Sort by DTE
        sorted_exp = sorted(expirations.items(), key=lambda x: x[1]['dte'])
        
        pairs = []
        for i in range(len(sorted_exp) - 1):
            front_date, front_data = sorted_exp[i]
            back_date, back_data = sorted_exp[i + 1]
            
            # Calculate Forward Factor
            fwd_vol, ff, error = self.calculate_forward_factor(
                front_data['iv'], front_data['dte'],
                back_data['iv'], back_data['dte']
            )
            
            if error:
                continue
            
            pairs.append({
                'front_date': front_date,
                'front_iv': front_data['iv'],
                'front_dte': front_data['dte'],
                'back_date': back_date,
                'back_iv': back_data['iv'],
                'back_dte': back_data['dte'],
                'forward_vol': fwd_vol,
                'forward_factor': ff
            })
        
        return pairs
    
    def scan_ticker(self, ticker):
        """Scan a single ticker for Forward Factor opportunities"""
        print(f"\n📊 Scanning {ticker}...")
        
        # Fetch options chain
        options = self.fetch_options_chain(ticker)
        if not options:
            print(f"  ❌ No options data for {ticker}")
            return None
        
        # Group by expiration
        expirations = self.group_by_expiration(options)
        if len(expirations) < 2:
            print(f"  ⚠️  Insufficient expirations for {ticker} (found {len(expirations)})")
            return None
        
        # Find best pairs
        pairs = self.find_best_pairs(expirations)
        if not pairs:
            print(f"  ⚠️  No valid pairs for {ticker}")
            return None
        
        print(f"  ✅ Found {len(pairs)} valid pairs for {ticker}")
        return {
            'ticker': ticker,
            'pairs': pairs,
            'expirations': expirations
        }
    
    def scan_multiple(self, tickers, min_ff=-100, max_ff=100, sort_by='abs'):
        """
        Scan multiple tickers and return opportunities
        
        Args:
            tickers: List of ticker symbols
            min_ff: Minimum Forward Factor to include
            max_ff: Maximum Forward Factor to include
            sort_by: How to sort results ('abs', 'ff', 'ticker')
        """
        results = []
        
        print(f"\n🔍 Starting Forward Factor scan of {len(tickers)} tickers...")
        print(f"Filter: {min_ff}% <= FF <= {max_ff}%")
        print("=" * 70)
        
        for i, ticker in enumerate(tickers, 1):
            print(f"\n[{i}/{len(tickers)}] Processing {ticker}...")
            
            result = self.scan_ticker(ticker)
            if result:
                # Filter pairs by Forward Factor range
                filtered_pairs = [
                    pair for pair in result['pairs']
                    if min_ff <= pair['forward_factor'] <= max_ff
                ]
                
                if filtered_pairs:
                    result['pairs'] = filtered_pairs
                    results.append(result)
            
            # Rate limiting: wait between requests
            if i < len(tickers):
                time.sleep(0.5)  # 2 requests per second max
        
        # Sort results
        if sort_by == 'abs':
            # Sort by absolute value of Forward Factor (biggest mispricing)
            for result in results:
                result['pairs'].sort(key=lambda x: abs(x['forward_factor']), reverse=True)
        elif sort_by == 'ff':
            # Sort by Forward Factor value
            for result in results:
                result['pairs'].sort(key=lambda x: x['forward_factor'])
        
        return results
    
    def print_results(self, results, top_n=5):
        """Print scan results in a readable format"""
        print("\n" + "=" * 70)
        print("📈 FORWARD FACTOR SCAN RESULTS")
        print("=" * 70)
        
        if not results:
            print("\n❌ No opportunities found matching the criteria.")
            return
        
        # Collect all pairs across all tickers
        all_opportunities = []
        for result in results:
            for pair in result['pairs']:
                all_opportunities.append({
                    'ticker': result['ticker'],
                    **pair
                })
        
        # Sort by absolute Forward Factor
        all_opportunities.sort(key=lambda x: abs(x['forward_factor']), reverse=True)
        
        # Print top opportunities
        print(f"\n🏆 TOP {min(top_n, len(all_opportunities))} OPPORTUNITIES (by |FF|):\n")
        
        for i, opp in enumerate(all_opportunities[:top_n], 1):
            ff = opp['forward_factor']
            signal = "🔴 SELL" if ff > 0 else "🟢 BUY"
            
            print(f"{i}. {opp['ticker']} - {signal} Front Contract")
            print(f"   Forward Factor: {ff:+.2f}%")
            print(f"   Front: {opp['front_date']} ({opp['front_dte']}d) - IV: {opp['front_iv']:.2f}%")
            print(f"   Back:  {opp['back_date']} ({opp['back_dte']}d) - IV: {opp['back_iv']:.2f}%")
            print(f"   Forward Vol: {opp['forward_vol']:.2f}%")
            print()
        
        # Print summary by ticker
        print("\n📊 SUMMARY BY TICKER:\n")
        for result in results:
            ticker = result['ticker']
            pairs = result['pairs']
            
            if pairs:
                best_pair = max(pairs, key=lambda x: abs(x['forward_factor']))
                ff = best_pair['forward_factor']
                signal = "SELL" if ff > 0 else "BUY"
                
                print(f"  {ticker}: {signal} signal, FF={ff:+.2f}% ({len(pairs)} pairs)")
        
        print("\n" + "=" * 70)
        print(f"✅ Scan complete. Found {len(all_opportunities)} opportunities across {len(results)} tickers.")
        print("=" * 70)
    
    def export_to_csv(self, results, filename='ff_scan_results.csv'):
        """Export results to CSV file"""
        import csv
        
        # Collect all opportunities
        all_opportunities = []
        for result in results:
            for pair in result['pairs']:
                all_opportunities.append({
                    'ticker': result['ticker'],
                    **pair
                })
        
        # Sort by absolute Forward Factor
        all_opportunities.sort(key=lambda x: abs(x['forward_factor']), reverse=True)
        
        # Write to CSV
        with open(filename, 'w', newline='') as f:
            fieldnames = [
                'ticker', 'forward_factor', 'signal',
                'front_date', 'front_dte', 'front_iv',
                'back_date', 'back_dte', 'back_iv',
                'forward_vol'
            ]
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            
            for opp in all_opportunities:
                writer.writerow({
                    'ticker': opp['ticker'],
                    'forward_factor': f"{opp['forward_factor']:.2f}",
                    'signal': 'SELL' if opp['forward_factor'] > 0 else 'BUY',
                    'front_date': opp['front_date'],
                    'front_dte': opp['front_dte'],
                    'front_iv': f"{opp['front_iv']:.2f}",
                    'back_date': opp['back_date'],
                    'back_dte': opp['back_dte'],
                    'back_iv': f"{opp['back_iv']:.2f}",
                    'forward_vol': f"{opp['forward_vol']:.2f}"
                })
        
        print(f"\n💾 Results exported to {filename}")


def main():
    """Main function"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Forward Factor Scanner using Polygon.io')
    parser.add_argument('--tickers', nargs='+', help='List of tickers to scan (default: popular stocks)')
    parser.add_argument('--min-ff', type=float, default=-100, help='Minimum Forward Factor (default: -100)')
    parser.add_argument('--max-ff', type=float, default=100, help='Maximum Forward Factor (default: 100)')
    parser.add_argument('--top', type=int, default=10, help='Number of top opportunities to display (default: 10)')
    parser.add_argument('--export', type=str, help='Export results to CSV file')
    
    args = parser.parse_args()
    
    # Use provided tickers or default list
    tickers = args.tickers if args.tickers else DEFAULT_TICKERS
    
    # Create scanner
    scanner = ForwardFactorScanner(POLYGON_API_KEY)
    
    # Run scan
    results = scanner.scan_multiple(tickers, min_ff=args.min_ff, max_ff=args.max_ff)
    
    # Print results
    scanner.print_results(results, top_n=args.top)
    
    # Export if requested
    if args.export:
        scanner.export_to_csv(results, args.export)


if __name__ == '__main__':
    main()

