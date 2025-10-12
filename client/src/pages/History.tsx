import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { type Scan } from "@shared/schema";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Activity, History as HistoryIcon, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function History() {
  const [, setLocation] = useLocation();

  const { data, isLoading } = useQuery<{ scans: Scan[] }>({
    queryKey: ["/api/scans"],
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <Link href="/" className="flex items-center gap-3 hover-elevate active-elevate-2 px-3 py-2 rounded-md" data-testid="link-home">
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
              </Link>
              
              <nav className="flex items-center gap-1">
                <Link href="/">
                  <Badge variant="outline" className="hover-elevate active-elevate-2 cursor-pointer" data-testid="link-scanner">
                    Scanner
                  </Badge>
                </Link>
                <Link href="/history">
                  <Badge variant="default" className="cursor-pointer" data-testid="link-history">
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
          <div className="flex items-center gap-3">
            <HistoryIcon className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-semibold">Scan History</h2>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-muted-foreground">Loading scan history...</div>
            </div>
          ) : !data?.scans || data.scans.length === 0 ? (
            <Card className="p-12 text-center">
              <p className="text-muted-foreground">No scans yet. Run your first scan to get started!</p>
              <Link href="/">
                <Badge variant="outline" className="mt-4 hover-elevate active-elevate-2 cursor-pointer">
                  Go to Scanner
                </Badge>
              </Link>
            </Card>
          ) : (
            <div className="space-y-4">
              {data.scans.map((scan) => (
                <Card
                  key={scan.id}
                  className="p-6 hover-elevate active-elevate-2 cursor-pointer transition-all"
                  onClick={() => setLocation(`/history/${scan.id}`)}
                  data-testid={`card-scan-${scan.id}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-muted-foreground">
                          {new Date(scan.timestamp).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </span>
                        <Badge variant={scan.total_opportunities > 0 ? "default" : "secondary"}>
                          {scan.total_opportunities} {scan.total_opportunities === 1 ? 'opportunity' : 'opportunities'}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Scanned {scan.tickers_scanned} tickers • FF range: {scan.min_ff}% to {scan.max_ff}%
                      </div>
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground" />
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
