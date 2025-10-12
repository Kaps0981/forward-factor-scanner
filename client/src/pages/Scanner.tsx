import { useState } from "react";
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
import { Activity } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function Scanner() {
  const { toast } = useToast();
  const [scanResults, setScanResults] = useState<ScanResponse | null>(null);
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0, ticker: "" });
  
  // Parse URL params for watchlist pre-fill
  const urlParams = new URLSearchParams(window.location.search);
  const urlTickers = urlParams.get('tickers');
  const urlWatchlistName = urlParams.get('watchlist');

  const scanMutation = useMutation({
    mutationFn: async (params: {
      tickers?: string[];
      minFF: number;
      maxFF: number;
      topN: number;
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
  }) => {
    scanMutation.mutate(params);
  };

  const handleExportCSV = () => {
    if (!scanResults?.opportunities.length) return;

    const headers = [
      "ticker",
      "forward_factor",
      "signal",
      "front_date",
      "front_dte",
      "front_iv",
      "back_date",
      "back_dte",
      "back_iv",
      "forward_vol",
    ];

    const rows = scanResults.opportunities.map((opp) => [
      opp.ticker,
      opp.forward_factor,
      opp.signal,
      opp.front_date,
      opp.front_dte,
      opp.front_iv,
      opp.back_date,
      opp.back_dte,
      opp.back_iv,
      opp.forward_vol,
    ]);

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
      description: "Scan results downloaded successfully",
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
