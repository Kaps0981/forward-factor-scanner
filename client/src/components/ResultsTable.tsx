import { useState, useMemo } from "react";
import { type Opportunity } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronUp, ChevronDown, Download, AlertTriangle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ResultsTableProps {
  opportunities: Opportunity[];
  onExportCSV: () => void;
}

type SortField = 'ticker' | 'forward_factor' | 'front_dte' | 'back_dte';
type SortDirection = 'asc' | 'desc';

export function ResultsTable({ opportunities, onExportCSV }: ResultsTableProps) {
  const [sortField, setSortField] = useState<SortField>('forward_factor');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedOpportunities = useMemo(() => {
    return [...opportunities].sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      if (sortField === 'forward_factor') {
        aVal = Math.abs(a.forward_factor);
        bVal = Math.abs(b.forward_factor);
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [opportunities, sortField, sortDirection]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? 
      <ChevronUp className="ml-1 h-3 w-3 inline" /> : 
      <ChevronDown className="ml-1 h-3 w-3 inline" />;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Scan Results</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={onExportCSV}
          disabled={opportunities.length === 0}
          data-testid="button-export-csv"
        >
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {opportunities.length === 0 ? (
        <div className="border border-card-border rounded-lg p-12 text-center">
          <p className="text-muted-foreground">No opportunities found. Run a scan to get started.</p>
        </div>
      ) : (
        <div className="border border-card-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto max-h-[600px]">
          <Table>
            <TableHeader className="sticky top-0 z-20 bg-background">
              <TableRow className="hover:bg-transparent border-b border-card-border">
                <TableHead 
                  className="cursor-pointer hover-elevate font-semibold sticky left-0 z-30 bg-background"
                  onClick={() => handleSort('ticker')}
                  data-testid="header-ticker"
                >
                  Ticker <SortIcon field="ticker" />
                </TableHead>
                <TableHead className="text-center font-semibold">Quality</TableHead>
                <TableHead 
                  className="text-right cursor-pointer hover-elevate font-semibold"
                  onClick={() => handleSort('forward_factor')}
                  data-testid="header-forward-factor"
                >
                  Forward Factor <SortIcon field="forward_factor" />
                </TableHead>
                <TableHead className="text-center font-semibold">Signal</TableHead>
                <TableHead className="font-semibold">Front Contract</TableHead>
                <TableHead 
                  className="text-right cursor-pointer hover-elevate font-semibold"
                  onClick={() => handleSort('front_dte')}
                  data-testid="header-front-dte"
                >
                  Front DTE <SortIcon field="front_dte" />
                </TableHead>
                <TableHead className="text-right font-semibold">Front IV</TableHead>
                <TableHead className="font-semibold">Back Contract</TableHead>
                <TableHead 
                  className="text-right cursor-pointer hover-elevate font-semibold"
                  onClick={() => handleSort('back_dte')}
                  data-testid="header-back-dte"
                >
                  Back DTE <SortIcon field="back_dte" />
                </TableHead>
                <TableHead className="text-right font-semibold">Back IV</TableHead>
                <TableHead className="text-right font-semibold">Forward Vol</TableHead>
                <TableHead className="text-right font-semibold">Avg OI</TableHead>
                <TableHead className="text-center font-semibold">Alerts</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedOpportunities.map((opp, index) => (
                <TableRow 
                  key={`${opp.ticker}-${opp.front_date}-${index}`}
                  className="hover-elevate"
                  data-testid={`row-opportunity-${index}`}
                >
                  <TableCell className="font-medium tracking-wide sticky left-0 z-10 bg-background" data-testid={`text-ticker-${index}`}>
                    {opp.ticker}
                  </TableCell>
                  <TableCell 
                    className="text-right font-mono font-semibold tabular-nums"
                    style={{ color: opp.forward_factor < 0 ? 'hsl(142 76% 36%)' : 'hsl(0 72% 51%)' }}
                    data-testid={`text-ff-${index}`}
                  >
                    {opp.forward_factor > 0 ? '+' : ''}{opp.forward_factor}%
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge
                      variant="outline"
                      className={
                        opp.signal === 'BUY'
                          ? 'bg-chart-1/10 text-chart-1 border-chart-1/20'
                          : 'bg-chart-3/10 text-chart-3 border-chart-3/20'
                      }
                      data-testid={`badge-signal-${index}`}
                    >
                      {opp.signal}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm" data-testid={`text-front-date-${index}`}>
                    {new Date(opp.front_date).toLocaleDateString('en-US', { 
                      month: 'short', 
                      day: 'numeric', 
                      year: 'numeric' 
                    })}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums" data-testid={`text-front-dte-${index}`}>
                    {opp.front_dte}d
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums" data-testid={`text-front-iv-${index}`}>
                    {opp.front_iv}%
                  </TableCell>
                  <TableCell className="text-sm" data-testid={`text-back-date-${index}`}>
                    {new Date(opp.back_date).toLocaleDateString('en-US', { 
                      month: 'short', 
                      day: 'numeric', 
                      year: 'numeric' 
                    })}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums" data-testid={`text-back-dte-${index}`}>
                    {opp.back_dte}d
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums" data-testid={`text-back-iv-${index}`}>
                    {opp.back_iv}%
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums" data-testid={`text-forward-vol-${index}`}>
                    {opp.forward_vol}%
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums" data-testid={`text-avg-oi-${index}`}>
                    {opp.avg_open_interest || '—'}
                  </TableCell>
                  <TableCell className="text-center" data-testid={`cell-alerts-${index}`}>
                    {opp.has_earnings_soon && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <AlertTriangle className="h-4 w-4 text-yellow-500 inline" data-testid={`icon-earnings-warning-${index}`} />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Earnings within 7 days</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
      )}
    </div>
  );
}
