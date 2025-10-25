import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { type Opportunity } from "@shared/schema";
import { 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  Activity, 
  AlertTriangle, 
  Info,
  DollarSign,
  Target,
  BarChart3,
  Shield,
  Clock,
  BookOpen,
  Calculator,
  ChevronRight
} from "lucide-react";
import { useState } from "react";

interface OpportunityDetailsModalProps {
  opportunity: Opportunity | null;
  open: boolean;
  onClose: () => void;
  onAddToPaper?: (opportunity: Opportunity) => void;
}

export function OpportunityDetailsModal({ 
  opportunity, 
  open, 
  onClose,
  onAddToPaper 
}: OpportunityDetailsModalProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  
  if (!opportunity) return null;
  
  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };
  
  const signalColor = opportunity.signal === 'BUY' ? 'text-green-600' : 'text-red-600';
  const absFF = Math.abs(opportunity.forward_factor);
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] p-0">
        <DialogHeader className="px-6 pt-6">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl font-bold flex items-center gap-3">
              {opportunity.ticker}
              <Badge 
                className={opportunity.signal === 'BUY' ? 'bg-green-500' : 'bg-red-500'}
              >
                {opportunity.signal}
              </Badge>
              {opportunity.quality_score && opportunity.quality_score >= 7 && (
                <Badge variant="outline" className="border-yellow-500 text-yellow-600">
                  High Quality
                </Badge>
              )}
            </DialogTitle>
            {onAddToPaper && (
              <Button onClick={() => onAddToPaper(opportunity)}>
                Add to Paper Trade
              </Button>
            )}
          </div>
        </DialogHeader>
        
        <ScrollArea className="h-[calc(85vh-6rem)]">
          <div className="px-6 pb-6">
            {/* Quick Stats Bar */}
            <div className="grid grid-cols-4 gap-3 mt-4 mb-6">
              <QuickStat
                icon={<Target className="h-4 w-4" />}
                label="Forward Factor"
                value={`${opportunity.forward_factor.toFixed(1)}%`}
                className={signalColor}
              />
              <QuickStat
                icon={<Activity className="h-4 w-4" />}
                label="Probability"
                value={`${opportunity.probability || 70}%`}
              />
              <QuickStat
                icon={<BarChart3 className="h-4 w-4" />}
                label="Risk/Reward"
                value={`${opportunity.risk_reward || '3.0'}:1`}
              />
              <QuickStat
                icon={<Shield className="h-4 w-4" />}
                label="Quality Score"
                value={`${opportunity.quality_score || 0}/10`}
              />
            </div>
            
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="technicals">Technicals</TabsTrigger>
                <TabsTrigger value="liquidity">Liquidity</TabsTrigger>
                <TabsTrigger value="execution">Execution</TabsTrigger>
              </TabsList>
              
              <TabsContent value="overview" className="space-y-4 mt-4">
                {/* Trading Thesis */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <BookOpen className="h-4 w-4" />
                      Trading Thesis
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {generateThesis(opportunity)}
                    </p>
                  </CardContent>
                </Card>
                
                {/* Key Metrics */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Calculator className="h-4 w-4" />
                      Key Metrics
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <MetricRow label="Front Expiration" value={`${opportunity.front_date} (${opportunity.front_dte}d)`} />
                      <MetricRow label="Back Expiration" value={`${opportunity.back_date} (${opportunity.back_dte}d)`} />
                      <MetricRow label="Front IV" value={`${opportunity.front_iv.toFixed(1)}%`} />
                      <MetricRow label="Back IV" value={`${opportunity.back_iv.toFixed(1)}%`} />
                      <MetricRow label="Forward Vol" value={`${opportunity.forward_vol.toFixed(1)}%`} />
                      <MetricRow label="IV Rank" value={`${opportunity.front_ivr || 50}%`} />
                    </div>
                  </CardContent>
                </Card>
                
                {/* Warnings */}
                {opportunity.execution_warnings && opportunity.execution_warnings.length > 0 && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Execution Warnings</AlertTitle>
                    <AlertDescription>
                      <ul className="list-disc pl-4 mt-2 space-y-1">
                        {opportunity.execution_warnings.map((warning, i) => (
                          <li key={i} className="text-xs">{warning}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}
              </TabsContent>
              
              <TabsContent value="technicals" className="space-y-4 mt-4">
                {/* Greeks */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Option Greeks</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <MetricRow label="Delta" value={opportunity.delta?.toFixed(3) || 'N/A'} />
                      <MetricRow label="Gamma" value={opportunity.gamma?.toFixed(5) || 'N/A'} />
                      <MetricRow label="Theta" value={opportunity.theta?.toFixed(3) || 'N/A'} />
                      <MetricRow label="Vega" value={opportunity.vega?.toFixed(3) || 'N/A'} />
                      <MetricRow label="Rho" value={opportunity.rho?.toFixed(3) || 'N/A'} />
                    </div>
                  </CardContent>
                </Card>
                
                {/* Price Information */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Price Information</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <MetricRow label="Stock Price" value={`$${opportunity.stock_price?.toFixed(2) || 'N/A'}`} />
                      <MetricRow label="Estimated Cost" value={`$${opportunity.estimated_cost?.toFixed(0) || 'N/A'}`} />
                      <MetricRow label="Dividend Yield" value={`${opportunity.dividend_yield?.toFixed(2) || 0}%`} />
                      <MetricRow label="Market Cap" value={opportunity.market_cap || 'N/A'} />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="liquidity" className="space-y-4 mt-4">
                {/* Liquidity Analysis */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Liquidity Analysis</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <MetricRow label="Front Straddle OI" value={opportunity.straddle_oi?.toLocaleString() || 'N/A'} />
                      <MetricRow label="Back Straddle OI" value={opportunity.back_straddle_oi?.toLocaleString() || 'N/A'} />
                      <MetricRow label="ATM Call OI" value={opportunity.atm_call_oi?.toLocaleString() || 'N/A'} />
                      <MetricRow label="ATM Put OI" value={opportunity.atm_put_oi?.toLocaleString() || 'N/A'} />
                      <MetricRow label="Put/Call Ratio" value={opportunity.oi_put_call_ratio?.toFixed(2) || 'N/A'} />
                      <MetricRow label="Volume" value={opportunity.volume?.toLocaleString() || 'N/A'} />
                    </div>
                    
                    {/* Liquidity Score */}
                    <div className="flex items-center gap-3 p-3 bg-muted rounded-md">
                      <div className="text-2xl font-bold">
                        {opportunity.liquidity_score || opportunity.liquidity_score_enhanced || 0}
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium">Liquidity Score</div>
                        <div className="text-xs text-muted-foreground">
                          {getLiquidityRating(opportunity.liquidity_score || 0)}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="execution" className="space-y-4 mt-4">
                {/* Execution Strategy */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Execution Strategy</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2">
                      <div className="font-medium text-sm">Position Size</div>
                      <div className="text-2xl font-bold">
                        {opportunity.position_size_recommendation || calculatePositionSize(opportunity)} contracts
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Based on liquidity and risk management rules
                      </p>
                    </div>
                    
                    <Separator />
                    
                    <div className="space-y-2">
                      <div className="font-medium text-sm">Order Type</div>
                      <Badge variant="outline">{getRecommendedOrderType(opportunity)}</Badge>
                      <p className="text-xs text-muted-foreground">
                        {getOrderTypeReason(opportunity)}
                      </p>
                    </div>
                    
                    <Separator />
                    
                    <div className="space-y-2">
                      <div className="font-medium text-sm">Expected Slippage</div>
                      <div className="text-lg font-semibold">
                        {estimateSlippage(opportunity)}%
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                {/* Event Calendar */}
                {(opportunity.earnings_date || opportunity.fed_events?.length) && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Upcoming Events
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {opportunity.earnings_date && (
                        <div className="flex items-center gap-2 text-sm">
                          <Badge variant="outline">Earnings</Badge>
                          <span>{opportunity.earnings_date}</span>
                          {opportunity.days_to_earnings && (
                            <span className="text-muted-foreground">
                              ({opportunity.days_to_earnings} days)
                            </span>
                          )}
                        </div>
                      )}
                      {opportunity.fed_events?.map((event, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <Badge variant="outline">Fed Event</Badge>
                          <span>{event}</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function QuickStat({ icon, label, value, className = "" }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className="flex flex-col items-center p-3 bg-muted/50 rounded-md">
      <div className="text-muted-foreground mb-1">{icon}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold ${className}`}>{value}</div>
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

function generateThesis(opp: Opportunity): string {
  const absFF = Math.abs(opp.forward_factor);
  const frontIVR = opp.front_ivr || 50;
  
  if (opp.forward_factor > 0) {
    return `Front-month volatility at ${opp.front_iv.toFixed(1)}% is trading ${absFF.toFixed(1)}% above the forward volatility of ${opp.forward_vol.toFixed(1)}%. This suggests the market is overpricing near-term risk. With an IV rank of ${frontIVR}%, consider selling front-month premium or establishing calendar spreads to capture this volatility premium decay.`;
  } else {
    return `Front-month volatility at ${opp.front_iv.toFixed(1)}% is trading ${absFF.toFixed(1)}% below the forward volatility of ${opp.forward_vol.toFixed(1)}%. This suggests the market is underpricing near-term risk. With an IV rank of ${frontIVR}%, consider buying front-month volatility to capture potential expansion.`;
  }
}

function getLiquidityRating(score: number): string {
  if (score >= 8) return "Excellent liquidity - tight spreads expected";
  if (score >= 6) return "Good liquidity - reasonable fills available";
  if (score >= 4) return "Fair liquidity - use limit orders";
  if (score >= 2) return "Poor liquidity - expect wide spreads";
  return "Very poor liquidity - trade with extreme caution";
}

function calculatePositionSize(opp: Opportunity): number {
  const minOI = Math.min(opp.straddle_oi || 0, opp.back_straddle_oi || 0);
  if (minOI === 0) return 0;
  
  let percentage = 0.05;
  if (minOI >= 1000) percentage = 0.10;
  else if (minOI >= 500) percentage = 0.075;
  else if (minOI >= 250) percentage = 0.06;
  
  const positionSize = Math.floor(minOI * percentage);
  
  if (minOI < 100) return Math.min(positionSize, 5);
  if (minOI < 250) return Math.min(positionSize, 10);
  if (minOI < 500) return Math.min(positionSize, 25);
  if (minOI < 1000) return Math.min(positionSize, 50);
  
  return positionSize;
}

function getRecommendedOrderType(opp: Opportunity): string {
  const liquidityScore = opp.liquidity_score || 0;
  if (liquidityScore >= 7) return "MARKET OR LIMIT";
  if (liquidityScore >= 4) return "LIMIT";
  return "LIMIT ONLY";
}

function getOrderTypeReason(opp: Opportunity): string {
  const liquidityScore = opp.liquidity_score || 0;
  if (liquidityScore >= 7) return "High liquidity allows market orders for quick fills";
  if (liquidityScore >= 4) return "Moderate liquidity requires careful limit order placement";
  return "Low liquidity - avoid market orders to prevent excessive slippage";
}

function estimateSlippage(opp: Opportunity): number {
  const minOI = Math.min(opp.straddle_oi || 0, opp.back_straddle_oi || 0);
  if (minOI >= 1000) return 2;
  if (minOI >= 500) return 5;
  if (minOI >= 250) return 10;
  if (minOI >= 100) return 15;
  if (minOI >= 50) return 20;
  return 30;
}