import { useState, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceDot,
  Area,
  ComposedChart
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign,
  Activity,
  Clock,
  Target,
  AlertTriangle,
  Info
} from "lucide-react";
import {
  Tooltip as TooltipUI,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Opportunity } from "@shared/schema";

interface PayoffDataPoint {
  stockPrice: number;
  pnl: number;
  percentMove: number;
  expirationPnl?: number;
  currentPnl?: number;
  selectedPnl?: number;
}

interface PayoffCurve {
  date: string;
  daysToExpiration: number;
  dataPoints: PayoffDataPoint[];
  isExpiration: boolean;
}

interface PayoffMetrics {
  premium: number;
  upperBreakeven: number;
  lowerBreakeven: number;
  maxLoss: number;
  maxProfit: string;
  profitProbability: number;
  currentDelta: number;
  currentTheta: number;
  currentGamma: number;
  currentVega: number;
}

interface PayoffAnalysisData {
  curves: PayoffCurve[];
  metrics: PayoffMetrics;
  currentStockPrice: number;
  strikePrice: number;
  frontIV: number;
  backIV: number;
  frontDTE: number;
  backDTE: number;
  signal: 'BUY' | 'SELL';
  forwardFactor: number;
}

interface PayoffDiagramProps {
  open: boolean;
  onClose: () => void;
  opportunity: Opportunity | null;
  payoffData?: PayoffAnalysisData;
}

