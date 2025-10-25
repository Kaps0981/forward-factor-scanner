# Forward Factor Scanner GitHub Repository: Implementation Guide

**Repository:** https://github.com/Kaps0981/forward-factor-scanner

**Date:** October 25, 2025

**Purpose:** Specific code changes to implement backtest-optimized filters in the existing codebase.

---

## Repository Structure Analysis

```
forward-factor-scanner/
├── client/                    # React/TypeScript frontend
│   └── src/
│       ├── components/
│       │   ├── ScanControls.tsx      # Main filter UI
│       │   ├── ResultsTable.tsx      # Results display
│       │   └── SummaryCards.tsx      # Summary stats
│       └── App.tsx
├── server/                    # Node.js/TypeScript backend
│   ├── scanner.ts            # Core scanning logic
│   ├── qualityFilters.ts     # Quality filtering
│   ├── routes.ts             # API endpoints
│   └── polygon.ts            # Polygon API integration
├── shared/
│   └── schema.ts             # Shared types/schemas
└── package.json
```

---

## Phase 1: Critical Changes

### 1. Add DTE Filtering to Scanner

#### File: `server/scanner.ts`

**Current State:** Scanner returns all DTE combinations without filtering

**Changes Required:**

```typescript
// Add after line 40 (after DEFAULT_TICKERS)
export const DTE_STRATEGIES = {
  '30-90': {
    frontDTEMin: 25,
    frontDTEMax: 35,
    backDTEMin: 85,
    backDTEMax: 95,
    minDTEDiff: 50,
    name: '30-90 (Optimal - Sharpe 2.64)',
    expectedCAGR: 20.08,
    expectedSharpe: 2.64,
    expectedWinRate: 53.2,
  },
  '30-60': {
    frontDTEMin: 25,
    frontDTEMax: 35,
    backDTEMin: 55,
    backDTEMax: 65,
    minDTEDiff: 20,
    name: '30-60 (Alternative)',
    expectedCAGR: 16.91,
    expectedSharpe: 2.37,
    expectedWinRate: 49.4,
  },
  '60-90': {
    frontDTEMin: 55,
    frontDTEMax: 65,
    backDTEMin: 85,
    backDTEMax: 95,
    minDTEDiff: 20,
    name: '60-90 (High Return)',
    expectedCAGR: 26.71,
    expectedSharpe: 2.40,
    expectedWinRate: 46.9,
  },
  'custom': {
    frontDTEMin: 0,
    frontDTEMax: 365,
    backDTEMin: 0,
    backDTEMax: 365,
    minDTEDiff: 7,
    name: 'Custom DTE Range',
  }
} as const;

export type DTEStrategyType = keyof typeof DTE_STRATEGIES;
```

**Update scanTicker method signature (line 268):**

```typescript
// OLD:
async scanTicker(ticker: string, minFF: number = -100, maxFF: number = 100): Promise<Opportunity[]>

// NEW:
async scanTicker(
  ticker: string, 
  minFF: number = -100, 
  maxFF: number = 100,
  dteStrategy: DTEStrategyType = '30-90',
  customDTEConfig?: {
    frontDTEMin?: number;
    frontDTEMax?: number;
    backDTEMin?: number;
    backDTEMax?: number;
    minDTEDiff?: number;
  }
): Promise<Opportunity[]>
```

**Add DTE filtering logic (after line 283, before the opportunities loop):**

```typescript
// Get DTE configuration
const dteConfig = dteStrategy === 'custom' && customDTEConfig 
  ? customDTEConfig 
  : DTE_STRATEGIES[dteStrategy];

// Filter expiration groups by DTE
const filteredGroups: ExpirationGroup[] = [];
for (let i = 0; i < expirationGroups.length - 1; i++) {
  const front = expirationGroups[i];
  const back = expirationGroups[i + 1];
  
  // Check if DTEs are within configured ranges
  const frontInRange = front.dte >= dteConfig.frontDTEMin && front.dte <= dteConfig.frontDTEMax;
  const backInRange = back.dte >= dteConfig.backDTEMin && back.dte <= dteConfig.backDTEMax;
  const diffInRange = (back.dte - front.dte) >= dteConfig.minDTEDiff;
  
  if (frontInRange && backInRange && diffInRange) {
    filteredGroups.push({ front, back });
  }
}

// Update the loop to use filteredGroups
const opportunities: Opportunity[] = [];

for (const { front, back } of filteredGroups) {
  const { forwardFactor, forwardVol } = this.calculateForwardFactor(
    front.atmIV,
    back.atmIV,
    front.dte,
    back.dte
  );

  // ... rest of the existing logic
}
```

