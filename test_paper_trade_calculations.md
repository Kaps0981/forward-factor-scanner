# Paper Trade Calculation Test Results

## Summary of Changes

✅ **Fixed Issues:**

1. **PaperTradeDialog Component:**
   - Removed hardcoded `quantity * 1.5` estimation
   - Added real-time fetching of payoff analysis data from backend
   - Display actual calculated premium/entry price from the payoff calculator
   - Show actual max profit and max loss based on payoff calculations
   - Added loading states while fetching payoff data
   - Display per-contract price breakdown for clarity

2. **Backend Routes:**
   - Updated `/api/paper-trades` POST endpoint to use PayoffCalculator
   - Calculate actual entry price from calendar spread payoff analysis
   - Calculate max profit and max loss using proper payoff calculations
   - Account for quantity and 100-share contract multiplier in all calculations

3. **Database Schema:**
   - Added `max_profit` field to `paperTrades` table
   - Pushed schema changes to database successfully

## Calculation Logic

### Entry Price (Premium)
- Calculated using PayoffCalculator's `calculateCalendarSpreadPayoff` method
- For SELL signals: Net debit = back option price - front option price  
- For BUY signals: Net cost = front option price - back option price
- Falls back to user-provided actual prices if available

### Max Loss
- Formula: `payoffAnalysis.metrics.maxLoss * quantity * 100`
- Accounts for:
  - Net debit paid (from payoff calculator)
  - Number of contracts (quantity)
  - Options contract multiplier (100 shares per contract)

### Max Profit  
- Formula: `payoffAnalysis.metrics.maxProfit * quantity * 100`
- Handles "Unlimited" max profit scenarios
- Accounts for:
  - Calculated max profit from payoff analysis
  - Number of contracts (quantity)
  - Options contract multiplier (100 shares per contract)

## Key Features

1. **Real-time Calculation:** PaperTradeDialog fetches payoff analysis on open and when stock price changes
2. **Accurate Pricing:** Uses Black-Scholes model through PayoffCalculator for proper option pricing
3. **User Override:** Still allows users to enter actual prices if they differ from estimates
4. **Visual Feedback:** Shows loading states and displays breakeven points and profit probability
5. **Proper Multipliers:** All calculations correctly account for the 100-share contract multiplier

## Testing Steps

1. Open the scanner and find an opportunity
2. Click "Paper Trade" on any opportunity
3. Observe:
   - Net Debit/Credit shows calculated value (not hardcoded $1.50)
   - Max Loss shows actual calculated risk
   - Max Profit shows calculated profit potential
   - Values update when quantity changes
   - Values match what the payoff diagram would show

## Database Verification

The `max_profit` field has been added to the `paperTrades` table and the schema has been successfully pushed to the database.

## Result

✅ **All requested fixes have been implemented successfully:**
- Entry price is calculated from actual opportunity data
- Max profit comes from the payoff calculation backend
- Max loss is properly calculated with contract multiplier
- Database stores both max_profit and max_risk values
- All values properly account for the 100-share contract multiplier