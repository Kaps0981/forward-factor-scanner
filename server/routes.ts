import type { Express } from "express";
import { createServer, type Server } from "http";
import { ForwardFactorScanner, DEFAULT_TICKERS } from "./scanner";
import { scanRequestSchema } from "@shared/schema";

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

      res.json({
        success: true,
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
