import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Activity,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  Target,
  StopCircle,
  RefreshCw,
  Newspaper
} from "lucide-react";
import { format } from "date-fns";
import type { PaperTrade, PortfolioSummary } from "@shared/schema";
import { Header } from "@/components/Header";

export default function PaperTrading() {
  const { toast } = useToast();
  const [selectedTradeId, setSelectedTradeId] = useState<number | null>(null);
  
  // Fetch open positions
  const { data: openTrades = [], isLoading: tradesLoading, refetch: refetchTrades } = useQuery<PaperTrade[]>({
    queryKey: ['/api/paper-trades/open']
  });
  
  // Fetch portfolio summary
  const { data: portfolio, isLoading: portfolioLoading, refetch: refetchPortfolio } = useQuery<PortfolioSummary>({
    queryKey: ['/api/portfolio-summary']
  });
  
  // Fetch all trades for history
  const { data: allTrades = [] } = useQuery<PaperTrade[]>({
    queryKey: ['/api/paper-trades']
  });
  
  // Fetch news for selected trade
  const { data: tradeNews = [] } = useQuery<any[]>({
    queryKey: [`/api/paper-trades/${selectedTradeId}/news`],
    enabled: !!selectedTradeId
  });
  
  // Update all prices mutation
  const updatePricesMutation = useMutation({
    mutationFn: () => apiRequest('/api/paper-trades/update-all-prices', 'POST'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/paper-trades'] });
      queryClient.invalidateQueries({ queryKey: ['/api/portfolio-summary'] });
      toast({
        title: "Prices Updated",
        description: "All position prices have been refreshed",
      });
    }
  });
  
  // Close trade mutation
  const closePositionMutation = useMutation({
    mutationFn: ({ id, exitPrice, exitReason }: { id: number, exitPrice: number, exitReason: string }) =>
      apiRequest(`/api/paper-trades/${id}/close`, 'POST', { exitPrice, exitReason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/paper-trades'] });
      queryClient.invalidateQueries({ queryKey: ['/api/portfolio-summary'] });
      toast({
        title: "Position Closed",
        description: "Trade has been closed successfully",
      });
    }
  });
  
  // Get exit signal icon and color
  const getExitSignalDisplay = (signal?: string | null) => {
    switch (signal) {
      case 'GREEN':
        return { icon: <CheckCircle className="w-4 h-4" />, color: 'bg-green-500', text: 'Hold' };
      case 'AMBER':
        return { icon: <AlertCircle className="w-4 h-4" />, color: 'bg-yellow-500', text: 'Monitor' };
      case 'RED':
        return { icon: <XCircle className="w-4 h-4" />, color: 'bg-red-500', text: 'Exit' };
      case 'TAKE_PROFIT':
        return { icon: <Target className="w-4 h-4" />, color: 'bg-green-600', text: 'Take Profit' };
      case 'STOP_LOSS':
        return { icon: <StopCircle className="w-4 h-4" />, color: 'bg-red-600', text: 'Stop Loss' };
      default:
        return { icon: <Clock className="w-4 h-4" />, color: 'bg-gray-500', text: 'Pending' };
    }
  };
  
  // Format P&L display
  const formatPnL = (value: number | null | undefined, isPercent = false) => {
    if (value == null) return '$0.00';
    const formatted = isPercent ? `${value.toFixed(2)}%` : `$${Math.abs(value).toFixed(2)}`;
    const color = value >= 0 ? 'text-green-600' : 'text-red-600';
    const prefix = value >= 0 ? '+' : '-';
    return <span className={color}>{prefix}{formatted}</span>;
  };
  
  if (tradesLoading || portfolioLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  return (
    <>
      <Header currentPage="paper-trading" />
      <div className="container mx-auto px-4 py-6 max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Paper Trading</h1>
            <p className="text-muted-foreground">Manage your simulated options positions</p>
          </div>
          <Button 
            onClick={() => updatePricesMutation.mutate()}
            disabled={updatePricesMutation.isPending}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${updatePricesMutation.isPending ? 'animate-spin' : ''}`} />
            Update Prices
          </Button>
        </div>
      
      {/* Portfolio Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Value</CardDescription>
            <CardTitle className="text-2xl">
              ${portfolio?.total_value?.toLocaleString() || '100,000'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">
              Cash: ${portfolio?.cash_balance?.toLocaleString() || '100,000'}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total P&L</CardDescription>
            <CardTitle className="text-2xl">
              {formatPnL(portfolio?.total_pnl)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">
              {formatPnL(portfolio?.total_pnl_percent, true)}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Win Rate</CardDescription>
            <CardTitle className="text-2xl">
              {portfolio?.win_rate ? `${portfolio.win_rate.toFixed(1)}%` : 'N/A'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">
              {portfolio?.closed_trades || 0} closed trades
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Avg Win/Loss</CardDescription>
            <CardTitle className="text-2xl">
              {portfolio?.avg_win && portfolio?.avg_loss 
                ? (portfolio.avg_win / portfolio.avg_loss).toFixed(2) 
                : 'N/A'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">
              Risk/Reward Ratio
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Tabs for Active and Closed Positions */}
      <Tabs defaultValue="active" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="active">
            Active Positions ({openTrades.length})
          </TabsTrigger>
          <TabsTrigger value="history">
            Trade History ({allTrades.filter(t => t.status === 'CLOSED').length})
          </TabsTrigger>
        </TabsList>
        
        {/* Active Positions */}
        <TabsContent value="active" className="space-y-4">
          {openTrades.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No active positions. Start by scanning for opportunities and entering paper trades.
              </CardContent>
            </Card>
          ) : (
            openTrades.map(trade => {
              const exitSignal = getExitSignalDisplay(trade.exit_signal);
              
              return (
                <Card key={trade.id} className="overflow-hidden">
                  <CardHeader className="pb-4">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-4">
                        <div>
                          <CardTitle className="text-xl flex items-center gap-2">
                            {trade.ticker}
                            <Badge variant={trade.signal === 'BUY' ? 'default' : 'destructive'}>
                              {trade.signal}
                            </Badge>
                          </CardTitle>
                          <CardDescription>
                            {trade.quantity} contracts @ ${trade.entry_price.toFixed(2)}
                          </CardDescription>
                        </div>
                        
                        {/* Traffic Light Exit Signal */}
                        <div className="flex items-center gap-2 ml-8">
                          <div className={`w-8 h-8 rounded-full ${exitSignal.color} flex items-center justify-center text-white animate-pulse`}>
                            {exitSignal.icon}
                          </div>
                          <div>
                            <div className="font-semibold">{exitSignal.text}</div>
                            <div className="text-xs text-muted-foreground">
                              {trade.exit_signal_reason || 'Monitoring...'}
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className="text-2xl font-bold">
                          {formatPnL(trade.current_pnl)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {formatPnL(trade.current_pnl_percent, true)}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-4">
                    {/* Position Details */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <div className="text-muted-foreground">Front Expiry</div>
                        <div className="font-medium">{trade.front_expiry}</div>
                        <div className="text-xs text-muted-foreground">
                          {trade.days_to_front_expiry} days
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Back Expiry</div>
                        <div className="font-medium">{trade.back_expiry}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Stock Price</div>
                        <div className="font-medium">
                          ${trade.stock_current_price?.toFixed(2) || trade.stock_entry_price.toFixed(2)}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Theta</div>
                        <div className="font-medium text-red-600">
                          ${trade.theta_decay?.toFixed(2) || '0.00'}
                        </div>
                      </div>
                    </div>
                    
                    {/* News Alerts */}
                    {trade.has_earnings_alert && (
                      <div className="bg-yellow-50 dark:bg-yellow-950 p-3 rounded-lg flex items-center gap-2">
                        <Newspaper className="w-4 h-4 text-yellow-600" />
                        <span className="text-sm">Earnings announcement detected</span>
                      </div>
                    )}
                    
                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <Button 
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedTradeId(trade.id)}
                      >
                        View News
                      </Button>
                      <Button 
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          const currentPrice = trade.current_price || trade.entry_price;
                          closePositionMutation.mutate({
                            id: trade.id,
                            exitPrice: currentPrice,
                            exitReason: 'Manual close'
                          });
                        }}
                      >
                        Close Position
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>
        
        {/* Trade History */}
        <TabsContent value="history" className="space-y-4">
          {allTrades.filter(t => t.status === 'CLOSED').length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No closed trades yet.
              </CardContent>
            </Card>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-2 text-left">Ticker</th>
                    <th className="px-4 py-2 text-left">Signal</th>
                    <th className="px-4 py-2 text-left">Entry Date</th>
                    <th className="px-4 py-2 text-left">Exit Date</th>
                    <th className="px-4 py-2 text-right">P&L</th>
                    <th className="px-4 py-2 text-right">Return</th>
                    <th className="px-4 py-2 text-left">Exit Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {allTrades
                    .filter(t => t.status === 'CLOSED')
                    .map(trade => (
                      <tr key={trade.id} className="border-t hover:bg-muted/30">
                        <td className="px-4 py-3 font-medium">{trade.ticker}</td>
                        <td className="px-4 py-3">
                          <Badge variant={trade.signal === 'BUY' ? 'default' : 'destructive'}>
                            {trade.signal}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {trade.entry_date && format(new Date(trade.entry_date), 'MMM d, yyyy')}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {trade.exit_date && format(new Date(trade.exit_date), 'MMM d, yyyy')}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {formatPnL(trade.realized_pnl)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {formatPnL(trade.realized_pnl_percent, true)}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {trade.exit_reason || 'N/A'}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>
      
      {/* News Modal (simplified) */}
      {selectedTradeId && tradeNews.length > 0 && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setSelectedTradeId(null)}>
          <Card className="w-full max-w-2xl max-h-[80vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <CardHeader>
              <CardTitle>Trade News & Events</CardTitle>
              <Button 
                size="sm" 
                variant="ghost" 
                className="absolute right-4 top-4"
                onClick={() => setSelectedTradeId(null)}
              >
                ✕
              </Button>
            </CardHeader>
            <CardContent>
              {/* News content would go here */}
              <p className="text-muted-foreground">No news events available.</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
    </>
  );
}