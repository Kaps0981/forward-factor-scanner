import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { type ScanResponse, type Opportunity } from "@shared/schema";
import { ScanControls } from "@/components/ScanControls";
import { SummaryCards } from "@/components/SummaryCards";
import { ResultsTable } from "@/components/ResultsTable";
import { ScanProgress } from "@/components/ScanProgress";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Activity, Clock, FileText, Download, Calendar, Building, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export default function Scanner() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [scanResults, setScanResults] = useState<ScanResponse | null>(null);
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0, ticker: "" });
  const [eventsExpanded, setEventsExpanded] = useState(false);
  
  // Calculate scans remaining
  const scanLimit = user?.subscriptionTier === 'paid' ? 30 : 10;
  const scansUsed = user?.scansThisMonth || 0;
  const scansRemaining = Math.max(0, scanLimit - scansUsed);
  const hasReachedLimit = scansRemaining === 0;
  
  // Parse URL params for watchlist pre-fill
  const urlParams = new URLSearchParams(window.location.search);
  const urlTickers = urlParams.get('tickers');
  const urlWatchlistName = urlParams.get('watchlist');
  
  // Fetch market status
  const { data: marketStatus } = useQuery<{
    isOpen: boolean;
    isTradingDay: boolean;
    nextTradingDay: string;
    currentTime: string;
    upcomingHolidays: string[];
    message: string;
  }>({
    queryKey: ['/api/market-status'],
    refetchInterval: 60000, // Update every minute
  });

  const scanMutation = useMutation({
    mutationFn: async (params: {
      tickers?: string[];
      minFF: number;
      maxFF: number;
      topN: number;
      minOpenInterest?: number;
      enableEmailAlerts?: boolean;
      useMarketCap?: boolean;
      minMarketCap?: number;
      maxMarketCap?: number;
      strategyType?: '30-90' | '60-90';
      dteStrategy?: '30-90' | '30-60' | '60-90' | 'all';
      ffCalculationMode?: 'raw' | 'ex-earnings';
    }) => {
      const tickersToScan = params.tickers || [];
      const totalTickers = tickersToScan.length > 0 ? Math.min(tickersToScan.length, 100) : 100;
      
      setScanProgress({ 
        current: 0, 
        total: totalTickers, 
        ticker: "Initializing scan..." 
      });
      
      const estimatedDuration = totalTickers * 12000;
      const progressUpdateInterval = 1000;
      const progressIncrement = totalTickers / (estimatedDuration / progressUpdateInterval);
      
      const progressSimulator = setInterval(() => {
        setScanProgress(prev => {
          const newCurrent = Math.min(prev.current + progressIncrement, prev.total - 0.5);
          const tickerNum = Math.floor(newCurrent) + 1;
          
          return {
            current: newCurrent,
            total: prev.total,
            ticker: tickerNum <= prev.total ? `Processing ticker ${tickerNum} of ${prev.total}...` : prev.ticker
          };
        });
      }, progressUpdateInterval);

      try {
        const response = await apiRequest("POST", "/api/scan", {
          tickers: params.tickers,
          min_ff: params.minFF,
          max_ff: params.maxFF,
          top_n: params.topN,
          min_open_interest: params.minOpenInterest,
          enable_email_alerts: params.enableEmailAlerts,
          use_market_cap: params.useMarketCap,
          min_market_cap: params.minMarketCap,
          max_market_cap: params.maxMarketCap,
          strategy_type: params.strategyType,
          dte_strategy: params.dteStrategy,
          ff_calculation_mode: params.ffCalculationMode,
        });

        let data: ScanResponse;
        try {
          data = await response.json() as ScanResponse;
        } catch (parseError) {
          throw new Error("Failed to parse scan results. Please try again.");
        }
        
        clearInterval(progressSimulator);
        setScanProgress({ 
          current: data.total_tickers_scanned, 
          total: data.total_tickers_scanned, 
          ticker: `Scan complete - analyzed ${data.total_tickers_scanned} tickers` 
        });

        return data;
      } catch (error) {
        clearInterval(progressSimulator);
        throw error;
      }
    },
    onSuccess: (data) => {
      setScanResults(data);
      toast({
        title: "Scan Complete",
        description: `Found ${data.total_opportunities_found} opportunities from ${data.total_tickers_scanned} tickers`,
      });
    },
    onError: (error: Error) => {
      // Check for unauthorized error
      if (isUnauthorizedError(error)) {
        window.location.href = "/api/login";
        return;
      }
      
      // Check for scan limit error
      if (error.message.includes("scan limit")) {
        toast({
          title: "Scan Limit Reached",
          description: "You've reached your monthly scan limit. Upgrade coming soon!",
          variant: "destructive",
        });
        return;
      }
      
      toast({
        title: "Scan Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleScan = (params: {
    tickers?: string[];
    minFF: number;
    maxFF: number;
    topN: number;
    minOpenInterest?: number;
    enableEmailAlerts?: boolean;
    useMarketCap?: boolean;
    minMarketCap?: number;
    maxMarketCap?: number;
    strategyType?: '30-90' | '60-90';
    dteStrategy?: '30-90' | '30-60' | '60-90' | 'all';
    ffCalculationMode?: 'raw' | 'ex-earnings';
  }) => {
    scanMutation.mutate(params);
  };

  const handleExportCSV = () => {
    if (!scanResults?.opportunities.length) return;

    const headers = [
      "ticker",
      "forward_factor",
      "signal",
      "risk_reward",
      "position_size_recommendation",
      "front_date",
      "front_dte",
      "front_iv",
      "front_ivr",
      "front_straddle_oi",
      "back_date",
      "back_dte",
      "back_iv",
      "back_ivr",
      "back_straddle_oi",
      "min_liquidity",
      "forward_vol",
      "avg_open_interest",
      "liquidity_score",
      "back_liquidity_score",
      "quality_score",
      "has_earnings_soon",
      "earnings_date",
      "days_to_earnings",
      "earnings_estimated",
      "fed_events",
      "event_warnings",
      "execution_warnings",
    ];

    const rows = scanResults.opportunities.map((opp) => {
      const minLiquidity = Math.min(opp.straddle_oi || 0, opp.back_straddle_oi || 0);
      const executionWarnings = opp.execution_warnings ? opp.execution_warnings.join("; ") : "";
      const fedEvents = opp.fed_events ? opp.fed_events.join("; ") : "";
      const eventWarnings = opp.event_warnings ? opp.event_warnings.join("; ") : "";
      
      return [
        opp.ticker,
        opp.forward_factor,
        opp.signal,
        opp.risk_reward || "",
        opp.position_size_recommendation || "",
        opp.front_date,
        opp.front_dte,
        opp.front_iv,
        opp.front_ivr || "",
        opp.straddle_oi || "",
        opp.back_date,
        opp.back_dte,
        opp.back_iv,
        opp.back_ivr || "",
        opp.back_straddle_oi || "",
        minLiquidity || "",
        opp.forward_vol,
        opp.avg_open_interest || "",
        opp.liquidity_score || "",
        opp.back_liquidity_score || "",
        opp.quality_score || "",
        opp.has_earnings_soon || false,
        opp.earnings_date || "",
        opp.days_to_earnings?.toString() || "",
        opp.earnings_estimated || false,
        `"${fedEvents}"`, // Quote since they may contain commas
        `"${eventWarnings}"`, // Quote since they may contain commas
        `"${executionWarnings}"`, // Quote execution warnings since they may contain commas
      ];
    });

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ff-scan-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: "CSV Exported",
      description: "Scan results with liquidity metrics downloaded successfully",
    });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header currentPage="scanner" />

      <main className="container max-w-7xl mx-auto px-4 md:px-6 py-4 md:py-8 flex-1">
        <div className="space-y-6">
          {/* Scan Usage Card */}
          <Card className="border-border">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Monthly Scan Usage</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {scansUsed} of {scanLimit} scans used this month
                  </p>
                </div>
                {hasReachedLimit ? (
                  <Badge variant="destructive">
                    Limit Reached - Upgrade Coming Soon
                  </Badge>
                ) : scansRemaining <= 5 ? (
                  <Badge variant="outline" className="border-yellow-500 text-yellow-600">
                    {scansRemaining} scans remaining
                  </Badge>
                ) : (
                  <Badge variant="outline">
                    {scansRemaining} scans remaining
                  </Badge>
                )}
              </div>
              {user && (
                <div className="mt-3">
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-primary rounded-full h-2 transition-all"
                      style={{ width: `${(scansUsed / scanLimit) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </CardHeader>
            {hasReachedLimit && (
              <CardContent className="pt-0">
                <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-md">
                  <AlertTriangle className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                  <p className="text-sm">
                    You've reached your monthly scan limit. Upgrade options coming soon! 
                    Your scan count will reset at the beginning of next month.
                  </p>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Upcoming Events Card */}
          {scanResults && scanResults.opportunities.length > 0 && (
            <Collapsible open={eventsExpanded} onOpenChange={setEventsExpanded}>
              <Card className="border-border">
                <CollapsibleTrigger className="w-full" data-testid="button-events-toggle">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-yellow-500" />
                        <CardTitle className="text-base">Upcoming Financial Events</CardTitle>
                      </div>
                      {eventsExpanded ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                
                <CollapsibleContent>
                  <CardContent className="pt-0 space-y-4">
                    {/* Fed Meetings Section */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Building className="h-4 w-4 text-blue-500" />
                        <h4 className="text-sm font-medium">Federal Reserve Meetings</h4>
                      </div>
                      <div className="pl-6 space-y-1">
                        {(() => {
                          // Get all unique Fed events from scan results
                          const allFedEvents = new Set<string>();
                          scanResults.opportunities.forEach(opp => {
                            if (opp.fed_events) {
                              opp.fed_events.forEach(event => allFedEvents.add(event));
                            }
                          });
                          const fedEventsList = Array.from(allFedEvents).sort();
                          
                          if (fedEventsList.length > 0) {
                            return fedEventsList.slice(0, 3).map((event, idx) => (
                              <p key={idx} className="text-sm text-muted-foreground">{event}</p>
                            ));
                          } else {
                            return <p className="text-sm text-muted-foreground">No Fed meetings in scan period</p>;
                          }
                        })()}
                      </div>
                    </div>
                    
                    {/* Earnings Section */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-yellow-500" />
                        <h4 className="text-sm font-medium">Upcoming Earnings (Next 7 Days)</h4>
                      </div>
                      <div className="pl-6 space-y-1">
                        {(() => {
                          // Get all stocks with earnings dates
                          const earningsStocks = scanResults.opportunities
                            .filter(opp => opp.earnings_date)
                            .map(opp => ({
                              ticker: opp.ticker,
                              date: opp.earnings_date!,
                              isCritical: opp.event_warnings?.some(w => 
                                w.includes('EARNINGS') && w.includes('HIGH RISK')
                              ) || false
                            }))
                            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                            .slice(0, 5);
                          
                          if (earningsStocks.length > 0) {
                            return earningsStocks.map((stock, idx) => (
                              <div key={idx} className="flex items-center gap-2">
                                <span className="text-sm font-medium">{stock.ticker}</span>
                                <span className="text-sm text-muted-foreground">
                                  {new Date(stock.date).toLocaleDateString('en-US', { 
                                    month: 'short', 
                                    day: 'numeric' 
                                  })}
                                </span>
                                {stock.isCritical && (
                                  <Badge variant="destructive" className="text-xs px-1 py-0">
                                    Between Exp
                                  </Badge>
                                )}
                              </div>
                            ));
                          } else {
                            return <p className="text-sm text-muted-foreground">No earnings in next 7 days</p>;
                          }
                        })()}
                      </div>
                    </div>
                    
                    {/* Warning Summary */}
                    {(() => {
                      const criticalEvents = scanResults.opportunities.filter(opp => 
                        opp.event_warnings && opp.event_warnings.some(w => 
                          w.includes('HIGH RISK') || w.includes('between expirations')
                        )
                      );
                      
                      if (criticalEvents.length > 0) {
                        return (
                          <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-950/30 rounded-md">
                            <div className="flex items-start gap-2">
                              <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                              <div className="flex-1">
                                <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                                  Event Risks Detected
                                </p>
                                <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                                  {criticalEvents.length} position{criticalEvents.length !== 1 ? 's' : ''} have 
                                  critical events between expirations. Review carefully before trading.
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          )}

          {/* Market Status Card */}
          {marketStatus && (
            <Card className="p-3 md:p-4 border-border">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  <div>
                    <p className="text-base md:text-lg font-medium">{marketStatus.message}</p>
                    {!marketStatus.isOpen && (
                      <p className="text-xs md:text-sm text-muted-foreground">
                        Next trading day: {new Date(marketStatus.nextTradingDay).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
                {scanResults?.scan_id && (
                  <div className="flex items-center gap-2 ml-8 md:ml-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        window.open(`/api/scans/${scanResults.scan_id}/report?format=markdown`, '_blank');
                      }}
                      data-testid="button-download-markdown"
                      className="flex-1 md:flex-none"
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      <span className="hidden sm:inline">Markdown</span>
                      <span className="sm:hidden">MD</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        window.open(`/api/scans/${scanResults.scan_id}/report?format=html`, '_blank');
                      }}
                      data-testid="button-download-html"
                      className="flex-1 md:flex-none"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      HTML
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          )}
          
          {urlWatchlistName && (
            <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
              <p className="text-sm text-primary">
                <strong>Scanning watchlist:</strong> {urlWatchlistName}
              </p>
            </div>
          )}
          <ScanControls 
            onScan={handleScan} 
            isScanning={scanMutation.isPending} 
            initialTickers={urlTickers || undefined}
            watchlistName={urlWatchlistName || undefined}
          />

          {scanMutation.isPending && (
            <ScanProgress
              currentTicker={scanProgress.ticker}
              progress={scanProgress.current}
              total={scanProgress.total}
            />
          )}

          <SummaryCards
            tickersScanned={scanResults?.total_tickers_scanned || 0}
            opportunitiesFound={scanResults?.total_opportunities_found || 0}
            opportunities={scanResults?.opportunities || []}
            isScanning={scanMutation.isPending}
          />

          <ResultsTable
            opportunities={scanResults?.opportunities || []}
            onExportCSV={handleExportCSV}
          />
        </div>
      </main>

      <Footer />
    </div>
  );
}
