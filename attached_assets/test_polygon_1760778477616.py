#!/usr/bin/env python3
import os
from polygon import RESTClient

# Get API key from environment
api_key = os.environ.get('POLYGON_API_KEY')
print(f"API Key present: {bool(api_key)}")

# Initialize client
client = RESTClient(api_key=api_key)

# Test 1: Try to get universal snapshots for options
print("\n=== Test 1: Universal Snapshots (Options) ===")
try:
    count = 0
    for snapshot in client.list_universal_snapshots(type='options', limit=5):
        count += 1
        print(f"Snapshot {count}:")
        if hasattr(snapshot, 'underlying_ticker'):
            print(f"  Underlying: {snapshot.underlying_ticker}")
        if hasattr(snapshot, 'details'):
            print(f"  Expiration: {snapshot.details.expiration_date if hasattr(snapshot.details, 'expiration_date') else 'N/A'}")
        if hasattr(snapshot, 'implied_volatility'):
            print(f"  IV: {snapshot.implied_volatility}")
        print()
        if count >= 3:
            break
    print(f"Success! Found {count} snapshots")
except Exception as e:
    print(f"Error: {e}")

# Test 2: Try to get all snapshots for options market
print("\n=== Test 2: Get All Snapshots (Options Market) ===")
try:
    from polygon.rest.models import SnapshotMarketType
    snapshots = client.get_snapshot_all(SnapshotMarketType.OPTIONS, tickers=['O:AAPL251017C00200000'])
    print(f"Success! Got {len(snapshots)} snapshots")
    if snapshots:
        snap = snapshots[0]
        print(f"Sample snapshot attributes: {dir(snap)}")
except Exception as e:
    print(f"Error: {e}")

print("\n=== Test Complete ===")

