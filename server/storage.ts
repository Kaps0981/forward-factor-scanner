import { db } from "./db";
import { 
  scans, 
  opportunities, 
  watchlists, 
  paperTrades,
  tradeNewsEvents,
  portfolioSummary,
  type Scan, 
  type InsertScan, 
  type InsertOpportunity, 
  type StoredOpportunity, 
  type Watchlist, 
  type InsertWatchlist,
  type PaperTrade,
  type InsertPaperTrade,
  type TradeNewsEvent,
  type InsertTradeNewsEvent,
  type PortfolioSummary,
  type InsertPortfolioSummary
} from "@shared/schema";
import { eq, desc, and, isNull, gt, sql } from "drizzle-orm";

export interface IStorage {
  // Scan history
  createScan(scan: InsertScan): Promise<Scan>;
  getScan(id: number): Promise<Scan | undefined>;
  getAllScans(limit?: number): Promise<Scan[]>;
  
  // Opportunities
  createOpportunities(opps: InsertOpportunity[]): Promise<StoredOpportunity[]>;
  getOpportunitiesByScan(scanId: number): Promise<StoredOpportunity[]>;
  
  // Watchlists
  createWatchlist(watchlist: InsertWatchlist): Promise<Watchlist>;
  getWatchlists(): Promise<Watchlist[]>;
  getWatchlist(id: number): Promise<Watchlist | undefined>;
  updateWatchlist(id: number, watchlist: Partial<InsertWatchlist>): Promise<Watchlist | undefined>;
  deleteWatchlist(id: number): Promise<void>;
  
  // Paper Trades
  createPaperTrade(trade: InsertPaperTrade): Promise<PaperTrade>;
  getPaperTrades(status?: string): Promise<PaperTrade[]>;
  getOpenPaperTrades(): Promise<PaperTrade[]>;
  getPaperTrade(id: number): Promise<PaperTrade | undefined>;
  updatePaperTrade(id: number, trade: Partial<InsertPaperTrade>): Promise<PaperTrade | undefined>;
  closePaperTrade(id: number, exitPrice: number, exitReason: string): Promise<PaperTrade | undefined>;
  updatePaperTradeExitSignal(id: number, signal: string, reason: string): Promise<PaperTrade | undefined>;
  
  // Trade News Events
  createTradeNewsEvent(event: InsertTradeNewsEvent): Promise<TradeNewsEvent>;
  getTradeNewsEvents(tradeId: number): Promise<TradeNewsEvent[]>;
  getRecentNewsForTicker(ticker: string): Promise<TradeNewsEvent[]>;
  
  // Portfolio Summary
  getPortfolioSummary(): Promise<PortfolioSummary | undefined>;
  updatePortfolioSummary(summary: Partial<InsertPortfolioSummary>): Promise<PortfolioSummary>;
  calculatePortfolioMetrics(): Promise<PortfolioSummary>;
}

export class DatabaseStorage implements IStorage {
  // Scan history methods
  async createScan(scan: InsertScan): Promise<Scan> {
    const [result] = await db.insert(scans).values(scan).returning();
    return result;
  }

  async getScan(id: number): Promise<Scan | undefined> {
    const [result] = await db.select().from(scans).where(eq(scans.id, id));
    return result;
  }

  async getAllScans(limit: number = 50): Promise<Scan[]> {
    return db.select().from(scans).orderBy(desc(scans.timestamp)).limit(limit);
  }

  // Opportunities methods
  async createOpportunities(opps: InsertOpportunity[]): Promise<StoredOpportunity[]> {
    if (opps.length === 0) return [];
    return db.insert(opportunities).values(opps).returning();
  }

  async getOpportunitiesByScan(scanId: number): Promise<StoredOpportunity[]> {
    return db.select().from(opportunities).where(eq(opportunities.scan_id, scanId));
  }

  // Watchlist methods
  async createWatchlist(watchlist: InsertWatchlist): Promise<Watchlist> {
    const [result] = await db.insert(watchlists).values(watchlist).returning();
    return result;
  }

