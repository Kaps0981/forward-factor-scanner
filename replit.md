# Forward Factor Scanner

A professional options trading scanner that identifies volatility mispricing opportunities using Forward Factor analysis and Polygon.io market data.

## Overview

The Forward Factor Scanner is a fullstack JavaScript application that helps traders identify BUY and SELL signals based on options volatility term structure mispricing. It scans multiple stocks simultaneously, calculates Forward Factor for option expiration pairs, and presents opportunities in a clean, professional trading interface.

## Tech Stack

- **Frontend**: React, TypeScript, Tailwind CSS, Shadcn UI
- **Backend**: Express.js, Node.js, TypeScript
- **API Integration**: Polygon.io for real-time options data
- **State Management**: TanStack Query (React Query)
- **Theming**: Dark/Light mode support

## Key Features

### Scanning
- **Default Stock List**: 100+ curated quality mid-cap stocks across multiple sectors
- **Custom Ticker Input**: Scan specific tickers of your choice
- **Watchlist Management**: Save and manage ticker lists for quick scanning
- **Configurable Filters**: Adjust Forward Factor range (-100% to +100%) and top N results
- **Rate Limiting**: Automatic 12-second delay between tickers to comply with Polygon.io API limits

### Analysis
- **Forward Factor Calculation**: Analyzes volatility term structure across option expiration pairs
- **ATM Filtering**: Filters options within ±10% of stock price for accurate IV calculations
- **Signal Generation**: 
  - **BUY Signal** (Negative FF): Near-term volatility underpriced
  - **SELL Signal** (Positive FF): Near-term volatility overpriced

### User Interface
- **Professional Trading Design**: Dark mode optimized with Bloomberg Terminal aesthetic
- **Sortable Results Table**: Click column headers to sort by ticker, FF, DTE, etc.
- **Summary Cards**: Real-time analytics showing tickers scanned, opportunities found, average |FF|
- **Progress Indicator**: Visual feedback during long scans with estimated progress
- **CSV Export**: Download results for further analysis in Excel/Sheets
- **Scan History**: View past scans with timestamps and detailed results
- **Watchlists**: Create, manage, and quickly scan saved ticker lists

## Architecture

### Data Flow
1. User configures scan parameters (tickers, FF range, top N)
2. Frontend sends scan request to `/api/scan` endpoint
3. Backend fetches options data from Polygon.io for each ticker
4. Scanner calculates Forward Factor for all expiration pairs
5. Results filtered, sorted by |FF| magnitude, and returned to frontend
6. Frontend displays opportunities in sortable table with color-coded signals

### Key Components

#### Frontend (`client/src/`)
- `pages/Scanner.tsx`: Main page with scan orchestration
- `pages/History.tsx`: Scan history listing page
- `pages/ScanDetail.tsx`: Detailed view of past scan results
- `pages/Watchlists.tsx`: Watchlist management page
- `components/ScanControls.tsx`: Ticker input, filters, scan button with watchlist support
- `components/ResultsTable.tsx`: Sortable table with BUY/SELL signals
- `components/SummaryCards.tsx`: Analytics dashboard
- `components/ScanProgress.tsx`: Loading state with progress bar
- `components/ThemeToggle.tsx`: Dark/light mode switcher

#### Backend (`server/`)
- `routes.ts`: API endpoints (scan, history, watchlists)
- `scanner.ts`: Forward Factor calculation engine with ATM filtering
- `polygon.ts`: Polygon.io API integration service
- `storage.ts`: PostgreSQL storage layer with Drizzle ORM
- `db.ts`: Database connection configuration

#### Shared (`shared/`)
- `schema.ts`: TypeScript types and Zod schemas for API contracts

## API Endpoints

### GET `/api/health`
Health check to verify API key configuration
```json
{
  "status": "ok",
  "api_key_configured": true
}
```

### GET `/api/default-tickers`
Returns the default ticker list
```json
{
  "tickers": ["PLTR", "SNOW", "DDOG", ...]
}
```

### POST `/api/scan`
Run Forward Factor scan
```json
// Request
{
  "tickers": ["PLTR", "ROKU", "NET"],  // optional
  "min_ff": -100,                       // optional
  "max_ff": 100,                        // optional
  "top_n": 20                           // optional
}

// Response
{
  "success": true,
  "scan_id": 123,
  "opportunities": [
    {
      "ticker": "PLTR",
      "forward_factor": -42.5,
      "signal": "BUY",
      "front_date": "2025-11-15",
      "front_dte": 34,
      "front_iv": 45.2,
      "back_date": "2025-11-22",
      "back_dte": 41,
      "back_iv": 52.8,
      "forward_vol": 78.6
    }
  ],
  "total_tickers_scanned": 3,
  "total_opportunities_found": 1
}
```

### GET `/api/scans`
Get all scan history
```json
{
  "scans": [
    {
      "id": 123,
      "timestamp": "2025-10-12T10:30:00Z",
      "tickers_scanned": 3,
      "total_opportunities": 1,
      "min_ff": -100,
      "max_ff": 100,
      "top_n": 20,
      "tickers_list": ["PLTR", "ROKU", "NET"]
    }
  ]
}
```

### GET `/api/scans/:id`
Get scan details with opportunities
```json
{
  "scan": {
    "id": 123,
    "timestamp": "2025-10-12T10:30:00Z",
    "tickers_scanned": 3,
    "total_opportunities": 1,
    "min_ff": -100,
    "max_ff": 100,
    "top_n": 20,
    "tickers_list": ["PLTR", "ROKU", "NET"]
  },
  "opportunities": [...]
}
```

