# OQuants Forward Factor Strategy Analysis

**Date:** October 25, 2025  
**Source:** https://oquants.com/plays/forward-factors?timeframe=30_60  
**Purpose:** Analyze OQuants' Forward Factor implementation to extract insights for your scanner

---

## Key Observations from OQuants Implementation

### 1. Strategy Definition

**Description from OQuants:**
> "Term structure opportunities ranked by ex-earnings forward volatility factors. Higher factors indicate greater term structure mispricing for calendar spreads and volatility arbitrage."

**Key Insight:** They explicitly focus on **ex-earnings** forward factors, meaning they exclude earnings effects from the calculation. This is critical - they're looking for "pure" term structure mispricings, not post-earnings IV decay.

---

### 2. Timeframe Strategy

**Current Implementation:**
- **Primary Timeframe:** 30-60 Days (visible in URL: `?timeframe=30_60`)
- This aligns **exactly** with your backtest's 30-60 strategy
- Dropdown suggests other timeframes are available (likely 30-90, 60-90)

**Implication:** OQuants defaults to 30-60, which your backtest shows has:
- CAGR: 16.91% (Quarter Kelly)
- Sharpe: 2.37
- Win Rate: 49.4%

This is their **primary recommended timeframe**, suggesting they've also found this to be optimal or at least highly effective.

---

### 3. Ranking Methodology

**Opportunities are ranked by:**
1. **Forward Factor (Ex-Earnings)** - Primary sort (highest to lowest)
2. **Earnings Date** - Shows when next earnings is
3. **Timeframe** - Fixed at 30-60 for this view
4. **Option Volume (20d Avg)** - Liquidity filter

**Top Opportunities (Oct 25, 2025):**

| Rank | Ticker | FF (Ex-Earn) | Earnings Date | Timeframe | Opt Vol (20d) |
|------|--------|--------------|---------------|-----------|---------------|
| 1 | ROKU | 44% | Oct 30 (5d) | 30-60 | 11.68K |
| 2 | DNUT | 33.2% | Nov 11 (17d) | 30-60 | 19.43K |
| 3 | CNC | 33.1% | Oct 29 (4d) | 30-60 | 39.34K |
| 4 | GSK | 33% | Oct 29 (4d) | 30-60 | 8.81K |
| 5 | WOLF | 32% | Oct 29 (4d) | 30-60 | 27.23K |
| 6 | AES | 30.2% | Nov 5 (11d) | 30-60 | 21.89K |
| 7 | KDP | 30.1% | Oct 27 (2d) | 30-60 | 23.45K |
| 8 | UMAC | 28.7% | Nov 13 (19d) | 30-60 | 8.01K |
| 9 | TEAM | 27.5% | Oct 30 (5d) | 30-60 | 9.53K |
| 10 | SBUX | 27.2% | Oct 29 (4d) | 30-60 | 49.56K |

---

### 4. Critical Differences from Your Current Scanner

#### A. Ex-Earnings Forward Factor Calculation

**OQuants Approach:**
- Calculates Forward Factor **excluding earnings effects**
- This means they're adjusting or filtering out the IV spike/decay caused by earnings
- Looking for "pure" term structure mispricings

**Your Current Scanner:**
- Calculates raw Forward Factor including all IV effects
- Tonight's scan showed many opportunities with earnings in 2-5 days
- These are likely **post-earnings IV decay** signals, not true term structure mispricings

**Why This Matters:**
Your backtest likely includes both:
1. **True term structure mispricings** (what OQuants targets)
2. **Post-earnings IV decay** (which may or may not be profitable)

OQuants is being more selective by focusing only on #1.

#### B. Earnings Date Display

**OQuants:**
- Shows earnings date prominently for each opportunity
- Shows days until earnings (e.g., "Oct 30 (5d)")
- Marks estimated earnings with "Est." tag

**Your Scanner:**
- Shows "No earnings in next 7 days" as a binary flag
- Doesn't show actual earnings dates in results table
- Doesn't distinguish between confirmed and estimated earnings

**Recommendation:** Add earnings date column to your results table.

#### C. Option Volume Filter

**OQuants:**
- Shows 20-day average option volume
- Uses this as a liquidity proxy
- Range in top 10: 7.84K to 568.38K (wide range)