  async getWatchlists(): Promise<Watchlist[]> {
    return db.select().from(watchlists).orderBy(desc(watchlists.created_at));
  }

  async getWatchlist(id: number): Promise<Watchlist | undefined> {
    const [result] = await db.select().from(watchlists).where(eq(watchlists.id, id));
    return result;
  }

  async updateWatchlist(id: number, watchlist: Partial<InsertWatchlist>): Promise<Watchlist | undefined> {
    const [result] = await db
      .update(watchlists)
      .set(watchlist)
      .where(eq(watchlists.id, id))
      .returning();
    return result;
  }

  async deleteWatchlist(id: number): Promise<void> {
    await db.delete(watchlists).where(eq(watchlists.id, id));
  }
  
  // Paper Trade methods
  async createPaperTrade(trade: InsertPaperTrade): Promise<PaperTrade> {
    const [result] = await db.insert(paperTrades).values(trade).returning();
    return result;
  }
  
  async getPaperTrades(status?: string): Promise<PaperTrade[]> {
    if (status) {
      return db.select().from(paperTrades)
        .where(eq(paperTrades.status, status))
        .orderBy(desc(paperTrades.entry_date));
    }
    return db.select().from(paperTrades)
      .orderBy(desc(paperTrades.entry_date));
  }
  
  async getOpenPaperTrades(): Promise<PaperTrade[]> {
    return db.select().from(paperTrades)
      .where(eq(paperTrades.status, 'OPEN'))
      .orderBy(desc(paperTrades.entry_date));
  }
  
  async getPaperTrade(id: number): Promise<PaperTrade | undefined> {
    const [result] = await db.select().from(paperTrades).where(eq(paperTrades.id, id));
    return result;
  }
  
  async updatePaperTrade(id: number, trade: Partial<InsertPaperTrade>): Promise<PaperTrade | undefined> {
    const [result] = await db
      .update(paperTrades)
      .set(trade)
      .where(eq(paperTrades.id, id))
      .returning();
    return result;
  }
  
  async closePaperTrade(id: number, exitPrice: number, exitReason: string): Promise<PaperTrade | undefined> {
    const trade = await this.getPaperTrade(id);
    if (!trade) return undefined;
    
    const realizedPnl = (exitPrice - trade.entry_price) * trade.quantity;
    const realizedPnlPercent = (realizedPnl / (trade.entry_price * trade.quantity)) * 100;
    
    const [result] = await db
      .update(paperTrades)
      .set({
        status: 'CLOSED',
        exit_date: new Date(),
        exit_price: exitPrice,
        realized_pnl: realizedPnl,
        realized_pnl_percent: realizedPnlPercent,
        exit_reason: exitReason
      })
      .where(eq(paperTrades.id, id))
      .returning();
    return result;
  }
  
  async updatePaperTradeExitSignal(id: number, signal: string, reason: string): Promise<PaperTrade | undefined> {
    const [result] = await db
      .update(paperTrades)
      .set({
        exit_signal: signal,
        exit_signal_reason: reason
      })
      .where(eq(paperTrades.id, id))
      .returning();
    return result;
  }
  
  // Trade News Event methods
  async createTradeNewsEvent(event: InsertTradeNewsEvent): Promise<TradeNewsEvent> {
    const [result] = await db.insert(tradeNewsEvents).values(event).returning();
    return result;
  }
  
  async getTradeNewsEvents(tradeId: number): Promise<TradeNewsEvent[]> {
    return db.select().from(tradeNewsEvents)
      .where(eq(tradeNewsEvents.trade_id, tradeId))
      .orderBy(desc(tradeNewsEvents.event_date));
  }
  
  async getRecentNewsForTicker(ticker: string): Promise<TradeNewsEvent[]> {
    return db.select().from(tradeNewsEvents)
      .where(eq(tradeNewsEvents.ticker, ticker))
      .orderBy(desc(tradeNewsEvents.event_date))
      .limit(10);
  }
  