---

#### File: `shared/schema.ts`

**Add DTE strategy fields to scanRequestSchema (around line 53):**

```typescript
// Update scanRequestSchema
export const scanRequestSchema = z.object({
  tickers: z.array(z.string()).optional(),
  min_ff: z.number().optional(),
  max_ff: z.number().optional(),
  top_n: z.number().min(1).max(100).optional(),
  min_open_interest: z.number().min(0).optional(),
  enable_email_alerts: z.boolean().optional(),
  // NEW: DTE strategy fields
  dte_strategy: z.enum(['30-90', '30-60', '60-90', 'custom']).optional().default('30-90'),
  custom_dte_config: z.object({
    front_dte_min: z.number().min(0).max(365).optional(),
    front_dte_max: z.number().min(0).max(365).optional(),
    back_dte_min: z.number().min(0).max(365).optional(),
    back_dte_max: z.number().min(0).max(365).optional(),
    min_dte_diff: z.number().min(7).max(365).optional(),
  }).optional(),
});
```

---

#### File: `server/routes.ts`

**Update the scan endpoint to pass DTE parameters (find the scanTicker call):**

```typescript
// Find the section where scanTicker is called (around line 150-200)
// Update to pass DTE strategy:

const opportunities = await scanner.scanTicker(
  ticker, 
  minFF, 
  maxFF,
  req.body.dte_strategy || '30-90',  // NEW
  req.body.custom_dte_config          // NEW
);
```

---

### 2. Restore Forward Factor Filtering

#### File: `client/src/components/ScanControls.tsx`

**Replace the "Forward Factor Range" section (lines 148-164):**

```typescript
// OLD (lines 148-164):
<div className="space-y-3">
  <div className="flex items-center justify-between">
    <Label className="text-xs sm:text-sm font-medium">Forward Factor Range</Label>
    <span className="text-xs sm:text-sm font-mono text-muted-foreground">
      No Limits Applied
    </span>
  </div>
  <div className="bg-muted/50 rounded-md p-2 sm:p-3">
    <p className="text-xs text-muted-foreground">
      ℹ️ FF percentage filtering has been removed. The scanner will find all opportunities regardless of FF magnitude.
    </p>
    <p className="text-xs text-muted-foreground mt-1">
      Quality filters and IVR regime filtering are applied automatically to find the best trades.
    </p>
  </div>
</div>

// NEW:
<div className="space-y-3">
  <Label className="text-xs sm:text-sm font-medium">Forward Factor Filter</Label>
  <select 
    value={ffFilterMode} 
    onChange={(e) => setFFFilterMode(e.target.value)}
    className="w-full p-2 border rounded-md"
    data-testid="select-ff-filter"
  >
    <option value="aggressive">Aggressive (FF &gt; 30%) - Top 10% - Sharpe 2.8-3.2</option>
    <option value="moderate">Moderate (FF &gt; 5%) - Top 60% - Sharpe 2.4-2.6 ⭐</option>
    <option value="minimal">Minimal (FF &gt; 0%) - Positive Only</option>
    <option value="none">No Filter (All FF values)</option>
  </select>
  
  <div className="bg-blue-50 dark:bg-blue-950 rounded-md p-2 sm:p-3 border border-blue-200 dark:border-blue-800">
    <p className="text-xs font-semibold text-blue-900 dark:text-blue-100 mb-1">
      📊 Backtest Insights (18-year data):
    </p>
    <div className="space-y-1 text-xs text-blue-800 dark:text-blue-200">
      {ffFilterMode === 'aggressive' && (
        <>
          <p>• Win Rate: 56-60% | Trades: 1-2/week</p>
          <p>• Best for: Maximum Sharpe, highest quality only</p>
        </>
      )}
      {ffFilterMode === 'moderate' && (
        <>
          <p>• Win Rate: 52-54% | Trades: 5-10/week</p>
          <p>• Best for: Balanced approach (recommended)</p>
        </>
      )}
      {ffFilterMode === 'minimal' && (
        <>
          <p>• Eliminates negative FF (losing trades)</p>
          <p>• Best for: Maximum opportunities</p>
        </>
      )}
      {ffFilterMode === 'none' && (
        <p className="text-amber-700 dark:text-amber-300">
          ⚠️ Warning: Includes negative FF trades (historically lose money)
        </p>
      )}
    </div>
  </div>
</div>
```

