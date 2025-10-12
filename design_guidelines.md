# Forward Factor Scanner - Design Guidelines

## Design Approach: Professional Trading Interface

**Selected Approach:** Design System-Based (Linear + Bloomberg Terminal aesthetic)
**Justification:** This is a utility-focused trading tool where data clarity, scan efficiency, and professional credibility are paramount. Traders need to quickly identify opportunities without visual distractions.

**Core Principles:**
- **Data First:** Information hierarchy optimized for rapid scanning
- **Professional Credibility:** Clean, sophisticated aesthetic that commands trust
- **Signal Clarity:** Unmistakable visual indicators for BUY/SELL opportunities
- **Functional Density:** Maximum information without clutter

---

## Color Palette

### Dark Mode (Primary)
**Background Layers:**
- Base: 222 20% 8% (deep charcoal)
- Elevated: 222 18% 11% (card surface)
- Interactive: 222 16% 14% (hover states)

**Signal Colors:**
- BUY Signal (Green): 142 76% 36% (emerald-600 equivalent)
- SELL Signal (Red): 0 72% 51% (red-600 equivalent)
- Neutral Data: 214 15% 70% (slate-300 for text)

**Accent & UI:**
- Primary Action: 217 91% 60% (blue-500)
- Border/Divider: 222 15% 20% (subtle separation)
- Muted Text: 214 10% 50% (secondary information)

### Light Mode (Secondary)
- Base: 0 0% 98%
- Elevated: 0 0% 100%
- BUY: 142 76% 32% (darker green for contrast)
- SELL: 0 84% 46% (deeper red for readability)

---

## Typography

**Font Stack:**
- Primary: 'Inter', system-ui, sans-serif (clean, excellent for numbers)
- Monospace: 'JetBrains Mono', 'Fira Code', monospace (for financial data/numbers)

**Scale:**
- Page Titles: text-2xl font-semibold (24px)
- Section Headers: text-lg font-medium (18px)
- Data Labels: text-sm font-medium (14px)
- Table Data: text-sm (14px, monospace for numbers)
- Metadata: text-xs text-muted (12px)

**Special Treatments:**
- Forward Factor values: Monospace, font-semibold
- Ticker symbols: Uppercase, font-medium, tracking-wide
- Percentages: Tabular numbers for alignment

---

## Layout System

**Spacing Primitives:** Use Tailwind units of 2, 4, 6, and 8 (8px increments)
- Component padding: p-6 (cards, containers)
- Section gaps: gap-4, gap-6 (between elements)
- Page margins: px-6 md:px-8 (responsive containment)

**Grid Structure:**
- Container: max-w-7xl mx-auto
- Two-column controls: grid grid-cols-1 md:grid-cols-2 gap-4
- Summary cards: grid grid-cols-3 gap-4 (desktop), single column mobile

---

## Component Library

### Navigation/Header
- Fixed top bar with scan controls
- Logo/title left, API status indicator right
- Subtle bottom border (border-b)
- Height: h-16, bg-elevated surface

### Scan Control Panel
- Grouped controls in elevated card (rounded-lg border)
- Pill-style toggle: "Default Stocks" vs "Custom Tickers"
- Input fields with monospace font for ticker entry
- Range sliders for FF min/max filters
- Primary action button: "Run Scan" (prominent, full-width on mobile)

### Summary Cards (3-across)
- Elevated surface with subtle border
- Large number display (text-3xl font-bold)
- Descriptive label below (text-sm text-muted)
- Icons: Search, TrendingUp, Database

### Results Table
- Sticky header (position: sticky top-0)
- Zebra striping: even rows with bg-elevated
- Sortable columns with arrow indicators
- Column alignment:
  - Ticker: left, font-medium
  - Forward Factor: right, monospace, color-coded
  - Signal: center, badge style
  - Dates: left, text-sm
  - IV/Vol: right, monospace

**Signal Badges:**
- BUY: Green background (bg-green-500/10), green text, green border
- SELL: Red background (bg-red-500/10), red text, red border
- Rounded-full, px-3 py-1, text-xs font-semibold

### Data Display
- All numerical data: Tabular figures (font-variant-numeric: tabular-nums)
- Percentages: Include + or - prefix for clarity
- Date format: MMM DD, YYYY (compact but clear)

### Export Button
- Secondary action: outline variant
- Icon: Download, text: "Export CSV"
- Position: Top-right of results section

### Loading States
- Skeleton loaders for table rows (animate-pulse)
- Progress indicator: Linear bar with percentage
- Scanning status: "Scanning TICKER... (X/Y complete)"

---

## Interactive States

**Buttons:**
- Primary: bg-blue-600 hover:bg-blue-500
- Secondary: border with hover:bg-accent
- Disabled: opacity-50 cursor-not-allowed

**Table:**
- Row hover: bg-muted/50 (subtle highlight)
- Sortable headers: hover:bg-accent cursor-pointer
- Active sort: Arrow icon, text-primary color

**Inputs:**
- Focus: ring-2 ring-blue-500 (clear focus indicator)
- Error: ring-red-500 border-red-500

---

## Animations

**Minimal Use Only:**
- Table sort: 200ms ease-out opacity transition
- Button states: 150ms ease transition
- Card entry: Staggered fade-in (50ms delay between cards)
- No loading spinners - use progress bars only

---

## Images

This is a data-centric application with no hero imagery. Visual elements limited to:
- Icons from Lucide React (Search, TrendingUp, TrendingDown, Download, ChevronUp/Down)
- No decorative images
- Optional: Minimal chart visualization for IV term structure (future enhancement)

---

## Accessibility & Polish

- All interactive elements: Proper focus states with ring-2
- Color signals: Always paired with text labels (not color-only)
- Table: aria-sort attributes for screen readers
- Keyboard navigation: Full support for table sorting, filter controls
- Dark mode toggle: Smooth transition-colors duration-200

**Critical:** This is a professional trading tool. Every pixel should reinforce credibility, clarity, and speed. Avoid gradients, shadows (except subtle elevations), or decorative elements. Let the data be the hero.