**Your Scanner:**
- Uses Open Interest (OI) as liquidity filter
- Default: 200 (should be 500+)
- Doesn't show option volume

**Insight:** Option volume is a **complementary** liquidity metric to OI. High OI with low volume = stale positions. High volume with low OI = active trading but less depth.

**Recommendation:** Consider adding option volume as a secondary liquidity filter.

---

### 5. Forward Factor Threshold Analysis

**OQuants Top Opportunities:**
- Minimum FF shown: ~20% (bottom of visible list)
- Top FF: 44% (ROKU)
- Average of top 10: ~31%

**Comparison to Your Backtest Thresholds:**
- **Aggressive (FF > 30%):** Would capture top 6-7 opportunities
- **Moderate (FF > 5%):** Would capture all shown opportunities
- **Minimal (FF > 0%):** Would capture everything

**OQuants Implicit Threshold:**
They're showing opportunities with FF ≥ 20%, suggesting this is their quality threshold for the 30-60 timeframe.

**Recommendation:**
- **Conservative:** FF > 30% (top decile, aligns with your backtest)
- **Moderate:** FF > 20% (aligns with OQuants display threshold)
- **Aggressive:** FF > 5% (your current backtest moderate)

---

### 6. Earnings Proximity Patterns

**Observations from OQuants Data:**

**Earnings in 2-5 days (7 opportunities):**
- ROKU (5d), CNC (4d), GSK (4d), WOLF (4d), TEAM (5d), SBUX (4d), KDP (2d)
- These are **post-earnings** opportunities (earnings just happened or happening soon)
- High FF likely due to elevated front-month IV from recent/upcoming earnings

**Earnings in 11-19 days (3 opportunities):**
- DNUT (17d), AES (11d), UMAC (19d)
- These are **pre-earnings** opportunities
- High FF suggests front month is pricing in earnings premium

**Key Insight:**
OQuants shows **both** pre-earnings and post-earnings opportunities, but they calculate FF **ex-earnings**. This means:
1. They're identifying when the term structure is mispriced **relative to the earnings effect**
2. Not just raw IV differences

---

### 7. Liquidity Patterns

**Option Volume Analysis:**

**High Liquidity (>20K avg volume):**
- CNC (39.34K), WOLF (27.23K), AES (21.89K), KDP (23.45K), SBUX (49.56K)
- These are safer for execution

**Medium Liquidity (10-20K):**
- ROKU (11.68K), DNUT (19.43K), XP (17.82K)
- Acceptable for moderate position sizes

**Low Liquidity (<10K):**
- GSK (8.81K), UMAC (8.01K), TEAM (9.53K), AAP (7.84K)
- Execution risk, wider spreads

**Your Scanner Comparison:**
- You use OI threshold (200-500)
- OQuants uses option volume (7.8K-568K range)
- These are complementary metrics

**Recommendation:** Add option volume filter:
- Aggressive: >5K avg volume
- Moderate: >10K avg volume
- Conservative: >20K avg volume

---

### 8. Missing Elements in Your Scanner

Based on OQuants implementation, your scanner is missing:

#### A. Ex-Earnings Forward Factor Calculation
**What it is:** Adjust FF calculation to exclude earnings IV effects

**How to implement:**
1. Detect if earnings is within the DTE range
2. Estimate earnings IV premium (historical average or model-based)
3. Subtract earnings premium from front month IV before calculating FF
4. Or: Simply filter out opportunities with earnings in the next 30 days

**Priority:** HIGH - This is the core difference

#### B. Earnings Date in Results
**What it is:** Show actual earnings date and days until earnings

**How to implement:**
- Already have earnings detection
- Add columns: "Earnings Date", "Days to Earnings"
- Mark estimated vs confirmed

**Priority:** MEDIUM - Improves decision-making

#### C. Option Volume Metric
**What it is:** 20-day average option volume as liquidity filter

**How to implement:**
- Query Polygon API for historical option volume
- Calculate 20-day average
- Add as filter and display column

**Priority:** MEDIUM - Complements OI filtering

#### D. Timeframe Selector
**What it is:** Allow users to switch between 30-60, 30-90, 60-90

**How to implement:**
- Already planned in your implementation guide
- Add dropdown with preset DTE ranges

