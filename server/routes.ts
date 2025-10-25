import type { Express } from "express";
import { createServer, type Server } from "http";
import { ForwardFactorScanner, DEFAULT_TICKERS } from "./scanner";
import { 
  scanRequestSchema, 
  insertWatchlistSchema, 
  createPaperTradeSchema,
  updatePaperTradeSchema,
  closePaperTradeSchema,
  updateExitSignalSchema
} from "@shared/schema";
import { storage } from "./storage";
import { PolygonService } from "./polygon";
import { sendHighFFAlert } from "./email";
import { analyzeOpportunityQuality, generateTradingThesis, calculatePositionSize, generateExecutionWarnings } from "./qualityFilters";
import { generateHTMLReport, generateMarkdownReport } from "./reportGenerator";
import { TradingCalendar } from "./tradingCalendar";
import { MarketCapFilter } from "./marketCapFilter";
import { FinancialEventsService } from "./financialEvents";
import { PayoffCalculator } from "./payoffCalculator";
import { NewsService } from "./newsService";
import { setupAuth, isAuthenticated } from "./replitAuth";

export async function registerRoutes(app: Express): Promise<Server> {
  const POLYGON_API_KEY = process.env.POLYGON_API_KEY;
  
  // Auth middleware - setup authentication first
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      api_key_configured: !!POLYGON_API_KEY,
    });
  });

  app.get("/api/default-tickers", (req, res) => {
    res.json({
      tickers: DEFAULT_TICKERS,
    });
  });

  // Get stocks by market cap (2-15B default)
  app.get("/api/stocks-by-market-cap", async (req, res) => {
    try {
      if (!POLYGON_API_KEY) {
        return res.status(500).json({
          error: "Polygon API key not configured",
        });
      }
      
      const minCap = parseFloat(req.query.min_cap as string || '2');
      const maxCap = parseFloat(req.query.max_cap as string || '15');
      const limit = parseInt(req.query.limit as string || '50');
      
      const marketCapFilter = new MarketCapFilter(POLYGON_API_KEY);
      const tickers = await marketCapFilter.getStocksByMarketCap(minCap, maxCap, limit);
      
      res.json({
        tickers,
        count: tickers.length,
        market_cap_range: `$${minCap}B - $${maxCap}B`
      });
    } catch (error) {
      console.error("Error fetching stocks by market cap:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to fetch stocks by market cap",
      });
    }
  });

  // Scan history endpoints
  app.get("/api/scans", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const scans = await storage.getAllScans(userId, limit);
      res.json({ scans });
    } catch (error) {
      console.error("Error fetching scans:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to fetch scans",
      });
    }
  });

  app.get("/api/scans/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const scanId = parseInt(req.params.id);
      const scan = await storage.getScan(scanId, userId);
      
      if (!scan) {
        return res.status(404).json({ error: "Scan not found" });
      }

      const opportunities = await storage.getOpportunitiesByScan(scanId, userId);
      
      res.json({
        scan,
        opportunities,
      });
    } catch (error) {
      console.error("Error fetching scan:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to fetch scan",
      });
    }
  });

  // Watchlist endpoints
  app.get("/api/watchlists", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const watchlists = await storage.getWatchlists(userId);
      res.json({ watchlists });
    } catch (error) {
      console.error("Error fetching watchlists:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to fetch watchlists",
      });
    }
  });

  app.post("/api/watchlists", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validationResult = insertWatchlistSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          error: "Invalid watchlist data",
          details: validationResult.error.errors,
        });
      }

      const watchlist = await storage.createWatchlist(validationResult.data, userId);
      res.json({ watchlist });
    } catch (error) {
      console.error("Error creating watchlist:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to create watchlist",
      });
    }
  });

  app.patch("/api/watchlists/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      
      const validationResult = insertWatchlistSchema.partial().safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          error: "Invalid watchlist data",
          details: validationResult.error.errors,
        });
      }
      
      const watchlist = await storage.updateWatchlist(id, validationResult.data, userId);
      
      if (!watchlist) {
        return res.status(404).json({ error: "Watchlist not found" });
      }

      res.json({ watchlist });
    } catch (error) {
      console.error("Error updating watchlist:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to update watchlist",
      });
    }
  });

  app.delete("/api/watchlists/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      await storage.deleteWatchlist(id, userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting watchlist:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to delete watchlist",
      });
    }
  });

  // Paper Trading Endpoints

  // Helper function to calculate exit timing signal
  function calculateExitSignal(trade: any): { signal: string; reason: string } {
    const daysToExpiry = trade.days_to_front_expiry || 0;
    const currentPnlPercent = trade.current_pnl_percent || 0;
    const stopLossPercent = -30; // Default 30% stop loss
    const takeProfitPercent = 50; // Default 50% take profit
    
    // Check stop loss
    if (currentPnlPercent <= stopLossPercent) {
      return {
        signal: 'STOP_LOSS',
        reason: `Stop loss triggered at ${currentPnlPercent.toFixed(2)}% loss`
      };
    }
    
    // Check take profit
    if (currentPnlPercent >= takeProfitPercent) {
      return {
        signal: 'TAKE_PROFIT',
        reason: `Take profit target reached at ${currentPnlPercent.toFixed(2)}% profit`
      };
    }
    
    // Check days to expiry
    if (daysToExpiry < 3) {
      return {
        signal: 'RED',
        reason: `Only ${daysToExpiry} days to front month expiry - exit immediately to avoid theta decay`
      };
    }
    
    if (daysToExpiry <= 7) {
      // Check if P&L is approaching targets
      if (currentPnlPercent < -20 || currentPnlPercent > 40) {
        return {
          signal: 'AMBER',
          reason: `${daysToExpiry} days to expiry with P&L at ${currentPnlPercent.toFixed(2)}% - consider exit`
        };
      }
      return {
        signal: 'AMBER',
        reason: `${daysToExpiry} days to expiry - monitor closely for exit opportunity`
      };
    }
    
    // Check for high theta decay (placeholder - would need actual calculation)
    if (trade.theta_decay && Math.abs(trade.theta_decay) > 0.1) {
      return {
        signal: 'AMBER',
        reason: `High theta decay of ${trade.theta_decay.toFixed(3)} - consider reducing position`
      };
    }
    
    // Default to GREEN
    return {
      signal: 'GREEN',
      reason: `Position is safe to hold - ${daysToExpiry} days to expiry with ${currentPnlPercent.toFixed(2)}% P&L`
    };
  }

  // Helper function to calculate current prices (simplified - would need actual pricing model)
  function calculateCurrentPrices(opportunity: any, stockPrice?: number) {
    // This is a simplified calculation - in production, you'd use proper options pricing
    const randomPnl = (Math.random() - 0.5) * 20; // Random P&L for demo
    const entryPrice = opportunity.entry_price || 1.5; // Use actual entry price if available
    const currentPrice = entryPrice * (1 + randomPnl / 100);
    const quantity = opportunity.quantity || 100; // Use actual quantity if available
    // Multiply by 100 for options contract multiplier (100 shares per contract)
    const currentPnl = (currentPrice - entryPrice) * quantity * 100;
    
    // Correct P&L percentage calculation: (current_pnl / (entry_price * quantity * 100)) * 100
    const currentPnlPercent = (currentPnl / (entryPrice * quantity * 100)) * 100;
    
    return {
      current_price: currentPrice,
      current_pnl: currentPnl,
      current_pnl_percent: currentPnlPercent,
      stock_current_price: stockPrice || 100,
      front_current_iv: opportunity.front_iv * (1 + (Math.random() - 0.5) * 0.1),
      back_current_iv: opportunity.back_iv * (1 + (Math.random() - 0.5) * 0.1),
    };
  }

  // 1. GET /api/paper-trades - Get all paper trades with optional status filter
  app.get("/api/paper-trades", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const status = req.query.status as string | undefined;
      const trades = await storage.getPaperTrades(userId, status);
      
      // Calculate exit signals for open trades
      const tradesWithSignals = trades.map(trade => {
        if (trade.status === 'OPEN') {
          const exitSignal = calculateExitSignal(trade);
          return {
            ...trade,
            exit_signal: trade.exit_signal || exitSignal.signal,
            exit_signal_reason: trade.exit_signal_reason || exitSignal.reason
          };
        }
        return trade;
      });
      
      res.json({ trades: tradesWithSignals });
    } catch (error) {
      console.error("Error fetching paper trades:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to fetch paper trades",
      });
    }
  });

  // 2. GET /api/paper-trades/open - Get only open positions
  app.get("/api/paper-trades/open", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const trades = await storage.getOpenPaperTrades(userId);
      
      // Calculate and add exit signals
      const tradesWithSignals = trades.map(trade => {
        const exitSignal = calculateExitSignal(trade);
        return {
          ...trade,
          exit_signal: trade.exit_signal || exitSignal.signal,
          exit_signal_reason: trade.exit_signal_reason || exitSignal.reason
        };
      });
      
      res.json({ trades: tradesWithSignals });
    } catch (error) {
      console.error("Error fetching open paper trades:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to fetch open paper trades",
      });
    }
  });

  // 3. GET /api/paper-trades/:id - Get specific trade details
  app.get("/api/paper-trades/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      const trade = await storage.getPaperTrade(id, userId);
      
      if (!trade) {
        return res.status(404).json({ error: "Paper trade not found" });
      }
      
      // Add exit signal if open
      if (trade.status === 'OPEN') {
        const exitSignal = calculateExitSignal(trade);
        return res.json({
          trade: {
            ...trade,
            exit_signal: trade.exit_signal || exitSignal.signal,
            exit_signal_reason: trade.exit_signal_reason || exitSignal.reason
          }
        });
      }
      
      res.json({ trade });
    } catch (error) {
      console.error("Error fetching paper trade:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to fetch paper trade",
      });
    }
  });

  // 4. POST /api/paper-trades - Create new paper trade from opportunity
  app.post("/api/paper-trades", isAuthenticated, async (req: any, res) => {
    try {
      const validationResult = createPaperTradeSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          error: "Invalid paper trade data",
          details: validationResult.error.errors,
        });
      }

      const { 
        opportunity, 
        quantity, 
        stop_loss_percent, 
        take_profit_percent, 
        use_actual_prices,
        actual_entry_price,
        actual_stock_price,
        actual_front_strike,
        actual_back_strike
      } = validationResult.data;
      
      // Calculate payoff analysis to get accurate entry price and max profit/loss
      const calculator = new PayoffCalculator();
      const payoffAnalysis = calculator.calculateCalendarSpreadPayoff(
        opportunity, 
        actual_stock_price
      );
      
      // Debug logging to understand the units from payoff analysis
      console.log("=== Paper Trade Creation Debug ===");
      console.log("Payoff Analysis Metrics:");
      console.log("  premium (netDebit):", payoffAnalysis.metrics.premium);
      console.log("  maxLoss:", payoffAnalysis.metrics.maxLoss);
      console.log("  maxProfit:", payoffAnalysis.metrics.maxProfit);
      console.log("  upperBreakeven:", payoffAnalysis.metrics.upperBreakeven);
      console.log("  lowerBreakeven:", payoffAnalysis.metrics.lowerBreakeven);
      console.log("Trade Parameters:");
      console.log("  quantity:", quantity);
      console.log("  signal:", opportunity.signal);
      
      // Use actual prices if provided, otherwise use calculated values from payoff analysis
      const entryPrice = actual_entry_price || payoffAnalysis.metrics.premium;
      const stockPrice = actual_stock_price || payoffAnalysis.currentStockPrice;
      const frontStrike = actual_front_strike || payoffAnalysis.strikePrice; // ATM
      const backStrike = actual_back_strike || payoffAnalysis.strikePrice; // ATM
      
      // Calculate stop loss and take profit prices based on entry price
      const stopLossPrice = entryPrice * (1 - stop_loss_percent / 100);
      const takeProfitPrice = entryPrice * (1 + take_profit_percent / 100);
      
      // Calculate days to expiry
      const frontExpiryDate = new Date(opportunity.front_date);
      const daysToFrontExpiry = Math.floor((frontExpiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      
      // IMPORTANT FIX: The values from payoffAnalysis.metrics are actually in dollars per share from Black-Scholes
      // But the payoff diagram expects per-contract values
      // We need to check and scale appropriately
      
      // Check if values need scaling - if they're less than 100, they're likely per-share
      // Otherwise they might already be per-contract
      const maxLossValue = payoffAnalysis.metrics.maxLoss;
      const maxProfitValue = typeof payoffAnalysis.metrics.maxProfit === 'string' 
        ? parseFloat(payoffAnalysis.metrics.maxProfit)
        : payoffAnalysis.metrics.maxProfit;
      
      // The values from Black-Scholes are in dollars per share
      // Convert to dollars per contract (* 100), then multiply by quantity
      const maxRisk = maxLossValue * 100 * quantity;
      const maxProfit = payoffAnalysis.metrics.maxProfit === 'Unlimited' 
        ? null 
        : maxProfitValue * 100 * quantity;
      
      console.log("Calculated Database Values:");
      console.log("  maxLoss from payoff (per share):", maxLossValue);
      console.log("  maxProfit from payoff (per share):", maxProfitValue);
      console.log("  max_risk (DB - total position):", maxRisk);
      console.log("  max_profit (DB - total position):", maxProfit);
      console.log("  Per contract values: maxLoss=$" + (maxLossValue * 100).toFixed(2) + ", maxProfit=$" + (maxProfitValue * 100).toFixed(2));
      console.log("==================");
      
      // Create paper trade with calculated values
      const userId = req.user.claims.sub;
      const paperTrade = await storage.createPaperTrade({
        ticker: opportunity.ticker,
        signal: opportunity.signal,
        status: 'OPEN',
        quantity: quantity || 1,
        front_strike: frontStrike,
        back_strike: backStrike,
        front_expiry: opportunity.front_date,
        back_expiry: opportunity.back_date,
        entry_price: entryPrice,
        front_entry_price: payoffAnalysis.metrics.premium, // Store the actual calculated premium
        back_entry_price: 0, // Will be calculated if needed
        front_entry_iv: opportunity.front_iv,
        back_entry_iv: opportunity.back_iv,
        stock_entry_price: stockPrice,
        current_price: entryPrice,
        current_pnl: 0,
        current_pnl_percent: 0,
        stock_current_price: stockPrice,
        front_current_iv: opportunity.front_iv,
        back_current_iv: opportunity.back_iv,
        stop_loss_price: stopLossPrice,
        take_profit_price: takeProfitPrice,
        max_risk: maxRisk,
        max_profit: maxProfit,
        forward_factor: opportunity.forward_factor,
        original_scan_id: null,
        days_to_front_expiry: daysToFrontExpiry,
        theta_decay: 0,
      }, userId);
      
      // Calculate initial exit signal
      const exitSignal = calculateExitSignal(paperTrade);
      
      // Update with exit signal
      const updatedTrade = await storage.updatePaperTrade(paperTrade.id, {
        exit_signal: exitSignal.signal,
        exit_signal_reason: exitSignal.reason
      }, userId);
      
      res.json({ 
        success: true,
        trade: updatedTrade || paperTrade 
      });
    } catch (error) {
      console.error("Error creating paper trade:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to create paper trade",
      });
    }
  });

  // 5. PATCH /api/paper-trades/:id - Update trade (current prices, P&L, exit signals)
  app.patch("/api/paper-trades/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      
      const validationResult = updatePaperTradeSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          error: "Invalid update data",
          details: validationResult.error.errors,
        });
      }
      
      // Update days to expiry if not provided
      if (!validationResult.data.days_to_front_expiry) {
        const trade = await storage.getPaperTrade(id, userId);
        if (trade && trade.front_expiry) {
          const frontExpiryDate = new Date(trade.front_expiry);
          const daysToFrontExpiry = Math.floor((frontExpiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          validationResult.data.days_to_front_expiry = daysToFrontExpiry;
        }
      }
      
      const updatedTrade = await storage.updatePaperTrade(id, validationResult.data, userId);
      
      if (!updatedTrade) {
        return res.status(404).json({ error: "Paper trade not found" });
      }
      
      // Recalculate exit signal if trade is still open
      if (updatedTrade.status === 'OPEN') {
        const exitSignal = calculateExitSignal(updatedTrade);
        const tradeWithSignal = await storage.updatePaperTradeExitSignal(id, exitSignal.signal, exitSignal.reason, userId);
        return res.json({ trade: tradeWithSignal || updatedTrade });
      }
      
      res.json({ trade: updatedTrade });
    } catch (error) {
      console.error("Error updating paper trade:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to update paper trade",
      });
    }
  });

  // 6. POST /api/paper-trades/:id/close - Close a trade
  app.post("/api/paper-trades/:id/close", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      
      const validationResult = closePaperTradeSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          error: "Invalid close data",
          details: validationResult.error.errors,
        });
      }
      
      const { exit_price, exit_reason } = validationResult.data;
      
      const closedTrade = await storage.closePaperTrade(id, exit_price, exit_reason, userId);
      
      if (!closedTrade) {
        return res.status(404).json({ error: "Paper trade not found" });
      }
      
      // Update portfolio summary
      await storage.calculatePortfolioMetrics();
      
      res.json({ 
        success: true,
        trade: closedTrade 
      });
    } catch (error) {
      console.error("Error closing paper trade:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to close paper trade",
      });
    }
  });

  // 6.5 PATCH /api/paper-trades/:id/prices - Update trade prices
  app.patch("/api/paper-trades/:id/prices", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      
      // Get the existing trade first
      const existingTrade = await storage.getPaperTrade(id, userId);
      if (!existingTrade) {
        return res.status(404).json({ error: "Paper trade not found" });
      }
      
      // Log incoming price update request
      console.log("=== PATCH /api/paper-trades/:id/prices - Price Update Request ===");
      console.log("Trade ID:", id);
      console.log("Request body:", req.body);
      console.log("Existing trade prices:");
      console.log("  entry_price:", existingTrade.entry_price);
      console.log("  front_entry_price:", existingTrade.front_entry_price);
      console.log("  back_entry_price:", existingTrade.back_entry_price);
      
      // Update the prices - validate and parse the input
      const updateData: any = {};
      
      // Handle direct entry_price update (net debit/credit)
      if (req.body.entry_price !== undefined) {
        const parsedPrice = parseFloat(req.body.entry_price);
        if (!isNaN(parsedPrice) && parsedPrice >= 0) {
          updateData.entry_price = parsedPrice;
          console.log("Updating entry_price to:", parsedPrice);
          
          // Also update front/back entry prices proportionally if not provided
          // This maintains the spread ratio while adjusting to the new net price
          if (req.body.front_entry_price === undefined && req.body.back_entry_price === undefined) {
            const currentSpread = Math.abs(existingTrade.front_entry_price - existingTrade.back_entry_price);
            if (currentSpread > 0) {
              const ratio = parsedPrice / currentSpread;
              updateData.front_entry_price = existingTrade.front_entry_price * ratio;
              updateData.back_entry_price = existingTrade.back_entry_price * ratio;
              console.log("Proportionally updating front/back prices:");
              console.log("  front_entry_price:", updateData.front_entry_price);
              console.log("  back_entry_price:", updateData.back_entry_price);
            }
          }
        }
      }
      
      // Handle individual option price updates
      if (req.body.front_entry_price !== undefined) {
        const parsedPrice = parseFloat(req.body.front_entry_price);
        if (!isNaN(parsedPrice) && parsedPrice >= 0) {
          updateData.front_entry_price = parsedPrice;
          console.log("Updating front_entry_price to:", parsedPrice);
        }
      }
      if (req.body.back_entry_price !== undefined) {
        const parsedPrice = parseFloat(req.body.back_entry_price);
        if (!isNaN(parsedPrice) && parsedPrice >= 0) {
          updateData.back_entry_price = parsedPrice;
          console.log("Updating back_entry_price to:", parsedPrice);
        }
      }
      
      // Handle stock price update
      if (req.body.stock_entry_price !== undefined) {
        const parsedPrice = parseFloat(req.body.stock_entry_price);
        if (!isNaN(parsedPrice) && parsedPrice > 0) {
          updateData.stock_entry_price = parsedPrice;
        }
      }
      
      // Handle risk management prices
      if (req.body.stop_loss_price !== undefined) {
        const parsedPrice = parseFloat(req.body.stop_loss_price);
        if (!isNaN(parsedPrice) && parsedPrice >= 0) {
          updateData.stop_loss_price = parsedPrice;
        }
      }
      if (req.body.take_profit_price !== undefined) {
        const parsedPrice = parseFloat(req.body.take_profit_price);
        if (!isNaN(parsedPrice) && parsedPrice >= 0) {
          updateData.take_profit_price = parsedPrice;
        }
      }
      
      // Recalculate entry price if front/back prices were updated individually
      // (but not if entry_price was already set directly)
      if (updateData.entry_price === undefined && 
          (updateData.front_entry_price !== undefined || updateData.back_entry_price !== undefined)) {
        const frontPrice = updateData.front_entry_price !== undefined ? updateData.front_entry_price : existingTrade.front_entry_price;
        const backPrice = updateData.back_entry_price !== undefined ? updateData.back_entry_price : existingTrade.back_entry_price;
        
        // For BUY signal: pay net debit (front - back)
        // For SELL signal: receive net credit (back - front)
        updateData.entry_price = existingTrade.signal === 'BUY' 
          ? Math.abs(frontPrice - backPrice)
          : Math.abs(backPrice - frontPrice);
        
        console.log("Recalculated entry_price based on leg prices:");
        console.log("  Signal:", existingTrade.signal);
        console.log("  Front price:", frontPrice);
        console.log("  Back price:", backPrice);
        console.log("  Calculated entry_price:", updateData.entry_price);
      }
      
      console.log("Final update data:", updateData);
      
      const updatedTrade = await storage.updatePaperTrade(id, updateData, userId);
      
      if (!updatedTrade) {
        return res.status(404).json({ error: "Failed to update trade" });
      }
      
      console.log("Trade successfully updated. New values:");
      console.log("  entry_price:", updatedTrade.entry_price);
      console.log("  front_entry_price:", updatedTrade.front_entry_price);
      console.log("  back_entry_price:", updatedTrade.back_entry_price);
      console.log("=== End Price Update ===\n");
      
      res.json({ 
        success: true,
        trade: updatedTrade 
      });
    } catch (error) {
      console.error("Error updating paper trade prices:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to update prices",
      });
    }
  });

  // 7. POST /api/paper-trades/:id/update-signal - Update exit timing signal
  app.post("/api/paper-trades/:id/update-signal", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      
      const validationResult = updateExitSignalSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          error: "Invalid signal data",
          details: validationResult.error.errors,
        });
      }
      
      const { signal, reason } = validationResult.data;
      
      const updatedTrade = await storage.updatePaperTradeExitSignal(id, signal, reason, userId);
      
      if (!updatedTrade) {
        return res.status(404).json({ error: "Paper trade not found" });
      }
      
      res.json({ 
        success: true,
        trade: updatedTrade 
      });
    } catch (error) {
      console.error("Error updating exit signal:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to update exit signal",
      });
    }
  });

  // 8. DELETE /api/paper-trades/:id - Delete a paper trade
  app.delete("/api/paper-trades/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      
      // Check if trade exists
      const trade = await storage.getPaperTrade(id, userId);
      if (!trade) {
        return res.status(404).json({ error: "Paper trade not found" });
      }
      
      // Delete the trade
      await storage.deletePaperTrade(id, userId);
      
      // Recalculate portfolio metrics after deletion
      await storage.calculatePortfolioMetrics();
      
      res.json({ success: true, message: "Paper trade deleted successfully" });
    } catch (error) {
      console.error("Error deleting paper trade:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to delete paper trade",
      });
    }
  });

  // 9. GET /api/paper-trades/:id/news - Get news events and analysis for a trade
  app.get("/api/paper-trades/:id/news", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      
      // Get the trade details
      const trade = await storage.getPaperTrade(id, userId);
      if (!trade) {
        return res.status(404).json({ error: "Paper trade not found" });
      }
      
      // Initialize news service
      const newsService = new NewsService(POLYGON_API_KEY);
      
      // Analyze news impact for this specific trade
      const newsAnalysis = await newsService.analyzeNewsImpact(
        trade.ticker,
        trade.signal as 'BUY' | 'SELL',
        trade.front_expiry,
        trade.back_expiry
      );
      
      // Get market-wide news that could affect position
      const marketNews = await newsService.getMarketNews();
      
      // Store significant news events in database
      if (newsAnalysis.overall_sentiment !== 'neutral') {
        await storage.createTradeNewsEvent({
          ticker: trade.ticker,
          trade_id: id,
          event_type: newsAnalysis.overall_sentiment === 'positive' ? 'favorable_news' : 'unfavorable_news',
          headline: newsAnalysis.impact_assessment.substring(0, 200),
          impact_score: newsAnalysis.overall_sentiment === 'positive' ? 8 : 3,
        });
      }
      
      res.json({ 
        news_analysis: newsAnalysis,
        market_news: marketNews,
        impact_summary: {
          whats_working: newsAnalysis.key_favorable,
          whats_not_working: newsAnalysis.key_unfavorable,
          overall_assessment: newsAnalysis.impact_assessment,
          recommendation: newsAnalysis.overall_sentiment === 'negative' 
            ? "Consider reducing position or tightening stops" 
            : newsAnalysis.overall_sentiment === 'positive'
            ? "News flow supports position - maintain or consider adding"
            : "Continue monitoring - no immediate action needed"
        }
      });
    } catch (error) {
      console.error("Error fetching trade news:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to fetch trade news",
      });
    }
  });

  // 9. GET /api/portfolio-summary - Get overall portfolio P&L summary
  app.get("/api/portfolio-summary", isAuthenticated, async (req: any, res) => {
    try {
      const summary = await storage.getPortfolioSummary();
      
      if (!summary) {
        // Create initial portfolio summary
        const newSummary = await storage.calculatePortfolioMetrics();
        return res.json({ summary: newSummary });
      }
      
      res.json({ summary });
    } catch (error) {
      console.error("Error fetching portfolio summary:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to fetch portfolio summary",
      });
    }
  });

  // 10. POST /api/paper-trades/update-all-prices - Update current prices for all open trades
  app.post("/api/paper-trades/update-all-prices", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const openTrades = await storage.getOpenPaperTrades(userId);
      
      if (openTrades.length === 0) {
        return res.json({ 
          success: true,
          message: "No open trades to update",
          updated_count: 0 
        });
      }
      
      const updatePromises = openTrades.map(async (trade) => {
        // Calculate days to expiry
        const frontExpiryDate = new Date(trade.front_expiry);
        const daysToFrontExpiry = Math.floor((frontExpiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        
        // Calculate current prices (simplified - would use actual pricing model)
        const currentPrices = calculateCurrentPrices({
          front_iv: trade.front_entry_iv,
          back_iv: trade.back_entry_iv
        }, trade.stock_current_price || trade.stock_entry_price);
        
        // Calculate theta decay (simplified)
        const thetaDecay = daysToFrontExpiry < 10 ? -0.05 * (10 - daysToFrontExpiry) : -0.01;
        
        // Update trade with new prices
        const updateData = {
          ...currentPrices,
          days_to_front_expiry: daysToFrontExpiry,
          theta_decay: thetaDecay
        };
        
        const updatedTrade = await storage.updatePaperTrade(trade.id, updateData);
        
        // Update exit signal
        if (updatedTrade) {
          const exitSignal = calculateExitSignal(updatedTrade);
          await storage.updatePaperTradeExitSignal(trade.id, exitSignal.signal, exitSignal.reason);
        }
        
        return updatedTrade;
      });
      
      const updatedTrades = await Promise.all(updatePromises);
      
      // Recalculate portfolio metrics
      await storage.calculatePortfolioMetrics();
      
      res.json({ 
        success: true,
        updated_count: updatedTrades.length,
        trades: updatedTrades 
      });
    } catch (error) {
      console.error("Error updating all prices:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to update prices",
      });
    }
  });

  // Market status endpoint
  app.get("/api/market-status", (req, res) => {
    const status = TradingCalendar.getMarketStatus();
    res.json(status);
  });

  // Payoff calculation endpoint
  app.post("/api/payoff-analysis", (req, res) => {
    try {
      const opportunity = req.body.opportunity;
      const currentStockPrice = req.body.currentStockPrice;
      
      if (!opportunity) {
        return res.status(400).json({
          error: "Opportunity data is required",
        });
      }

      const calculator = new PayoffCalculator();
      // Use calendar spread calculation for Forward Factor trades
      // The Forward Factor strategy is a calendar spread (sell front, buy back)
      const payoffAnalysis = calculator.calculateCalendarSpreadPayoff(opportunity, currentStockPrice);
      
      res.json(payoffAnalysis);
    } catch (error) {
      console.error("Error calculating payoff analysis:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to calculate payoff analysis",
      });
    }
  });

  // Generate report for a specific scan
  app.get("/api/scans/:id/report", async (req, res) => {
    try {
      const scanId = parseInt(req.params.id);
      const format = req.query.format === 'markdown' ? 'markdown' : 'html';
      
      // Get scan data
      const scan = await storage.getScan(scanId);
      if (!scan) {
        return res.status(404).json({ error: "Scan not found" });
      }
      
      // Get opportunities for this scan
      const opportunities = await storage.getOpportunitiesByScan(scanId);
      
      // Re-run quality analysis for the report
      const analyzedOpportunities = opportunities.map(storedOpp => {
        const opp: any = {
          ticker: storedOpp.ticker,
          forward_factor: storedOpp.forward_factor,
          signal: storedOpp.signal as 'BUY' | 'SELL',
          front_date: storedOpp.front_date,
          front_dte: storedOpp.front_dte,
          front_iv: storedOpp.front_iv,
          back_date: storedOpp.back_date,
          back_dte: storedOpp.back_dte,
          back_iv: storedOpp.back_iv,
          forward_vol: storedOpp.forward_vol,
          avg_open_interest: storedOpp.avg_open_interest,
          has_earnings_soon: storedOpp.has_earnings_soon === 'true',
        };
        
        const analysis = analyzeOpportunityQuality(opp);
        // Removed calculatePositionSize - using kelly_sizing_recommendation instead
        const warnings = generateExecutionWarnings(opp);
        
        return {
          ...opp,
          quality_score: analysis.rating,
          is_quality: analysis.isQuality,
          probability: analysis.probability,
          risk_reward: analysis.riskReward,
          rejection_reasons: analysis.rejectionReasons,
          // Position sizing handled by kelly_sizing_recommendation from quality filters
          execution_warnings: warnings,
        };
      });
      
      // Separate quality from rejected
      const qualitySetups = analyzedOpportunities.filter((opp: any) => opp.is_quality === true);
      const rejectedSetups = analyzedOpportunities.filter((opp: any) => opp.is_quality === false);
      
      // Generate report
      const report = format === 'markdown'
        ? generateMarkdownReport({ scan, opportunities: analyzedOpportunities, qualitySetups, rejectedSetups })
        : generateHTMLReport({ scan, opportunities: analyzedOpportunities, qualitySetups, rejectedSetups });
      
      // Set appropriate content type
      const contentType = format === 'markdown' ? 'text/markdown' : 'text/html';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `inline; filename="scan_${scanId}_report.${format === 'markdown' ? 'md' : 'html'}"`);
      
      res.send(report);
    } catch (error) {
      console.error("Error generating report:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to generate report",
      });
    }
  });

  app.post("/api/scan", isAuthenticated, async (req: any, res) => {
    try {
      if (!POLYGON_API_KEY) {
        return res.status(500).json({
          error: "Polygon API key not configured",
        });
      }

      // Get user ID from authenticated session
      const userId = req.user.claims.sub;
      
      // Check and reset monthly scans if needed
      const user = await storage.checkAndResetMonthlyScans(userId);
      
      // Check scan limits
      const scanLimit = await storage.getUserScanLimit(userId);
      if (scanLimit !== -1 && user.scansThisMonth >= scanLimit) {
        return res.status(403).json({
          error: `Scan limit reached. You have used ${user.scansThisMonth} of ${scanLimit} scans this month.`,
          scansUsed: user.scansThisMonth,
          scanLimit: scanLimit,
          subscriptionTier: user.subscriptionTier,
        });
      }

      const validationResult = scanRequestSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          error: "Invalid request parameters",
          details: validationResult.error.errors,
        });
      }

      const { tickers, min_ff, max_ff, top_n, min_open_interest, enable_email_alerts, strategy_type, max_monthly_trades, dte_strategy, ff_calculation_mode } = validationResult.data;
      
      // Check if we should use market cap filtering
      const useMarketCap = req.body.use_market_cap === true;
      let tickersToScan: string[];
      
      if (tickers && tickers.length > 0) {
        // Use provided tickers
        tickersToScan = tickers;
      } else if (useMarketCap) {
        // Get stocks by market cap (2-15B)
        const marketCapFilter = new MarketCapFilter(POLYGON_API_KEY);
        const minCap = req.body.min_market_cap || 2;
        const maxCap = req.body.max_market_cap || 15;
        tickersToScan = await marketCapFilter.getStocksByMarketCap(minCap, maxCap, 50);
        console.log(`Using ${tickersToScan.length} stocks with market cap $${minCap}B-$${maxCap}B`);
      } else {
        // Use default tickers
        tickersToScan = DEFAULT_TICKERS;
      }
      // Convert large values to Infinity for unlimited scanning
      const minFF = min_ff === null || min_ff === undefined || min_ff <= -999999 ? -Infinity : min_ff;
      const maxFF = max_ff === null || max_ff === undefined || max_ff >= 999999 ? Infinity : max_ff;
      const topN = top_n ?? 20;
      const minOI = min_open_interest ?? 200; // Default to 200 for high liquidity

      const scanner = new ForwardFactorScanner(POLYGON_API_KEY);
      const polygonService = new PolygonService(POLYGON_API_KEY);
      const eventsService = new FinancialEventsService(POLYGON_API_KEY);
      
      const opportunities = await scanner.scanMultiple(
        tickersToScan.slice(0, 100),
        minFF,
        maxFF,
        dte_strategy || '30-90',
        ff_calculation_mode || 'raw',
        (current, total, ticker) => {
          console.log(`Scanning progress: ${ticker} (${current}/${total})`);
        }
      );

      // Apply quality filters with strategy type (this also handles liquidity filtering)
      const qualityFilteredOpportunities = scanner.applyQualityFilters(opportunities, strategy_type);
      
      // Additional filtering by min_open_interest if specified (backward compatibility)
      const filteredOpportunities = minOI > 0 
        ? qualityFilteredOpportunities.filter(opp => {
            // Use straddle_oi if available, fallback to avg_open_interest
            const oi = opp.straddle_oi !== undefined ? opp.straddle_oi : (opp.avg_open_interest || 0);
            return oi >= minOI;
          })
        : qualityFilteredOpportunities;

      // Check for earnings in parallel (batch unique tickers)
      const uniqueTickers = Array.from(new Set(filteredOpportunities.map(opp => opp.ticker)));
      const earningsChecks = await Promise.all(
        uniqueTickers.map(async ticker => {
          const hasEarnings = await polygonService.checkEarningsSoon(ticker, 7);
          return { ticker, hasEarnings };
        })
      );
      
      const earningsMap = new Map(earningsChecks.map(e => [e.ticker, e.hasEarnings]));
      
      // Check for financial events for each opportunity
      const opportunitiesWithEvents = await Promise.all(
        filteredOpportunities.map(async (opp) => {
          const events = await eventsService.checkFinancialEvents(
            opp.ticker,
            opp.front_date,
            opp.back_date
          );
          return { ...opp, ...events };
        })
      );
      
      // Add earnings flag and other analysis to opportunities
      const opportunitiesWithAnalysis = opportunitiesWithEvents.map(opp => {
        // Calculate days to earnings
        const today = new Date();
        let daysToEarnings: number | null = null;
        let earningsEstimated = false;
        
        if (opp.earnings_date && opp.earnings_date !== null) {
          const earningsDate = new Date(opp.earnings_date);
          daysToEarnings = Math.ceil((earningsDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          // Assume all earnings dates are estimated for now (could be improved with API data)
          earningsEstimated = true;
        }
        
        const oppWithEarnings = {
          ...opp,
          has_earnings_soon: earningsMap.get(opp.ticker) || false,
          // Convert null to undefined for earnings_date
          earnings_date: opp.earnings_date === null ? undefined : opp.earnings_date,
          days_to_earnings: daysToEarnings,
          earnings_estimated: earningsEstimated,
        };
        
        // Run additional quality analysis (for probability and risk/reward)
        const analysis = analyzeOpportunityQuality(oppWithEarnings);
        
        // Generate execution warnings
        const warnings = generateExecutionWarnings(oppWithEarnings);
        
        // Merge with quality filter results (quality_score from applyQualityFilters takes precedence)
        return {
          ...oppWithEarnings,
          // Keep the quality_score from applyQualityFilters, only add missing fields
          probability: analysis.probability,
          risk_reward: analysis.riskReward,
          rejection_reasons: opp.quality_score === 0 ? ['Below minimum |FF| threshold'] : analysis.rejectionReasons,
          // Use kelly_sizing_recommendation instead of numeric position size
          // kelly_sizing_recommendation already contains "Quarter Kelly", "Half Kelly", or "Minimum position"
          execution_warnings: warnings,
        };
      });

      // Sort by quality first, then by |FF|
      const sortedOpportunities = opportunitiesWithAnalysis.sort((a, b) => {
        // Quality setups first
        if (a.is_quality !== b.is_quality) {
          return a.is_quality ? -1 : 1;
        }
        // Then by quality score
        if (a.quality_score !== b.quality_score) {
          return (b.quality_score ?? 0) - (a.quality_score ?? 0);
        }
        // Finally by |FF|
        return Math.abs(b.forward_factor) - Math.abs(a.forward_factor);
      });

      // Apply monthly trade frequency limit (~20 trades/month based on research)
      // This limits the number of opportunities to manage risk and focus on highest quality setups
      const monthlyLimit = max_monthly_trades || 20;
      const frequencyLimitedOpportunities = sortedOpportunities.slice(0, monthlyLimit);

      const limitedOpportunities = frequencyLimitedOpportunities.slice(0, topN);

      // Save scan to database
      const scan = await storage.createScan({
        tickers_scanned: Math.min(tickersToScan.length, 100),
        total_opportunities: limitedOpportunities.length,
        min_ff: minFF,
        max_ff: maxFF,
        top_n: topN,
        tickers_list: tickersToScan.slice(0, 100),
      });

      // Save opportunities to database
      if (limitedOpportunities.length > 0) {
        // Log to verify volumes are present
        console.log(`Saving ${limitedOpportunities.length} opportunities with volumes:`, 
          limitedOpportunities.slice(0, 3).map(o => ({
            ticker: o.ticker,
            front_volume: o.front_volume,
            back_volume: o.back_volume
          }))
        );
        
        const opportunityRecords = limitedOpportunities.map(opp => ({
          scan_id: scan.id,
          ticker: opp.ticker,
          forward_factor: opp.forward_factor,
          signal: opp.signal,
          front_date: opp.front_date,
          front_dte: opp.front_dte,
          front_iv: opp.front_iv,
          back_date: opp.back_date,
          back_dte: opp.back_dte,
          back_iv: opp.back_iv,
          forward_vol: opp.forward_vol,
          avg_open_interest: opp.avg_open_interest,
          has_earnings_soon: opp.has_earnings_soon ? 'true' : 'false',
          // Front month straddle liquidity fields
          atm_call_oi: opp.atm_call_oi,
          atm_put_oi: opp.atm_put_oi,
          straddle_oi: opp.straddle_oi,
          oi_put_call_ratio: opp.oi_put_call_ratio,
          liquidity_score: opp.liquidity_score,
          // Back month straddle liquidity fields
          back_atm_call_oi: opp.back_atm_call_oi,
          back_atm_put_oi: opp.back_atm_put_oi,
          back_straddle_oi: opp.back_straddle_oi,
          back_liquidity_score: opp.back_liquidity_score,
          // Volume fields for liquidity assessment
          front_volume: opp.front_volume,
          back_volume: opp.back_volume,
          // Position sizing handled by kelly_sizing_recommendation text field
          // Removed position_size_recommendation as it was causing fractional values in INTEGER column
          execution_warnings: opp.execution_warnings,
          // Quality analysis fields
          quality_score: opp.quality_score,
          is_quality: opp.is_quality,
          probability: opp.probability,
          risk_reward: opp.risk_reward,
          rejection_reasons: opp.rejection_reasons,
          // IVR fields
          front_ivr: opp.front_ivr,
          back_ivr: opp.back_ivr,
          ivr_context: opp.ivr_context,
          // Financial events fields
          earnings_date: opp.earnings_date || null,
          fed_events: opp.fed_events || [],
          event_warnings: opp.event_warnings || [],
          // New quality filter fields
          meets_30_90_criteria: opp.meets_30_90_criteria,
          meets_60_90_criteria: opp.meets_60_90_criteria,
          liquidity_rating: opp.liquidity_rating,
          kelly_sizing_recommendation: opp.kelly_sizing_recommendation,
          // Additional earnings display fields
          days_to_earnings: opp.days_to_earnings || null,
          earnings_estimated: opp.earnings_estimated || false,
        }));
        
        await storage.createOpportunities(opportunityRecords);
      }

      // Send email alert if enabled and high FF opportunities found
      if (enable_email_alerts && limitedOpportunities.length > 0) {
        sendHighFFAlert(limitedOpportunities).catch(err => {
          console.error('Email alert failed:', err);
          // Don't fail the scan if email fails
        });
      }

      // Increment user's scan count after successful scan
      await storage.incrementUserScanCount(userId);
      
      // Get updated user for scan count info
      const updatedUser = await storage.getUser(userId);
      const userScanLimit = await storage.getUserScanLimit(userId);

      res.json({
        success: true,
        scan_id: scan.id,
        opportunities: limitedOpportunities,
        total_tickers_scanned: Math.min(tickersToScan.length, 100),
        total_opportunities_found: limitedOpportunities.length,
        scansUsed: updatedUser?.scansThisMonth || 0,
        scanLimit: userScanLimit,
      });
    } catch (error) {
      console.error("Scan error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Unknown error occurred",
      });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
