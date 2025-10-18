#!/usr/bin/env python3
import os
import requests
import json

API_KEY = os.environ.get('POLYGON_API_KEY')

# Fetch PLTR options
url = f'https://api.polygon.io/v3/snapshot/options/PLTR'
params = {'apiKey': API_KEY, 'limit': 10}

response = requests.get(url, params=params)
data = response.json()

print("First 3 options with full details:\n")
for i, option in enumerate(data.get('results', [])[:3], 1):
    print(f"Option {i}:")
    print(f"  Ticker: {option['details']['ticker']}")
    print(f"  Expiration: {option['details']['expiration_date']}")
    print(f"  Strike: ${option['details']['strike_price']}")
    print(f"  Type: {option['details']['contract_type']}")
    print(f"  Implied Volatility: {option.get('implied_volatility')}")
    print(f"  Open Interest: {option.get('open_interest')}")
    if 'greeks' in option:
        print(f"  Delta: {option['greeks'].get('delta')}")
    print()

