import WebSocket from 'ws';
import { Server } from 'http';
import { PolygonService } from './polygon';
import type { IStorage } from './storage';
import type { LiveSpread, InsertLiveSpread } from '@shared/schema';

interface WSMessage {
  type: 'subscribe' | 'unsubscribe' | 'ping';
  tickers?: string[];
  channel?: 'spreads' | 'portfolio' | 'performance';
}

interface WSResponse {
  type: 'spread_update' | 'portfolio_update' | 'performance_update' | 'error' | 'pong';
  data?: any;
  error?: string;
  timestamp?: string;
}

export class WebSocketService {
  private wss: WebSocket.Server;
  private clients: Map<WebSocket, Set<string>> = new Map();
  private subscriptions: Map<string, Set<WebSocket>> = new Map();
  private intervalHandles: Map<string, NodeJS.Timeout> = new Map();
  private polygonService: PolygonService;
  private storage: IStorage;

  constructor(server: Server, storage: IStorage) {
    this.wss = new WebSocket.Server({ server });
    this.polygonService = new PolygonService();
    this.storage = storage;
    this.setupWebSocketServer();
  }

  private setupWebSocketServer() {
    this.wss.on('connection', (ws: WebSocket) => {
      console.log('New WebSocket client connected');
      this.clients.set(ws, new Set());

      ws.on('message', async (message: string) => {
        try {
          const data: WSMessage = JSON.parse(message);
          await this.handleMessage(ws, data);
        } catch (error) {
          console.error('WebSocket message error:', error);
          this.sendError(ws, 'Invalid message format');
        }
      });

      ws.on('close', () => {
        console.log('WebSocket client disconnected');
        this.cleanupClient(ws);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.cleanupClient(ws);
      });

      // Send initial connection confirmation
      this.send(ws, {
        type: 'pong',
        timestamp: new Date().toISOString()
      });
    });
  }

  private async handleMessage(ws: WebSocket, message: WSMessage) {
    switch (message.type) {
      case 'subscribe':
        if (message.tickers && message.channel === 'spreads') {
          await this.subscribeToSpreads(ws, message.tickers);
        } else if (message.channel === 'portfolio') {
          await this.subscribeToPortfolio(ws);
        } else if (message.channel === 'performance') {
          await this.subscribeToPerformance(ws);
        }
        break;
      case 'unsubscribe':
        if (message.tickers && message.channel === 'spreads') {
          this.unsubscribeFromSpreads(ws, message.tickers);
        } else if (message.channel === 'portfolio') {
          this.unsubscribeFromPortfolio(ws);
        } else if (message.channel === 'performance') {
          this.unsubscribeFromPerformance(ws);
        }
        break;
      case 'ping':
        this.send(ws, {
          type: 'pong',
          timestamp: new Date().toISOString()
        });
        break;
    }
  }

  private async subscribeToSpreads(ws: WebSocket, tickers: string[]) {
    const clientSubs = this.clients.get(ws) || new Set();
    
    for (const ticker of tickers) {
      const subKey = `spread:${ticker}`;
      clientSubs.add(subKey);
      
      // Add client to ticker subscription
      if (!this.subscriptions.has(subKey)) {
        this.subscriptions.set(subKey, new Set());
        this.startSpreadUpdates(ticker);
      }
      this.subscriptions.get(subKey)!.add(ws);
    }
    
    this.clients.set(ws, clientSubs);
  }