### GET `/api/watchlists`
Get all watchlists
```json
{
  "watchlists": [
    {
      "id": 1,
      "name": "Tech Growth",
      "tickers": ["PLTR", "SNOW", "NET", "DDOG"],
      "created_at": "2025-10-12T10:00:00Z"
    }
  ]
}
```

### POST `/api/watchlists`
Create a new watchlist
```json
// Request
{
  "name": "Tech Growth",
  "tickers": ["PLTR", "SNOW", "NET", "DDOG"]
}

// Response
{
  "watchlist": {
    "id": 1,
    "name": "Tech Growth",
    "tickers": ["PLTR", "SNOW", "NET", "DDOG"],
    "created_at": "2025-10-12T10:00:00Z"
  }
}
```

### PATCH `/api/watchlists/:id`
Update a watchlist
```json
// Request
{
  "name": "Updated Name",
  "tickers": ["PLTR", "SNOW"]
}
```

### DELETE `/api/watchlists/:id`
Delete a watchlist
```json
{
  "success": true
}
```

## Forward Factor Methodology

### Calculation
1. **Fetch Options Data**: Get all option contracts for a ticker from Polygon.io
2. **Estimate Stock Price**: Use ATM call delta (≈0.5) to estimate current price
3. **Group by Expiration**: Organize options by expiration date
4. **Calculate ATM IV**: Average implied volatility of ATM options (within ±10% of stock price)
5. **Compute Forward Factor**:
   - Front variance = (Front IV)² × (Front DTE / 365)
   - Back variance = (Back IV)² × (Back DTE / 365)
   - Forward variance = Back variance - Front variance
   - Forward Vol = √(Forward variance / (DTE diff / 365))
   - **Forward Factor = ((Front IV - Forward Vol) / Forward Vol) × 100**

### Interpretation
- **Negative FF (BUY)**: Front-month options are underpriced relative to forward period → Buy front-month
- **Positive FF (SELL)**: Front-month options are overpriced relative to forward period → Sell front-month (or buy calendar spreads)
- **|FF| > 40%**: Strong signal
- **|FF| 20-40%**: Moderate signal
- **|FF| < 20%**: Weak signal

## Environment Variables

- `POLYGON_API_KEY`: Your Polygon.io API key (required)
- `SESSION_SECRET`: Express session secret (pre-configured)

## Running the Application

```bash
npm run dev
```

Application runs on `http://localhost:5000`

## Design System

### Colors
- **Dark Mode Primary**: Deep charcoal backgrounds (222° 20% 8%)
- **BUY Signal**: Emerald green (142° 76% 36%)
- **SELL Signal**: Red (0° 72% 51%)
- **Primary Action**: Blue (217° 91% 60%)

### Typography
- **Primary Font**: Inter (clean, excellent for numbers)
- **Monospace Font**: JetBrains Mono (for financial data)
- **Tabular Numbers**: All numeric values use monospace with tabular-nums for perfect alignment

### Spacing
- Card padding: 1.5rem (p-6)
- Component gaps: 1rem, 1.5rem (gap-4, gap-6)
- Container: max-w-7xl with responsive padding

## Trading Considerations

⚠️ **Important Notes**:
1. **Check for Catalysts**: Always verify no upcoming earnings before trading signals
2. **Liquidity Check**: Ensure option open interest >100 and tight bid-ask spreads
3. **Position Sizing**: Start small (1-2% of portfolio per trade)
4. **Educational Tool**: Not financial advice - always do your own research

## Known Limitations

1. **Progress Updates**: Uses simulated progress bar (no real-time per-ticker updates via SSE/WebSocket)
2. **Polygon API Limits**: Free tier has 5 requests/minute; scanner auto-delays 12s between tickers
3. **Ticker Limit**: Maximum 30 tickers per scan to prevent timeouts
4. **IV Values**: Polygon.io returns lower IV values than expected; relative FF calculations remain valid

## Future Enhancements

- Real-time progress updates via Server-Sent Events (SSE)
- Earnings calendar integration to flag event-driven term structures
- Automated daily scans with email notifications
- Live price updates via WebSocket during market hours

## Project Status

**Current Version**: 2.0 (Phase 2 Complete)
**Last Updated**: October 12, 2025

All core features are implemented and functional:
✅ Polygon.io integration with rate limiting
✅ Forward Factor calculation engine
✅ ATM filtering (±10% threshold)
✅ Default ticker list (100+ stocks)
✅ Custom ticker input
✅ Watchlist management (create, view, delete, quick scan)
✅ Configurable filters (FF range, top N)
✅ Sortable results table
✅ Summary analytics dashboard
✅ CSV export (always visible, disabled when no results)
✅ PostgreSQL persistence with Drizzle ORM
✅ Scan history with detailed views
✅ Dark/light mode
✅ Responsive design
✅ Loading states and robust error handling
✅ Progress indicator with interval cleanup
✅ JSON response parsing with error handling

## Recent Bug Fixes

### Critical Fix (Oct 12, 2025)
**Issue**: Scan results not updating in UI after backend completion
**Root Cause**: `apiRequest()` returns a `Response` object, but code was treating it as parsed JSON data
**Solution**: Added `await response.json()` to parse Response before use, with try/catch for JSON parse errors

### UX Improvement (Oct 12, 2025)
**Issue**: Export CSV button not visible when no results
**Solution**: Changed ResultsTable to always show Export button, but disable it when `opportunities.length === 0`