**Add state variable (after line 30):**

```typescript
const [ffFilterMode, setFFFilterMode] = useState<'aggressive' | 'moderate' | 'minimal' | 'none'>('moderate');
```

**Update handleScan function (around line 39):**

```typescript
const handleScan = () => {
  const tickers = scanType === "custom" && customTickers
    ? customTickers.split(",").map(t => t.trim().toUpperCase()).filter(Boolean)
    : undefined;

  // Convert FF filter mode to actual thresholds
  const ffThresholds = {
    aggressive: { min: 0.30, max: 999999 },
    moderate: { min: 0.05, max: 999999 },
    minimal: { min: 0.0, max: 999999 },
    none: { min: -999999, max: 999999 },
  };
  
  const threshold = ffThresholds[ffFilterMode];

  onScan({ 
    tickers, 
    minFF: threshold.min,  // CHANGED
    maxFF: threshold.max,  // CHANGED
    topN,
    minOpenInterest: minOpenInterest > 0 ? minOpenInterest : undefined,
    enableEmailAlerts,
    useMarketCap: scanType === "marketcap",
    minMarketCap: scanType === "marketcap" ? minMarketCap : undefined,
    maxMarketCap: scanType === "marketcap" ? maxMarketCap : undefined,
  });
};
```

**Update the interface (line 12):**

```typescript
interface ScanControlsProps {
  onScan: (params: {
    tickers?: string[];
    minFF: number;
    maxFF: number;
    topN: number;
    minOpenInterest?: number;
    enableEmailAlerts?: boolean;
    useMarketCap?: boolean;
    minMarketCap?: number;
    maxMarketCap?: number;
    dteStrategy?: string;  // NEW
  }) => void;
  isScanning: boolean;
  initialTickers?: string;
  watchlistName?: string;
}
```

---

### 3. Add Strategy Type Selector

#### File: `client/src/components/ScanControls.tsx`

**Add after the ticker selection tabs (after line 146, before Forward Factor section):**

```typescript
<div className="space-y-3">
  <Label className="text-xs sm:text-sm font-medium">Strategy Type</Label>
  <select 
    value={dteStrategy} 
    onChange={(e) => setDTEStrategy(e.target.value as DTEStrategyType)}
    className="w-full p-2 border rounded-md"
    data-testid="select-dte-strategy"
  >
    <option value="30-90">30-90 Days (Optimal - Sharpe 2.64) ⭐</option>
    <option value="30-60">30-60 Days (Alternative - Sharpe 2.37)</option>
    <option value="60-90">60-90 Days (High Return - Sharpe 2.40)</option>
    <option value="custom">Custom DTE Range</option>
  </select>
  
  {dteStrategy === 'custom' && (
    <div className="space-y-3 p-3 border rounded-md bg-muted/30">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="text-xs">Front DTE Min</Label>
          <Input
            type="number"
            min="0"
            max="365"
            value={customDTE.frontMin}
            onChange={(e) => setCustomDTE({...customDTE, frontMin: Number(e.target.value)})}
            className="text-sm"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Front DTE Max</Label>
          <Input
            type="number"
            min="0"
            max="365"
            value={customDTE.frontMax}
            onChange={(e) => setCustomDTE({...customDTE, frontMax: Number(e.target.value)})}
            className="text-sm"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Back DTE Min</Label>
          <Input
            type="number"
            min="0"
            max="365"
            value={customDTE.backMin}
            onChange={(e) => setCustomDTE({...customDTE, backMin: Number(e.target.value)})}
            className="text-sm"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Back DTE Max</Label>
          <Input
            type="number"
            min="0"
            max="365"
            value={customDTE.backMax}
            onChange={(e) => setCustomDTE({...customDTE, backMax: Number(e.target.value)})}
            className="text-sm"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label className="text-xs">Min DTE Difference</Label>
        <Input
          type="number"
          min="7"
          max="365"
          value={customDTE.minDiff}
          onChange={(e) => setCustomDTE({...customDTE, minDiff: Number(e.target.value)})}
          className="text-sm"
        />
        <p className="text-xs text-muted-foreground">
          Backtest optimal: 60 days
        </p>
      </div>
    </div>
  )}
  
  <div className="bg-green-50 dark:bg-green-950 rounded-md p-2 sm:p-3 border border-green-200 dark:border-green-800">
    <p className="text-xs font-semibold text-green-900 dark:text-green-100 mb-1">
      📈 Expected Performance ({dteStrategy}):
    </p>
    <div className="grid grid-cols-3 gap-2 text-xs text-green-800 dark:text-green-200">
      <div>
        <div className="font-semibold">CAGR</div>
        <div>{getStrategyMetric(dteStrategy, 'cagr')}</div>
      </div>
      <div>
        <div className="font-semibold">Sharpe</div>
        <div>{getStrategyMetric(dteStrategy, 'sharpe')}</div>
      </div>
      <div>
        <div className="font-semibold">Win Rate</div>
        <div>{getStrategyMetric(dteStrategy, 'winRate')}</div>
      </div>
    </div>
  </div>
</div>
```

