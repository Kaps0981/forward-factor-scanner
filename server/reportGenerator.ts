import { type Opportunity, type Scan } from '@shared/schema';
import { analyzeOpportunityQuality, generateTradingThesis } from './qualityFilters';

export interface ReportData {
  scan: Scan;
  opportunities: Opportunity[];
  qualitySetups: Opportunity[];
  rejectedSetups: Opportunity[];
}

/**
 * Generate a professional HTML report for scan results
 */
export function generateHTMLReport(data: ReportData): string {
  const { scan, opportunities, qualitySetups, rejectedSetups } = data;
  const scanDate = new Date(scan.timestamp).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  const scanTime = new Date(scan.timestamp).toLocaleTimeString('en-US');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Forward Factor Scan Report - ${scanDate}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Inter', -apple-system, sans-serif;
      line-height: 1.6;
      color: #1a1a1a;
      background: #f9fafb;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 2rem;
    }
    .header {
      background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
      color: white;
      padding: 2.5rem;
      border-radius: 12px;
      margin-bottom: 2rem;
      box-shadow: 0 10px 25px rgba(30, 64, 175, 0.15);
    }
    .header h1 {
      font-size: 2rem;
      margin-bottom: 0.5rem;
    }
    .header .subtitle {
      opacity: 0.9;
      font-size: 1.1rem;
    }
    .summary-cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 1.5rem;
      margin-bottom: 2rem;
    }
    .card {
      background: white;
      padding: 1.5rem;
      border-radius: 8px;
      border: 1px solid #e5e7eb;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
    .card h3 {
      font-size: 0.875rem;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 0.5rem;
    }
    .card .value {
      font-size: 2rem;
      font-weight: bold;
      color: #1f2937;
    }
    .card.success .value { color: #16a34a; }
    .card.warning .value { color: #eab308; }
    .card.danger .value { color: #dc2626; }
    
    .section {
      background: white;
      border-radius: 8px;
      border: 1px solid #e5e7eb;
      padding: 1.5rem;
      margin-bottom: 2rem;
    }
    .section h2 {
      font-size: 1.5rem;
      color: #1f2937;
      margin-bottom: 1rem;
      padding-bottom: 0.75rem;
      border-bottom: 2px solid #e5e7eb;
    }
    
    .table-container {
      overflow-x: auto;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.95rem;
    }
    th {
      background: #f9fafb;
      padding: 0.75rem;
      text-align: left;
      font-weight: 600;
      color: #374151;
      border-bottom: 2px solid #e5e7eb;
    }
    th.right { text-align: right; }
    th.center { text-align: center; }
    
    td {
      padding: 0.75rem;
      border-bottom: 1px solid #f3f4f6;
    }
    td.right { text-align: right; font-family: monospace; }
    td.center { text-align: center; }
    
    tr:hover {
      background: #f9fafb;
    }
    
    .quality-badge {
      display: inline-block;
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      font-size: 0.875rem;
      font-weight: 500;
    }
    .quality-high {
      background: #dcfce7;
      color: #16a34a;
    }
    .quality-medium {
      background: #fef3c7;
      color: #ca8a04;
    }
    .quality-low {
      background: #fee2e2;
      color: #dc2626;
    }
    
    .signal-badge {
      display: inline-block;
      padding: 0.25rem 0.75rem;
      border-radius: 4px;
      font-size: 0.875rem;
      font-weight: 600;
    }
    .signal-buy {
      background: #dcfce7;
      color: #16a34a;
    }
    .signal-sell {
      background: #fee2e2;
      color: #dc2626;
    }
    
    .thesis {
      background: #f9fafb;
      padding: 1rem;
      border-left: 3px solid #3b82f6;
      border-radius: 4px;
      margin: 1rem 0;
      font-size: 0.95rem;
      line-height: 1.7;
      color: #4b5563;
    }
    
    .rejection {
      background: #fef2f2;
      border: 1px solid #fecaca;
      padding: 0.75rem;
      border-radius: 4px;
      margin: 0.5rem 0;
      color: #991b1b;
      font-size: 0.9rem;
    }
    
    .disclaimer {
      background: #fef3c7;
      border: 1px solid #fcd34d;
      padding: 1.5rem;
      border-radius: 8px;
      margin-top: 2rem;
    }
    .disclaimer h3 {
      color: #92400e;
      margin-bottom: 0.75rem;
    }
    .disclaimer p {
      color: #78350f;
      font-size: 0.95rem;
    }
    
    .footer {
      text-align: center;
      padding: 2rem;
      color: #6b7280;
      font-size: 0.875rem;
    }
    
    @media print {
      .header { break-inside: avoid; }
      .section { break-inside: avoid; }
      tr { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📊 Forward Factor Scan Report</h1>
      <div class="subtitle">
        ${scanDate} at ${scanTime} • Scan ID: ${scan.id}
      </div>
    </div>

    <div class="summary-cards">
      <div class="card">
        <h3>Tickers Scanned</h3>
        <div class="value">${scan.tickers_scanned}</div>
      </div>
      <div class="card ${qualitySetups.length > 0 ? 'success' : ''}">
        <h3>Quality Setups</h3>
        <div class="value">${qualitySetups.length}</div>
      </div>
      <div class="card ${rejectedSetups.length > 0 ? 'warning' : ''}">
        <h3>Rejected</h3>
        <div class="value">${rejectedSetups.length}</div>
      </div>
      <div class="card">
        <h3>Avg |FF|</h3>
        <div class="value">
          ${opportunities.length > 0 
            ? (opportunities.reduce((sum, o) => sum + Math.abs(o.forward_factor), 0) / opportunities.length).toFixed(1)
            : 0}%
        </div>
      </div>
    </div>

    ${qualitySetups.length > 0 ? `
    <div class="section">
      <h2>✅ Quality Trading Opportunities</h2>
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Ticker</th>
              <th class="center">Quality</th>
              <th class="center">Signal</th>
              <th class="right">FF %</th>
              <th class="right">Probability</th>
              <th class="right">Risk/Reward</th>
              <th>Front (DTE/IV)</th>
              <th>Back (DTE/IV)</th>
              <th class="right">Liquidity</th>
            </tr>
          </thead>
          <tbody>
            ${qualitySetups.map(opp => `
            <tr>
              <td><strong>${opp.ticker}</strong></td>
              <td class="center">
                <span class="quality-badge ${
                  (opp.quality_score || 0) >= 8 ? 'quality-high' : 
                  (opp.quality_score || 0) >= 6 ? 'quality-medium' : 
                  'quality-low'
                }">
                  ${opp.quality_score}/10
                </span>
              </td>
              <td class="center">
                <span class="signal-badge signal-${opp.signal.toLowerCase()}">
                  ${opp.signal}
                </span>
              </td>
              <td class="right" style="color: ${opp.forward_factor < 0 ? '#16a34a' : '#dc2626'}; font-weight: bold;">
                ${opp.forward_factor > 0 ? '+' : ''}${opp.forward_factor.toFixed(1)}%
              </td>
              <td class="right">${opp.probability || '—'}%</td>
              <td class="right">${opp.risk_reward || '—'}:1</td>
              <td>${opp.front_dte}d / ${opp.front_iv.toFixed(1)}%</td>
              <td>${opp.back_dte}d / ${opp.back_iv.toFixed(1)}%</td>
              <td class="right">${opp.avg_open_interest || '—'}</td>
            </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      
      ${qualitySetups.slice(0, 3).map(opp => {
        const analysis = analyzeOpportunityQuality(opp);
        const thesis = generateTradingThesis(opp, analysis);
        return `
        <div class="thesis">
          <strong>${opp.ticker} Trading Thesis:</strong><br>
          ${thesis}
        </div>
        `;
      }).join('')}
    </div>
    ` : `
    <div class="section">
      <h2>⚠️ No Quality Setups Found</h2>
      <p style="color: #6b7280; margin-top: 1rem;">
        The scanner applied strict quality filters and found no opportunities meeting the criteria.
        This is normal and expected - the scanner is designed to be highly selective.
      </p>
    </div>
    `}

    ${rejectedSetups.length > 0 ? `
    <div class="section">
      <h2>❌ Rejected Opportunities</h2>
      <p style="color: #6b7280; margin-bottom: 1rem;">
        The following ${rejectedSetups.length} opportunities were analyzed but failed quality checks:
      </p>
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Ticker</th>
              <th class="right">FF %</th>
              <th>Rejection Reason</th>
            </tr>
          </thead>
          <tbody>
            ${rejectedSetups.slice(0, 10).map(opp => `
            <tr>
              <td><strong>${opp.ticker}</strong></td>
              <td class="right" style="color: ${opp.forward_factor < 0 ? '#16a34a' : '#dc2626'};">
                ${opp.forward_factor > 0 ? '+' : ''}${opp.forward_factor.toFixed(1)}%
              </td>
              <td>
                ${(opp.rejection_reasons || []).slice(0, 1).join(', ') || 'Quality score too low'}
              </td>
            </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
    ` : ''}

    <div class="disclaimer">
      <h3>⚠️ Important Disclaimer</h3>
      <p>
        This report is for educational and informational purposes only. It is not financial advice.
        Options trading involves significant risk and you can lose your entire investment.
        Always verify earnings dates, check liquidity, and consult with a licensed financial advisor.
        Past performance does not guarantee future results.
      </p>
    </div>

    <div class="footer">
      <p>Generated by Forward Factor Scanner • Professional Options Analysis Tool</p>
      <p>Data source: Polygon.io • Methodology: Forward Volatility Term Structure Analysis</p>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Generate a markdown report for scan results
 */
export function generateMarkdownReport(data: ReportData): string {
  const { scan, opportunities, qualitySetups, rejectedSetups } = data;
  const scanDate = new Date(scan.timestamp).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  const scanTime = new Date(scan.timestamp).toLocaleTimeString('en-US');
  
  let report = `# Forward Factor Scan Report

**Date**: ${scanDate}  
**Time**: ${scanTime}  
**Scan ID**: ${scan.id}

---

## Executive Summary

- **Tickers Scanned**: ${scan.tickers_scanned}
- **Quality Setups**: ${qualitySetups.length}
- **Rejected**: ${rejectedSetups.length}
- **Average |FF|**: ${opportunities.length > 0 
    ? (opportunities.reduce((sum, o) => sum + Math.abs(o.forward_factor), 0) / opportunities.length).toFixed(1)
    : 0}%

`;

  if (qualitySetups.length > 0) {
    report += `
## ✅ Quality Trading Opportunities

| Ticker | Quality | Signal | FF % | Probability | Risk/Reward | Front (DTE/IV) | Back (DTE/IV) | Liquidity |
|--------|---------|--------|------|-------------|-------------|----------------|---------------|-----------|
`;
    
    qualitySetups.forEach(opp => {
      report += `| **${opp.ticker}** | ${opp.quality_score}/10 | ${opp.signal} | ${opp.forward_factor > 0 ? '+' : ''}${opp.forward_factor.toFixed(1)}% | ${opp.probability || '—'}% | ${opp.risk_reward || '—'}:1 | ${opp.front_dte}d / ${opp.front_iv.toFixed(1)}% | ${opp.back_dte}d / ${opp.back_iv.toFixed(1)}% | ${opp.avg_open_interest || '—'} |\n`;
    });
    
    report += '\n### Trading Theses\n\n';
    
    qualitySetups.slice(0, 3).forEach(opp => {
      const analysis = analyzeOpportunityQuality(opp);
      const thesis = generateTradingThesis(opp, analysis);
      report += `**${opp.ticker}**: ${thesis}\n\n`;
    });
  } else {
    report += `
## ⚠️ No Quality Setups Found

The scanner applied strict quality filters and found no opportunities meeting the criteria.
This is normal and expected - the scanner is designed to be highly selective.

`;
  }
  
  if (rejectedSetups.length > 0) {
    report += `
## ❌ Rejected Opportunities

The following opportunities were analyzed but failed quality checks:

| Ticker | FF % | Rejection Reason |
|--------|------|------------------|
`;
    
    rejectedSetups.slice(0, 10).forEach(opp => {
      const reason = (opp.rejection_reasons || []).slice(0, 1).join(', ') || 'Quality score too low';
      report += `| **${opp.ticker}** | ${opp.forward_factor > 0 ? '+' : ''}${opp.forward_factor.toFixed(1)}% | ${reason} |\n`;
    });
  }
  
  report += `

---

## ⚠️ Important Disclaimer

This report is for educational and informational purposes only. It is not financial advice.
Options trading involves significant risk and you can lose your entire investment.
Always verify earnings dates, check liquidity, and consult with a licensed financial advisor.

---

*Generated by Forward Factor Scanner • Data source: Polygon.io*
`;
  
  return report;
}