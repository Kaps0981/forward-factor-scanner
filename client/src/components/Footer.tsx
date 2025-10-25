import { AlertTriangle } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-border bg-card/50 mt-auto">
      <div className="container max-w-7xl mx-auto px-4 md:px-6 py-4">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 text-center">
          <p className="text-xs text-muted-foreground">
            Built by a solo founder
          </p>
          <span className="hidden sm:inline text-xs text-muted-foreground">|</span>
          <p className="text-xs text-muted-foreground">
            Based on 18 years of backtested research
          </p>
        </div>
        <div className="flex items-center justify-center gap-2 mt-2">
          <AlertTriangle className="h-3 w-3 text-yellow-500" />
          <p className="text-xs text-muted-foreground">
            Not investment advice - Educational tool only
          </p>
        </div>
      </div>
    </footer>
  );
}