**Add state variables (after line 30):**

```typescript
type DTEStrategyType = '30-90' | '30-60' | '60-90' | 'custom';
const [dteStrategy, setDTEStrategy] = useState<DTEStrategyType>('30-90');
const [customDTE, setCustomDTE] = useState({
  frontMin: 25,
  frontMax: 35,
  backMin: 85,
  backMax: 95,
  minDiff: 50,
});
```

**Add helper function:**

```typescript
const getStrategyMetric = (strategy: DTEStrategyType, metric: 'cagr' | 'sharpe' | 'winRate') => {
  const metrics = {
    '30-90': { cagr: '20.08%', sharpe: '2.64', winRate: '53.2%' },
    '30-60': { cagr: '16.91%', sharpe: '2.37', winRate: '49.4%' },
    '60-90': { cagr: '26.71%', sharpe: '2.40', winRate: '46.9%' },
    'custom': { cagr: 'N/A', sharpe: 'N/A', winRate: 'N/A' },
  };
  return metrics[strategy][metric];
};
```

**Update handleScan to include DTE strategy:**

```typescript
onScan({ 
  tickers, 
  minFF: threshold.min,
  maxFF: threshold.max,
  topN,
  minOpenInterest: minOpenInterest > 0 ? minOpenInterest : undefined,
  enableEmailAlerts,
  useMarketCap: scanType === "marketcap",
  minMarketCap: scanType === "marketcap" ? minMarketCap : undefined,
  maxMarketCap: scanType === "marketcap" ? maxMarketCap : undefined,
  dteStrategy: dteStrategy,  // NEW
  customDTEConfig: dteStrategy === 'custom' ? {  // NEW
    front_dte_min: customDTE.frontMin,
    front_dte_max: customDTE.frontMax,
    back_dte_min: customDTE.backMin,
    back_dte_max: customDTE.backMax,
    min_dte_diff: customDTE.minDiff,
  } : undefined,
});
```

---

### 4. Update Default Settings

#### File: `client/src/components/ScanControls.tsx`

**Update state initialization (lines 29-37):**

```typescript
// OLD:
const [minFF, setMinFF] = useState(-999999);
const [maxFF, setMaxFF] = useState(999999);
const [topN, setTopN] = useState(20);
const [minOpenInterest, setMinOpenInterest] = useState(200);

// NEW:
const [ffFilterMode, setFFFilterMode] = useState<'aggressive' | 'moderate' | 'minimal' | 'none'>('moderate');
const [dteStrategy, setDTEStrategy] = useState<DTEStrategyType>('30-90');
const [topN, setTopN] = useState(20);
const [minOpenInterest, setMinOpenInterest] = useState(500);  // CHANGED from 200 to 500
```

---

### 5. Update Min Open Interest Slider

#### File: `client/src/components/ScanControls.tsx`

**Update the slider range (around line 198):**

```typescript
// OLD:
<Slider
  id="min-oi"
  min={0}
  max={500}
  step={50}
  value={[minOpenInterest]}
  onValueChange={([v]) => setMinOpenInterest(v)}
  className="mt-2 touch-none"
  data-testid="slider-min-oi"
/>

// NEW:
<Slider
  id="min-oi"
  min={0}
  max={2000}  // CHANGED from 500 to 2000
  step={100}   // CHANGED from 50 to 100
  value={[minOpenInterest]}
  onValueChange={([v]) => setMinOpenInterest(v)}
  className="mt-2 touch-none"
  data-testid="slider-min-oi"
/>
```

