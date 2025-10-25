import { db } from "./db";
import { 
  scans, 
  opportunities, 
  watchlists, 
  paperTrades,
  tradeNewsEvents,
  portfolioSummary,
  users,
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
  type InsertPortfolioSummary,
  type User,
  type UpsertUser
} from "@shared/schema";
import { eq, desc, and, isNull, gt, sql } from "drizzle-orm";

export interface IStorage {
  // User operations (IMPORTANT: mandatory for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  incrementUserScanCount(userId: string): Promise<User>;
  resetMonthlyScans(userId: string): Promise<User>;
  getUserScanLimit(userId: string): Promise<number>;
  checkAndResetMonthlyScans(userId: string): Promise<User>;
  
  // Scan history
  createScan(scan: InsertScan): Promise<Scan>;
  getScan(id: number, userId: string): Promise<Scan | undefined>;
  getAllScans(userId: string, limit?: number): Promise<Scan[]>;
  
  // Opportunities
  createOpportunities(opps: InsertOpportunity[]): Promise<StoredOpportunity[]>;
  getOpportunitiesByScan(scanId: number, userId: string): Promise<StoredOpportunity[]>;
  
  // Watchlists
  createWatchlist(watchlist: InsertWatchlist, userId: string): Promise<Watchlist>;
  getWatchlists(userId: string): Promise<Watchlist[]>;
  getWatchlist(id: number, userId: string): Promise<Watchlist | undefined>;
  updateWatchlist(id: number, watchlist: Partial<InsertWatchlist>, userId: string): Promise<Watchlist | undefined>;
  deleteWatchlist(id: number, userId: string): Promise<void>;
  
  // Paper Trades
  createPaperTrade(trade: InsertPaperTrade, userId: string): Promise<PaperTrade>;
  getPaperTrades(userId: string, status?: string): Promise<PaperTrade[]>;
  getOpenPaperTrades(userId: string): Promise<PaperTrade[]>;
  getPaperTrade(id: number, userId: string): Promise<PaperTrade | undefined>;
  updatePaperTrade(id: number, trade: Partial<InsertPaperTrade>, userId: string): Promise<PaperTrade | undefined>;
  closePaperTrade(id: number, exitPrice: number, exitReason: string, userId: string): Promise<PaperTrade | undefined>;
  updatePaperTradeExitSignal(id: number, signal: string, reason: string, userId: string): Promise<PaperTrade | undefined>;
  deletePaperTrade(id: number, userId: string): Promise<void>;
  
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
  // User operations (IMPORTANT: mandatory for Replit Auth)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async incrementUserScanCount(userId: string): Promise<User> {
    // First check and reset monthly scans if needed
    await this.checkAndResetMonthlyScans(userId);
    
