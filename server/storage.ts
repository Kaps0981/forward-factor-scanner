import { db } from "./db";
import { scans, opportunities, watchlists, type Scan, type InsertScan, type InsertOpportunity, type StoredOpportunity, type Watchlist, type InsertWatchlist } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

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
}

export const storage = new DatabaseStorage();
