import { type Opportunity } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronRight, AlertTriangle, Calendar, Building, LineChart } from "lucide-react";
import { 
  Collapsible, 
  CollapsibleContent, 
  CollapsibleTrigger 
} from "@/components/ui/collapsible";
import { useState } from "react";
import { PayoffDiagram } from "@/components/PayoffDiagram";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface MobileResultCardProps {
  opportunity: Opportunity;
}

export function MobileResultCard({ opportunity }: MobileResultCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [payoffDialogOpen, setPayoffDialogOpen] = useState(false);
  const [payoffData, setPayoffData] = useState<any>(null);
  const [loadingPayoff, setLoadingPayoff] = useState(false);
  const { toast } = useToast();
  
  const minLiquidity = Math.min(opportunity.straddle_oi || 0, opportunity.back_straddle_oi || 0);
  
  const handleViewPayoff = async () => {
    setLoadingPayoff(true);
    setPayoffDialogOpen(true);
    
    try {
      const response = await apiRequest("POST", "/api/payoff-analysis", {
        opportunity: opportunity
      });
      
      const data = await response.json();
      setPayoffData(data);
    } catch (error) {
      toast({
        title: "Failed to load payoff analysis",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
      setPayoffDialogOpen(false);
    } finally {
      setLoadingPayoff(false);
    }
  };
  
  const getLiquidityColor = (oi: number | undefined) => {
    if (!oi) return 'text-muted-foreground';
    if (oi >= 250) return 'text-green-600 dark:text-green-400';
    if (oi >= 100) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getSignalBadgeVariant = (signal: string) => {
    if (signal === 'BUY') return 'default';
    if (signal === 'SELL') return 'secondary';
    return 'outline';
  };

  const getIVRBadgeVariant = (ivr: number | undefined): string => {
    if (ivr === undefined || ivr === null) return 'outline';
    if (ivr > 70) return 'destructive'; // Red for high IVR
    if (ivr >= 30) return 'secondary'; // Yellow/normal for normal IVR
    return 'default'; // Green for low IVR
  };

  const getIVRLabel = (ivr: number | undefined): string => {
    if (ivr === undefined || ivr === null) return '—';
    return `${Math.round(ivr)}%`;
  };

  const getRiskRewardLabel = (riskReward: number | undefined): string => {
    if (riskReward === undefined || riskReward === null) return '—';
    return `${riskReward.toFixed(1)}:1`;
  };

  return (
    <Card className="border-card-border">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="w-full" data-testid={`card-opportunity-${opportunity.ticker}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-start gap-3 flex-1">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-semibold text-lg">{opportunity.ticker}</span>
                    <Badge variant={getSignalBadgeVariant(opportunity.signal)} className="text-xs">
                      {opportunity.signal}
                    </Badge>
                    {opportunity.has_earnings_soon && (
                      <Badge variant="destructive" className="text-xs">
                        Earnings
                      </Badge>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    <div>
                      <span className="text-muted-foreground">FF%: </span>
                      <span className="font-mono font-medium">
                        {opportunity.forward_factor > 0 ? '+' : ''}{opportunity.forward_factor.toFixed(1)}%
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">R/R: </span>
                      <span className="font-mono font-semibold text-primary">
                        {getRiskRewardLabel(opportunity.risk_reward)}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Front: </span>
                      <span className="text-xs">{opportunity.front_dte}d</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Back: </span>
                      <span className="text-xs">{opportunity.back_dte}d</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">IVR:</span>
                      <Badge 
                        variant={getIVRBadgeVariant(opportunity.front_ivr) as any}
                        className="text-xs px-1 py-0"
                      >
                        F: {getIVRLabel(opportunity.front_ivr)}
                      </Badge>
                      <Badge 
                        variant={getIVRBadgeVariant(opportunity.back_ivr) as any}
                        className="text-xs px-1 py-0"
                      >
                        B: {getIVRLabel(opportunity.back_ivr)}
                      </Badge>
                    </div>
                    <div className="text-xs">
                      <span className="text-muted-foreground">Pos: </span>
                      <span className="font-mono">
                        {opportunity.position_size_recommendation || '—'}
                      </span>
                    </div>
                  </div>

                  {/* Financial Events */}
                  {(opportunity.earnings_date || (opportunity.fed_events && opportunity.fed_events.length > 0)) && (
                    <div className="flex items-center gap-2 mt-2">
                      {opportunity.earnings_date && (
                        <div className="flex items-center gap-1">
                          <Calendar className={`h-3 w-3 ${
                            opportunity.event_warnings?.some(w => w.includes('EARNINGS') && w.includes('HIGH RISK'))
                              ? 'text-red-500'
                              : 'text-yellow-500'
                          }`} />
                          <span className="text-xs">Earnings</span>
                        </div>
                      )}
                      {opportunity.fed_events && opportunity.fed_events.length > 0 && (
                        <div className="flex items-center gap-1">
                          <Building className={`h-3 w-3 ${
                            opportunity.event_warnings?.some(w => w.includes('Fed meeting') && w.includes('between'))
                              ? 'text-red-500'
                              : 'text-blue-500'
                          }`} />
                          <span className="text-xs">Fed Meeting</span>
                        </div>
                      )}
                    </div>
                  )}

                  {opportunity.event_warnings && opportunity.event_warnings.length > 0 && (
                    <div className="flex items-start gap-1 mt-2">
                      <AlertTriangle className="h-3 w-3 text-yellow-500 mt-0.5" />
                      <p className="text-xs text-yellow-600 dark:text-yellow-400">
                        {opportunity.event_warnings[0]}
                      </p>
                    </div>
                  )}
                </div>
              </div>
              
              <ChevronRight className={`h-5 w-5 text-muted-foreground transition-transform ${isOpen ? 'rotate-90' : ''}`} />
            </div>
          </CardContent>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <div className="px-4 pb-4 pt-0 border-t border-card-border">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-3 text-sm">
              <div>
                <p className="text-muted-foreground text-xs mb-1">Front Month</p>
                <div className="space-y-1">
                  <div>
                    <span className="text-muted-foreground">Date: </span>
                    <span>{opportunity.front_date}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">IV: </span>
                    <span className="font-mono">{opportunity.front_iv.toFixed(1)}%</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">IVR: </span>
                    <Badge 
                      variant={getIVRBadgeVariant(opportunity.front_ivr) as any}
                      className="text-xs px-1 py-0"
                    >
                      {getIVRLabel(opportunity.front_ivr)}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-muted-foreground">OI: </span>
                    <span className={`font-mono ${getLiquidityColor(opportunity.straddle_oi)}`}>
                      {opportunity.straddle_oi || '—'}
                    </span>
                  </div>
                </div>
              </div>
              
              <div>
                <p className="text-muted-foreground text-xs mb-1">Back Month</p>
                <div className="space-y-1">
                  <div>
                    <span className="text-muted-foreground">Date: </span>
                    <span>{opportunity.back_date}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">IV: </span>
                    <span className="font-mono">{opportunity.back_iv.toFixed(1)}%</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">IVR: </span>
                    <Badge 
                      variant={getIVRBadgeVariant(opportunity.back_ivr) as any}
                      className="text-xs px-1 py-0"
                    >
                      {getIVRLabel(opportunity.back_ivr)}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-muted-foreground">OI: </span>
                    <span className={`font-mono ${getLiquidityColor(opportunity.back_straddle_oi)}`}>
                      {opportunity.back_straddle_oi || '—'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {opportunity.forward_vol && (
              <div className="mt-3 p-2 bg-muted/50 rounded-md">
                <div className="text-xs text-muted-foreground mb-1">Implied Move</div>
                <div className="font-mono text-sm">{opportunity.forward_vol}%</div>
              </div>
            )}

            {/* Detailed Financial Events */}
            {(opportunity.earnings_date || (opportunity.fed_events && opportunity.fed_events.length > 0)) && (
              <div className="mt-3 p-2 bg-muted/50 rounded-md">
                <div className="text-xs text-muted-foreground mb-2">Financial Events</div>
                {opportunity.earnings_date && (
                  <div className="flex items-start gap-2 mb-2">
                    <Calendar className="h-3 w-3 text-yellow-500 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs font-medium">Earnings Date</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(opportunity.earnings_date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </p>
                    </div>
                  </div>
                )}
                {opportunity.fed_events && opportunity.fed_events.length > 0 && (
                  <div className="flex items-start gap-2">
                    <Building className="h-3 w-3 text-blue-500 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs font-medium">Fed Meetings</p>
                      {opportunity.fed_events.map((event, idx) => (
                        <p key={idx} className="text-xs text-muted-foreground">{event}</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {opportunity.event_warnings && opportunity.event_warnings.length > 0 && (
              <div className="mt-3">
                <p className="text-xs text-muted-foreground mb-1">All Warnings:</p>
                <ul className="list-disc list-inside">
                  {opportunity.execution_warnings && opportunity.execution_warnings.map((warning, idx) => (
                    <li key={idx} className="text-xs text-yellow-600 dark:text-yellow-400">{warning}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* View Payoff Button */}
            <div className="mt-4 pt-3 border-t border-card-border">
              <Button
                variant="default"
                size="sm"
                className="w-full"
                onClick={handleViewPayoff}
                disabled={loadingPayoff}
                data-testid={`button-view-payoff-mobile-${opportunity.ticker}`}
              >
                <LineChart className="h-4 w-4 mr-2" />
                View Payoff Diagram
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
      
      {/* Payoff Diagram Modal */}
      <PayoffDiagram 
        open={payoffDialogOpen}
        onClose={() => {
          setPayoffDialogOpen(false);
          setPayoffData(null);
        }}
        opportunity={opportunity}
        payoffData={payoffData}
      />
    </Card>
  );
}