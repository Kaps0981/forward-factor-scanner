import { z } from "zod";
import { pgTable, serial, varchar, text, timestamp, integer, decimal, jsonb, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

// Scanner opportunity result from Forward Factor analysis
export const opportunitySchema = z.object({
  ticker: z.string(),
  forward_factor: z.number(),
  signal: z.enum(['BUY', 'SELL']),
  front_date: z.string(),
  front_dte: z.number(),
  front_iv: z.number(),
  back_date: z.string(),
  back_dte: z.number(),
  back_iv: z.number(),
  forward_vol: z.number(),
  avg_open_interest: z.number().optional(),
  has_earnings_soon: z.boolean().optional(),
  // Quality analysis fields
  quality_score: z.number().min(0).max(10).optional(),
  is_quality: z.boolean().optional(),
  probability: z.number().min(0).max(100).optional(),
  risk_reward: z.number().min(0).optional(),
  rejection_reasons: z.array(z.string()).optional(),
});

export type Opportunity = z.infer<typeof opportunitySchema>;

// Scan request payload
export const scanRequestSchema = z.object({
  tickers: z.array(z.string()).optional(),
  min_ff: z.number().min(-100).max(100).optional(),
  max_ff: z.number().min(-100).max(100).optional(),
  top_n: z.number().min(1).max(100).optional(),
  min_open_interest: z.number().min(0).optional(),
  enable_email_alerts: z.boolean().optional(),
});

export type ScanRequest = z.infer<typeof scanRequestSchema>;

// Scan response
export const scanResponseSchema = z.object({
  success: z.boolean(),
  opportunities: z.array(opportunitySchema),
  total_tickers_scanned: z.number(),
  total_opportunities_found: z.number(),
  error: z.string().optional(),
});

export type ScanResponse = z.infer<typeof scanResponseSchema>;

// Health check response
export const healthResponseSchema = z.object({
  status: z.string(),
  api_key_configured: z.boolean(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

// Default tickers response
export const defaultTickersResponseSchema = z.object({
  tickers: z.array(z.string()),
});

export type DefaultTickersResponse = z.infer<typeof defaultTickersResponseSchema>;

// Database Tables

// Scans table - stores historical scan metadata
export const scans = pgTable("scans", {
  id: serial("id").primaryKey(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  tickers_scanned: integer("tickers_scanned").notNull(),
  total_opportunities: integer("total_opportunities").notNull(),
  min_ff: doublePrecision("min_ff").notNull(),
  max_ff: doublePrecision("max_ff").notNull(),
  top_n: integer("top_n").notNull(),
  tickers_list: jsonb("tickers_list").notNull(), // Array of ticker strings
});

export const insertScanSchema = createInsertSchema(scans).omit({ id: true, timestamp: true });
export type InsertScan = z.infer<typeof insertScanSchema>;
export type Scan = typeof scans.$inferSelect;

// Opportunities table - stores individual opportunity results from scans
export const opportunities = pgTable("opportunities", {
  id: serial("id").primaryKey(),
  scan_id: integer("scan_id").notNull(),
  ticker: varchar("ticker", { length: 10 }).notNull(),
  forward_factor: doublePrecision("forward_factor").notNull(),
  signal: varchar("signal", { length: 4 }).notNull(), // 'BUY' or 'SELL'
  front_date: varchar("front_date", { length: 20 }).notNull(),
  front_dte: integer("front_dte").notNull(),
  front_iv: doublePrecision("front_iv").notNull(),
  back_date: varchar("back_date", { length: 20 }).notNull(),
  back_dte: integer("back_dte").notNull(),
  back_iv: doublePrecision("back_iv").notNull(),
  forward_vol: doublePrecision("forward_vol").notNull(),
  avg_open_interest: integer("avg_open_interest"),
  has_earnings_soon: varchar("has_earnings_soon", { length: 5 }),
});

export const insertOpportunitySchema = createInsertSchema(opportunities).omit({ id: true });
export type InsertOpportunity = z.infer<typeof insertOpportunitySchema>;
export type StoredOpportunity = typeof opportunities.$inferSelect;

// Watchlists table - stores user's saved ticker watchlists
export const watchlists = pgTable("watchlists", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  tickers: jsonb("tickers").notNull(), // Array of ticker strings
  created_at: timestamp("created_at").defaultNow().notNull(),
});

// Ticker validation schema - ensures tickers are valid uppercase stock symbols
const tickerArraySchema = z.array(
  z.string()
    .min(1, "Ticker cannot be empty")
    .max(5, "Ticker too long (max 5 characters)")
    .transform((val) => val.trim().toUpperCase())
    .refine((val) => /^[A-Z]+$/.test(val), {
      message: "Ticker must contain only letters",
    })
);

export const insertWatchlistSchema = createInsertSchema(watchlists)
  .omit({ id: true, created_at: true })
  .extend({
    tickers: tickerArraySchema,
  });

export type InsertWatchlist = z.infer<typeof insertWatchlistSchema>;
export type Watchlist = typeof watchlists.$inferSelect;