**Update help text (around line 207):**

```typescript
// OLD:
<p className="text-xs text-muted-foreground">
  Filter by ATM option liquidity
</p>

// NEW:
<p className="text-xs text-muted-foreground">
  Backtest optimal: 500+ (moderate) or 1,000+ (aggressive)
</p>
```

---

## Phase 2: Important Enhancements

### 6. Add Position Sizing Calculator

#### File: `server/kelly.ts` (NEW FILE)

```typescript
/**
 * Kelly Criterion position sizing calculator
 * Based on 18-year backtest results for Forward Factor strategies
 */

export interface KellyConfig {
  portfolioSize: number;
  kellySizing: 'quarter' | 'half' | 'full' | 'fixed' | 'fixed-percent';
  fixedAmount?: number;
  fixedPercent?: number;
  // Backtest-derived parameters (can be overridden)
  winRate?: number;
  avgWin?: number;
  avgLoss?: number;
}

export interface PositionSizeResult {
  recommendedSize: number;
  numContracts: number;
  kellyFraction: number;
  riskPercent: number;
}

/**
 * Calculate optimal position size using Kelly Criterion
 * Default parameters from 30-90 backtest: 53.2% win rate, 25% avg win/loss
 */
export function calculateKellyPositionSize(
  config: KellyConfig,
  optionPrice: number = 500  // Estimated spread price
): PositionSizeResult {
  const {
    portfolioSize,
    kellySizing,
    fixedAmount,
    fixedPercent,
    winRate = 0.532,  // 30-90 backtest win rate
    avgWin = 0.25,    // 25% average win
    avgLoss = 0.25,   // 25% average loss
  } = config;

  // Kelly formula: (p * b - q) / b
  // where p = win probability, q = loss probability, b = win/loss ratio
  const p = winRate;
  const q = 1 - winRate;
  const b = avgWin / avgLoss;
  
  const kellyFraction = (p * b - q) / b;
  
  let positionFraction: number;
  
  switch (kellySizing) {
    case 'quarter':
      positionFraction = kellyFraction / 4;
      break;
    case 'half':
      positionFraction = kellyFraction / 2;
      break;
    case 'full':
      positionFraction = kellyFraction;
      break;
    case 'fixed':
      return {
        recommendedSize: fixedAmount || 0,
        numContracts: Math.floor((fixedAmount || 0) / optionPrice),
        kellyFraction: kellyFraction,
        riskPercent: ((fixedAmount || 0) / portfolioSize) * 100,
      };
    case 'fixed-percent':
      positionFraction = (fixedPercent || 5) / 100;
      break;
    default:
      positionFraction = kellyFraction / 4;  // Default to Quarter Kelly
  }
  
  const recommendedSize = portfolioSize * positionFraction;
  const numContracts = Math.floor(recommendedSize / optionPrice);
  const riskPercent = positionFraction * 100;
  
  return {
    recommendedSize: Math.round(recommendedSize),
    numContracts,
    kellyFraction: Math.round(kellyFraction * 1000) / 1000,
    riskPercent: Math.round(riskPercent * 100) / 100,
  };
}

/**
 * Get expected performance metrics for a given strategy and Kelly sizing
 */
export function getExpectedPerformance(
  strategy: '30-90' | '30-60' | '60-90',
  kellySizing: 'quarter' | 'half' | 'full'
): {
  cagr: number;
  sharpe: number;
  winRate: number;
} {
  const metrics = {
    '30-90': {
      quarter: { cagr: 20.08, sharpe: 2.64, winRate: 53.2 },
      half: { cagr: 21.93, sharpe: 2.06, winRate: 53.2 },
      full: { cagr: 22.61, sharpe: 1.93, winRate: 53.2 },
    },
    '30-60': {
      quarter: { cagr: 16.91, sharpe: 2.37, winRate: 49.4 },
      half: { cagr: 20.46, sharpe: 1.92, winRate: 49.4 },
      full: { cagr: 21.51, sharpe: 1.58, winRate: 49.4 },
    },
    '60-90': {
      quarter: { cagr: 26.71, sharpe: 2.40, winRate: 46.9 },
      half: { cagr: 27.79, sharpe: 1.97, winRate: 46.9 },
      full: { cagr: 28.05, sharpe: 1.72, winRate: 46.9 },
    },
  };
  
  return metrics[strategy][kellySizing];
}
```

