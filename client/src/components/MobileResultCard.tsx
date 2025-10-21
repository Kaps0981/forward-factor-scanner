import { type Opportunity } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, AlertTriangle } from "lucide-react";
import { 
  Collapsible, 
  CollapsibleContent, 
  CollapsibleTrigger 
} from "@/components/ui/collapsible";
import { useState } from "react";

interface MobileResultCardProps {
  opportunity: Opportunity;
}

export function MobileResultCard({ opportunity }: MobileResultCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  const minLiquidity = Math.min(opportunity.straddle_oi || 0, opportunity.back_straddle_oi || 0);
  
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
                      <span className="text-muted-foreground">Position: </span>
                      <span className="font-mono">
                        {opportunity.position_size_recommendation || '—'}
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

                  {opportunity.execution_warnings && opportunity.execution_warnings.length > 0 && (
                    <div className="flex items-start gap-1 mt-2">
                      <AlertTriangle className="h-3 w-3 text-yellow-500 mt-0.5" />
                      <p className="text-xs text-yellow-600 dark:text-yellow-400">
                        {opportunity.execution_warnings[0]}
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

            {opportunity.execution_warnings && opportunity.execution_warnings.length > 1 && (
              <div className="mt-3">
                <p className="text-xs text-muted-foreground mb-1">All Warnings:</p>
                <ul className="list-disc list-inside">
                  {opportunity.execution_warnings.map((warning, idx) => (
                    <li key={idx} className="text-xs text-yellow-600 dark:text-yellow-400">{warning}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}