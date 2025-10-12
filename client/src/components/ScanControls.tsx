import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Play } from "lucide-react";

interface ScanControlsProps {
  onScan: (params: {
    tickers?: string[];
    minFF: number;
    maxFF: number;
    topN: number;
  }) => void;
  isScanning: boolean;
}

export function ScanControls({ onScan, isScanning }: ScanControlsProps) {
  const [scanType, setScanType] = useState<"default" | "custom">("default");
  const [customTickers, setCustomTickers] = useState("");
  const [minFF, setMinFF] = useState(-100);
  const [maxFF, setMaxFF] = useState(100);
  const [topN, setTopN] = useState(20);

  const handleScan = () => {
    const tickers = scanType === "custom" && customTickers
      ? customTickers.split(",").map(t => t.trim().toUpperCase()).filter(Boolean)
      : undefined;

    onScan({ tickers, minFF, maxFF, topN });
  };

  return (
    <Card className="border-card-border">
      <CardContent className="p-6">
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold mb-4">Scan Configuration</h2>
            
            <Tabs value={scanType} onValueChange={(v) => setScanType(v as "default" | "custom")}>
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="default" data-testid="tab-default-stocks">
                  Default Stocks
                </TabsTrigger>
                <TabsTrigger value="custom" data-testid="tab-custom-tickers">
                  Custom Tickers
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="default" className="mt-0">
                <p className="text-sm text-muted-foreground">
                  Scan 100+ curated quality mid-cap stocks across multiple sectors
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
            </Tabs>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Forward Factor Range</Label>
                <span className="text-sm font-mono text-muted-foreground">
                  {minFF}% to {maxFF}%
                </span>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="min-ff" className="text-xs text-muted-foreground">
                    Minimum FF
                  </Label>
                  <Slider
                    id="min-ff"
                    min={-100}
                    max={0}
                    step={5}
                    value={[minFF]}
                    onValueChange={([v]) => setMinFF(v)}
                    data-testid="slider-min-ff"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max-ff" className="text-xs text-muted-foreground">
                    Maximum FF
                  </Label>
                  <Slider
                    id="max-ff"
                    min={0}
                    max={100}
                    step={5}
                    value={[maxFF]}
                    onValueChange={([v]) => setMaxFF(v)}
                    data-testid="slider-max-ff"
                  />
                </div>
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
