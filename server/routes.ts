import type { Express } from "express";
import { createServer, type Server } from "http";
import { ForwardFactorScanner, DEFAULT_TICKERS } from "./scanner";
import { scanRequestSchema, insertWatchlistSchema } from "@shared/schema";
import { storage } from "./storage";
import { PolygonService } from "./polygon";
import { sendHighFFAlert } from "./email";
import { analyzeOpportunityQuality, generateTradingThesis, calculatePositionSize, generateExecutionWarnings } from "./qualityFilters";
import { generateHTMLReport, generateMarkdownReport } from "./reportGenerator";
import { TradingCalendar } from "./tradingCalendar";
import { MarketCapFilter } from "./marketCapFilter";
import { FinancialEventsService } from "./financialEvents";

export async function registerRoutes(app: Express): Promise<Server> {
  const POLYGON_API_KEY = process.env.POLYGON_API_KEY;

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
  app.get("/api/scans", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const scans = await storage.getAllScans(limit);
      res.json({ scans });
    } catch (error) {
      console.error("Error fetching scans:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to fetch scans",
      });
    }
  });

  app.get("/api/scans/:id", async (req, res) => {
    try {
      const scanId = parseInt(req.params.id);
      const scan = await storage.getScan(scanId);
      
      if (!scan) {
        return res.status(404).json({ error: "Scan not found" });
      }

      const opportunities = await storage.getOpportunitiesByScan(scanId);
      
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
  app.get("/api/watchlists", async (req, res) => {
    try {
      const watchlists = await storage.getWatchlists();
      res.json({ watchlists });
    } catch (error) {
      console.error("Error fetching watchlists:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to fetch watchlists",
      });
    }
  });

  app.post("/api/watchlists", async (req, res) => {
    try {
      const validationResult = insertWatchlistSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          error: "Invalid watchlist data",
          details: validationResult.error.errors,
        });
      }

      const watchlist = await storage.createWatchlist(validationResult.data);
      res.json({ watchlist });
    } catch (error) {
      console.error("Error creating watchlist:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to create watchlist",
      });
    }
  });

  app.patch("/api/watchlists/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      const validationResult = insertWatchlistSchema.partial().safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          error: "Invalid watchlist data",
          details: validationResult.error.errors,
        });
      }
      
      const watchlist = await storage.updateWatchlist(id, validationResult.data);
      
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

  app.delete("/api/watchlists/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteWatchlist(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting watchlist:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to delete watchlist",
      });
    }
  });

  // Market status endpoint
  app.get("/api/market-status", (req, res) => {
    const status = TradingCalendar.getMarketStatus();
    res.json(status);
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
        const positionSize = calculatePositionSize(opp);
        const warnings = generateExecutionWarnings(opp);
        
        return {
          ...opp,
          quality_score: analysis.rating,
          is_quality: analysis.isQuality,
          probability: analysis.probability,
          risk_reward: analysis.riskReward,
          rejection_reasons: analysis.rejectionReasons,
          position_size_recommendation: positionSize,
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

  app.post("/api/scan", async (req, res) => {
    try {
      if (!POLYGON_API_KEY) {
        return res.status(500).json({
          error: "Polygon API key not configured",
        });
      }

      const validationResult = scanRequestSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          error: "Invalid request parameters",
          details: validationResult.error.errors,
        });
      }

      const { tickers, min_ff, max_ff, top_n, min_open_interest, enable_email_alerts } = validationResult.data;
      
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
        tickersToScan.slice(0, 30),
        minFF,
        maxFF,
        (current, total, ticker) => {
          console.log(`Scanning progress: ${ticker} (${current}/${total})`);
        }
      );

      // Filter by liquidity if requested (prefer straddle_oi over avg_open_interest)
      const filteredOpportunities = minOI > 0 
        ? opportunities.filter(opp => {
            // Use straddle_oi if available, fallback to avg_open_interest
            const oi = opp.straddle_oi !== undefined ? opp.straddle_oi : (opp.avg_open_interest || 0);
            return oi >= minOI;
          })
        : opportunities;

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
      
      // Add earnings flag, quality analysis, position sizing, and warnings to opportunities
      const opportunitiesWithAnalysis = opportunitiesWithEvents.map(opp => {
        const oppWithEarnings = {
          ...opp,
          has_earnings_soon: earningsMap.get(opp.ticker) || false,
          // Convert null to undefined for earnings_date
          earnings_date: opp.earnings_date === null ? undefined : opp.earnings_date,
        };
        
        // Run quality analysis
        const analysis = analyzeOpportunityQuality(oppWithEarnings);
        
        // Calculate position size recommendation
        const positionSize = calculatePositionSize(oppWithEarnings);
        
        // Generate execution warnings
        const warnings = generateExecutionWarnings(oppWithEarnings);
        
        return {
          ...oppWithEarnings,
          quality_score: analysis.rating,
          is_quality: analysis.isQuality,
          probability: analysis.probability,
          risk_reward: analysis.riskReward,
          rejection_reasons: analysis.rejectionReasons,
          position_size_recommendation: positionSize,
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
          return b.quality_score - a.quality_score;
        }
        // Finally by |FF|
        return Math.abs(b.forward_factor) - Math.abs(a.forward_factor);
      });

      const limitedOpportunities = sortedOpportunities.slice(0, topN);

      // Save scan to database
      const scan = await storage.createScan({
        tickers_scanned: Math.min(tickersToScan.length, 30),
        total_opportunities: limitedOpportunities.length,
        min_ff: minFF,
        max_ff: maxFF,
        top_n: topN,
        tickers_list: tickersToScan.slice(0, 30),
      });

      // Save opportunities to database
      if (limitedOpportunities.length > 0) {
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
          // Position sizing and warnings
          position_size_recommendation: String(opp.position_size_recommendation),
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

      res.json({
        success: true,
        scan_id: scan.id,
        opportunities: limitedOpportunities,
        total_tickers_scanned: Math.min(tickersToScan.length, 30),
        total_opportunities_found: limitedOpportunities.length,
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