**Priority:** HIGH - Already in your plan

---

## Key Differences: OQuants vs Your Scanner

| Feature | OQuants | Your Scanner | Action Needed |
|---------|---------|--------------|---------------|
| **FF Calculation** | Ex-earnings | Raw (includes earnings) | Add ex-earnings option |
| **Default Timeframe** | 30-60 | No default (all DTEs) | Set to 30-90 (higher Sharpe) |
| **FF Threshold** | ~20% minimum shown | No limit (was removed) | Restore with 5-30% options |
| **Liquidity Metric** | Option volume (20d avg) | Open Interest | Add option volume |
| **Earnings Display** | Date + days until | Binary flag | Add date column |
| **Min FF Shown** | ~20% | All values | Apply threshold |
| **Ranking** | By FF descending | By FF descending | ✅ Same |
| **Quality Filters** | Implicit (ex-earnings) | Explicit (IVR, events) | ✅ You have more |

---

## Recommendations for Your Scanner

### Priority 1: Critical (Implement First)

**1. Add Ex-Earnings Forward Factor Option**

```typescript
// In scanner.ts
interface FFCalculationOptions {
  excludeEarnings: boolean;
  earningsIVPremium?: number; // Default: 10% or historical average
}

function calculateForwardFactor(
  frontIV: number,
  backIV: number,
  frontDTE: number,
  backDTE: number,
  options: FFCalculationOptions = { excludeEarnings: false }
): { forwardFactor: number; forwardVol: number } {
  
  let adjustedFrontIV = frontIV;
  
  if (options.excludeEarnings && hasEarningsInRange(frontDTE)) {
    // Subtract estimated earnings premium from front month
    const earningsPremium = options.earningsIVPremium || 10; // 10% default
    adjustedFrontIV = frontIV - earningsPremium;
  }
  
  // Calculate FF with adjusted IV
  const dteDiff = backDTE - frontDTE;
  if (dteDiff <= 0) {
    return { forwardFactor: 0, forwardVol: 0 };
  }

  const frontVar = Math.pow(adjustedFrontIV / 100, 2) * (frontDTE / 365);
  const backVar = Math.pow(backIV / 100, 2) * (backDTE / 365);
  const forwardVar = backVar - frontVar;

  if (forwardVar <= 0) {
    return { forwardFactor: 0, forwardVol: 0 };
  }

  const forwardVol = Math.sqrt(forwardVar / (dteDiff / 365)) * 100;
  const forwardFactor = ((adjustedFrontIV - forwardVol) / forwardVol) * 100;

  return { forwardFactor, forwardVol };
}
```

**UI Addition:**
```typescript
// In ScanControls.tsx
<div className="space-y-2">
  <Label className="text-xs">Forward Factor Calculation</Label>
  <select 
    value={ffCalculationMode} 
    onChange={(e) => setFFCalculationMode(e.target.value)}
    className="w-full p-2 border rounded-md text-sm"
  >
    <option value="raw">Raw (Include Earnings Effects)</option>
    <option value="ex-earnings">Ex-Earnings (Exclude Earnings Effects) ⭐</option>
  </select>
  <p className="text-xs text-muted-foreground">
    Ex-earnings mode adjusts for earnings IV premium to find pure term structure mispricings
  </p>
</div>
```

**2. Update Default FF Threshold to 20%**

Based on OQuants showing opportunities ≥20%, update your moderate threshold:

```typescript
// Update FF filter modes
const ffThresholds = {
  aggressive: { min: 0.30, max: 999999 },  // 30%+ (top decile)
  moderate: { min: 0.20, max: 999999 },    // 20%+ (OQuants threshold) - CHANGED
  minimal: { min: 0.05, max: 999999 },     // 5%+ (positive only)
  none: { min: -999999, max: 999999 },
};
```

**3. Add Earnings Date Column**

```typescript
// In ResultsTable.tsx
<TableColumn>
  <TableHeader>Earnings Date</TableHeader>
  <TableCell>
    {opportunity.earnings_date ? (
      <div className="text-xs">
        <div className="font-mono">{opportunity.earnings_date}</div>
        <div className="text-muted-foreground">
          ({calculateDaysUntil(opportunity.earnings_date)}d)
          {opportunity.earnings_estimated && <span className="ml-1">Est.</span>}
        </div>
      </div>
    ) : (
      <span className="text-muted-foreground">—</span>
    )}
  </TableCell>
</TableColumn>
```

