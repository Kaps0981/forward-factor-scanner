import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { type ScanResponse, type Opportunity } from "@shared/schema";
import { ScanControls } from "@/components/ScanControls";
import { SummaryCards } from "@/components/SummaryCards";
import { ResultsTable } from "@/components/ResultsTable";
import { ScanProgress } from "@/components/ScanProgress";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Activity, Clock, FileText, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function Scanner() {
  const { toast } = useToast();
  const [scanResults, setScanResults] = useState<ScanResponse | null>(null);
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0, ticker: "" });
  
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
    }) => {
      const tickersToScan = params.tickers || [];
      const totalTickers = tickersToScan.length > 0 ? Math.min(tickersToScan.length, 30) : 30;
      
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
  }) => {
    scanMutation.mutate(params);
  };

  const handleExportCSV = () => {
    if (!scanResults?.opportunities.length) return;

    const headers = [
      "ticker",
      "forward_factor",
      "signal",
      "position_size_recommendation",
      "front_date",
      "front_dte",
      "front_iv",
      "front_straddle_oi",
      "back_date",
      "back_dte",
      "back_iv",
      "back_straddle_oi",
      "min_liquidity",
      "forward_vol",
      "avg_open_interest",
      "liquidity_score",
      "back_liquidity_score",
      "quality_score",
      "has_earnings_soon",
      "execution_warnings",
    ];

    const rows = scanResults.opportunities.map((opp) => {
      const minLiquidity = Math.min(opp.straddle_oi || 0, opp.back_straddle_oi || 0);
      const executionWarnings = opp.execution_warnings ? opp.execution_warnings.join("; ") : "";
      
      return [
        opp.ticker,
        opp.forward_factor,
        opp.signal,
        opp.position_size_recommendation || "",
        opp.front_date,
        opp.front_dte,
        opp.front_iv,
        opp.straddle_oi || "",
        opp.back_date,
        opp.back_dte,
        opp.back_iv,
        opp.back_straddle_oi || "",
        minLiquidity || "",
        opp.forward_vol,
        opp.avg_open_interest || "",
        opp.liquidity_score || "",
        opp.back_liquidity_score || "",
        opp.quality_score || "",
        opp.has_earnings_soon || false,
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
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-md bg-primary/10">
                  <Activity className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight">
                    Forward Factor Scanner
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Options volatility mispricing detector
                  </p>
                </div>
              </div>
              
              <nav className="flex items-center gap-1">
                <Badge variant="default" className="cursor-pointer" data-testid="link-scanner">
                  Scanner
                </Badge>
                <Link href="/watchlists">
                  <Badge variant="outline" className="hover-elevate active-elevate-2 cursor-pointer" data-testid="link-watchlists">
                    Watchlists
                  </Badge>
                </Link>
                <Link href="/history">
                  <Badge variant="outline" className="hover-elevate active-elevate-2 cursor-pointer" data-testid="link-history">
                    History
                  </Badge>
                </Link>
              </nav>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="container max-w-7xl mx-auto px-6 py-8">
        <div className="space-y-6">
          {/* Market Status Card */}
          {marketStatus && (
            <Card className="p-4 border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-lg font-medium">{marketStatus.message}</p>
                    {!marketStatus.isOpen && (
                      <p className="text-sm text-muted-foreground">
                        Next trading day: {new Date(marketStatus.nextTradingDay).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
                {scanResults?.scan_id && (
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        window.open(`/api/scans/${scanResults.scan_id}/report?format=markdown`, '_blank');
                      }}
                      data-testid="button-download-markdown"
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Markdown Report
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        window.open(`/api/scans/${scanResults.scan_id}/report?format=html`, '_blank');
                      }}
                      data-testid="button-download-html"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      HTML Report
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

      <footer className="border-t border-border mt-12 py-6">
        <div className="container max-w-7xl mx-auto px-6">
          <p className="text-center text-sm text-muted-foreground">
            Educational tool only. Not financial advice. Always verify signals before trading.
          </p>
        </div>
      </footer>
    </div>
  );
}