---

#### File: `shared/schema.ts`

**Add Kelly sizing fields to scanRequestSchema:**

```typescript
export const scanRequestSchema = z.object({
  tickers: z.array(z.string()).optional(),
  min_ff: z.number().optional(),
  max_ff: z.number().optional(),
  top_n: z.number().min(1).max(100).optional(),
  min_open_interest: z.number().min(0).optional(),
  enable_email_alerts: z.boolean().optional(),
  dte_strategy: z.enum(['30-90', '30-60', '60-90', 'custom']).optional().default('30-90'),
  custom_dte_config: z.object({
    front_dte_min: z.number().min(0).max(365).optional(),
    front_dte_max: z.number().min(0).max(365).optional(),
    back_dte_min: z.number().min(0).max(365).optional(),
    back_dte_max: z.number().min(0).max(365).optional(),
    min_dte_diff: z.number().min(7).max(365).optional(),
  }).optional(),
  // NEW: Kelly sizing fields
  portfolio_size: z.number().min(1000).optional().default(100000),
  kelly_sizing: z.enum(['quarter', 'half', 'full', 'fixed', 'fixed-percent']).optional().default('quarter'),
  fixed_amount: z.number().optional(),
  fixed_percent: z.number().min(1).max(100).optional(),
});
```

**Add position sizing fields to opportunitySchema:**

```typescript
export const opportunitySchema = z.object({
  // ... existing fields ...
  position_size_recommendation: z.number().optional(),
  num_contracts: z.number().optional(),  // NEW
  kelly_fraction: z.number().optional(),  // NEW
  risk_percent: z.number().optional(),    // NEW
  // ... rest of fields ...
});
```

---

#### File: `server/scanner.ts`

**Import Kelly calculator (add to imports at top):**

```typescript
import { calculateKellyPositionSize, type KellyConfig } from './kelly';
```

**Update scanTicker method signature:**

```typescript
async scanTicker(
  ticker: string, 
  minFF: number = -100, 
  maxFF: number = 100,
  dteStrategy: DTEStrategyType = '30-90',
  customDTEConfig?: {
    frontDTEMin?: number;
    frontDTEMax?: number;
    backDTEMin?: number;
    backDTEMax?: number;
    minDTEDiff?: number;
  },
  kellyConfig?: KellyConfig  // NEW
): Promise<Opportunity[]>
```

**Add position sizing calculation in the opportunities loop (after line 304):**

```typescript
// Calculate position sizing if Kelly config provided
let positionSizing = undefined;
if (kellyConfig) {
  // Estimate spread price (simplified - could be improved with actual option prices)
  const estimatedSpreadPrice = Math.abs(front.atmIV - back.atmIV) * stockPrice * 0.01;
  positionSizing = calculateKellyPositionSize(kellyConfig, estimatedSpreadPrice);
}

opportunities.push({
  ticker,
  forward_factor: Math.round(forwardFactor * 100) / 100,
  signal: forwardFactor > 0 ? 'SELL' : 'BUY',
  front_date: front.date,
  front_dte: front.dte,
  front_iv: Math.round(front.atmIV * 100) / 100,
  back_date: back.date,
  back_dte: back.dte,
  back_iv: Math.round(back.atmIV * 100) / 100,
  forward_vol: Math.round(forwardVol * 100) / 100,
  // ... existing fields ...
  // NEW: Position sizing fields
  position_size_recommendation: positionSizing?.recommendedSize,
  num_contracts: positionSizing?.numContracts,
  kelly_fraction: positionSizing?.kellyFraction,
  risk_percent: positionSizing?.riskPercent,
});
```

---

#### File: `server/routes.ts`

**Update scan endpoint to pass Kelly config:**

```typescript
// Build Kelly config from request
const kellyConfig: KellyConfig | undefined = req.body.portfolio_size ? {
  portfolioSize: req.body.portfolio_size,
  kellySizing: req.body.kelly_sizing || 'quarter',
  fixedAmount: req.body.fixed_amount,
  fixedPercent: req.body.fixed_percent,
} : undefined;

// Pass to scanner
const opportunities = await scanner.scanTicker(
  ticker, 
  minFF, 
  maxFF,
  req.body.dte_strategy || '30-90',
  req.body.custom_dte_config,
  kellyConfig  // NEW
);
```

