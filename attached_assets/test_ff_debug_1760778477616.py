#!/usr/bin/env python3
import os
import requests
from datetime import datetime
from collections import defaultdict

API_KEY = os.environ.get('POLYGON_API_KEY')

# Fetch PLTR options
url = f'https://api.polygon.io/v3/snapshot/options/PLTR'
params = {'apiKey': API_KEY, 'limit': 250}

response = requests.get(url, params=params)
data = response.json()

print(f"Status: {response.status_code}")
print(f"Total results: {len(data.get('results', []))}\n")

# Group by expiration
expirations = defaultdict(list)

for option in data.get('results', []):
    try:
        exp_date_str = option['details']['expiration_date']
        iv = option.get('implied_volatility')
        
        if iv and iv > 0:
            expirations[exp_date_str].append(iv)
    except:
        pass

print("Expirations found:")
for exp_date in sorted(expirations.keys()):
    iv_list = expirations[exp_date]
    avg_iv = sum(iv_list) / len(iv_list)
    
    # Calculate DTE
    exp = datetime.strptime(exp_date, '%Y-%m-%d').date()
    today = datetime.now().date()
    dte = (exp - today).days
    
    print(f"  {exp_date} ({dte}d): {len(iv_list)} options, avg IV = {avg_iv:.2f}%")

print(f"\nTotal expirations with data: {len(expirations)}")