  // Portfolio Summary methods
  async getPortfolioSummary(): Promise<PortfolioSummary | undefined> {
    const [result] = await db.select().from(portfolioSummary)
      .orderBy(desc(portfolioSummary.date))
      .limit(1);
    
    // If no summary exists, create initial one
    if (!result) {
      const initialSummary = await this.calculatePortfolioMetrics();
      return initialSummary;
    }
    
    return result;
  }
  
  async updatePortfolioSummary(summary: Partial<InsertPortfolioSummary>): Promise<PortfolioSummary> {
    const existing = await this.getPortfolioSummary();
    
    if (existing && existing.id) {
      const [result] = await db
        .update(portfolioSummary)
        .set(summary)
        .where(eq(portfolioSummary.id, existing.id))
        .returning();
      return result;
    } else {
      const fullSummary: InsertPortfolioSummary = {
        total_capital: summary.total_capital || 100000,
        cash_balance: summary.cash_balance || 100000,
        positions_value: summary.positions_value || 0,
        total_value: summary.total_value || 100000,
        total_pnl: summary.total_pnl || 0,
        total_pnl_percent: summary.total_pnl_percent || 0,
        open_trades: summary.open_trades || 0,
        closed_trades: summary.closed_trades || 0,
        win_rate: summary.win_rate || null,
        avg_win: summary.avg_win || null,
        avg_loss: summary.avg_loss || null,
        sharpe_ratio: summary.sharpe_ratio || null,
        max_drawdown: summary.max_drawdown || null
      };
      const [result] = await db.insert(portfolioSummary).values(fullSummary).returning();
      return result;
    }
  }
  
  async calculatePortfolioMetrics(): Promise<PortfolioSummary> {
    // Get all trades
    const allTrades = await db.select().from(paperTrades);
    const openTrades = allTrades.filter(t => t.status === 'OPEN');
    const closedTrades = allTrades.filter(t => t.status === 'CLOSED');
    
    // Calculate positions value (sum of current P&L for open trades)
    const positionsValue = openTrades.reduce((sum, trade) => 
      sum + (trade.current_pnl || 0), 0);
    
    // Calculate total realized P&L
    const totalRealizedPnl = closedTrades.reduce((sum, trade) => 
      sum + (trade.realized_pnl || 0), 0);
    
    // Calculate win rate
    const winningTrades = closedTrades.filter(t => (t.realized_pnl || 0) > 0);
    const losingTrades = closedTrades.filter(t => (t.realized_pnl || 0) < 0);
    const winRate = closedTrades.length > 0 
      ? (winningTrades.length / closedTrades.length) * 100 
      : null;
    
    // Calculate average win/loss
    const avgWin = winningTrades.length > 0
      ? winningTrades.reduce((sum, t) => sum + (t.realized_pnl || 0), 0) / winningTrades.length
      : null;
    
    const avgLoss = losingTrades.length > 0
      ? Math.abs(losingTrades.reduce((sum, t) => sum + (t.realized_pnl || 0), 0) / losingTrades.length)
      : null;
    
    const totalCapital = 100000; // Starting capital
    const cashUsed = openTrades.reduce((sum, trade) => 
      sum + (trade.entry_price * trade.quantity), 0);
    const cashBalance = totalCapital - cashUsed + totalRealizedPnl;
    const totalValue = cashBalance + positionsValue;
    const totalPnl = totalValue - totalCapital;
    const totalPnlPercent = (totalPnl / totalCapital) * 100;
    
    const summary = await this.updatePortfolioSummary({
      total_capital: totalCapital,
      cash_balance: cashBalance,
      positions_value: positionsValue,
      total_value: totalValue,
      total_pnl: totalPnl,
      total_pnl_percent: totalPnlPercent,
      open_trades: openTrades.length,
      closed_trades: closedTrades.length,
      win_rate: winRate,
      avg_win: avgWin,
      avg_loss: avgLoss,
      sharpe_ratio: null, // TODO: Calculate Sharpe ratio
      max_drawdown: null  // TODO: Calculate max drawdown
    });
    
    return summary;
  }
}

export const storage = new DatabaseStorage();
