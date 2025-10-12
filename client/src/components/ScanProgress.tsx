import { Progress } from "@/components/ui/progress";
import { Loader2 } from "lucide-react";

interface ScanProgressProps {
  currentTicker?: string;
  progress: number;
  total: number;
}

export function ScanProgress({ currentTicker, progress, total }: ScanProgressProps) {
  const percentage = total > 0 ? Math.round((progress / total) * 100) : 0;

  return (
    <div className="border border-card-border rounded-lg p-6 space-y-3">
      <div className="flex items-center gap-3">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <div className="flex-1">
          <p className="text-sm font-medium">
            Scanning {currentTicker || "..."}
          </p>
          <p className="text-xs text-muted-foreground">
            {progress} of {total} tickers complete
          </p>
        </div>
        <span className="text-sm font-mono font-semibold tabular-nums">
          {percentage}%
        </span>
      </div>
      <Progress value={percentage} className="h-2" data-testid="progress-scan" />
    </div>
  );
}