---

#### File: `client/src/components/ScanControls.tsx`

**Add Kelly sizing controls (add after DTE strategy section):**

```typescript
<div className="space-y-3">
  <Label className="text-xs sm:text-sm font-medium">Position Sizing</Label>
  
  <div className="space-y-2">
    <Label className="text-xs">Portfolio Size ($)</Label>
    <Input
      type="number"
      min="1000"
      step="1000"
      value={portfolioSize}
      onChange={(e) => setPortfolioSize(Number(e.target.value))}
      placeholder="e.g., 100000"
      className="font-mono"
    />
  </div>
  
  <div className="space-y-2">
    <Label className="text-xs">Kelly Sizing Method</Label>
    <select 
      value={kellySizing} 
      onChange={(e) => setKellySizing(e.target.value as KellySizingType)}
      className="w-full p-2 border rounded-md text-sm"
    >
      <option value="quarter">Quarter Kelly (~5% per trade) - Optimal Sharpe ⭐</option>
      <option value="half">Half Kelly (~10% per trade) - Balanced</option>
      <option value="full">Full Kelly (~20% per trade) - Aggressive</option>
      <option value="fixed">Fixed Dollar Amount</option>
      <option value="fixed-percent">Fixed Percentage</option>
    </select>
  </div>
  
  {kellySizing === 'fixed' && (
    <div className="space-y-2">
      <Label className="text-xs">Fixed Position Size ($)</Label>
      <Input
        type="number"
        min="100"
        step="100"
        value={fixedAmount}
        onChange={(e) => setFixedAmount(Number(e.target.value))}
        className="font-mono"
      />
    </div>
  )}
  
  {kellySizing === 'fixed-percent' && (
    <div className="space-y-2">
      <Label className="text-xs">Fixed Position Size (%)</Label>
      <Input
        type="number"
        min="1"
        max="100"
        step="1"
        value={fixedPercent}
        onChange={(e) => setFixedPercent(Number(e.target.value))}
        className="font-mono"
      />
    </div>
  )}
  
  <div className="bg-purple-50 dark:bg-purple-950 rounded-md p-2 sm:p-3 border border-purple-200 dark:border-purple-800">
    <p className="text-xs font-semibold text-purple-900 dark:text-purple-100 mb-1">
      💡 Kelly Criterion Guidance:
    </p>
    <div className="space-y-1 text-xs text-purple-800 dark:text-purple-200">
      {kellySizing === 'quarter' && (
        <p>Quarter Kelly: Backtest Sharpe 2.64, CAGR 20%, recommended for most traders</p>
      )}
      {kellySizing === 'half' && (
        <p>Half Kelly: Backtest Sharpe 2.06, CAGR 22%, moderate risk</p>
      )}
      {kellySizing === 'full' && (
        <p>Full Kelly: Backtest Sharpe 1.93, CAGR 23%, high risk/volatility</p>
      )}
    </div>
  </div>
</div>
```

**Add state variables:**

```typescript
type KellySizingType = 'quarter' | 'half' | 'full' | 'fixed' | 'fixed-percent';
const [portfolioSize, setPortfolioSize] = useState(100000);
const [kellySizing, setKellySizing] = useState<KellySizingType>('quarter');
const [fixedAmount, setFixedAmount] = useState(5000);
const [fixedPercent, setFixedPercent] = useState(5);
```

**Update handleScan:**

```typescript
onScan({ 
  // ... existing params ...
  portfolioSize,  // NEW
  kellySizing,    // NEW
  fixedAmount: kellySizing === 'fixed' ? fixedAmount : undefined,  // NEW
  fixedPercent: kellySizing === 'fixed-percent' ? fixedPercent : undefined,  // NEW
});
```

---

### 7. Enhance Results Table

#### File: `client/src/components/ResultsTable.tsx`

**Add new columns to the table (find the table header section and add):**

```typescript
// Add after existing columns
<TableHead className="text-xs">Front DTE</TableHead>
<TableHead className="text-xs">Back DTE</TableHead>
<TableHead className="text-xs">DTE Diff</TableHead>
<TableHead className="text-xs">Position Size</TableHead>
<TableHead className="text-xs">Contracts</TableHead>
```

**Add corresponding data cells:**

