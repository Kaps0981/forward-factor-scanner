#!/usr/bin/env python3
import os
from polygon import RESTClient
from datetime import datetime

# Get API key from environment
api_key = os.environ.get('POLYGON_API_KEY')
client = RESTClient(api_key=api_key)

ticker = "AAPL"
print(f"=== Testing Options Snapshots for {ticker} ===\n")

try:
    count = 0
    aapl_options = {}
    
    for snapshot in client.list_universal_snapshots(type='options', limit=250):
        # Check all attributes
        if count == 0:
            print(f"First snapshot attributes: {dir(snapshot)}\n")
        
        # Try to find the underlying ticker
        underlying = None
        if hasattr(snapshot, 'underlying_ticker'):
            underlying = snapshot.underlying_ticker
        elif hasattr(snapshot, 'details') and hasattr(snapshot.details, 'underlying_ticker'):
            underlying = snapshot.details.underlying_ticker
        elif hasattr(snapshot, 'details') and hasattr(snapshot.details, 'ticker'):
            # Extract from option ticker (format: O:AAPL251017C00200000)
            option_ticker = snapshot.details.ticker
            if option_ticker.startswith('O:'):
                # Extract underlying from option ticker
                parts = option_ticker[2:]  # Remove 'O:'
                # Find where the date starts (6 digits YYMMDD)
                for i in range(len(parts)):
                    if parts[i:i+6].isdigit() and len(parts[i:i+6]) == 6:
                        underlying = parts[:i]
                        break
        
        if underlying == ticker:
            count += 1
            if hasattr(snapshot, 'details') and hasattr(snapshot, 'implied_volatility'):
                exp_date = snapshot.details.expiration_date
                iv = snapshot.implied_volatility
                
                if exp_date not in aapl_options:
                    aapl_options[exp_date] = []
                aapl_options[exp_date].append(iv)
            
            if count <= 3:
                print(f"Option {count}:")
                if hasattr(snapshot, 'details'):
                    print(f"  Ticker: {snapshot.details.ticker if hasattr(snapshot.details, 'ticker') else 'N/A'}")
                    print(f"  Expiration: {snapshot.details.expiration_date if hasattr(snapshot.details, 'expiration_date') else 'N/A'}")
                    print(f"  Strike: {snapshot.details.strike_price if hasattr(snapshot.details, 'strike_price') else 'N/A'}")
                print(f"  IV: {snapshot.implied_volatility if hasattr(snapshot, 'implied_volatility') else 'N/A'}")
                print()
        
        if count >= 50:  # Limit for testing
            break
    
    print(f"\nFound {count} {ticker} options")
    print(f"Unique expirations: {len(aapl_options)}")
    
    if aapl_options:
        sorted_exps = sorted(aapl_options.keys())
        print(f"\nExpirations found:")
        for exp in sorted_exps[:5]:
            avg_iv = sum(aapl_options[exp]) / len(aapl_options[exp])
            today = datetime.now().date()
            exp_date = datetime.strptime(exp, '%Y-%m-%d').date()
            dte = (exp_date - today).days
            print(f"  {exp}: {len(aapl_options[exp])} contracts, Avg IV: {avg_iv:.2f}%, DTE: {dte}")
    
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()

