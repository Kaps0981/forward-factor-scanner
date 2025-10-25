import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Opportunity } from "@shared/schema";
import { TrendingUp, TrendingDown, DollarSign, Activity, Clock, AlertTriangle } from "lucide-react";

interface OpportunityCardProps {
  opportunity: Opportunity;
  onViewDetails: () => void;
  onAddToPaper: () => void;
}

export function OpportunityCard({ opportunity, onViewDetails, onAddToPaper }: OpportunityCardProps) {
  const isHighQuality = (opportunity.quality_score || 0) >= 70;
  const isGoodLiquidity = (opportunity.liquidity_score_enhanced || opportunity.liquidity_score || 0) >= 60;
  
  return (
    <Card 
      className="hover-elevate cursor-pointer transition-all duration-200"
      onClick={onViewDetails}
      data-testid={`card-opportunity-${opportunity.ticker}`}
    >
      {/* HERO SECTION - Primary information */}
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-xl font-bold">{opportunity.ticker}</h3>
              <SignalBadge
                type={opportunity.signal}
                value={opportunity.forward_factor}
                size="large"
              />
            </div>
            
            {/* Quality and Risk/Reward */}
            <div className="flex items-center gap-4 text-sm">
              <QualityIndicator score={opportunity.quality_score || 50} />
              {opportunity.risk_reward && (
                <div className="flex items-center gap-1">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{opportunity.risk_reward.toFixed(1)}:1</span>
                </div>
              )}
            </div>
          </div>
          
          {/* Probability Badge */}
          {opportunity.probability && (
            <div className="text-right">
              <div className="text-xs text-muted-foreground mb-1">Win Rate</div>
              <div className={`text-lg font-bold ${
                opportunity.probability >= 60 ? 'text-green-600 dark:text-green-400' : 
                opportunity.probability >= 50 ? 'text-yellow-600 dark:text-yellow-400' : 
                'text-red-600 dark:text-red-400'
              }`}>
                {opportunity.probability}%
              </div>
            </div>
          )}
        </div>
      </CardHeader>

      {/* METRICS ROW - Key trading metrics */}
      <CardContent className="space-y-3">
        {/* Dates and DTE */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <MetricCard
            icon={<Clock className="h-3.5 w-3.5" />}
            label="Front"
            value={`${opportunity.front_dte}d`}
            subValue={`IV: ${opportunity.front_iv.toFixed(1)}%`}
          />
          <MetricCard
            icon={<Clock className="h-3.5 w-3.5" />}
            label="Back"
            value={`${opportunity.back_dte}d`}
            subValue={`IV: ${opportunity.back_iv.toFixed(1)}%`}
          />
        </div>

        {/* Liquidity and Position Size */}
        <div className="flex items-center justify-between">
          <LiquidityBadge 
            score={opportunity.liquidity_score_enhanced || opportunity.liquidity_score || 0}
            rating={opportunity.liquidity_rating}
          />
          {opportunity.position_size_recommendation && (
            <div className="text-xs text-muted-foreground">
              Size: {opportunity.position_size_recommendation}
            </div>
          )}
        </div>

        {/* Warnings */}
        {opportunity.execution_warnings && opportunity.execution_warnings.length > 0 && (
          <div className="flex items-start gap-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-md">
            <AlertTriangle className="h-3.5 w-3.5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
            <div className="text-xs text-yellow-700 dark:text-yellow-300">
              {opportunity.execution_warnings[0]}
            </div>
          </div>
        )}

        {/* ACTION BAR */}
        <div className="flex gap-2 pt-2">
          <Button 
            variant="default" 
            size="sm" 
            className="flex-1"
            onClick={(e) => {
              e.stopPropagation();
              onViewDetails();
            }}
            data-testid={`button-view-${opportunity.ticker}`}
          >
            View Details
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onAddToPaper();
            }}
            data-testid={`button-paper-${opportunity.ticker}`}
          >
            Paper Trade
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SignalBadge({ type, value, size = "default" }: {
  type: 'BUY' | 'SELL';
  value: number;
  size?: "default" | "large";
}) {
  const isLarge = size === "large";
  const isBuy = type === 'BUY';
  
  return (
    <Badge 
      variant={isBuy ? "default" : "secondary"}
      className={`${isLarge ? 'text-sm px-3 py-1' : 'text-xs'} ${
        isBuy 
          ? 'bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600' 
          : 'bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600'
      } text-white`}
    >
      <span className="font-semibold">
        {type} {Math.abs(value).toFixed(1)}%
      </span>
    </Badge>
  );
}

function QualityIndicator({ score }: { score: number }) {
  const getColor = () => {
    if (score >= 80) return 'text-green-600 dark:text-green-400';
    if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-gray-500 dark:text-gray-400';
  };
  
  return (
    <div className={`flex items-center gap-1 ${getColor()}`}>
      <Activity className="h-4 w-4" />
      <span className="font-medium">Q{Math.round(score / 10)}/10</span>
    </div>
  );
}

function LiquidityBadge({ score, rating }: { score: number; rating?: string }) {
  const getVariant = () => {
    if (score >= 70 || rating === 'VERY_HIGH') return 'default';
    if (score >= 50 || rating === 'HIGH') return 'secondary';
    if (score >= 30 || rating === 'MEDIUM') return 'outline';
    return 'destructive';
  };
  
  const getLabel = () => {
    if (rating) return rating.replace('_', ' ');
    if (score >= 70) return 'High Liquidity';
    if (score >= 50) return 'Good Liquidity';
    if (score >= 30) return 'Fair Liquidity';
    return 'Low Liquidity';
  };
  
  return (
    <Badge variant={getVariant()} className="text-xs">
      {getLabel()}
    </Badge>
  );
}

function MetricCard({ icon, label, value, subValue }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subValue?: string;
}) {
  return (
    <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
      <div className="text-muted-foreground">{icon}</div>
      <div className="flex-1">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="font-medium">{value}</div>
        {subValue && <div className="text-xs text-muted-foreground">{subValue}</div>}
      </div>
    </div>
  );
}