```typescript
// In the table body, add after existing cells
<TableCell className="text-xs font-mono">
  {opportunity.front_dte} days
</TableCell>
<TableCell className="text-xs font-mono">
  {opportunity.back_dte} days
</TableCell>
<TableCell className="text-xs font-mono">
  {opportunity.back_dte - opportunity.front_dte} days
</TableCell>
<TableCell className="text-xs font-mono">
  {opportunity.position_size_recommendation 
    ? `$${opportunity.position_size_recommendation.toLocaleString()}`
    : '—'}
</TableCell>
<TableCell className="text-xs font-mono">
  {opportunity.num_contracts || '—'}
</TableCell>
```

---

## Testing Checklist

### Unit Tests to Add

- [ ] DTE filtering logic (30-90, 30-60, 60-90, custom)
- [ ] Forward Factor threshold filtering (aggressive, moderate, minimal, none)
- [ ] Kelly Criterion calculations (quarter, half, full)
- [ ] Position size calculations with different portfolio sizes

### Integration Tests

- [ ] Full scan with 30-90 moderate preset
- [ ] Full scan with custom DTE range
- [ ] Position sizing appears correctly in results
- [ ] DTE filtering excludes 0 DTE opportunities
- [ ] FF filtering excludes negative FF when set to minimal/moderate/aggressive

### Manual Testing

- [ ] UI displays all new controls correctly
- [ ] Strategy metrics update when changing DTE strategy
- [ ] FF filter insights update when changing filter mode
- [ ] Kelly sizing controls show/hide based on selection
- [ ] Results table shows new columns (DTE, position size, contracts)
- [ ] Default settings match backtest-optimized values

---

## Deployment Steps

### 1. Create Feature Branch

```bash
git checkout -b feature/backtest-optimized-filters
```

### 2. Implement Changes in Order

1. Backend: Add DTE filtering to scanner.ts
2. Backend: Create kelly.ts calculator
3. Shared: Update schema.ts with new fields
4. Backend: Update routes.ts to pass new parameters
5. Frontend: Update ScanControls.tsx with new UI
6. Frontend: Update ResultsTable.tsx with new columns
7. Test thoroughly

### 3. Commit and Push

```bash
git add .
git commit -m "feat: Add backtest-optimized filters (DTE, FF, Kelly sizing)"
git push origin feature/backtest-optimized-filters
```

### 4. Create Pull Request

Create PR on GitHub with description of changes and link to backtest analysis document.

### 5. Deploy to Production

After PR approval and merge:
```bash
git checkout main
git pull origin main
# Deploy to Replit or hosting platform
```

---

## Summary of Changes

### Files Modified

**Backend:**
- `server/scanner.ts` - Add DTE filtering, Kelly integration
- `server/kelly.ts` - NEW: Kelly Criterion calculator
- `server/routes.ts` - Pass new parameters to scanner
- `shared/schema.ts` - Add new request/response fields

**Frontend:**
- `client/src/components/ScanControls.tsx` - Add DTE, FF, Kelly controls
- `client/src/components/ResultsTable.tsx` - Add new columns
- `client/src/components/ScanControls.tsx` - Update default values

### Configuration Changes

| Setting | Old Default | New Default |
|---------|-------------|-------------|
| Forward Factor Filter | None | Moderate (FF > 5%) |
| Min Open Interest | 200 | 500 |
| DTE Strategy | None | 30-90 days |
| Position Sizing | None | Quarter Kelly (5%) |
| Portfolio Size | N/A | $100,000 |

### Expected Impact

- **Scan Quality:** Dramatically improved - only backtest-validated opportunities
- **User Experience:** Clear guidance on expected performance
- **Risk Management:** Proper position sizing based on Kelly Criterion
- **Performance:** Expected 18-20% CAGR with Sharpe 2.4-2.6

---

## Next Steps

1. Review this implementation guide
2. Create GitHub issues for each major change
3. Implement Phase 1 (critical changes) first
4. Test thoroughly in development
5. Deploy to staging for user testing
6. Collect feedback and iterate
7. Deploy to production
8. Implement Phase 2 (enhancements)
9. Monitor live performance vs backtest expectations

---

**Document Version:** 1.0  
**Last Updated:** October 25, 2025  
**Repository:** https://github.com/Kaps0981/forward-factor-scanner  
**Status:** Ready for Implementation

