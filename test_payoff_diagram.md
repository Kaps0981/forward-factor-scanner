# Testing Payoff Diagram - Debug Instructions

## Current Status

✅ **Backend is working correctly**: The backend is generating tent-shaped calendar spread curves as confirmed by server logs:
- P&L at strike: Maximum value (tent peak)
- P&L at edges: Lower values
- Server confirms: "Is tent-shaped? ✓ YES"

## Testing Steps

1. **Open the application** in your browser at http://localhost:5000

2. **Open Browser Developer Console** (F12 or right-click → Inspect → Console tab)

3. **Navigate to a scan** with results (e.g., scan #31 exists)

4. **Click on "View Payoff" button** for any opportunity

5. **Check the console logs** for:
   - "=== PayoffDiagram Debug ==="
   - Look for "✓ Curve is tent-shaped" or "✗ Curve is NOT tent-shaped"
   - Check the P&L values at 25%, 50%, and 75% positions

## Expected Console Output

You should see something like:
```
=== PayoffDiagram Debug ===
Net Debit (premium): [value]
P&L at 25% (left): [negative value]
P&L at 50% (middle/strike): [positive maximum value]
P&L at 75% (right): [negative value]
✓ Curve is tent-shaped (calendar spread)
```

## What to Look For

1. **If console shows "✗ Curve is NOT tent-shaped"**: The frontend is receiving wrong data or transforming it incorrectly

2. **If console shows "✓ Curve is tent-shaped"**: The data is correct but the chart rendering has an issue

3. **Check the chart data points**: Look at the logged "Chart data prepared" messages to see the actual values being plotted

## Potential Issues to Check

1. **YAxis domain**: The chart might be auto-scaling incorrectly
2. **Data transformation**: The merging of curves might be incorrect
3. **Negative values**: The chart might not handle negative P&L values correctly

Please test and check the browser console output to determine which component is causing the issue.