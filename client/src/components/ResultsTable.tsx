import { useState, useMemo } from "react";
import { type Opportunity } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ChevronUp, 
  ChevronDown, 
  Download, 
  AlertTriangle, 
  X, 
  ChevronRight,
  Info,
  Calendar,
  Building
} from "lucide-react";
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
import {
  Alert,
  AlertDescription,
} from "@/components/ui/alert";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useIsMobile } from "@/hooks/use-mobile";
import { MobileResultCard } from "@/components/MobileResultCard";

interface ResultsTableProps {
  opportunities: Opportunity[];
  onExportCSV: () => void;
}

type SortField = 'ticker' | 'forward_factor' | 'front_dte' | 'back_dte' | 'min_liquidity';
type SortDirection = 'asc' | 'desc';

export function ResultsTable({ opportunities, onExportCSV }: ResultsTableProps) {
  const [sortField, setSortField] = useState<SortField>('forward_factor');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [showWarning, setShowWarning] = useState(true);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const isMobile = useIsMobile();

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
      let aVal: any = a[sortField as keyof Opportunity];
      let bVal: any = b[sortField as keyof Opportunity];

      if (sortField === 'forward_factor') {
        aVal = Math.abs(a.forward_factor);
        bVal = Math.abs(b.forward_factor);
      } else if (sortField === 'min_liquidity') {
        aVal = Math.min(a.straddle_oi || 0, a.back_straddle_oi || 0);
        bVal = Math.min(b.straddle_oi || 0, b.back_straddle_oi || 0);
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

  const getLiquidityColor = (oi: number | undefined) => {
    if (!oi) return 'text-muted-foreground';
    if (oi >= 250) return 'text-green-600 dark:text-green-400';
    if (oi >= 100) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
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

  const toggleRowExpansion = (rowId: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(rowId)) {
        newSet.delete(rowId);
      } else {
        newSet.add(rowId);
      }
      return newSet;
    });
  };

  return (
    <div className="space-y-4">
      {showWarning && (
        <Alert className="bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800 relative">
          <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
          <AlertDescription className="text-yellow-800 dark:text-yellow-200 font-medium pr-8">
            ⚠️ CRITICAL: Always verify exact strike liquidity before trading. Back month is often the bottleneck.
          </AlertDescription>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 top-2 h-6 w-6 rounded-sm opacity-70 hover:opacity-100"
            onClick={() => setShowWarning(false)}
            data-testid="button-dismiss-warning"
          >
            <X className="h-4 w-4" />
          </Button>
        </Alert>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-base sm:text-lg font-semibold">Scan Results</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={onExportCSV}
          disabled={opportunities.length === 0}
          data-testid="button-export-csv"
        >
          <Download className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
          <span className="hidden sm:inline">Export CSV</span>
          <span className="sm:hidden">Export</span>
        </Button>
      </div>

      {opportunities.length === 0 ? (
        <div className="border border-card-border rounded-lg p-8 sm:p-12 text-center">
          <p className="text-sm sm:text-base text-muted-foreground">No opportunities found. Run a scan to get started.</p>
        </div>
      ) : isMobile ? (
        // Mobile Card View
        <div className="space-y-3">
          {sortedOpportunities.map((opp) => (
            <MobileResultCard key={opp.ticker} opportunity={opp} />
          ))}
        </div>
      ) : (
        // Desktop Table View
        <div className="border border-card-border rounded-lg overflow-hidden">
        <div className="relative max-h-[600px] overflow-auto">
          <Table className="relative">
            <TableHeader className="sticky top-0 z-50">
              <TableRow className="hover:bg-transparent bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <TableHead className="w-8 sticky left-0 z-[60] bg-background border-r border-card-border shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]"></TableHead>
                <TableHead 
                  className="cursor-pointer hover-elevate font-semibold sticky left-8 z-[60] bg-background shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]"
                  onClick={() => handleSort('ticker')}
                  data-testid="header-ticker"
                >
                  Ticker <SortIcon field="ticker" />
                </TableHead>
                <TableHead 
                  className="text-right cursor-pointer hover-elevate font-semibold bg-background"
                  onClick={() => handleSort('forward_factor')}
                  data-testid="header-forward-factor"
                >
                  Forward Factor <SortIcon field="forward_factor" />
                </TableHead>
                <TableHead className="text-center font-semibold bg-background">Signal</TableHead>
                <TableHead className="text-center font-semibold bg-background">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger className="cursor-help">
                        Events
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Financial Events</p>
                        <p className="text-xs text-muted-foreground">Earnings announcements and Fed meetings</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TableHead>
                <TableHead className="text-center font-semibold bg-background">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger className="cursor-help">
                        Risk/Reward
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Risk to Reward Ratio</p>
                        <p className="text-xs text-muted-foreground">Potential profit vs loss ratio for ATM straddles</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TableHead>
                <TableHead className="text-right font-semibold bg-background">Position Size</TableHead>
                <TableHead className="font-semibold bg-background">Front Contract</TableHead>
                <TableHead 
                  className="text-right cursor-pointer hover-elevate font-semibold bg-background"
                  onClick={() => handleSort('front_dte')}
                  data-testid="header-front-dte"
                >
                  Front DTE <SortIcon field="front_dte" />
                </TableHead>
                <TableHead className="text-right font-semibold bg-background">Front IV</TableHead>
                <TableHead className="text-center font-semibold bg-background">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger className="cursor-help">
                        Front IVR
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Implied Volatility Rank (0-100)</p>
                        <p className="text-xs text-muted-foreground">Estimates where current IV stands relative to typical ranges</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TableHead>
                <TableHead className="text-right font-semibold bg-background">Front OI</TableHead>
                <TableHead className="font-semibold bg-background">Back Contract</TableHead>
                <TableHead 
                  className="text-right cursor-pointer hover-elevate font-semibold bg-background"
                  onClick={() => handleSort('back_dte')}
                  data-testid="header-back-dte"
                >
                  Back DTE <SortIcon field="back_dte" />
                </TableHead>
                <TableHead className="text-right font-semibold bg-background">Back IV</TableHead>
                <TableHead className="text-center font-semibold bg-background">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger className="cursor-help">
                        Back IVR
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Implied Volatility Rank (0-100)</p>
                        <p className="text-xs text-muted-foreground">Estimates where current IV stands relative to typical ranges</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TableHead>
                <TableHead className="text-right font-semibold bg-background">Back Month OI</TableHead>
                <TableHead 
                  className="text-right cursor-pointer hover-elevate font-semibold bg-background"
                  onClick={() => handleSort('min_liquidity')}
                  data-testid="header-min-liquidity"
                >
                  Min Liquidity <SortIcon field="min_liquidity" />
                </TableHead>
                <TableHead className="text-right font-semibold bg-background">Forward Vol</TableHead>
                <TableHead className="text-center font-semibold bg-background">Alerts</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedOpportunities.map((opp, index) => {
                const rowId = `${opp.ticker}-${opp.front_date}-${index}`;
                const minLiquidity = Math.min(opp.straddle_oi || 0, opp.back_straddle_oi || 0);
                const liquidityDifference = opp.straddle_oi && opp.back_straddle_oi 
                  ? ((opp.straddle_oi - opp.back_straddle_oi) / opp.straddle_oi) * 100
                  : 0;
                const hasSignificantDifference = Math.abs(liquidityDifference) > 50;
                const hasWarnings = opp.execution_warnings && opp.execution_warnings.length > 0;
                const isExpanded = expandedRows.has(rowId);

                return (
                  <>
                    <TableRow 
                      key={rowId}
                      className="hover-elevate"
                      data-testid={`row-opportunity-${index}`}
                    >
                      <TableCell className="w-8 sticky left-0 z-[40] bg-background border-r border-card-border shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                        {hasWarnings && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => toggleRowExpansion(rowId)}
                            className="h-6 w-6"
                            data-testid={`button-expand-${index}`}
                          >
                            <ChevronRight 
                              className={`h-4 w-4 transition-transform ${
                                isExpanded ? 'rotate-90' : ''
                              }`} 
                            />
                          </Button>
                        )}
                      </TableCell>
                      <TableCell className="font-medium tracking-wide sticky left-8 z-[40] bg-background shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]" data-testid={`text-ticker-${index}`}>
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
                      <TableCell className="text-center" data-testid={`cell-events-${index}`}>
                        <div className="flex items-center justify-center gap-1">
                          {opp.earnings_date && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center gap-1">
                                    <Calendar className={`h-4 w-4 ${
                                      opp.event_warnings?.some(w => w.includes('EARNINGS') && w.includes('HIGH RISK'))
                                        ? 'text-red-500'
                                        : 'text-yellow-500'
                                    }`} />
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <div>
                                    <p className="font-semibold">Earnings Date</p>
                                    <p className="text-sm">{new Date(opp.earnings_date).toLocaleDateString()}</p>
                                    {opp.event_warnings?.filter(w => w.includes('Earnings')).map((warning, i) => (
                                      <p key={i} className="text-xs text-muted-foreground mt-1">{warning}</p>
                                    ))}
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          {opp.fed_events && opp.fed_events.length > 0 && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center gap-1">
                                    <Building className={`h-4 w-4 ${
                                      opp.event_warnings?.some(w => w.includes('Fed meeting') && w.includes('between'))
                                        ? 'text-red-500'
                                        : 'text-blue-500'
                                    }`} />
                                    {opp.fed_events.length > 1 && (
                                      <span className="text-xs text-muted-foreground">
                                        {opp.fed_events.length}
                                      </span>
                                    )}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <div>
                                    <p className="font-semibold">Fed Meetings</p>
                                    {opp.fed_events.map((event, i) => (
                                      <p key={i} className="text-sm mt-1">{event}</p>
                                    ))}
                                    {opp.event_warnings?.filter(w => w.includes('Fed')).map((warning, i) => (
                                      <p key={i} className="text-xs text-muted-foreground mt-1">{warning}</p>
                                    ))}
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          {!opp.earnings_date && (!opp.fed_events || opp.fed_events.length === 0) && (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center" data-testid={`text-risk-reward-${index}`}>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="font-mono font-semibold text-sm">
                                {getRiskRewardLabel(opp.risk_reward)}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <div>
                                <p className="font-semibold">Risk/Reward Ratio</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  Higher ratios indicate better potential return vs risk
                                </p>
                                {opp.risk_reward && (
                                  <p className="text-xs font-mono mt-1">
                                    For every $1 risked, potential reward is ${opp.risk_reward.toFixed(2)}
                                  </p>
                                )}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums" data-testid={`text-position-size-${index}`}>
                        {opp.position_size_recommendation || '—'}
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
                      <TableCell className="text-center" data-testid={`badge-front-ivr-${index}`}>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge 
                                variant={getIVRBadgeVariant(opp.front_ivr) as any}
                                className="font-mono"
                              >
                                {getIVRLabel(opp.front_ivr)}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              <div>
                                <p className="font-semibold">Front Month IVR: {opp.front_ivr || '—'}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {opp.front_ivr && opp.front_ivr > 70 && "High volatility regime - favors selling premium"}
                                  {opp.front_ivr && opp.front_ivr >= 30 && opp.front_ivr <= 70 && "Normal volatility regime"}
                                  {opp.front_ivr && opp.front_ivr < 30 && "Low volatility regime - favors buying premium"}
                                </p>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums" data-testid={`text-front-oi-${index}`}>
                        {opp.straddle_oi || '—'}
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
                      <TableCell className="text-center" data-testid={`badge-back-ivr-${index}`}>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge 
                                variant={getIVRBadgeVariant(opp.back_ivr) as any}
                                className="font-mono"
                              >
                                {getIVRLabel(opp.back_ivr)}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              <div>
                                <p className="font-semibold">Back Month IVR: {opp.back_ivr || '—'}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {opp.back_ivr && opp.back_ivr > 70 && "High volatility regime - favors selling premium"}
                                  {opp.back_ivr && opp.back_ivr >= 30 && opp.back_ivr <= 70 && "Normal volatility regime"}
                                  {opp.back_ivr && opp.back_ivr < 30 && "Low volatility regime - favors buying premium"}
                                </p>
                                {opp.ivr_context && (
                                  <p className="text-xs font-medium mt-2">{opp.ivr_context}</p>
                                )}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell 
                        className={`text-right font-mono tabular-nums ${
                          hasSignificantDifference ? 'font-semibold' : ''
                        }`}
                        data-testid={`text-back-oi-${index}`}
                      >
                        <span className={getLiquidityColor(opp.back_straddle_oi)}>
                          {opp.back_straddle_oi || '—'}
                        </span>
                        {hasSignificantDifference && opp.back_straddle_oi && opp.back_straddle_oi < (opp.straddle_oi || 0) && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <AlertTriangle className="h-3 w-3 text-yellow-500 inline ml-1" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Back month has {Math.abs(liquidityDifference).toFixed(0)}% less liquidity</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </TableCell>
                      <TableCell 
                        className={`text-right font-mono tabular-nums font-semibold ${getLiquidityColor(minLiquidity)}`}
                        data-testid={`text-min-liquidity-${index}`}
                      >
                        {minLiquidity || '—'}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums" data-testid={`text-forward-vol-${index}`}>
                        {opp.forward_vol}%
                      </TableCell>
                      <TableCell className="text-center" data-testid={`cell-alerts-${index}`}>
                        {hasWarnings && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center justify-center gap-1">
                                  <Info className="h-4 w-4 text-blue-500" data-testid={`icon-warning-${index}`} />
                                  <span className="text-xs text-muted-foreground">
                                    {opp.execution_warnings?.length}
                                  </span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Click row to view execution warnings</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        {opp.has_earnings_soon && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <AlertTriangle className="h-4 w-4 text-yellow-500" data-testid={`icon-earnings-warning-${index}`} />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Earnings within 7 days</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </TableCell>
                    </TableRow>
                    {hasWarnings && isExpanded && (
                      <TableRow 
                        className="bg-muted/30"
                        data-testid={`row-warnings-${index}`}
                      >
                        <TableCell className="sticky left-0 z-[40] bg-muted/30 border-r border-card-border shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]"></TableCell>
                        <TableCell className="sticky left-8 z-[40] bg-muted/30 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]"></TableCell>
                        <TableCell colSpan={18} className="p-4">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Info className="h-4 w-4 text-blue-500" />
                              <span className="font-semibold text-sm">Execution Warnings:</span>
                            </div>
                            <div className="space-y-1 ml-6">
                              {opp.execution_warnings?.map((warning, wIdx) => (
                                <Alert 
                                  key={wIdx} 
                                  className="py-2"
                                  data-testid={`alert-warning-${index}-${wIdx}`}
                                >
                                  <AlertDescription className="text-sm">
                                    {warning}
                                  </AlertDescription>
                                </Alert>
                              ))}
                            </div>
                            {hasSignificantDifference && (
                              <div className="ml-6 mt-3">
                                <Alert className="py-2 bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800">
                                  <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                                  <AlertDescription className="text-sm text-yellow-800 dark:text-yellow-200">
                                    <strong>Liquidity Warning:</strong> Back month has significantly less liquidity than front month 
                                    ({Math.abs(liquidityDifference).toFixed(0)}% difference). This may impact execution.
                                  </AlertDescription>
                                </Alert>
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
      )}
    </div>
  );
}
