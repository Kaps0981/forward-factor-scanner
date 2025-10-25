import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Play } from "lucide-react";

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
    strategyType?: '30-90' | '60-90';
    dteStrategy?: '30-90' | '30-60' | '60-90' | 'all';
    ffCalculationMode?: 'raw' | 'ex-earnings';
  }) => void;
  isScanning: boolean;
  initialTickers?: string;
  watchlistName?: string;
}

export function ScanControls({ onScan, isScanning, initialTickers, watchlistName }: ScanControlsProps) {
  const [scanType, setScanType] = useState<"default" | "custom" | "marketcap">(initialTickers ? "custom" : "default");
  const [customTickers, setCustomTickers] = useState(initialTickers || "");
  const [minFF, setMinFF] = useState(-999999);
  const [maxFF, setMaxFF] = useState(999999);
  const [topN, setTopN] = useState(20);
  const [minOpenInterest, setMinOpenInterest] = useState(200);
  const [enableEmailAlerts, setEnableEmailAlerts] = useState(false);
  const [minMarketCap, setMinMarketCap] = useState(2);
  const [maxMarketCap, setMaxMarketCap] = useState(15);
  const [strategyType, setStrategyType] = useState<"all" | "30-90" | "60-90">("all");
  const [dteStrategy, setDTEStrategy] = useState<'30-90' | '30-60' | '60-90' | 'all'>('30-90');
  const [ffCalculationMode, setFFCalculationMode] = useState<'raw' | 'ex-earnings'>('raw');
  const [ffFilterMode, setFFFilterMode] = useState<'aggressive' | 'moderate' | 'balanced' | 'minimal' | 'none'>('moderate');

  const handleScan = () => {
    const tickers = scanType === "custom" && customTickers
      ? customTickers.split(",").map(t => t.trim().toUpperCase()).filter(Boolean)
      : undefined;

    // Convert FF filter mode to actual thresholds
    const ffThresholds = {
      aggressive: { min: 30, max: 100 },   // |FF| > 30%
      moderate: { min: 20, max: 100 },     // |FF| > 20% (OQuants standard)
      balanced: { min: 5, max: 100 },      // |FF| > 5%
      minimal: { min: 0, max: 100 },       // |FF| > 0%
      none: { min: -100, max: 100 },       // No filter
    };

    const threshold = ffThresholds[ffFilterMode];

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
      strategyType: strategyType === "all" ? undefined : strategyType,
      dteStrategy,
      ffCalculationMode,
    });
  };

  return (
    <Card className="border-card-border">
      <CardContent className="p-4 md:p-6">
        <div className="space-y-4 md:space-y-6">
          <div>
            <h2 className="text-base md:text-lg font-semibold mb-3 md:mb-4">Scan Configuration</h2>
            
            <Tabs value={scanType} onValueChange={(v) => setScanType(v as "default" | "custom" | "marketcap")}>
              <TabsList className="grid w-full grid-cols-3 mb-3 md:mb-4 h-auto">
                <TabsTrigger value="default" data-testid="tab-default-stocks" className="text-xs sm:text-sm px-1 sm:px-3 py-2 sm:py-1.5">
                  <span className="hidden sm:inline">Default Stocks</span>
                  <span className="sm:hidden">Default</span>
                </TabsTrigger>
                <TabsTrigger value="custom" data-testid="tab-custom-tickers" className="text-xs sm:text-sm px-1 sm:px-3 py-2 sm:py-1.5">
                  <span className="hidden sm:inline">Custom Tickers</span>
                  <span className="sm:hidden">Custom</span>
                </TabsTrigger>
                <TabsTrigger value="marketcap" data-testid="tab-market-cap" className="text-xs sm:text-sm px-1 sm:px-3 py-2 sm:py-1.5">
                  <span className="hidden sm:inline">By Market Cap</span>
                  <span className="sm:hidden">Market Cap</span>
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="default" className="mt-0">
                <p className="text-sm text-muted-foreground">
                  Scan 100 curated quality mid-cap stocks across multiple sectors
                </p>
              </TabsContent>
              
              <TabsContent value="custom" className="mt-0 space-y-2">
                <Label htmlFor="custom-tickers" className="text-sm font-medium">
                  Enter Tickers (comma-separated)
                </Label>
                <Input
                  id="custom-tickers"
                  placeholder="PLTR, ROKU, NET, ETSY, RIVN"
                  value={customTickers}
                  onChange={(e) => setCustomTickers(e.target.value)}
                  className="font-mono"
                  data-testid="input-custom-tickers"
                />
                <p className="text-xs text-muted-foreground">
                  Maximum 100 tickers per scan
                </p>
              </TabsContent>
              
              <TabsContent value="marketcap" className="mt-0 space-y-4">
                <p className="text-sm text-muted-foreground">
                  Scan stocks by market capitalization range (in billions)
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="min-cap" className="text-sm font-medium">
                      Min Market Cap ($B)
                    </Label>
                    <Input
                      id="min-cap"
                      type="number"
                      min="0.1"
                      max="1000"
                      step="0.5"
                      value={minMarketCap}
                      onChange={(e) => setMinMarketCap(Number(e.target.value))}
                      className="font-mono"
                      data-testid="input-min-market-cap"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="max-cap" className="text-sm font-medium">
                      Max Market Cap ($B)
                    </Label>
                    <Input
                      id="max-cap"
                      type="number"
                      min="0.1"
                      max="1000"
                      step="0.5"
                      value={maxMarketCap}
                      onChange={(e) => setMaxMarketCap(Number(e.target.value))}
                      className="font-mono"
                      data-testid="input-max-market-cap"
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Recommended: $2B - $15B for quality mid-cap stocks
                </p>
              </TabsContent>
            </Tabs>
          </div>

          <div className="grid grid-cols-1 gap-4 md:gap-6">
            <div className="space-y-3">
              <Label className="text-xs sm:text-sm font-medium">Forward Factor Filter</Label>
              <Select 
                value={ffFilterMode} 
                onValueChange={(value) => setFFFilterMode(value as 'aggressive' | 'moderate' | 'balanced' | 'minimal' | 'none')}
              >
                <SelectTrigger data-testid="select-ff-filter">
                  <SelectValue placeholder="Select FF filter mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="aggressive">Aggressive (|FF| &gt; 30%) - Top 10% - Sharpe 2.8-3.2</SelectItem>
                  <SelectItem value="moderate">Moderate (|FF| &gt; 20%) - OQuants Standard ⭐</SelectItem>
                  <SelectItem value="balanced">Balanced (|FF| &gt; 5%) - Top 60% - Sharpe 2.4-2.6</SelectItem>
                  <SelectItem value="minimal">Minimal (|FF| &gt; 0%) - Positive Only</SelectItem>
                  <SelectItem value="none">No Filter (All FF values) ⚠️</SelectItem>
                </SelectContent>
              </Select>
              
              <div className="bg-green-50 dark:bg-green-950 rounded-md p-2 sm:p-3 border border-green-200 dark:border-green-800">
                <p className="text-xs font-semibold text-green-900 dark:text-green-100 mb-1">
                  📊 Backtest Insights (18-year data):
                </p>
                <div className="space-y-1 text-xs text-green-800 dark:text-green-200">
                  {ffFilterMode === 'aggressive' && (
                    <>
                      <p>• Win Rate: 56-60% | Trades: 50-100/month</p>
                      <p>• Best for: Maximum Sharpe, highest quality only</p>
                      <p>• Dramatically reduces false signals</p>
                    </>
                  )}
                  {ffFilterMode === 'moderate' && (
                    <>
                      <p>• Win Rate: 54-56% | Trades: ~300/month</p>
                      <p>• OQuants professional standard threshold</p>
                      <p>• Optimal balance of quality and opportunity</p>
                    </>
                  )}
                  {ffFilterMode === 'balanced' && (
                    <>
                      <p>• Win Rate: 52-54% | Trades: ~400/month</p>
                      <p>• Best for: Balanced approach with more trades</p>
                      <p>• Good for active traders</p>
                    </>
                  )}
                  {ffFilterMode === 'minimal' && (
                    <>
                      <p>• Eliminates negative FF (historically lose money)</p>
                      <p>• Maximum opportunities while avoiding losses</p>
                    </>
                  )}
                  {ffFilterMode === 'none' && (
                    <p className="text-red-700 dark:text-red-300">
                      ⚠️ Warning: Includes negative FF trades that historically lose money!
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-xs sm:text-sm font-medium">DTE Strategy</Label>
              <Select 
                value={dteStrategy} 
                onValueChange={(value) => setDTEStrategy(value as '30-90' | '30-60' | '60-90' | 'all')}
              >
                <SelectTrigger data-testid="select-dte-strategy">
                  <SelectValue placeholder="Select DTE strategy" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30-90">30-90 Days (2.64 Sharpe) ⭐ Recommended</SelectItem>
                  <SelectItem value="30-60">30-60 Days (2.37 Sharpe)</SelectItem>
                  <SelectItem value="60-90">60-90 Days (2.40 Sharpe, Highest Returns)</SelectItem>
                  <SelectItem value="all">All DTEs (Unfiltered)</SelectItem>
                </SelectContent>
              </Select>
              
              <div className="bg-blue-50 dark:bg-blue-950 rounded-md p-2 sm:p-3 border border-blue-200 dark:border-blue-800">
                <p className="text-xs font-semibold text-blue-900 dark:text-blue-100 mb-1">
                  📊 Backtest Performance (18 years):
                </p>
                <div className="space-y-1 text-xs text-blue-800 dark:text-blue-200">
                  {dteStrategy === '30-90' && (
                    <>
                      <p>• CAGR: 20.08% | Sharpe: 2.64 | Win Rate: 53.2%</p>
                      <p>• Best risk-adjusted returns with Quarter Kelly sizing</p>
                    </>
                  )}
                  {dteStrategy === '30-60' && (
                    <>
                      <p>• CAGR: 16.91% | Sharpe: 2.37 | Win Rate: 49.4%</p>
                      <p>• More frequent trading opportunities</p>
                    </>
                  )}
                  {dteStrategy === '60-90' && (
                    <>
                      <p>• CAGR: 26.71% | Sharpe: 2.40 | Win Rate: 46.9%</p>
                      <p>• Highest returns but more volatile</p>
                    </>
                  )}
                  {dteStrategy === 'all' && (
                    <p className="text-amber-700 dark:text-amber-300">
                      ⚠️ No filtering - includes suboptimal DTE combinations
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-xs sm:text-sm font-medium">Forward Factor Calculation</Label>
              <Select 
                value={ffCalculationMode} 
                onValueChange={(value) => setFFCalculationMode(value as 'raw' | 'ex-earnings')}
              >
                <SelectTrigger data-testid="select-ff-calculation">
                  <SelectValue placeholder="Select FF calculation mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="raw">Raw (Include Earnings Effects)</SelectItem>
                  <SelectItem value="ex-earnings">Ex-Earnings (Pure Term Structure) ⭐</SelectItem>
                </SelectContent>
              </Select>
              
              <div className="bg-purple-50 dark:bg-purple-950 rounded-md p-2 sm:p-3 border border-purple-200 dark:border-purple-800">
                <p className="text-xs font-semibold text-purple-900 dark:text-purple-100 mb-1">
                  🎯 Calculation Mode Insights:
                </p>
                <div className="space-y-1 text-xs text-purple-800 dark:text-purple-200">
                  {ffCalculationMode === 'ex-earnings' ? (
                    <>
                      <p>• Adjusts for earnings IV premium (~15%)</p>
                      <p>• Finds pure term structure mispricings</p>
                      <p>• Method used by OQuants professionals</p>
                    </>
                  ) : (
                    <>
                      <p>• Includes all IV effects including earnings</p>
                      <p>• May show false signals from earnings decay</p>
                      <p>• Use when specifically trading earnings</p>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Label htmlFor="strategy-type" className="text-xs sm:text-sm font-medium">
                Strategy Filter
              </Label>
              <Select value={strategyType} onValueChange={(value) => setStrategyType(value as "all" | "30-90" | "60-90")}>
                <SelectTrigger id="strategy-type" data-testid="select-strategy-type">
                  <SelectValue placeholder="Select strategy" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Opportunities</SelectItem>
                  <SelectItem value="30-90">30-90 DTE Strategy</SelectItem>
                  <SelectItem value="60-90">60-90 DTE Strategy</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Filter opportunities by specific trading strategies
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="top-n" className="text-xs sm:text-sm font-medium">
                    Top Results
                  </Label>
                  <span className="text-xs sm:text-sm font-mono text-muted-foreground">
                    {topN}
                  </span>
                </div>
                <Slider
                  id="top-n"
                  min={5}
                  max={50}
                  step={5}
                  value={[topN]}
                  onValueChange={([v]) => setTopN(v)}
                  className="mt-2 touch-none"
                  data-testid="slider-top-n"
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="min-oi" className="text-xs sm:text-sm font-medium">
                    Min Open Interest
                  </Label>
                  <span className="text-xs sm:text-sm font-mono text-muted-foreground">
                    {minOpenInterest === 0 ? 'None' : minOpenInterest}
                  </span>
                </div>
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
                <p className="text-xs text-muted-foreground">
                  Filter by ATM option liquidity
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 sm:p-4 border border-card-border rounded-lg">
            <div className="space-y-1">
              <Label htmlFor="email-alerts" className="text-xs sm:text-sm font-medium">
                Email Notifications
              </Label>
              <p className="text-xs text-muted-foreground">
                Get alerts for high |FF| opportunities
              </p>
            </div>
            <Switch
              id="email-alerts"
              checked={enableEmailAlerts}
              onCheckedChange={setEnableEmailAlerts}
              data-testid="switch-email-alerts"
              className="touch-none"
            />
          </div>

          <Button
            onClick={handleScan}
            disabled={isScanning || (scanType === "custom" && !customTickers.trim())}
            className="w-full"
            size="lg"
            data-testid="button-run-scan"
          >
            <Play className="mr-2 h-4 w-4" />
            {isScanning ? "Scanning..." : "Run Scan"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
