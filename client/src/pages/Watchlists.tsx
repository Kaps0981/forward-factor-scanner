import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { type Watchlist } from "@shared/schema";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, Trash2, Play, ListPlus } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export default function Watchlists() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [newWatchlistOpen, setNewWatchlistOpen] = useState(false);
  const [newWatchlistName, setNewWatchlistName] = useState("");
  const [newWatchlistTickers, setNewWatchlistTickers] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const { data, isLoading } = useQuery<{ watchlists: Watchlist[] }>({
    queryKey: ["/api/watchlists"],
  });

  const createMutation = useMutation({
    mutationFn: async (watchlist: { name: string; tickers: string[] }) => {
      const response = await apiRequest("POST", "/api/watchlists", watchlist);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/watchlists"] });
      setNewWatchlistOpen(false);
      setNewWatchlistName("");
      setNewWatchlistTickers("");
      toast({
        title: "Watchlist Created",
        description: "Your watchlist has been saved successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Create Watchlist",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("DELETE", `/api/watchlists/${id}`);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/watchlists"] });
      setDeleteConfirmId(null);
      toast({
        title: "Watchlist Deleted",
        description: "Your watchlist has been removed",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Delete Watchlist",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCreateWatchlist = () => {
    const tickers = newWatchlistTickers
      .toUpperCase()
      .split(/[\s,]+/)
      .filter(t => t.length > 0)
      .map(t => t.trim());

    if (!newWatchlistName.trim()) {
      toast({
        title: "Name Required",
        description: "Please enter a name for your watchlist",
        variant: "destructive",
      });
      return;
    }

    if (tickers.length === 0) {
      toast({
        title: "Tickers Required",
        description: "Please enter at least one ticker symbol",
        variant: "destructive",
      });
      return;
    }

    createMutation.mutate({ name: newWatchlistName, tickers });
  };

  const handleScanWatchlist = (watchlist: Watchlist) => {
    const tickers = watchlist.tickers as string[];
    const tickerString = tickers.join(",");
    setLocation(`/?tickers=${encodeURIComponent(tickerString)}&watchlist=${encodeURIComponent(watchlist.name)}`);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header currentPage="watchlists" />
      
      <main className="container max-w-7xl mx-auto px-4 md:px-6 py-4 md:py-8 flex-1">
        <div className="space-y-4 md:space-y-6">
          {/* Page Title */}
          <div className="flex items-center gap-2 md:gap-3">
            <ListPlus className="h-5 w-5 md:h-6 md:w-6 text-primary" />
            <div>
              <h1 className="text-xl md:text-2xl font-semibold">Watchlists</h1>
              <p className="text-xs md:text-sm text-muted-foreground">Manage your saved ticker lists for quick scanning</p>
            </div>
          </div>

        {/* Create Watchlist Button */}
        <div className="mb-6">
          <Dialog open={newWatchlistOpen} onOpenChange={setNewWatchlistOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-watchlist">
                <Plus className="w-4 h-4 mr-2" />
                Create Watchlist
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Watchlist</DialogTitle>
                <DialogDescription>
                  Create a saved list of tickers to scan quickly without re-entering them
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="watchlist-name">Name</Label>
                  <Input
                    id="watchlist-name"
                    data-testid="input-watchlist-name"
                    placeholder="e.g., High Volatility Tech"
                    value={newWatchlistName}
                    onChange={(e) => setNewWatchlistName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="watchlist-tickers">Tickers</Label>
                  <Textarea
                    id="watchlist-tickers"
                    data-testid="input-watchlist-tickers"
                    placeholder="Enter tickers separated by commas or spaces (e.g., PLTR, SNOW, DDOG)"
                    value={newWatchlistTickers}
                    onChange={(e) => setNewWatchlistTickers(e.target.value)}
                    rows={4}
                  />
                  <p className="text-xs text-muted-foreground">
                    Tickers will be automatically uppercased and validated
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="ghost"
                  onClick={() => setNewWatchlistOpen(false)}
                  data-testid="button-cancel-create"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateWatchlist}
                  disabled={createMutation.isPending}
                  data-testid="button-save-watchlist"
                >
                  {createMutation.isPending ? "Creating..." : "Create Watchlist"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Watchlists Grid */}
        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading watchlists...</p>
          </div>
        ) : !data?.watchlists?.length ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <ListPlus className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Watchlists Yet</h3>
                <p className="text-muted-foreground mb-4">
                  Create your first watchlist to save ticker lists for quick scanning
                </p>
                <Button onClick={() => setNewWatchlistOpen(true)} data-testid="button-create-first">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Watchlist
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.watchlists.map((watchlist) => {
              const tickers = watchlist.tickers as string[];
              return (
                <Card key={watchlist.id} className="hover-elevate">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg" data-testid={`text-watchlist-name-${watchlist.id}`}>
                          {watchlist.name}
                        </CardTitle>
                        <CardDescription>
                          {tickers.length} ticker{tickers.length !== 1 ? "s" : ""}
                        </CardDescription>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteConfirmId(watchlist.id)}
                        data-testid={`button-delete-${watchlist.id}`}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-1 mb-4">
                      {tickers.slice(0, 10).map((ticker, idx) => (
                        <Badge key={idx} variant="secondary" className="font-mono text-xs">
                          {ticker}
                        </Badge>
                      ))}
                      {tickers.length > 10 && (
                        <Badge variant="outline" className="text-xs">
                          +{tickers.length - 10} more
                        </Badge>
                      )}
                    </div>
                    <Button
                      className="w-full"
                      onClick={() => handleScanWatchlist(watchlist)}
                      data-testid={`button-scan-${watchlist.id}`}
                    >
                      <Play className="w-4 h-4 mr-2" />
                      Scan Watchlist
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

          {/* Delete Confirmation Dialog */}
          <AlertDialog open={deleteConfirmId !== null} onOpenChange={() => setDeleteConfirmId(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Watchlist?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete this watchlist. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => deleteConfirmId && deleteMutation.mutate(deleteConfirmId)}
                  data-testid="button-confirm-delete"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </main>
      <Footer />
    </div>
  );
}