  private startSpreadUpdates(ticker: string) {
    const subKey = `spread:${ticker}`;
    
    // Clear any existing interval
    if (this.intervalHandles.has(subKey)) {
      clearInterval(this.intervalHandles.get(subKey)!);
    }

    // Start new interval for spread updates (every 30 seconds)
    const interval = setInterval(async () => {
      try {
        const spreads = await this.polygonService.getOptionSpreads(ticker);
        
        if (spreads && spreads.length > 0) {
          // Store spreads in database
          const spreadRecords: InsertLiveSpread[] = spreads.map(spread => ({
            ticker,
            expiration: spread.expiration,
            strike: spread.strike,
            option_type: spread.option_type,
            bid: spread.bid,
            ask: spread.ask,
            mid: spread.mid,
            spread: spread.spread,
            spread_pct: spread.spread_pct,
            volume: spread.volume || 0,
            open_interest: spread.open_interest || 0,
            iv: spread.iv || 0,
            delta: spread.delta || 0,
            gamma: spread.gamma || 0,
            theta: spread.theta || 0,
            vega: spread.vega || 0
          }));

          // Store in database (implement this method in storage)
          // await this.storage.saveLiveSpreads(spreadRecords);

          // Broadcast to all subscribed clients
          const clients = this.subscriptions.get(subKey);
          if (clients) {
            const response: WSResponse = {
              type: 'spread_update',
              data: {
                ticker,
                spreads: spreads.slice(0, 10) // Send top 10 most liquid
              },
              timestamp: new Date().toISOString()
            };
            
            clients.forEach(client => {
              if (client.readyState === WebSocket.OPEN) {
                this.send(client, response);
              }
            });
          }
        }
      } catch (error) {
        console.error(`Error updating spreads for ${ticker}:`, error);
      }
    }, 30000); // Update every 30 seconds

    this.intervalHandles.set(subKey, interval);

    // Send initial data immediately
    this.sendInitialSpreadData(ticker);
  }