### Priority 2: Important (Implement Second)

**4. Add Option Volume Filter**

```typescript
// In shared/schema.ts
export const scanRequestSchema = z.object({
  // ... existing fields ...
  min_option_volume: z.number().min(0).optional(), // NEW
});

// In scanner.ts - add to opportunity data
{
  ticker,
  forward_factor,
  // ... existing fields ...
  option_volume_20d: calculateAvgOptionVolume(ticker, 20), // NEW
}
```

**UI Addition:**
```typescript
// In ScanControls.tsx
<div className="space-y-3">
  <div className="flex items-center justify-between">
    <Label htmlFor="min-vol" className="text-xs sm:text-sm font-medium">
      Min Option Volume (20d Avg)
    </Label>
    <span className="text-xs sm:text-sm font-mono text-muted-foreground">
      {minOptionVolume === 0 ? 'None' : `${minOptionVolume}K`}
    </span>
  </div>
  <Slider
    id="min-vol"
    min={0}
    max={50}
    step={5}
    value={[minOptionVolume]}
    onValueChange={([v]) => setMinOptionVolume(v)}
    className="mt-2 touch-none"
  />
  <p className="text-xs text-muted-foreground">
    OQuants uses 7.8K-50K+ range. Recommended: 10K+ (moderate), 20K+ (conservative)
  </p>
</div>
```

**5. Update Default Timeframe to Match OQuants**

OQuants defaults to 30-60, but your backtest shows 30-90 has higher Sharpe (2.64 vs 2.37).

**Options:**
- **Option A:** Default to 30-60 (match OQuants, more conservative)
- **Option B:** Default to 30-90 (match backtest optimal Sharpe)

**Recommendation:** Default to 30-90 but add a note that OQuants uses 30-60.

```typescript
// In ScanControls.tsx
<select value={dteStrategy} onChange={(e) => setDTEStrategy(e.target.value)}>
  <option value="30-90">30-90 Days (Optimal Sharpe 2.64) ⭐</option>
  <option value="30-60">30-60 Days (OQuants Default - Sharpe 2.37)</option>
  <option value="60-90">60-90 Days (Highest CAGR - Sharpe 2.40)</option>
  <option value="custom">Custom DTE Range</option>
</select>
```

### Priority 3: Nice-to-Have (Implement Later)

**6. Add Timeframe Switcher Like OQuants**

Allow users to quickly switch between 30-60, 30-90, 60-90 views:

```typescript
// Add tab-style switcher above results
<Tabs value={activeTimeframe} onValueChange={setActiveTimeframe}>
  <TabsList>
    <TabsTrigger value="30-60">30-60 Days</TabsTrigger>
    <TabsTrigger value="30-90">30-90 Days</TabsTrigger>
    <TabsTrigger value="60-90">60-90 Days</TabsTrigger>
  </TabsList>
</Tabs>
```

**7. Add "Est." Tag for Estimated Earnings**

OQuants marks estimated earnings dates. Add this to your earnings detection:

```typescript
// In financialEvents.ts
interface EarningsData {
  date: string;
  estimated: boolean; // NEW
  confirmed: boolean; // NEW
}
```

---

## Strategic Insights

### 1. OQuants' Approach is More Conservative

**Evidence:**
- Ex-earnings FF calculation (excludes noise)
- 20%+ FF threshold (vs your current "no limit")
- 30-60 timeframe (lower CAGR but more consistent)

**Implication:** They're prioritizing **quality over quantity** of opportunities.

### 2. Your Backtest May Include "False Positives"

**Post-Earnings IV Decay Signals:**
- Tonight's scan: SOFI, COIN, HOOD, UPST, AFRM all had recent earnings
- High positive FF due to front month IV elevated from earnings
- OQuants would filter these out with ex-earnings calculation

**Question:** Did your backtest include these post-earnings opportunities?
- If YES: Your backtest results include both true term structure trades AND post-earnings trades
- If NO: Your backtest already excludes them (unlikely given the methodology)

**Recommendation:** Re-run backtest with ex-earnings FF calculation to see if performance improves.

