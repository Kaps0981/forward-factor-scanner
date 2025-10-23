import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { type Scan } from "@shared/schema";
import { Header } from "@/components/Header";
import { History as HistoryIcon, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// Helper function to render tickers list
function renderTickersList(tickersList: unknown): string {
  if (!tickersList || !Array.isArray(tickersList)) {
    return 'Custom ticker list';
  }
  const tickers = tickersList as string[];
  if (tickers.length === 0) {
    return 'Custom ticker list';
  }
  const displayedTickers = tickers.slice(0, 10).join(', ');
  const remaining = tickers.length > 10 ? ` +${tickers.length - 10} more` : '';
  return displayedTickers + remaining;
}

export default function History() {
  const [, setLocation] = useLocation();

  const { data, isLoading } = useQuery<{ scans: Scan[] }>({
    queryKey: ["/api/scans"],
  });

  return (
    <div className="min-h-screen bg-background">
      <Header currentPage="history" />

      <main className="container max-w-7xl mx-auto px-4 md:px-6 py-4 md:py-8">
        <div className="space-y-4 md:space-y-6">
          <div className="flex items-center gap-2 md:gap-3">
            <HistoryIcon className="h-5 w-5 md:h-6 md:w-6 text-primary" />
            <h2 className="text-xl md:text-2xl font-semibold">Scan History</h2>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8 md:py-12">
              <div className="text-sm md:text-base text-muted-foreground">Loading scan history...</div>
            </div>
          ) : !data?.scans || data.scans.length === 0 ? (
            <Card className="p-8 md:p-12 text-center">
              <p className="text-sm md:text-base text-muted-foreground">No scans yet. Run your first scan to get started!</p>
              <Link href="/">
                <Badge variant="outline" className="mt-4 hover-elevate active-elevate-2 cursor-pointer">
                  Go to Scanner
                </Badge>
              </Link>
            </Card>
          ) : (
            <div className="space-y-3 md:space-y-4">
              {data.scans.map((scan) => (
                <Card
                  key={scan.id}
                  className="p-4 md:p-6 hover-elevate active-elevate-2 cursor-pointer transition-all"
                  onClick={() => setLocation(`/history/${scan.id}`)}
                  data-testid={`card-scan-${scan.id}`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                        <span className="text-xs sm:text-sm text-muted-foreground">
                          {new Date(scan.timestamp).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </span>
                        <Badge variant={scan.total_opportunities > 0 ? "default" : "secondary"} className="w-fit">
                          {scan.total_opportunities} {scan.total_opportunities === 1 ? 'opportunity' : 'opportunities'}
                        </Badge>
                      </div>
                      <div className="text-xs sm:text-sm text-muted-foreground">
                        Scanned {scan.tickers_scanned} tickers • FF range: {scan.min_ff}% to {scan.max_ff}%
                      </div>
                      {Array.isArray(scan.tickers_list) && scan.tickers_list.length > 0 && (
                        <div className="text-xs text-muted-foreground mt-1">
                          <span className="font-medium">Tickers: </span>
                          {renderTickersList(scan.tickers_list)}
                        </div>
                      )}
                    </div>
                    <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground self-end sm:self-center" />
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
