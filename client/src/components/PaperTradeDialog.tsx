import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { InfoIcon, TrendingUp, TrendingDown } from "lucide-react";
import type { Opportunity } from "@shared/schema";

interface PaperTradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opportunity: Opportunity | null;
  onConfirm: (data: {
    quantity: number;
    stop_loss_percent: number;
    take_profit_percent: number;
    use_actual_prices: boolean;
    actual_entry_price?: number;
    actual_stock_price?: number;
    actual_front_strike?: number;
    actual_back_strike?: number;
  }) => void;
}

export function PaperTradeDialog({ 
  open, 
  onOpenChange, 
  opportunity,
  onConfirm 
}: PaperTradeDialogProps) {
  const [quantity, setQuantity] = useState(1);
  const [stopLossPercent, setStopLossPercent] = useState(30);
  const [takeProfitPercent, setTakeProfitPercent] = useState(50);
  const [useActualPrices, setUseActualPrices] = useState(false);
  const [actualEntryPrice, setActualEntryPrice] = useState<string>("");
  const [actualStockPrice, setActualStockPrice] = useState<string>("");
  const [actualFrontStrike, setActualFrontStrike] = useState<string>("");
  const [actualBackStrike, setActualBackStrike] = useState<string>("");

  if (!opportunity) return null;

  const handleConfirm = () => {
    const data = {
      quantity,
      stop_loss_percent: stopLossPercent,
      take_profit_percent: takeProfitPercent,
      use_actual_prices: useActualPrices,
      ...(useActualPrices && {
        actual_entry_price: actualEntryPrice ? parseFloat(actualEntryPrice) : undefined,
        actual_stock_price: actualStockPrice ? parseFloat(actualStockPrice) : undefined,
        actual_front_strike: actualFrontStrike ? parseFloat(actualFrontStrike) : undefined,
        actual_back_strike: actualBackStrike ? parseFloat(actualBackStrike) : undefined,
      })
    };
    onConfirm(data);
  };

  const estimatedCost = quantity * 1.5; // Simplified estimate
  const maxRisk = estimatedCost;
  const maxProfit = estimatedCost * (takeProfitPercent / 100);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">Create Paper Trade</DialogTitle>
          <DialogDescription>
            Configure your paper trade for {opportunity.ticker}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Trade Summary */}
          <div className="bg-muted/50 p-4 rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">{opportunity.ticker}</span>
              <Badge variant={opportunity.signal === 'BUY' ? 'default' : 'destructive'} className="text-sm">
                {opportunity.signal === 'BUY' ? (
                  <TrendingUp className="mr-1 h-3 w-3" />
                ) : (
                  <TrendingDown className="mr-1 h-3 w-3" />
                )}
                {opportunity.signal}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Forward Factor:</span>
                <span className={`ml-2 font-semibold ${opportunity.forward_factor < 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {opportunity.forward_factor.toFixed(2)}%
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Expiries:</span>
                <span className="ml-2">{opportunity.front_dte}d / {opportunity.back_dte}d</span>
              </div>
              <div>
                <span className="text-muted-foreground">Front IV:</span>
                <span className="ml-2">{opportunity.front_iv.toFixed(1)}%</span>
              </div>
              <div>
                <span className="text-muted-foreground">Back IV:</span>
                <span className="ml-2">{opportunity.back_iv.toFixed(1)}%</span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Position Size */}
          <div className="space-y-4">
            <h3 className="font-semibold">Position Size</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity (Contracts)</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  max="100"
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                  data-testid="input-quantity"
                />
              </div>
              <div className="space-y-2">
                <Label>Estimated Cost</Label>
                <div className="h-9 px-3 py-2 bg-muted rounded-md flex items-center font-mono">
                  ${estimatedCost.toFixed(2)}
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Risk Management */}
          <div className="space-y-4">
            <h3 className="font-semibold">Risk Management</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="stop-loss">Stop Loss (%)</Label>
                <Input
                  id="stop-loss"
                  type="number"
                  min="10"
                  max="100"
                  value={stopLossPercent}
                  onChange={(e) => setStopLossPercent(parseInt(e.target.value) || 30)}
                  data-testid="input-stop-loss"
                />
                <p className="text-xs text-muted-foreground">
                  Max Loss: ${(maxRisk * (stopLossPercent / 100)).toFixed(2)}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="take-profit">Take Profit (%)</Label>
                <Input
                  id="take-profit"
                  type="number"
                  min="20"
                  max="500"
                  value={takeProfitPercent}
                  onChange={(e) => setTakeProfitPercent(parseInt(e.target.value) || 50)}
                  data-testid="input-take-profit"
                />
                <p className="text-xs text-muted-foreground">
                  Target Profit: ${maxProfit.toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Actual Prices (Optional) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Match Actual Trade Prices (Optional)</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setUseActualPrices(!useActualPrices)}
                data-testid="button-toggle-actual-prices"
              >
                {useActualPrices ? 'Hide' : 'Show'}
              </Button>
            </div>
            
            {useActualPrices && (
              <>
                <Alert>
                  <InfoIcon className="h-4 w-4" />
                  <AlertDescription>
                    Enter the actual prices from your Moomoo trade if they differ from the estimated prices.
                    Leave blank to use automatic estimates.
                  </AlertDescription>
                </Alert>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="actual-entry">Net Debit/Credit</Label>
                    <Input
                      id="actual-entry"
                      type="number"
                      step="0.01"
                      placeholder="e.g. 1.45"
                      value={actualEntryPrice}
                      onChange={(e) => setActualEntryPrice(e.target.value)}
                      data-testid="input-actual-entry"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="actual-stock">Stock Price</Label>
                    <Input
                      id="actual-stock"
                      type="number"
                      step="0.01"
                      placeholder="e.g. 250.50"
                      value={actualStockPrice}
                      onChange={(e) => setActualStockPrice(e.target.value)}
                      data-testid="input-actual-stock"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="actual-front-strike">Front Strike</Label>
                    <Input
                      id="actual-front-strike"
                      type="number"
                      step="1"
                      placeholder="e.g. 250"
                      value={actualFrontStrike}
                      onChange={(e) => setActualFrontStrike(e.target.value)}
                      data-testid="input-actual-front-strike"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="actual-back-strike">Back Strike</Label>
                    <Input
                      id="actual-back-strike"
                      type="number"
                      step="1"
                      placeholder="e.g. 250"
                      value={actualBackStrike}
                      onChange={(e) => setActualBackStrike(e.target.value)}
                      data-testid="input-actual-back-strike"
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} data-testid="button-create-trade">
            Create Paper Trade
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}