  private async sendInitialSpreadData(ticker: string) {
    try {
      const spreads = await this.polygonService.getOptionSpreads(ticker);
      const subKey = `spread:${ticker}`;
      const clients = this.subscriptions.get(subKey);
      
      if (clients && spreads) {
        const response: WSResponse = {
          type: 'spread_update',
          data: {
            ticker,
            spreads: spreads.slice(0, 10),
            initial: true
          },
          timestamp: new Date().toISOString()
        };
        
        clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            this.send(client, response);
          }
        });
      }
    } catch (error) {
      console.error(`Error sending initial spread data for ${ticker}:`, error);
    }
  }

  private async subscribeToPortfolio(ws: WebSocket) {
    const clientSubs = this.clients.get(ws) || new Set();
    const subKey = 'portfolio:updates';
    clientSubs.add(subKey);
    
    if (!this.subscriptions.has(subKey)) {
      this.subscriptions.set(subKey, new Set());
      this.startPortfolioUpdates();
    }
    this.subscriptions.get(subKey)!.add(ws);
    this.clients.set(ws, clientSubs);

    // Send initial portfolio data
    await this.sendInitialPortfolioData(ws);
  }

  private startPortfolioUpdates() {
    const subKey = 'portfolio:updates';
    
    if (this.intervalHandles.has(subKey)) {
      clearInterval(this.intervalHandles.get(subKey)!);
    }

    // Update portfolio every 60 seconds
    const interval = setInterval(async () => {
      try {
        const portfolioData = await this.storage.getPortfolioSummary();
        const openTrades = await this.storage.getOpenPaperTrades('default');
        
        const clients = this.subscriptions.get(subKey);
        if (clients) {
          const response: WSResponse = {
            type: 'portfolio_update',
            data: {
              summary: portfolioData,
              openTrades: openTrades
            },
            timestamp: new Date().toISOString()
          };
          
          clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
              this.send(client, response);
            }
          });
        }
      } catch (error) {
        console.error('Error updating portfolio:', error);
      }
    }, 60000);

    this.intervalHandles.set(subKey, interval);
  }

  private async sendInitialPortfolioData(ws: WebSocket) {
    try {
      const portfolioData = await this.storage.getPortfolioSummary();
      const openTrades = await this.storage.getOpenPaperTrades('default');
      
      const response: WSResponse = {
        type: 'portfolio_update',
        data: {
          summary: portfolioData,
          openTrades: openTrades,
          initial: true
        },
        timestamp: new Date().toISOString()
      };
      
      this.send(ws, response);
    } catch (error) {
      console.error('Error sending initial portfolio data:', error);
    }
  }

  private async subscribeToPerformance(ws: WebSocket) {
    const clientSubs = this.clients.get(ws) || new Set();
    const subKey = 'performance:metrics';
    clientSubs.add(subKey);
    
    if (!this.subscriptions.has(subKey)) {
      this.subscriptions.set(subKey, new Set());
      this.startPerformanceUpdates();
    }
    this.subscriptions.get(subKey)!.add(ws);
    this.clients.set(ws, clientSubs);

    // Send initial performance data
    await this.sendInitialPerformanceData(ws);
  }

  private startPerformanceUpdates() {
    const subKey = 'performance:metrics';
    
    if (this.intervalHandles.has(subKey)) {
      clearInterval(this.intervalHandles.get(subKey)!);
    }

    // Update performance metrics every 5 minutes
    const interval = setInterval(async () => {
      try {
        // Get performance metrics from database
        // const metrics = await this.storage.getPerformanceMetrics();
        
        const clients = this.subscriptions.get(subKey);
        if (clients) {
          const response: WSResponse = {
            type: 'performance_update',
            data: {
              // metrics
              placeholder: 'Performance metrics will go here'
            },
            timestamp: new Date().toISOString()
          };
          
          clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
              this.send(client, response);
            }
          });
        }
      } catch (error) {
        console.error('Error updating performance metrics:', error);
      }
    }, 300000); // Every 5 minutes

    this.intervalHandles.set(subKey, interval);
  }

  private async sendInitialPerformanceData(ws: WebSocket) {
    try {
      // Get initial performance metrics
      // const metrics = await this.storage.getPerformanceMetrics();
      
      const response: WSResponse = {
        type: 'performance_update',
        data: {
          // metrics,
          placeholder: 'Initial performance metrics',
          initial: true
        },
        timestamp: new Date().toISOString()
      };
      
      this.send(ws, response);
    } catch (error) {
      console.error('Error sending initial performance data:', error);
    }
  }

  private unsubscribeFromSpreads(ws: WebSocket, tickers: string[]) {
    const clientSubs = this.clients.get(ws);
    if (!clientSubs) return;

    for (const ticker of tickers) {
      const subKey = `spread:${ticker}`;
      clientSubs.delete(subKey);
      
      const tickerSubs = this.subscriptions.get(subKey);
      if (tickerSubs) {
        tickerSubs.delete(ws);
        
        // If no more clients subscribed to this ticker, stop updates
        if (tickerSubs.size === 0) {
          this.subscriptions.delete(subKey);
          const interval = this.intervalHandles.get(subKey);
          if (interval) {
            clearInterval(interval);
            this.intervalHandles.delete(subKey);
          }
        }
      }
    }
  }

  private unsubscribeFromPortfolio(ws: WebSocket) {
    this.unsubscribeFromChannel(ws, 'portfolio:updates');
  }

  private unsubscribeFromPerformance(ws: WebSocket) {
    this.unsubscribeFromChannel(ws, 'performance:metrics');
  }

  private unsubscribeFromChannel(ws: WebSocket, channel: string) {
    const clientSubs = this.clients.get(ws);
    if (!clientSubs) return;

    clientSubs.delete(channel);
    
    const channelSubs = this.subscriptions.get(channel);
    if (channelSubs) {
      channelSubs.delete(ws);
      
      if (channelSubs.size === 0) {
        this.subscriptions.delete(channel);
        const interval = this.intervalHandles.get(channel);
        if (interval) {
          clearInterval(interval);
          this.intervalHandles.delete(channel);
        }
      }
    }
  }

  private cleanupClient(ws: WebSocket) {
    const clientSubs = this.clients.get(ws);
    if (clientSubs) {
      clientSubs.forEach(subKey => {
        const subs = this.subscriptions.get(subKey);
        if (subs) {
          subs.delete(ws);
          if (subs.size === 0) {
            this.subscriptions.delete(subKey);
            const interval = this.intervalHandles.get(subKey);
            if (interval) {
              clearInterval(interval);
              this.intervalHandles.delete(subKey);
            }
          }
        }
      });
      this.clients.delete(ws);
    }
  }

  private send(ws: WebSocket, response: WSResponse) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(response));
    }
  }

  private sendError(ws: WebSocket, error: string) {
    this.send(ws, {
      type: 'error',
      error,
      timestamp: new Date().toISOString()
    });
  }

  public shutdown() {
    // Clear all intervals
    this.intervalHandles.forEach(interval => clearInterval(interval));
    this.intervalHandles.clear();

    // Close all connections
    this.wss.clients.forEach(ws => {
      ws.close();
    });

    this.clients.clear();
    this.subscriptions.clear();
  }
}