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
    return expirationCurve.dataPoints.map((point, index) => {
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
      <DialogContent className="max-w-6xl max-h-[95vh] overflow-auto p-0">
        <div className="p-6 space-y-6">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-2xl font-bold flex items-center gap-3">
                  {opportunity.ticker} Straddle Payoff Analysis
                  <Badge variant={opportunity.signal === 'BUY' ? 'default' : 'secondary'}>
                    {opportunity.signal}
                  </Badge>
                </DialogTitle>
                <DialogDescription className="mt-2">
                  Forward Factor: {formatPercent(payoffData.forwardFactor)} • 
                  Front: {payoffData.frontDTE}d @ {payoffData.frontIV}% IV • 
                  Back: {payoffData.backDTE}d @ {payoffData.backIV}% IV
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Key Metrics Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="border-card-border">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <DollarSign className="h-3 w-3" />
                  PREMIUM PAID
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="text-xl font-bold text-red-500 dark:text-red-400">
                  {formatCurrency(payoffData.metrics.premium)}
                </div>
                <p className="text-xs text-muted-foreground">Max Loss</p>
              </CardContent>
            </Card>

            <Card className="border-card-border">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Target className="h-3 w-3" />
                  BREAKEVENS
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="text-sm font-mono">
                  <div>{formatCurrency(payoffData.metrics.upperBreakeven)}</div>
                  <div>{formatCurrency(payoffData.metrics.lowerBreakeven)}</div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-card-border">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  PROFIT PROB
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="text-xl font-bold text-green-600 dark:text-green-400">
                  {payoffData.metrics.profitProbability.toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground">Based on IV</p>
              </CardContent>
            </Card>

            <Card className="border-card-border">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Activity className="h-3 w-3" />
                  GREEKS
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-0.5">
                <div className="flex justify-between text-xs">
                  <span>Δ</span>
                  <span className="font-mono">{payoffData.metrics.currentDelta.toFixed(3)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span>Θ</span>
                  <span className="font-mono text-green-600 dark:text-green-400">
                    {payoffData.metrics.currentTheta.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span>Γ</span>
                  <span className="font-mono">{payoffData.metrics.currentGamma.toFixed(4)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span>ν</span>
                  <span className="font-mono">{payoffData.metrics.currentVega.toFixed(2)}</span>
                </div>
              </CardContent>
            </Card>
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
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis
                    dataKey="stockPrice"
                    type="number"
                    domain={['dataMin', 'dataMax']}
                    tickFormatter={(value) => `$${value.toFixed(0)}`}
                    label={{ value: 'Stock Price', position: 'insideBottom', offset: -5 }}
                  />
                  <YAxis
                    tickFormatter={(value) => `$${value.toFixed(0)}`}
                    label={{ value: 'Profit / Loss', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  
                  {/* Reference lines */}
                  <ReferenceLine 
                    y={0} 
                    stroke="hsl(var(--muted-foreground))" 
                    strokeDasharray="3 3"
                  />
                  <ReferenceLine
                    x={payoffData.currentStockPrice}
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    label={{ value: "Current", position: "top" }}
                  />
                  <ReferenceLine
                    x={payoffData.metrics.upperBreakeven}
                    stroke="hsl(var(--yellow-500))"
                    strokeDasharray="5 5"
                    label={{ value: "BE", position: "top" }}
                  />
                  <ReferenceLine
                    x={payoffData.metrics.lowerBreakeven}
                    stroke="hsl(var(--yellow-500))"
                    strokeDasharray="5 5"
                    label={{ value: "BE", position: "top" }}
                  />
                  
                  {/* P&L Lines */}
                  <Line
                    type="monotone"
                    dataKey="expirationPnl"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={false}
                    name="At Expiration"
                  />
                  <Line
                    type="monotone"
                    dataKey="currentPnl"
                    stroke="#6366f1"
                    strokeWidth={1}
                    strokeDasharray="5 5"
                    dot={false}
                    name="Current"
                  />
                  <Line
                    type="monotone"
                    dataKey="selectedPnl"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    dot={false}
                    name={`${selectedDays}d to Exp`}
                  />
                  
                  <Legend />
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
                    This straddle strategy profits from large moves in either direction. 
                    The position needs the stock to move beyond the breakeven points to be profitable.
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <TrendingUp className="h-3 w-3 mt-0.5 text-green-500" />
                  <span>
                    With a Forward Factor of {formatPercent(payoffData.forwardFactor)}, 
                    the implied volatility differential suggests {opportunity.signal === 'BUY' ? 'buying' : 'selling'} pressure.
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <Clock className="h-3 w-3 mt-0.5 text-blue-500" />
                  <span>
                    Theta decay accelerates as expiration approaches. Consider closing the position 
                    when you've captured 25-50% of maximum profit.
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