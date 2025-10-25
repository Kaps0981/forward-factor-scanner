import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { useAuth } from "@/hooks/useAuth";
import Scanner from "@/pages/Scanner";
import History from "@/pages/History";
import ScanDetail from "@/pages/ScanDetail";
import Watchlists from "@/pages/Watchlists";
import PaperTrading from "@/pages/PaperTrading";
import Landing from "@/pages/Landing";
import NotFound from "@/pages/not-found";
import { Loader2 } from "lucide-react";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  // Show loading spinner while checking auth
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Show landing page for unauthenticated users
  if (!isAuthenticated) {
    return <Landing />;
  }

  // Show authenticated routes
  return (
    <Switch>
      <Route path="/" component={Scanner} />
      <Route path="/history" component={History} />
      <Route path="/history/:id" component={ScanDetail} />
      <Route path="/watchlists" component={Watchlists} />
      <Route path="/paper-trading" component={PaperTrading} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