### 3. The "30-60 vs 30-90" Question

**OQuants uses 30-60 as default**
**Your backtest shows 30-90 is optimal (Sharpe 2.64 vs 2.37)**

**Possible explanations:**
1. OQuants' backtest showed different results
2. OQuants prioritizes execution simplicity (30-60 is easier to manage)
3. OQuants' ex-earnings calculation changes the optimal timeframe
4. OQuants serves a broader audience (more conservative)

**Recommendation:** Offer both, default to 30-90, but note that OQuants uses 30-60.

---

## Implementation Priority Summary

### Phase 1: Critical Alignment with OQuants (Week 1)

1. ✅ **Add ex-earnings FF calculation option** (highest priority)
2. ✅ **Update FF threshold to 20% for moderate mode**
3. ✅ **Add earnings date column to results**
4. ✅ **Set default timeframe to 30-90** (or 30-60 to match OQuants)

### Phase 2: Enhanced Filtering (Week 2)

5. ✅ **Add option volume filter and display**
6. ✅ **Add "Est." tag for estimated earnings**
7. ✅ **Update liquidity warnings based on option volume**

### Phase 3: UX Improvements (Week 3)

8. ✅ **Add timeframe switcher tabs**
9. ✅ **Add comparison note: "OQuants uses 30-60"**
10. ✅ **Add ex-earnings explainer tooltip**

---

## Testing Recommendations

### A. Compare Your Scanner to OQuants

**Test on same date (Oct 25, 2025):**

1. Run your scanner with:
   - Timeframe: 30-60
   - FF threshold: 20%+
   - Ex-earnings: ON

2. Compare top 10 results to OQuants top 10

3. Expected: Should see similar tickers (ROKU, DNUT, CNC, etc.)

4. If different: Investigate why (likely ex-earnings calculation differences)

### B. Backtest with Ex-Earnings FF

1. Re-run your 18-year backtest with ex-earnings FF calculation
2. Compare performance metrics:
   - CAGR
   - Sharpe ratio
   - Win rate
   - Drawdowns

3. Hypothesis: Ex-earnings should improve Sharpe ratio by reducing false positives

### C. A/B Test Live Trading

1. Paper trade both approaches:
   - **Approach A:** Raw FF (your current method)
   - **Approach B:** Ex-earnings FF (OQuants method)

2. Track for 3-6 months

3. Compare actual vs expected performance

---

## Final Recommendations

### What to Implement Immediately

1. **Add ex-earnings FF calculation** - This is the biggest difference
2. **Restore FF filtering with 20% moderate threshold** - Matches OQuants
3. **Add earnings date column** - Critical for decision-making
4. **Set default to 30-90 with note about OQuants 30-60** - Best of both worlds

### What to Test

1. **Re-run backtest with ex-earnings FF** - Validate if this improves performance
2. **Compare scanner output to OQuants** - Ensure alignment
3. **Paper trade both methods** - Real-world validation

### What Makes Your Scanner Better

Your scanner already has advantages over OQuants:

1. ✅ **IVR filtering** - OQuants doesn't show this
2. ✅ **Quality score** - Proprietary filtering
3. ✅ **Event warnings** - Fed meetings, etc.
4. ✅ **Position sizing** - Kelly Criterion (if implemented)
5. ✅ **Backtest-validated thresholds** - 18 years of data
6. ✅ **Multiple timeframe options** - 30-60, 30-90, 60-90

**Your Goal:** Combine OQuants' ex-earnings approach with your superior filtering and position sizing.

---

## Conclusion

**Key Takeaway:** OQuants' main differentiator is the **ex-earnings Forward Factor calculation**. This filters out post-earnings IV decay "false positives" and focuses on true term structure mispricings.

**Action Items:**
1. Implement ex-earnings FF calculation (Priority 1)
2. Update FF threshold to 20%+ for moderate mode (Priority 1)
3. Add earnings date column (Priority 1)
4. Add option volume filter (Priority 2)
5. Test and compare results to OQuants (Validation)

**Expected Outcome:** Higher quality opportunities, better Sharpe ratio, fewer false positives, more consistent returns.

---

**Document Version:** 1.0  
**Last Updated:** October 25, 2025  
**Source:** OQuants Forward Factors Analysis  
**Status:** Ready for Implementation

