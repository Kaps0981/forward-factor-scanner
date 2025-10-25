import { Opportunity } from "@shared/schema";

export function exportToCSV(opportunities: Opportunity[]) {
  if (!opportunities || opportunities.length === 0) return;
  
  const headers = [
    "Ticker",
    "Signal",
    "Forward Factor %",
    "Quality Score",
    "Probability %",
    "Risk/Reward",
    "Front Date",
    "Front DTE",
    "Front IV %",
    "Back Date",
    "Back DTE",
    "Back IV %",
    "Forward Vol %",
    "Open Interest",
    "Liquidity Score",
    "Position Size",
    "Earnings Date",
    "Stock Price",
    "Dividend Yield %"
  ];
  
  const rows = opportunities.map(opp => [
    opp.ticker,
    opp.signal,
    opp.forward_factor.toFixed(2),
    opp.quality_score?.toFixed(0) || "",
    opp.probability?.toFixed(0) || "",
    opp.risk_reward?.toFixed(2) || "",
    opp.front_date,
    opp.front_dte,
    opp.front_iv.toFixed(2),
    opp.back_date,
    opp.back_dte,
    opp.back_iv.toFixed(2),
    opp.forward_vol.toFixed(2),
    opp.avg_open_interest || "",
    opp.liquidity_score || opp.liquidity_score_enhanced || "",
    opp.position_size_recommendation || "",
    opp.earnings_date || "",
    opp.stock_price?.toFixed(2) || "",
    opp.dividend_yield?.toFixed(2) || ""
  ]);
  
  const csv = [
    headers.join(","),
    ...rows.map(row => row.join(","))
  ].join("\n");
  
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `forward-factor-scan-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}