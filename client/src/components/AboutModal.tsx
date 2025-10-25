import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, AlertCircle, BookOpen, BarChart2 } from "lucide-react";

interface AboutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AboutModal({ open, onOpenChange }: AboutModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" />
            About FFQuant
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-6 mt-4">
              <p className="text-base">
                FFQuant is a research-based Forward Factor quantitative analysis tool built on 18 years of historical backtesting data.
              </p>

              <div className="bg-primary/5 rounded-lg p-4 space-y-3">
                <h3 className="font-semibold text-base flex items-center gap-2">
                  <BarChart2 className="h-4 w-4 text-primary" />
                  Validated Methodology
                </h3>
                <p className="text-sm text-muted-foreground">
                  The methodology implemented here has been validated to achieve:
                </p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-green-500" />
                    <span><strong>20% CAGR</strong> with proper position sizing</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-green-500" />
                    <span><strong>2.64 Sharpe ratio</strong> using optimal filters</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-green-500" />
                    <span><strong>53% win rate</strong> on calendar spreads</span>
                  </li>
                </ul>
              </div>

              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Built by a solo founder passionate about quantitative trading and options analysis.
                </p>
                <Badge variant="outline" className="text-xs">
                  Based on 18 years of backtested research
                </Badge>
              </div>

              <div className="border-t pt-4 space-y-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p className="font-semibold text-foreground">IMPORTANT DISCLAIMER:</p>
                    <p>
                      This is an analytical tool for educational purposes only. Not investment advice.
                    </p>
                    <p>
                      All trading decisions are your responsibility. Past performance does not guarantee future results.
                    </p>
                    <p>
                      Options trading involves substantial risk including possible loss of principal.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}