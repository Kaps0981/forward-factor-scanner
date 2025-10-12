import { z } from "zod";

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
});

export type Opportunity = z.infer<typeof opportunitySchema>;

// Scan request payload
export const scanRequestSchema = z.object({
  tickers: z.array(z.string()).optional(),
  min_ff: z.number().min(-100).max(100).optional(),
  max_ff: z.number().min(-100).max(100).optional(),
  top_n: z.number().min(1).max(100).optional(),
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