    const [user] = await db
      .update(users)
      .set({
        scansThisMonth: sql`${users.scansThisMonth} + 1`,
        lastScanAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async resetMonthlyScans(userId: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({
        scansThisMonth: 0,
        monthResetAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async getUserScanLimit(userId: string): Promise<number> {
    const user = await this.getUser(userId);
    if (!user) return 10; // Default for free tier
    
    switch (user.subscriptionTier) {
      case 'pro':
        return 100;
      case 'enterprise':
        return -1; // Unlimited
      default:
        return 10; // Free tier
    }
  }

  async checkAndResetMonthlyScans(userId: string): Promise<User> {
    const user = await this.getUser(userId);
    if (!user) throw new Error("User not found");
    
    const now = new Date();
    const lastReset = user.monthResetAt || user.createdAt || now;
    const daysSinceReset = Math.floor((now.getTime() - lastReset.getTime()) / (1000 * 60 * 60 * 24));
    
    // Reset if more than 30 days have passed
    if (daysSinceReset >= 30) {
      return await this.resetMonthlyScans(userId);
    }
    
    return user;
  }

  // Scan history methods
  async createScan(scan: InsertScan): Promise<Scan> {
    const [result] = await db.insert(scans).values(scan).returning();
    return result;
  }

  async getScan(id: number, userId: string): Promise<Scan | undefined> {
    const [result] = await db.select().from(scans)
      .where(and(eq(scans.id, id), eq(scans.userId, userId)));
    return result;
  }

  async getAllScans(userId: string, limit: number = 50): Promise<Scan[]> {
    return db.select().from(scans)
      .where(eq(scans.userId, userId))
      .orderBy(desc(scans.timestamp))
      .limit(limit);
  }

  // Opportunities methods
  async createOpportunities(opps: InsertOpportunity[]): Promise<StoredOpportunity[]> {
    if (opps.length === 0) return [];
    return db.insert(opportunities).values(opps).returning();
  }

  async getOpportunitiesByScan(scanId: number, userId: string): Promise<StoredOpportunity[]> {
    return db.select().from(opportunities)
      .where(and(eq(opportunities.scan_id, scanId), eq(opportunities.userId, userId)));
  }

  // Watchlist methods
  async createWatchlist(watchlist: InsertWatchlist, userId: string): Promise<Watchlist> {
    const watchlistWithUser = { ...watchlist, userId };
    const [result] = await db.insert(watchlists).values(watchlistWithUser).returning();
    return result;
  }

  async getWatchlists(userId: string): Promise<Watchlist[]> {
    return db.select().from(watchlists)
      .where(eq(watchlists.userId, userId))
      .orderBy(desc(watchlists.created_at));
  }

  async getWatchlist(id: number, userId: string): Promise<Watchlist | undefined> {
    const [result] = await db.select().from(watchlists)
      .where(and(eq(watchlists.id, id), eq(watchlists.userId, userId)));
    return result;
  }

  async updateWatchlist(id: number, watchlist: Partial<InsertWatchlist>, userId: string): Promise<Watchlist | undefined> {
    const [result] = await db
      .update(watchlists)
      .set(watchlist)
      .where(and(eq(watchlists.id, id), eq(watchlists.userId, userId)))
      .returning();
    return result;
  }

  async deleteWatchlist(id: number, userId: string): Promise<void> {
    await db.delete(watchlists)
      .where(and(eq(watchlists.id, id), eq(watchlists.userId, userId)));
  }
  
  // Paper Trade methods
  async createPaperTrade(trade: InsertPaperTrade, userId: string): Promise<PaperTrade> {
    const tradeWithUser = { ...trade, userId };
    const [result] = await db.insert(paperTrades).values(tradeWithUser).returning();
    return result;
  }
  
  async getPaperTrades(userId: string, status?: string): Promise<PaperTrade[]> {
    if (status) {
      return db.select().from(paperTrades)
        .where(and(eq(paperTrades.userId, userId), eq(paperTrades.status, status)))
        .orderBy(desc(paperTrades.entry_date));
    }
    return db.select().from(paperTrades)
      .where(eq(paperTrades.userId, userId))
      .orderBy(desc(paperTrades.entry_date));
  }
  
  async getOpenPaperTrades(userId: string): Promise<PaperTrade[]> {
    return db.select().from(paperTrades)
      .where(and(eq(paperTrades.userId, userId), eq(paperTrades.status, 'OPEN')))
      .orderBy(desc(paperTrades.entry_date));
  }
  
  async getPaperTrade(id: number, userId: string): Promise<PaperTrade | undefined> {
    const [result] = await db.select().from(paperTrades)
      .where(and(eq(paperTrades.id, id), eq(paperTrades.userId, userId)));
    return result;
  }
  
  async updatePaperTrade(id: number, trade: Partial<InsertPaperTrade>, userId: string): Promise<PaperTrade | undefined> {
    const [result] = await db
      .update(paperTrades)
      .set(trade)
      .where(and(eq(paperTrades.id, id), eq(paperTrades.userId, userId)))
      .returning();
    return result;
  }
  
  async closePaperTrade(id: number, exitPrice: number, exitReason: string, userId: string): Promise<PaperTrade | undefined> {
    const trade = await this.getPaperTrade(id, userId);
    if (!trade) return undefined;
    
    // Multiply by 100 for options contract multiplier (100 shares per contract)
    const realizedPnl = (exitPrice - trade.entry_price) * trade.quantity * 100;
    // Correct P&L percentage calculation: (pnl / (entry_price * quantity * 100)) * 100
    const realizedPnlPercent = (realizedPnl / (trade.entry_price * trade.quantity * 100)) * 100;
    
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
      .where(and(eq(paperTrades.id, id), eq(paperTrades.userId, userId)))
      .returning();
    return result;
  }
  
  async updatePaperTradeExitSignal(id: number, signal: string, reason: string, userId: string): Promise<PaperTrade | undefined> {
    const [result] = await db
      .update(paperTrades)
      .set({
        exit_signal: signal,
        exit_signal_reason: reason
      })
      .where(and(eq(paperTrades.id, id), eq(paperTrades.userId, userId)))
      .returning();
    return result;
  }
  
  async deletePaperTrade(id: number, userId: string): Promise<void> {
    await db.delete(paperTrades)
      .where(and(eq(paperTrades.id, id), eq(paperTrades.userId, userId)));
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
    // Check if a portfolio summary exists WITHOUT creating a new one (to prevent infinite loop)
    const [existing] = await db.select().from(portfolioSummary)
      .orderBy(desc(portfolioSummary.date))
      .limit(1);
    
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
    // Multiply by 100 for options contract multiplier (100 shares per contract)
    const cashUsed = openTrades.reduce((sum, trade) => 
      sum + (trade.entry_price * trade.quantity * 100), 0);
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
