import { Activity, TrendingUp, Shield, Brain, Clock, BarChart3, ChevronRight, Github, Mail, Chrome } from "lucide-react";
import { SiX, SiApple } from "react-icons/si";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function Landing() {
  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container max-w-7xl mx-auto px-4 md:px-6 py-3 md:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-primary/10">
                <Activity className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">FFQuant</h1>
                <p className="text-sm text-muted-foreground">Research-based volatility mispricing detector</p>
              </div>
            </div>
            <Button 
              onClick={handleLogin}
              size="lg"
              data-testid="button-signin-header"
            >
              Sign In to Start Scanning
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-4 md:px-6 lg:px-8">
        <div className="container max-w-5xl mx-auto text-center">
          <Badge variant="outline" className="mb-4">
            Based on peer-reviewed quantitative research
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
            Detect Volatility Mispricing with
            <span className="text-primary"> Forward Factor Analysis</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-3xl mx-auto">
            FFQuant implements the Forward Factor strategy from institutional research, 
            scanning options markets to identify statistically significant volatility arbitrage opportunities.
          </p>
          <div className="space-y-4 max-w-md mx-auto">
            <p className="text-sm font-medium text-foreground mb-2">
              Choose your preferred sign-in method:
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Button 
                size="lg" 
                onClick={handleLogin}
                className="gap-2"
                data-testid="button-signin-google"
              >
                <Chrome className="h-5 w-5" />
                Google
              </Button>
              <Button 
                size="lg" 
                onClick={handleLogin}
                className="gap-2"
                data-testid="button-signin-github"
              >
                <Github className="h-5 w-5" />
                GitHub
              </Button>
              <Button 
                size="lg" 
                onClick={handleLogin}
                className="gap-2"
                data-testid="button-signin-x"
              >
                <SiX className="h-4 w-4" />
                X (Twitter)
              </Button>
              <Button 
                size="lg" 
                onClick={handleLogin}
                className="gap-2"
                data-testid="button-signin-apple"
              >
                <SiApple className="h-5 w-5" />
                Apple
              </Button>
            </div>
            <Button 
              size="lg" 
              onClick={handleLogin}
              variant="outline"
              className="gap-2 w-full"
              data-testid="button-signin-email"
            >
              <Mail className="h-5 w-5" />
              Sign In with Email
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mt-4">
            Free tier includes 10 scans per month • All login methods supported
          </p>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-16 px-4 md:px-6 lg:px-8 border-t">
        <div className="container max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Professional-Grade Options Analytics</h2>
            <p className="text-lg text-muted-foreground">
              Built on quantitative research and institutional trading methodologies
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="hover-elevate">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <TrendingUp className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Forward Factor Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Identifies volatility mispricing between calendar spreads using proven mathematical models. 
                  Detects when front month IV is overpriced relative to back month.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="hover-elevate">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Quality Filtering</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Advanced filters eliminate low-quality setups. Checks liquidity, open interest, 
                  bid-ask spreads, and applies Kelly Criterion for optimal position sizing.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="hover-elevate">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Brain className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Research-Based</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Based on OQuants research showing 70%+ win rates with proper filters. 
                  Implements exact specifications from institutional-grade analysis.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="hover-elevate">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Clock className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Real-Time Scanning</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Scans 100+ tickers in under 2 minutes using Polygon.io data. 
                  Analyzes entire option chains to find the best calendar spread opportunities.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="hover-elevate">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <BarChart3 className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Execution Guidance</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Provides specific strike prices, expiration dates, and position sizing. 
                  Includes warnings for earnings, low liquidity, and other risk factors.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="hover-elevate">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Activity className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Paper Trading</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Track hypothetical trades with exit timing signals. Monitor P&L, 
                  days to expiry, and receive alerts when positions need attention.
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Research Section */}
      <section className="py-16 px-4 md:px-6 lg:px-8 border-t">
        <div className="container max-w-5xl mx-auto">
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Based on Institutional Research</CardTitle>
              <CardDescription className="text-lg">
                The Forward Factor strategy has been validated through extensive backtesting
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-8 text-center">
                <div>
                  <p className="text-3xl font-bold text-primary">70%+</p>
                  <p className="text-sm text-muted-foreground">Historical Win Rate</p>
                  <p className="text-xs mt-2">With quality filters applied</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-primary">1.5+</p>
                  <p className="text-sm text-muted-foreground">Sharpe Ratio</p>
                  <p className="text-xs mt-2">Risk-adjusted returns</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-primary">20</p>
                  <p className="text-sm text-muted-foreground">Max Monthly Trades</p>
                  <p className="text-xs mt-2">Optimal frequency per research</p>
                </div>
              </div>
              <div className="mt-8 p-4 bg-muted rounded-lg">
                <p className="text-sm text-center">
                  <strong>Research Note:</strong> The Forward Factor strategy exploits the tendency for 
                  front-month implied volatility to be overpriced relative to back-month volatility, 
                  particularly in the 30-90 day timeframe where theta decay accelerates.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 md:px-6 lg:px-8 border-t">
        <div className="container max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">
            Start Finding Volatility Arbitrage Opportunities
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            Join professional traders using quantitative analysis to identify mispriced options
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              size="lg" 
              onClick={handleLogin}
              className="gap-2"
              data-testid="button-signin-cta"
            >
              Get Started with 10 Free Scans
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mt-6">
            No credit card required • Sign in with Google, GitHub, X, Apple, or Email
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 px-4 md:px-6 lg:px-8">
        <div className="container max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              <span className="font-semibold">FFQuant</span>
              <span className="text-sm text-muted-foreground">
                • Professional Options Analytics
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2025 FFQuant. Research-based trading tools.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}