export function PayoffDiagram({ open, onClose, opportunity, payoffData }: PayoffDiagramProps) {
  const [selectedTimePercent, setSelectedTimePercent] = useState(0);
  
  // Debug logging - see what data we're receiving
  if (payoffData) {
    console.log("=== PayoffDiagram Debug ===");
    console.log("Received payoffData:", payoffData);
    console.log("Net Debit (premium):", payoffData.metrics.premium);
    console.log("Signal:", payoffData.signal);
    console.log("Forward Factor:", payoffData.forwardFactor);
    console.log("Max Profit:", payoffData.metrics.maxProfit);
    console.log("Max Loss:", payoffData.metrics.maxLoss);
    console.log("Number of curves:", payoffData.curves.length);
    
    // Check the shape of the expiration curve
    const expirationCurve = payoffData.curves.find(c => c.isExpiration);
    if (expirationCurve) {
      console.log("Expiration curve found, checking shape...");
      // Sample a few points to see if it's tent-shaped
      const midIndex = Math.floor(expirationCurve.dataPoints.length / 2);
      const quarterIndex = Math.floor(expirationCurve.dataPoints.length / 4);
      const threeQuarterIndex = Math.floor(3 * expirationCurve.dataPoints.length / 4);
      
      console.log("P&L at 25% (left):", expirationCurve.dataPoints[quarterIndex]?.pnl);
      console.log("P&L at 50% (middle/strike):", expirationCurve.dataPoints[midIndex]?.pnl);
      console.log("P&L at 75% (right):", expirationCurve.dataPoints[threeQuarterIndex]?.pnl);
      console.log("Stock prices - 25%:", expirationCurve.dataPoints[quarterIndex]?.stockPrice, 
                  "50%:", expirationCurve.dataPoints[midIndex]?.stockPrice,
                  "75%:", expirationCurve.dataPoints[threeQuarterIndex]?.stockPrice);
      
      // Check if it's tent-shaped (middle should be higher than edges)
      if (expirationCurve.dataPoints[midIndex]?.pnl > expirationCurve.dataPoints[quarterIndex]?.pnl &&
          expirationCurve.dataPoints[midIndex]?.pnl > expirationCurve.dataPoints[threeQuarterIndex]?.pnl) {
        console.log("✓ Curve is tent-shaped (calendar spread)");
      } else {
        console.log("✗ Curve is NOT tent-shaped - appears to be V-shaped (straddle)");
      }
      
      // Find min and max P&L
      const pnlValues = expirationCurve.dataPoints.map(p => p.pnl);
      const minPnl = Math.min(...pnlValues);
      const maxPnl = Math.max(...pnlValues);
      console.log("P&L range - Min:", minPnl, "Max:", maxPnl);
    }
  }
  
  // Prepare chart data by merging all curves - MUST be before any conditional returns
  const chartData = useMemo(() => {
    if (!payoffData) return [];

    const { curves, currentStockPrice } = payoffData;
    
    // Find the curves we need
    const expirationCurve = curves.find(c => c.isExpiration);
    const currentCurve = curves.find(c => c.daysToExpiration === payoffData.frontDTE);
    const selectedIndex = Math.floor(selectedTimePercent * (curves.length - 1) / 100);
    const selectedCurve = curves[selectedIndex];

    if (!expirationCurve) return [];

    // Merge data points
    const mergedData = expirationCurve.dataPoints.map((point, index) => {
      const data: any = {
        stockPrice: point.stockPrice,
        percentMove: point.percentMove,
        expirationPnl: point.pnl,
      };

      if (currentCurve && currentCurve.dataPoints[index]) {
        data.currentPnl = currentCurve.dataPoints[index].pnl;
      }

      if (selectedCurve && selectedCurve.dataPoints[index]) {
        data.selectedPnl = selectedCurve.dataPoints[index].pnl;
      }

      return data;
    });
    
    console.log("Chart data prepared, first 3 points:", mergedData.slice(0, 3));
    console.log("Chart data prepared, middle 3 points:", mergedData.slice(48, 51));
    console.log("Chart data prepared, last 3 points:", mergedData.slice(-3));
    
    return mergedData;
  }, [payoffData, selectedTimePercent]);

  const selectedDays = payoffData ? Math.round(payoffData.frontDTE * (1 - selectedTimePercent / 100)) : 0;
  
  // If no data is provided, return early (AFTER all hooks)
  if (!opportunity || !payoffData) {
    return (
      <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Payoff Diagram</DialogTitle>
            <DialogDescription>
              No data available for payoff visualization
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  // Format currency values
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Format percentage values
  const formatPercent = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
  };

  // Custom tooltip for the chart
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const stockPrice = label;
      const percentMove = payload[0]?.payload?.percentMove || 0;
      
      return (
        <div className="bg-background/95 backdrop-blur-sm border border-card-border rounded-lg p-3">
          <p className="text-sm font-semibold mb-1">
            Stock: {formatCurrency(stockPrice)} ({formatPercent(percentMove)})
          </p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-xs" style={{ color: entry.color }}>
              {entry.name}: {formatCurrency(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-7xl max-h-[95vh] overflow-auto p-0">
        <div className="p-6 space-y-6">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">
              {opportunity.signal === 'BUY' ? 'Reverse Calendar Spread' : 'Calendar Spread'} Payoff Analysis
            </DialogTitle>
            <DialogDescription className="mt-2">
              {opportunity.ticker} • Forward Factor: {formatPercent(payoffData.forwardFactor)} • 
              {opportunity.signal === 'BUY' ? (
                <>Long Front {payoffData.frontDTE}d @ {payoffData.frontIV}% IV • 
                   Short Back {payoffData.backDTE}d @ {payoffData.backIV}% IV</>
              ) : (
                <>Short Front {payoffData.frontDTE}d @ {payoffData.frontIV}% IV • 
                   Long Back {payoffData.backDTE}d @ {payoffData.backIV}% IV</>
              )}
            </DialogDescription>
          </DialogHeader>

          {/* Direction Indicator */}
          <div className="flex items-center gap-3 p-4 rounded-lg bg-slate-900 dark:bg-slate-950 border border-slate-800">
            <span className="text-sm font-medium text-slate-400">Direction:</span>
            <div className={`flex items-center gap-2 text-2xl font-bold ${
              opportunity.signal === 'BUY' 
                ? 'text-green-500' 
                : 'text-red-500'
            }`}>
              {opportunity.signal === 'BUY' ? (
                <TrendingUp className="h-6 w-6" />
              ) : (
                <TrendingDown className="h-6 w-6" />
              )}
              <span>{opportunity.signal}</span>
            </div>
          </div>

          {/* Strategy Analysis Section */}
          <div className="p-6 rounded-lg bg-slate-900 dark:bg-slate-950 border border-slate-800">
            <h3 className="text-lg font-semibold text-slate-200 mb-6">Strategy Analysis</h3>
            
            {/* Row 1: Max Profit, Breakeven, Max Loss */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pb-6 border-b border-slate-800">
              <div className="space-y-1">
                <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Max Profit</div>
                <div className="text-3xl font-bold text-green-500 tabular-nums">
                  {typeof payoffData.metrics.maxProfit === 'string' 
                    ? `$${payoffData.metrics.maxProfit}` 
                    : formatCurrency(Number(payoffData.metrics.maxProfit))}
                </div>
                <div className="text-xs text-slate-500">
                  {opportunity.signal === 'BUY' ? 'When Stock Moves Significantly' : 'At Strike Price'}
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Breakeven</div>
                <div className="space-y-1 mt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-400">Lower:</span>
                    <span className="text-xl font-semibold text-slate-200 tabular-nums">
                      {formatCurrency(payoffData.metrics.lowerBreakeven)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-400">Upper:</span>
                    <span className="text-xl font-semibold text-slate-200 tabular-nums">
                      {formatCurrency(payoffData.metrics.upperBreakeven)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Max Loss</div>
                <div className="text-3xl font-bold text-red-500 tabular-nums">
                  -{formatCurrency(Math.abs(payoffData.metrics.premium))}
                </div>
                <div className="text-xs text-slate-500">
                  {opportunity.signal === 'BUY' ? 'When Stock Stays at Strike' : 'Net Debit Paid'}
                </div>
              </div>
            </div>

            {/* Row 2: Profit Probability, Delta, Theta */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6">
              <div className="space-y-1">
                <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Profit Probability</div>
                <div className={`text-3xl font-bold tabular-nums ${
                  payoffData.metrics.profitProbability >= 60 
                    ? 'text-green-500' 
                    : payoffData.metrics.profitProbability >= 40 
                    ? 'text-amber-500'
                    : 'text-red-500'
                }`}>
                  {payoffData.metrics.profitProbability.toFixed(1)}%
                </div>
                <div className="text-xs text-slate-500">IV-Based Estimate</div>
              </div>

              <div className="space-y-1">
                <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Delta</div>
                <div className={`text-3xl font-bold tabular-nums ${
                  Math.abs(payoffData.metrics.currentDelta) < 0.1 
                    ? 'text-slate-400' 
                    : payoffData.metrics.currentDelta > 0 
                    ? 'text-green-500' 
                    : 'text-red-500'
                }`}>
                  {payoffData.metrics.currentDelta >= 0 ? '+' : ''}{payoffData.metrics.currentDelta.toFixed(3)}
                </div>
                <div className="text-xs text-slate-500">Position Delta</div>
              </div>

              <div className="space-y-1">
                <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Theta</div>
                <div className={`text-3xl font-bold tabular-nums ${
                  payoffData.metrics.currentTheta > 0 
                    ? 'text-green-500' 
                    : 'text-red-500'
                }`}>
                  {payoffData.metrics.currentTheta >= 0 ? '+' : ''}{payoffData.metrics.currentTheta.toFixed(2)}
                </div>
                <div className="text-xs text-slate-500">Time Decay</div>
              </div>
            </div>
          </div>

          {/* Current Price Display */}
          <div className="flex items-center justify-center gap-4 p-4 rounded-lg bg-primary/5 border border-primary/10">
            <DollarSign className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium text-muted-foreground">Current Price:</span>
            <span className="text-2xl font-bold text-primary tabular-nums">
              {formatCurrency(payoffData.currentStockPrice)}
            </span>
          </div>

          {/* Payoff Chart */}
          <Card className="border-card-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">P&L Diagram</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <ComposedChart
                  data={chartData}
                  margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
                >
                  {/* Gradient definitions for profit/loss areas */}
                  <defs>
                    <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.4}/>
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0.05}/>
                    </linearGradient>
                    <linearGradient id="lossGradient" x1="0" y1="1" x2="0" y2="0">
                      <stop offset="0%" stopColor="#ef4444" stopOpacity={0.4}/>
                      <stop offset="100%" stopColor="#ef4444" stopOpacity={0.05}/>
                    </linearGradient>
                    <linearGradient id="profitGradientCurrent" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3}/>
                      <stop offset="100%" stopColor="#6366f1" stopOpacity={0.02}/>
                    </linearGradient>
                    <linearGradient id="lossGradientCurrent" x1="0" y1="1" x2="0" y2="0">
                      <stop offset="0%" stopColor="#dc2626" stopOpacity={0.3}/>
                      <stop offset="100%" stopColor="#dc2626" stopOpacity={0.02}/>
                    </linearGradient>
                    <linearGradient id="profitGradientSelected" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.35}/>
                      <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.03}/>
                    </linearGradient>
                    <linearGradient id="lossGradientSelected" x1="0" y1="1" x2="0" y2="0">
                      <stop offset="0%" stopColor="#dc2626" stopOpacity={0.35}/>
                      <stop offset="100%" stopColor="#dc2626" stopOpacity={0.03}/>
                    </linearGradient>
                  </defs>

                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis
                    dataKey="stockPrice"
                    type="number"
                    domain={['dataMin', 'dataMax']}
                    tickFormatter={(value) => `$${value.toFixed(0)}`}
                    label={{ value: 'Stock Price', position: 'insideBottom', offset: -5 }}
                  />
                  <YAxis
                    tickFormatter={(value) => {
                      const formatted = Math.abs(value) >= 1000 
                        ? `$${(value / 1000).toFixed(1)}k` 
                        : `$${value.toFixed(0)}`;
                      return value < 0 ? formatted : formatted;
                    }}
                    label={{ value: 'Profit / Loss', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  
                  {/* Reference lines */}
                  {/* Bold breakeven line at y=0 */}
                  <ReferenceLine 
                    y={0} 
                    stroke="hsl(var(--foreground))" 
                    strokeWidth={2}
                    opacity={0.4}
                    label={{ value: "Breakeven", position: "left", fill: "hsl(var(--foreground))", fontSize: 12 }}
                  />
                  
                  {/* Current stock price - made more prominent */}
                  <ReferenceLine
                    x={payoffData.currentStockPrice}
                    stroke="hsl(var(--primary))"
                    strokeWidth={2.5}
                    strokeDasharray="none"
                    label={{ 
                      value: `Current: $${payoffData.currentStockPrice.toFixed(2)}`, 
                      position: "top",
                      fill: "hsl(var(--primary))",
                      fontWeight: "bold"
                    }}
                  />
                  
                  {/* Breakeven points */}
                  <ReferenceLine
                    x={payoffData.metrics.upperBreakeven}
                    stroke="#f59e0b"
                    strokeWidth={1.5}
                    strokeDasharray="5 5"
                    opacity={0.7}
                    label={{ value: "Upper BE", position: "top", fontSize: 11 }}
                  />
                  <ReferenceLine
                    x={payoffData.metrics.lowerBreakeven}
                    stroke="#f59e0b"
                    strokeWidth={1.5}
                    strokeDasharray="5 5"
                    opacity={0.7}
                    label={{ value: "Lower BE", position: "top", fontSize: 11 }}
                  />
                  
                  {/* P&L Areas with conditional fills for profit/loss */}
                  {/* Current time curve */}
                  <Area
                    type="linear"
                    dataKey="currentPnl"
                    stroke="#6366f1"
                    strokeWidth={1.5}
                    strokeDasharray="5 5"
                    fill="url(#profitGradientCurrent)"
                    fillOpacity={0.3}
                    name="Current"
                  />
                  
                  {/* Selected time curve */}
                  <Area
                    type="linear"
                    dataKey="selectedPnl"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    fill="url(#profitGradientSelected)"
                    fillOpacity={0.3}
                    name={`${selectedDays}d to Exp`}
                  />
                  
                  {/* Expiration curve - most prominent */}
                  <Area
                    type="linear"
                    dataKey="expirationPnl"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    fill="url(#profitGradient)"
                    fillOpacity={0.3}
                    name="At Expiration"
                  />
                  
                  <Legend 
                    wrapperStyle={{
                      paddingTop: '10px',
                      fontSize: '12px'
                    }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Time Slider */}
          <Card className="border-card-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Time to Expiration
                </span>
                <Badge variant="outline" className="font-mono">
                  {selectedDays} days remaining
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Slider
                value={[selectedTimePercent]}
                onValueChange={(value) => setSelectedTimePercent(value[0])}
                min={0}
                max={100}
                step={1}
                className="w-full"
                data-testid="slider-time-to-expiration"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Today</span>
                <span>25%</span>
                <span>50%</span>
                <span>75%</span>
                <span>Expiration</span>
              </div>
            </CardContent>
          </Card>

          {/* Debug Info Panel - Temporary for debugging */}
          {process.env.NODE_ENV === 'development' && (
            <Card className="border-card-border bg-yellow-50 dark:bg-yellow-950/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  Debug Info (Dev Only)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-xs font-mono">
                  {(() => {
                    const expirationCurve = payoffData.curves.find(c => c.isExpiration);
                    if (!expirationCurve) return <div>No expiration curve found</div>;
                    
                    const midIndex = Math.floor(expirationCurve.dataPoints.length / 2);
                    const quarterIndex = Math.floor(expirationCurve.dataPoints.length / 4);
                    const threeQuarterIndex = Math.floor(3 * expirationCurve.dataPoints.length / 4);
                    
                    const leftPnl = expirationCurve.dataPoints[quarterIndex]?.pnl || 0;
                    const midPnl = expirationCurve.dataPoints[midIndex]?.pnl || 0;
                    const rightPnl = expirationCurve.dataPoints[threeQuarterIndex]?.pnl || 0;
                    
                    const isTentShaped = midPnl > leftPnl && midPnl > rightPnl;
                    
                    return (
                      <>
                        <div className="flex justify-between">
                          <span>Net Debit:</span>
                          <span className={payoffData.metrics.premium < 0 ? 'text-green-600' : 'text-red-600'}>
                            {formatCurrency(payoffData.metrics.premium)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>P&L @ 25%:</span>
                          <span>{formatCurrency(leftPnl)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>P&L @ Strike:</span>
                          <span className="font-bold text-green-600">{formatCurrency(midPnl)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>P&L @ 75%:</span>
                          <span>{formatCurrency(rightPnl)}</span>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t">
                          <span>Curve Shape:</span>
                          <span className={isTentShaped ? 'text-green-600' : 'text-red-600'}>
                            {isTentShaped ? '✓ TENT (Calendar)' : '✗ V-SHAPE (Straddle)'}
                          </span>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Strategy Notes */}
          <Card className="border-card-border bg-muted/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Info className="h-4 w-4" />
                Strategy Notes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-xs text-muted-foreground">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-3 w-3 mt-0.5 text-yellow-500" />
                  <span>
                    This calendar spread profits from the stock staying near the strike price. 
                    Maximum profit occurs at front expiration when the stock is at the strike. 
                    Assignment risk exists if front month expires in-the-money.
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <TrendingUp className="h-3 w-3 mt-0.5 text-green-500" />
                  <span>
                    With a Forward Factor of {formatPercent(payoffData.forwardFactor)}, 
                    we're {opportunity.signal === 'SELL' ? 'selling the expensive front month and buying the cheaper back month' : 'capitalizing on volatility term structure'}.
                    Max profit: {typeof payoffData.metrics.maxProfit === 'string' ? `$${payoffData.metrics.maxProfit}` : formatCurrency(Number(payoffData.metrics.maxProfit))}.
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <Clock className="h-3 w-3 mt-0.5 text-blue-500" />
                  <span>
                    Time decay works in our favor as the front month decays faster than the back month. 
                    Monitor closely as front expiration approaches - consider rolling or closing before assignment risk.
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}