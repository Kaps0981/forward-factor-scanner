import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "wouter";
import { type Scan, type Opportunity } from "@shared/schema";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ResultsTable } from "@/components/ResultsTable";
import { Activity, ArrowLeft, Calendar, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

export default function ScanDetail() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();

  const { data, isLoading } = useQuery<{ scan: Scan; opportunities: Opportunity[] }>({
    queryKey: ["/api/scans", id],
    queryFn: async () => {
      const res = await fetch(`/api/scans/${id}`);
      if (!res.ok) throw new Error("Failed to fetch scan");
      return res.json();
    },
  });

  const handleExportCSV = () => {
    if (!data?.opportunities.length) return;

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

    const rows = data.opportunities.map((opp) => [
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
    a.download = `ff-scan-${id}-${new Date().toISOString().split("T")[0]}.csv`;
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
              <Link href="/" className="flex items-center gap-3 hover-elevate active-elevate-2 px-3 py-2 rounded-md">
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
                  <Badge variant="outline" className="hover-elevate active-elevate-2 cursor-pointer">
                    Scanner
                  </Badge>
                </Link>
                <Link href="/history">
                  <Badge variant="outline" className="hover-elevate active-elevate-2 cursor-pointer">
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
          <Link href="/history">
            <div className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
              <ArrowLeft className="h-4 w-4" />
              <span>Back to History</span>
            </div>
          </Link>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-muted-foreground">Loading scan details...</div>
            </div>
          ) : !data ? (
            <Card className="p-12 text-center">
              <p className="text-muted-foreground">Scan not found</p>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Scan Date</CardTitle>
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-semibold tabular-nums">
                      {new Date(data.scan.timestamp).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(data.scan.timestamp).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Tickers Scanned</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-semibold tabular-nums">{data.scan.tickers_scanned}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      FF range: {data.scan.min_ff}% to {data.scan.max_ff}%
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Opportunities</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-semibold tabular-nums">{data.scan.total_opportunities}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Top {data.scan.top_n} results
                    </p>
                  </CardContent>
                </Card>
              </div>

              <ResultsTable
                opportunities={data.opportunities}
                onExportCSV={handleExportCSV}
              />
            </>
          )}
        </div>
      </main>
    </div>
  );
}
