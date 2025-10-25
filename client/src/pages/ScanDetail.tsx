import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "wouter";
import { type Scan, type Opportunity } from "@shared/schema";
import { Header } from "@/components/Header";
import { ResultsContainer } from "@/components/ResultsContainer";
import { ArrowLeft, Calendar, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { OpportunityDetailsModal } from "@/components/OpportunityDetailsModal";

// Helper function to render tickers list
function renderTickersList(tickersList: unknown, limit: number = 5): string {
  if (!tickersList || !Array.isArray(tickersList)) {
    return 'Custom ticker list';
  }
  const tickers = tickersList as string[];
  if (tickers.length === 0) {
    return 'Custom ticker list';
  }
  const displayedTickers = tickers.slice(0, limit).join(', ');
  const remaining = tickers.length > limit ? ` +${tickers.length - limit} more` : '';
  return displayedTickers + remaining;
}

// Helper function to get ticker list title
function getTickersTitle(tickersList: unknown): string {
  if (!tickersList || !Array.isArray(tickersList)) {
    return 'Custom ticker list';
  }
  const tickers = tickersList as string[];
  return tickers.join(', ');
}

export default function ScanDetail() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const { data, isLoading } = useQuery<{ scan: Scan; opportunities: Opportunity[] }>({
    queryKey: ["/api/scans", id],
    queryFn: async () => {
      const res = await fetch(`/api/scans/${id}`);
      if (!res.ok) throw new Error("Failed to fetch scan");
      return res.json();
    },
  });

  const handleViewDetails = (opportunity: Opportunity) => {
    setSelectedOpportunity(opportunity);
    setModalOpen(true);
  };

  const handleAddToPaper = async (opportunity: Opportunity) => {
    // Implementation for adding to paper trade
    toast({
      title: "Added to Paper Trade",
      description: `${opportunity.ticker} added to paper trading`,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <Header currentPage="history" />

      <main className="container max-w-7xl mx-auto px-4 md:px-6 py-4 md:py-8">
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
                    {Array.isArray(data.scan.tickers_list) && data.scan.tickers_list.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-2" title={getTickersTitle(data.scan.tickers_list)}>
                        {renderTickersList(data.scan.tickers_list, 5)}
                      </p>
                    )}
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

              <ResultsContainer
                opportunities={data.opportunities}
                onViewDetails={handleViewDetails}
                onAddToPaper={handleAddToPaper}
              />

              <OpportunityDetailsModal
                opportunity={selectedOpportunity}
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                onAddToPaper={handleAddToPaper}
              />
            </>
          )}
        </div>
      </main>
    </div>
  );
}
