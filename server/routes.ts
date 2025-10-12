import type { Express } from "express";
import { createServer, type Server } from "http";
import { ForwardFactorScanner, DEFAULT_TICKERS } from "./scanner";
import { scanRequestSchema } from "@shared/schema";
import { storage } from "./storage";

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

      const { tickers, min_ff, max_ff, top_n } = validationResult.data;
      const tickersToScan = tickers && tickers.length > 0 ? tickers : DEFAULT_TICKERS;
      const minFF = min_ff ?? -100;
      const maxFF = max_ff ?? 100;
      const topN = top_n ?? 20;

      const scanner = new ForwardFactorScanner(POLYGON_API_KEY);
      
      const opportunities = await scanner.scanMultiple(
        tickersToScan.slice(0, 30),
        minFF,
        maxFF,
        (current, total, ticker) => {
          console.log(`Scanning progress: ${ticker} (${current}/${total})`);
        }
      );

      const limitedOpportunities = opportunities.slice(0, topN);

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
        }));
        
        await storage.createOpportunities(opportunityRecords);
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
