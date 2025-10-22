import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { InfoIcon, TrendingUp, TrendingDown } from "lucide-react";
import type { PaperTrade } from "@shared/schema";

interface EditPricesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trade: PaperTrade | null;
  onConfirm: (tradeId: number, data: {
    entry_price?: number;
    stock_entry_price?: number;
    front_strike?: number;
    back_strike?: number;
    stop_loss_price?: number;
    take_profit_price?: number;
  }) => void;
}

export function EditPricesDialog({ 
  open, 
  onOpenChange, 
  trade,
  onConfirm 
}: EditPricesDialogProps) {
  const [entryPrice, setEntryPrice] = useState<string>("");
  const [stockPrice, setStockPrice] = useState<string>("");
  const [frontStrike, setFrontStrike] = useState<string>("");
  const [backStrike, setBackStrike] = useState<string>("");
  const [stopLossPrice, setStopLossPrice] = useState<string>("");
  const [takeProfitPrice, setTakeProfitPrice] = useState<string>("");

  useEffect(() => {
    if (trade) {
      setEntryPrice(trade.entry_price.toString());
      setStockPrice(trade.stock_entry_price.toString());
      setFrontStrike(trade.front_strike.toString());
      setBackStrike(trade.back_strike.toString());
      setStopLossPrice(trade.stop_loss_price?.toString() || "");
      setTakeProfitPrice(trade.take_profit_price?.toString() || "");
    }
  }, [trade]);

  if (!trade) return null;

  const handleConfirm = () => {
    const data: any = {};
    
    // Only include changed values
    if (entryPrice && parseFloat(entryPrice) !== trade.entry_price) {
      data.entry_price = parseFloat(entryPrice);
    }
    if (stockPrice && parseFloat(stockPrice) !== trade.stock_entry_price) {
      data.stock_entry_price = parseFloat(stockPrice);
    }
    if (frontStrike && parseFloat(frontStrike) !== trade.front_strike) {
      data.front_strike = parseFloat(frontStrike);
    }
    if (backStrike && parseFloat(backStrike) !== trade.back_strike) {
      data.back_strike = parseFloat(backStrike);
    }
    if (stopLossPrice && parseFloat(stopLossPrice) !== trade.stop_loss_price) {
      data.stop_loss_price = parseFloat(stopLossPrice);
    }
    if (takeProfitPrice && parseFloat(takeProfitPrice) !== trade.take_profit_price) {
      data.take_profit_price = parseFloat(takeProfitPrice);
    }
    
    if (Object.keys(data).length > 0) {
      onConfirm(trade.id, data);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">Adjust Trade Prices</DialogTitle>
          <DialogDescription>
            Update prices to match your actual Moomoo trade execution
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Trade Summary */}
          <div className="bg-muted/50 p-4 rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">{trade.ticker}</span>
              <Badge variant={trade.signal === 'BUY' ? 'default' : 'destructive'} className="text-sm">
                {trade.signal === 'BUY' ? (
                  <TrendingUp className="mr-1 h-3 w-3" />
                ) : (
                  <TrendingDown className="mr-1 h-3 w-3" />
                )}
                {trade.signal}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Quantity:</span>
                <span className="ml-2 font-semibold">{trade.quantity} contracts</span>
              </div>
              <div>
                <span className="text-muted-foreground">Status:</span>
                <span className="ml-2 font-semibold">{trade.status}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Front Expiry:</span>
                <span className="ml-2">{new Date(trade.front_expiry).toLocaleDateString()}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Back Expiry:</span>
                <span className="ml-2">{new Date(trade.back_expiry).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          <Alert>
            <InfoIcon className="h-4 w-4" />
            <AlertDescription>
              Update these values to match the actual prices from your Moomoo execution.
              Leave unchanged if the current values are correct.
            </AlertDescription>
          </Alert>

          <Separator />

          {/* Entry Prices */}
          <div className="space-y-4">
            <h3 className="font-semibold">Entry Prices</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="entry-price">Net Debit/Credit</Label>
                <Input
                  id="entry-price"
                  type="number"
                  step="0.01"
                  value={entryPrice}
                  onChange={(e) => setEntryPrice(e.target.value)}
                  data-testid="input-edit-entry-price"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="stock-price">Stock Price at Entry</Label>
                <Input
                  id="stock-price"
                  type="number"
                  step="0.01"
                  value={stockPrice}
                  onChange={(e) => setStockPrice(e.target.value)}
                  data-testid="input-edit-stock-price"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Strike Prices */}
          <div className="space-y-4">
            <h3 className="font-semibold">Strike Prices</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="front-strike">Front Strike</Label>
                <Input
                  id="front-strike"
                  type="number"
                  step="1"
                  value={frontStrike}
                  onChange={(e) => setFrontStrike(e.target.value)}
                  data-testid="input-edit-front-strike"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="back-strike">Back Strike</Label>
                <Input
                  id="back-strike"
                  type="number"
                  step="1"
                  value={backStrike}
                  onChange={(e) => setBackStrike(e.target.value)}
                  data-testid="input-edit-back-strike"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Risk Management Prices */}
          <div className="space-y-4">
            <h3 className="font-semibold">Risk Management</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="stop-loss">Stop Loss Price</Label>
                <Input
                  id="stop-loss"
                  type="number"
                  step="0.01"
                  value={stopLossPrice}
                  onChange={(e) => setStopLossPrice(e.target.value)}
                  data-testid="input-edit-stop-loss"
                />
                <p className="text-xs text-muted-foreground">
                  Current: ${stopLossPrice}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="take-profit">Take Profit Price</Label>
                <Input
                  id="take-profit"
                  type="number"
                  step="0.01"
                  value={takeProfitPrice}
                  onChange={(e) => setTakeProfitPrice(e.target.value)}
                  data-testid="input-edit-take-profit"
                />
                <p className="text-xs text-muted-foreground">
                  Current: ${takeProfitPrice}
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} data-testid="button-save-prices">
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}