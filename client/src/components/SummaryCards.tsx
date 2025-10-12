import { Card, CardContent } from "@/components/ui/card";
import { Search, TrendingUp, Database } from "lucide-react";
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

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
    </div>
  );
}
