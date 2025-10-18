import { Card, CardContent } from "@/components/ui/card";
import { Search, TrendingUp, Database, AlertTriangle, Target } from "lucide-react";
import { type Opportunity } from "@shared/schema";

interface SummaryCardsProps {
  tickersScanned: number;
  opportunitiesFound: number;
  opportunities: Opportunity[];
  isScanning: boolean;
}

export function SummaryCards({ tickersScanned, opportunitiesFound, opportunities, isScanning }: SummaryCardsProps) {
  const avgFFMagnitude = opportunities.length > 0
    ? Math.round(opportunities.reduce((sum, opp) => sum + Math.abs(opp.forward_factor), 0) / opportunities.length)
    : 0;

  // Count opportunities where back month has less liquidity than front month
  const liquidityWarnings = opportunities.filter(opp => {
    const frontOI = opp.straddle_oi || 0;
    const backOI = opp.back_straddle_oi || 0;
    return backOI < frontOI && backOI > 0;
  }).length;

  // Calculate average position size from recommendations
  const positionSizeOpps = opportunities.filter(opp => opp.position_size_recommendation);
  const avgPositionSize = positionSizeOpps.length > 0
    ? positionSizeOpps.reduce((sum, opp) => sum + (opp.position_size_recommendation || 0), 0) / positionSizeOpps.length
    : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      <Card className="border-card-border">
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-primary/10">
              <Search className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Tickers Scanned</p>
              <p className="text-3xl font-bold tabular-nums" data-testid="text-tickers-scanned">
                {isScanning ? "..." : tickersScanned}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-card-border">
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-chart-1/10">
              <TrendingUp className="h-5 w-5 text-chart-1" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Opportunities</p>
              <p className="text-3xl font-bold tabular-nums" data-testid="text-opportunities-found">
                {isScanning ? "..." : opportunitiesFound}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-card-border">
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-chart-2/10">
              <Database className="h-5 w-5 text-chart-2" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Avg |FF| Signal</p>
              <p className="text-3xl font-bold tabular-nums" data-testid="text-avg-ff">
                {isScanning ? "..." : `${avgFFMagnitude}%`}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-card-border">
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-yellow-500/10">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Liquidity Warnings</p>
              <p className="text-3xl font-bold tabular-nums" data-testid="text-liquidity-warnings">
                {isScanning ? "..." : liquidityWarnings}
              </p>
              {liquidityWarnings > 0 && !isScanning && (
                <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                  Back &lt; Front OI
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-card-border">
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-purple-500/10">
              <Target className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Avg Position Size</p>
              <p className="text-3xl font-bold tabular-nums" data-testid="text-avg-position-size">
                {isScanning ? "..." : avgPositionSize > 0 ? avgPositionSize.toFixed(0) : "—"}
              </p>
              {avgPositionSize > 0 && !isScanning && (
                <p className="text-xs text-muted-foreground mt-1">
                  Recommended contracts
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}