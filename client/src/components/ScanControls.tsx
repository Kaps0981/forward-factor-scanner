import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Play } from "lucide-react";

interface ScanControlsProps {
  onScan: (params: {
    tickers?: string[];
    minFF: number;
    maxFF: number;
    topN: number;
    minOpenInterest?: number;
    enableEmailAlerts?: boolean;
    useMarketCap?: boolean;
    minMarketCap?: number;
    maxMarketCap?: number;
  }) => void;
  isScanning: boolean;
  initialTickers?: string;
  watchlistName?: string;
}

export function ScanControls({ onScan, isScanning, initialTickers, watchlistName }: ScanControlsProps) {
  const [scanType, setScanType] = useState<"default" | "custom" | "marketcap">(initialTickers ? "custom" : "default");
  const [customTickers, setCustomTickers] = useState(initialTickers || "");
  const [minFF, setMinFF] = useState(-999999);
  const [maxFF, setMaxFF] = useState(999999);
  const [topN, setTopN] = useState(20);
  const [minOpenInterest, setMinOpenInterest] = useState(200);
  const [enableEmailAlerts, setEnableEmailAlerts] = useState(false);
  const [minMarketCap, setMinMarketCap] = useState(2);
  const [maxMarketCap, setMaxMarketCap] = useState(15);

  const handleScan = () => {
    const tickers = scanType === "custom" && customTickers
      ? customTickers.split(",").map(t => t.trim().toUpperCase()).filter(Boolean)
      : undefined;

    onScan({ 
      tickers, 
      minFF, 
      maxFF, 
      topN,
      minOpenInterest: minOpenInterest > 0 ? minOpenInterest : undefined,
      enableEmailAlerts,
      useMarketCap: scanType === "marketcap",
      minMarketCap: scanType === "marketcap" ? minMarketCap : undefined,
      maxMarketCap: scanType === "marketcap" ? maxMarketCap : undefined,
    });
  };

  return (
    <Card className="border-card-border">
      <CardContent className="p-6">
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold mb-4">Scan Configuration</h2>
            
            <Tabs value={scanType} onValueChange={(v) => setScanType(v as "default" | "custom" | "marketcap")}>
              <TabsList className="grid w-full grid-cols-3 mb-4">
                <TabsTrigger value="default" data-testid="tab-default-stocks">
                  Default Stocks
                </TabsTrigger>
                <TabsTrigger value="custom" data-testid="tab-custom-tickers">
                  Custom Tickers
                </TabsTrigger>
                <TabsTrigger value="marketcap" data-testid="tab-market-cap">
                  By Market Cap
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="default" className="mt-0">
                <p className="text-sm text-muted-foreground">
                  Scan 100 curated quality mid-cap stocks across multiple sectors
                </p>
              </TabsContent>
              
              <TabsContent value="custom" className="mt-0 space-y-2">
                <Label htmlFor="custom-tickers" className="text-sm font-medium">
                  Enter Tickers (comma-separated)
                </Label>
                <Input
                  id="custom-tickers"
                  placeholder="PLTR, ROKU, NET, ETSY, RIVN"
                  value={customTickers}
                  onChange={(e) => setCustomTickers(e.target.value)}
                  className="font-mono"
                  data-testid="input-custom-tickers"
                />
                <p className="text-xs text-muted-foreground">
                  Maximum 30 tickers per scan
                </p>
              </TabsContent>
              
              <TabsContent value="marketcap" className="mt-0 space-y-4">
                <p className="text-sm text-muted-foreground">
                  Scan stocks by market capitalization range (in billions)
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="min-cap" className="text-sm font-medium">
                      Min Market Cap ($B)
                    </Label>
                    <Input
                      id="min-cap"
                      type="number"
                      min="0.1"
                      max="1000"
                      step="0.5"
                      value={minMarketCap}
                      onChange={(e) => setMinMarketCap(Number(e.target.value))}
                      className="font-mono"
                      data-testid="input-min-market-cap"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="max-cap" className="text-sm font-medium">
                      Max Market Cap ($B)
                    </Label>
                    <Input
                      id="max-cap"
                      type="number"
                      min="0.1"
                      max="1000"
                      step="0.5"
                      value={maxMarketCap}
                      onChange={(e) => setMaxMarketCap(Number(e.target.value))}
                      className="font-mono"
                      data-testid="input-max-market-cap"
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Recommended: $2B - $15B for quality mid-cap stocks
                </p>
              </TabsContent>
            </Tabs>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Forward Factor Range</Label>
                <span className="text-sm font-mono text-muted-foreground">
                  No Limits Applied
                </span>
              </div>
              <div className="bg-muted/50 rounded-md p-3">
                <p className="text-xs text-muted-foreground">
                  ℹ️ FF percentage filtering has been removed. The scanner will find all opportunities regardless of FF magnitude.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Quality filters and IVR regime filtering are applied automatically to find the best trades.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="top-n" className="text-sm font-medium">
                  Top Results
                </Label>
                <span className="text-sm font-mono text-muted-foreground">
                  {topN}
                </span>
              </div>
              <Slider
                id="top-n"
                min={5}
                max={50}
                step={5}
                value={[topN]}
                onValueChange={([v]) => setTopN(v)}
                className="mt-2"
                data-testid="slider-top-n"
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="min-oi" className="text-sm font-medium">
                  Min Open Interest
                </Label>
                <span className="text-sm font-mono text-muted-foreground">
                  {minOpenInterest === 0 ? 'None' : minOpenInterest}
                </span>
              </div>
              <Slider
                id="min-oi"
                min={0}
                max={500}
                step={50}
                value={[minOpenInterest]}
                onValueChange={([v]) => setMinOpenInterest(v)}
                className="mt-2"
                data-testid="slider-min-oi"
              />
              <p className="text-xs text-muted-foreground">
                Filter by ATM option liquidity
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 border border-card-border rounded-lg">
            <div className="space-y-1">
              <Label htmlFor="email-alerts" className="text-sm font-medium">
                Email Notifications
              </Label>
              <p className="text-xs text-muted-foreground">
                Get alerts for high |FF| opportunities
              </p>
            </div>
            <Switch
              id="email-alerts"
              checked={enableEmailAlerts}
              onCheckedChange={setEnableEmailAlerts}
              data-testid="switch-email-alerts"
            />
          </div>

          <Button
            onClick={handleScan}
            disabled={isScanning || (scanType === "custom" && !customTickers.trim())}
            className="w-full"
            size="lg"
            data-testid="button-run-scan"
          >
            <Play className="mr-2 h-4 w-4" />
            {isScanning ? "Scanning..." : "Run Scan"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
