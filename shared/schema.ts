import { z } from "zod";
import { pgTable, serial, varchar, text, timestamp, integer, decimal, jsonb, doublePrecision, boolean } from "drizzle-orm/pg-core";
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
  // Front month straddle liquidity fields
  atm_call_oi: z.number().optional(),
  atm_put_oi: z.number().optional(),
  straddle_oi: z.number().optional(),
  oi_put_call_ratio: z.number().optional(),
  liquidity_score: z.number().min(0).max(10).optional(),
  // Back month straddle liquidity fields
  back_atm_call_oi: z.number().optional(),
  back_atm_put_oi: z.number().optional(),
  back_straddle_oi: z.number().optional(),
  back_liquidity_score: z.number().min(0).max(10).optional(),
  // Volume fields for liquidity assessment
  front_volume: z.number().optional(),
  back_volume: z.number().optional(),
  // Position sizing recommendation
  position_size_recommendation: z.number().optional(),
  // Execution warnings
  execution_warnings: z.array(z.string()).optional(),
  // Quality analysis fields
  quality_score: z.number().min(0).max(100).optional(), // Changed from max(10) to max(100)
  is_quality: z.boolean().optional(),
  probability: z.number().min(0).max(100).optional(),
  risk_reward: z.number().min(0).optional(),
  rejection_reasons: z.array(z.string()).optional(),
  // New quality filter fields
  meets_30_90_criteria: z.boolean().optional(),
  meets_60_90_criteria: z.boolean().optional(),
  liquidity_rating: z.enum(['LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH']).optional(),
  kelly_sizing_recommendation: z.string().optional(),
  // IVR (Implied Volatility Rank) fields
  front_ivr: z.number().min(0).max(100).optional(),
  back_ivr: z.number().min(0).max(100).optional(),
  ivr_context: z.string().optional(),
  // Financial events fields
  earnings_date: z.string().optional(),
  fed_events: z.array(z.string()).optional(),
  event_warnings: z.array(z.string()).optional(),
  // DTE strategy field
  dte_strategy: z.string().optional(),
  // FF calculation mode fields
  ff_calculation_mode: z.enum(['raw', 'ex-earnings']).optional(),
  is_ex_earnings: z.boolean().optional(), // Flag to indicate if this FF was calculated ex-earnings
  earnings_dte: z.number().optional(), // Days until earnings
  // Additional earnings display fields
  days_to_earnings: z.number().nullable().optional(), // Days to earnings for display
  earnings_estimated: z.boolean().optional(), // Whether earnings date is estimated
});

export type Opportunity = z.infer<typeof opportunitySchema>;

// Scan request payload
export const scanRequestSchema = z.object({
  tickers: z.array(z.string()).optional(),
  min_ff: z.number().optional(), // No limits - allow any FF value
  max_ff: z.number().optional(), // No limits - allow any FF value
  top_n: z.number().min(1).max(100).optional(),
  min_open_interest: z.number().min(0).optional(),
  enable_email_alerts: z.boolean().optional(),
  strategy_type: z.enum(['30-90', '60-90']).optional(), // Strategy selection for quality filters
  max_monthly_trades: z.number().min(1).max(100).default(20).optional(), // Limit trades per month (default: 20 based on research)
  dte_strategy: z.enum(['30-90', '30-60', '60-90', 'all']).optional().default('30-90'),
  ff_calculation_mode: z.enum(['raw', 'ex-earnings']).optional().default('raw'),
});

export type ScanRequest = z.infer<typeof scanRequestSchema>;

// Scan response
export const scanResponseSchema = z.object({
  success: z.boolean(),
  scan_id: z.number().optional(),
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
  // Front month straddle liquidity fields
  atm_call_oi: integer("atm_call_oi"),
  atm_put_oi: integer("atm_put_oi"),
  straddle_oi: integer("straddle_oi"),
  oi_put_call_ratio: doublePrecision("oi_put_call_ratio"),
  liquidity_score: integer("liquidity_score"),
  // Back month straddle liquidity fields
  back_atm_call_oi: integer("back_atm_call_oi"),
  back_atm_put_oi: integer("back_atm_put_oi"),
  back_straddle_oi: integer("back_straddle_oi"),
  back_liquidity_score: integer("back_liquidity_score"),
  // Volume fields for liquidity assessment
  front_volume: integer("front_volume"),
  back_volume: integer("back_volume"),
  // Position sizing recommendation
  position_size_recommendation: varchar("position_size_recommendation", { length: 50 }),
  // Execution warnings
  execution_warnings: jsonb("execution_warnings"), // Array of warning strings
  // Quality analysis fields
  quality_score: integer("quality_score"),
  is_quality: boolean("is_quality"),
  probability: integer("probability"),
  risk_reward: doublePrecision("risk_reward"),
  rejection_reasons: jsonb("rejection_reasons"), // Array of rejection strings
  // IVR (Implied Volatility Rank) fields
  front_ivr: integer("front_ivr"),
  back_ivr: integer("back_ivr"),
  ivr_context: varchar("ivr_context", { length: 100 }),
  // Financial events fields
  earnings_date: varchar("earnings_date", { length: 20 }),
  fed_events: jsonb("fed_events"), // Array of Fed event strings
  event_warnings: jsonb("event_warnings"), // Array of warning strings
  // New quality filter fields
  meets_30_90_criteria: boolean("meets_30_90_criteria"),
  meets_60_90_criteria: boolean("meets_60_90_criteria"),
  liquidity_rating: varchar("liquidity_rating", { length: 20 }),
  kelly_sizing_recommendation: varchar("kelly_sizing_recommendation", { length: 50 }),
  // Additional earnings display fields
  days_to_earnings: integer("days_to_earnings"),
  earnings_estimated: boolean("earnings_estimated"),
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

// Paper Trades table - stores simulated trades
export const paperTrades = pgTable("paper_trades", {
  id: serial("id").primaryKey(),
  ticker: varchar("ticker", { length: 10 }).notNull(),
  signal: varchar("signal", { length: 4 }).notNull(), // 'BUY' or 'SELL'
  entry_date: timestamp("entry_date").defaultNow().notNull(),
  exit_date: timestamp("exit_date"),
  status: varchar("status", { length: 20 }).notNull().default('OPEN'), // OPEN, CLOSED, STOPPED
  
  // Position details
  quantity: integer("quantity").notNull(),
  front_strike: doublePrecision("front_strike").notNull(),
  back_strike: doublePrecision("back_strike").notNull(),
  front_expiry: varchar("front_expiry", { length: 20 }).notNull(),
  back_expiry: varchar("back_expiry", { length: 20 }).notNull(),
  
  // Entry prices
  entry_price: doublePrecision("entry_price").notNull(),
  front_entry_price: doublePrecision("front_entry_price").notNull().default(0), // Price paid for front option
  back_entry_price: doublePrecision("back_entry_price").notNull().default(0), // Price paid for back option
  front_entry_iv: doublePrecision("front_entry_iv").notNull(),
  back_entry_iv: doublePrecision("back_entry_iv").notNull(),
  stock_entry_price: doublePrecision("stock_entry_price").notNull(),
  
  // Current prices (updated regularly)
  current_price: doublePrecision("current_price"),
  current_pnl: doublePrecision("current_pnl"),
  current_pnl_percent: doublePrecision("current_pnl_percent"),
  stock_current_price: doublePrecision("stock_current_price"),
  front_current_iv: doublePrecision("front_current_iv"),
  back_current_iv: doublePrecision("back_current_iv"),
  
  // Exit details
  exit_price: doublePrecision("exit_price"),
  realized_pnl: doublePrecision("realized_pnl"),
  realized_pnl_percent: doublePrecision("realized_pnl_percent"),
  exit_reason: varchar("exit_reason", { length: 100 }),
  
  // Exit timing signals
  exit_signal: varchar("exit_signal", { length: 20 }), // GREEN, AMBER, RED, TAKE_PROFIT, STOP_LOSS
  exit_signal_reason: text("exit_signal_reason"),
  days_to_front_expiry: integer("days_to_front_expiry"),
  theta_decay: doublePrecision("theta_decay"),
  
  // Risk management
  stop_loss_price: doublePrecision("stop_loss_price"),
  take_profit_price: doublePrecision("take_profit_price"),
  max_risk: doublePrecision("max_risk"),
  max_profit: doublePrecision("max_profit"),
  
  // News and events
  news_alerts: jsonb("news_alerts"), // Array of news events
  has_earnings_alert: boolean("has_earnings_alert").default(false),
  
  // Original opportunity data
  forward_factor: doublePrecision("forward_factor").notNull(),
  original_scan_id: integer("original_scan_id"),
});

export const insertPaperTradeSchema = createInsertSchema(paperTrades)
  .omit({ id: true, entry_date: true });
export type InsertPaperTrade = z.infer<typeof insertPaperTradeSchema>;
export type PaperTrade = typeof paperTrades.$inferSelect;

// Trade News Events table - stores news that affects trades
export const tradeNewsEvents = pgTable("trade_news_events", {
  id: serial("id").primaryKey(),
  trade_id: integer("trade_id").notNull(),
  ticker: varchar("ticker", { length: 10 }).notNull(),
  event_date: timestamp("event_date").defaultNow().notNull(),
  event_type: varchar("event_type", { length: 50 }).notNull(), // EARNINGS, NEWS, UPGRADE, DOWNGRADE, etc
  headline: text("headline").notNull(),
  impact_score: integer("impact_score"), // 1-10 severity
  source: varchar("source", { length: 100 }),
  url: text("url"),
  recommended_action: varchar("recommended_action", { length: 50 }), // HOLD, CONSIDER_EXIT, EXIT_NOW
});

export const insertTradeNewsEventSchema = createInsertSchema(tradeNewsEvents)
  .omit({ id: true, event_date: true });
export type InsertTradeNewsEvent = z.infer<typeof insertTradeNewsEventSchema>;
export type TradeNewsEvent = typeof tradeNewsEvents.$inferSelect;

// Portfolio Summary table - tracks overall performance
export const portfolioSummary = pgTable("portfolio_summary", {
  id: serial("id").primaryKey(),
  date: timestamp("date").defaultNow().notNull(),
  total_capital: doublePrecision("total_capital").notNull().default(100000), // Starting capital
  cash_balance: doublePrecision("cash_balance").notNull(),
  positions_value: doublePrecision("positions_value").notNull(),
  total_value: doublePrecision("total_value").notNull(),
  total_pnl: doublePrecision("total_pnl").notNull(),
  total_pnl_percent: doublePrecision("total_pnl_percent").notNull(),
  open_trades: integer("open_trades").notNull(),
  closed_trades: integer("closed_trades").notNull(),
  win_rate: doublePrecision("win_rate"),
  avg_win: doublePrecision("avg_win"),
  avg_loss: doublePrecision("avg_loss"),
  sharpe_ratio: doublePrecision("sharpe_ratio"),
  max_drawdown: doublePrecision("max_drawdown"),
});

export const insertPortfolioSummarySchema = createInsertSchema(portfolioSummary)
  .omit({ id: true, date: true });
export type InsertPortfolioSummary = z.infer<typeof insertPortfolioSummarySchema>;
export type PortfolioSummary = typeof portfolioSummary.$inferSelect;

// Paper Trade Request Schemas
export const createPaperTradeSchema = z.object({
  opportunity: opportunitySchema,
  quantity: z.number().min(1).max(100).default(1),
  stop_loss_percent: z.number().min(0).max(100).default(30), // Default 30% stop loss
  take_profit_percent: z.number().min(0).max(500).default(50), // Default 50% take profit
  use_actual_prices: z.boolean().default(false), // Whether to use real current prices
  actual_entry_price: z.number().optional(), // User's actual net debit/credit
  actual_stock_price: z.number().optional(), // User's actual stock price at entry
  actual_front_strike: z.number().optional(), // User's actual front strike
  actual_back_strike: z.number().optional(), // User's actual back strike
});

export type CreatePaperTradeRequest = z.infer<typeof createPaperTradeSchema>;

export const updatePaperTradeSchema = z.object({
  current_price: z.number().optional(),
  current_pnl: z.number().optional(),
  current_pnl_percent: z.number().optional(),
  stock_current_price: z.number().optional(),
  front_current_iv: z.number().optional(),
  back_current_iv: z.number().optional(),
  days_to_front_expiry: z.number().optional(),
  theta_decay: z.number().optional(),
  exit_signal: z.enum(['GREEN', 'AMBER', 'RED', 'TAKE_PROFIT', 'STOP_LOSS']).optional(),
  exit_signal_reason: z.string().optional(),
  news_alerts: z.array(z.any()).optional(),
  has_earnings_alert: z.boolean().optional(),
});

export type UpdatePaperTradeRequest = z.infer<typeof updatePaperTradeSchema>;

export const closePaperTradeSchema = z.object({
  exit_price: z.number(),
  exit_reason: z.string().max(100),
});

export type ClosePaperTradeRequest = z.infer<typeof closePaperTradeSchema>;

export const updateExitSignalSchema = z.object({
  signal: z.enum(['GREEN', 'AMBER', 'RED', 'TAKE_PROFIT', 'STOP_LOSS']),
  reason: z.string(),
});

export type UpdateExitSignalRequest = z.infer<typeof updateExitSignalSchema>;
