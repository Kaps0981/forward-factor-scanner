#!/usr/bin/env python3.11
"""
Forward Factor Report Generator

Generates detailed markdown reports for trade recommendations
"""

from datetime import datetime
from typing import List
from ff_nightly_scanner import TradeAnalysis, Opportunity


class ReportGenerator:
    """Generates formatted reports for Forward Factor analysis"""
    
    def __init__(self):
        """Initialize report generator"""
        pass
    
    def generate_summary_section(self, quality_setups: List[TradeAnalysis], 
                                 rejected_setups: List[TradeAnalysis],
                                 scan_id: int) -> str:
        """Generate executive summary section"""
        total_analyzed = len(quality_setups) + len(rejected_setups)
        
        summary = f"""# Forward Factor Nightly Scan Report

**Date**: {datetime.now().strftime('%A, %B %d, %Y')}  
**Scan ID**: {scan_id}  
**Report Generated**: {datetime.now().strftime('%I:%M %p %Z')}

---

## Executive Summary

- **Total Opportunities Analyzed**: {total_analyzed}
- **Quality Setups Identified**: {len(quality_setups)}
- **Opportunities Rejected**: {len(rejected_setups)}

"""
        
        if len(quality_setups) == 0:
            summary += """
### ⚠️ No Quality Setups Found Tonight

The scanner applied strict quality filters and rejected all opportunities. This is **normal and expected** - the scanner is designed to be highly selective and only surface truly exceptional setups.

**Why so selective?**
- Most Forward Factor signals are FALSE POSITIVES from inverted term structures
- Inverted structures (front IV > back IV) typically indicate post-earnings IV decay, not mispricing
- We require normal term structures OR extremely high Forward Factor (>60%) to override
- DTE must be in optimal range (7-180 days)
- IV must be reasonable (15-150%)
- Calculations must verify correctly

**This is a feature, not a bug.** Better to have zero recommendations than to recommend mediocre trades.

"""
        else:
            summary += f"""
### ✅ {len(quality_setups)} High-Quality Setup{'s' if len(quality_setups) > 1 else ''} Identified

The following opportunities passed all quality filters and represent genuine volatility mispricings worth considering.

"""
        
        return summary
    
    def generate_opportunity_section(self, analysis: TradeAnalysis, rank: int) -> str:
        """Generate detailed section for a single opportunity"""
        opp = analysis.opportunity
        
        # Header
        section = f"""
---

## {rank}. {opp.ticker} - {opp.signal} Signal

**Rating**: {analysis.rating}/10 ⭐  
**Forward Factor**: {opp.forward_factor:+.1f}%  
**Probability**: {analysis.probability:.0f}%  
**Risk/Reward**: {analysis.risk_reward:.1f}:1

### Setup Details

| Parameter | Front Contract | Back Contract |
|-----------|---------------|---------------|
| **Expiration** | {opp.front_date} | {opp.back_date} |
| **DTE** | {opp.front_dte} days | {opp.back_dte} days |
| **Implied Volatility** | {opp.front_iv:.1f}% | {opp.back_iv:.1f}% |
| **Forward Volatility** | {opp.forward_vol:.1f}% | - |

**Term Structure**: {"⚠️ INVERTED" if opp.is_inverted() else "✅ NORMAL"} (Front IV {">" if opp.is_inverted() else "<"} Back IV)

### Trading Thesis

{analysis.thesis}

### Recommended Trade Structure

{analysis.trade_structure}

### Risk Analysis

**Maximum Loss**: Limited to debit paid (for debit spreads) or credit received (for credit spreads)  
**Maximum Gain**: Difference in option premiums at optimal price level  
**Break-Even**: Depends on entry prices and strike selection

**Key Risks**:
- Volatility risk: Actual volatility may differ from implied
- Time decay: Theta works against long positions
- Directional risk: Large moves can impact P&L
- Liquidity risk: Ensure tight bid-ask spreads before entering

### Execution Notes

1. **Check Earnings Calendar**: Verify no unexpected catalysts between expirations
2. **Assess Liquidity**: Ensure bid-ask spreads are reasonable (<5% of mid price)
3. **Size Appropriately**: Risk no more than 1-2% of portfolio on any single trade
4. **Set Alerts**: Monitor position and set profit targets / stop losses
5. **Paper Trade First**: Consider paper trading if new to calendar spreads

"""
        
        return section
    
    def generate_rejection_summary(self, rejected_setups: List[TradeAnalysis]) -> str:
        """Generate summary of rejected opportunities"""
        if len(rejected_setups) == 0:
            return ""
        
        section = """
---

## Rejected Opportunities

The following opportunities were analyzed but rejected for failing to meet quality criteria:

"""
        
        # Group rejections by reason
        rejection_categories = {
            'Inverted Term Structure': [],
            'DTE Out of Range': [],
            'Calculation Mismatch': [],
            'Forward Factor Too Low': [],
            'IV Out of Range': [],
            'Other': []
        }
        
        for analysis in rejected_setups:
            opp = analysis.opportunity
            reason = analysis.rejection_reasons[0] if analysis.rejection_reasons else "Unknown"
            
            # Categorize
            if 'Inverted term structure' in reason or 'FALSE SIGNAL' in reason:
                category = 'Inverted Term Structure'
            elif 'DTE' in reason:
                category = 'DTE Out of Range'
            elif 'calculation mismatch' in reason:
                category = 'Calculation Mismatch'
            elif 'Forward Factor too low' in reason:
                category = 'Forward Factor Too Low'
            elif 'IV' in reason:
                category = 'IV Out of Range'
            else:
                category = 'Other'
            
            rejection_categories[category].append((opp, reason))
        
        # Generate summary by category
        for category, items in rejection_categories.items():
            if items:
                section += f"\n### {category} ({len(items)} opportunities)\n\n"
                for opp, reason in items[:5]:  # Show first 5 in each category
                    section += f"- **{opp.ticker}** (FF: {opp.forward_factor:+.1f}%): {reason}\n"
                if len(items) > 5:
                    section += f"- *...and {len(items) - 5} more*\n"
        
        return section
    
    def generate_disclaimer(self) -> str:
        """Generate disclaimer section"""
        return """
---

## Important Disclaimers

⚠️ **This report is for educational and informational purposes only. It is not financial advice.**

### Key Points

1. **Do Your Own Research**: Always verify the analysis independently before trading
2. **Check Earnings Dates**: Manually confirm earnings calendars for all tickers
3. **Assess Your Risk Tolerance**: These trades involve significant risk and may not be suitable for all investors
4. **Paper Trade First**: Consider practicing with paper trading before risking real capital
5. **Consult a Professional**: Speak with a licensed financial advisor about your specific situation

### Risk Warnings

- **Options are complex instruments** with significant risk of loss
- **You can lose your entire investment** in options trades
- **Volatility trading requires experience** and understanding of Greeks
- **Past performance does not guarantee future results**
- **Market conditions can change rapidly** invalidating the analysis

### Data Sources

- Scanner data from: https://factor-forward.replit.app/
- Analysis methodology based on Forward Factor volatility mispricing detection
- Quality filters applied to eliminate false signals

---

*Report generated by Forward Factor Nightly Scanner*  
*For questions or issues, please review the documentation*
"""
    
    def generate_full_report(self, quality_setups: List[TradeAnalysis],
                            rejected_setups: List[TradeAnalysis],
                            scan_id: int) -> str:
        """
        Generate complete markdown report
        
        Args:
            quality_setups: List of quality trade setups
            rejected_setups: List of rejected opportunities
            scan_id: Scanner scan ID
        
        Returns:
            Complete markdown report as string
        """
        report = ""
        
        # Summary section
        report += self.generate_summary_section(quality_setups, rejected_setups, scan_id)
        
        # Quality setups (detailed)
        if quality_setups:
            report += "\n---\n\n# Recommended Trades\n"
            for i, analysis in enumerate(quality_setups, 1):
                report += self.generate_opportunity_section(analysis, i)
        
        # Rejected opportunities (summary)
        report += self.generate_rejection_summary(rejected_setups)
        
        # Disclaimer
        report += self.generate_disclaimer()
        
        return report
    
    def save_report(self, report: str, filename: str) -> str:
        """
        Save report to file
        
        Args:
            report: Report content
            filename: Output filename
        
        Returns:
            Full path to saved file
        """
        with open(filename, 'w') as f:
            f.write(report)
        
        return filename


def main():
    """Test report generator with sample data"""
    from ff_nightly_scanner import Opportunity, TradeAnalysis, EarningsInfo
    
    # Create sample opportunity
    sample_opp = Opportunity(
        ticker="AAPL",
        forward_factor=45.5,
        signal="SELL",
        front_date="2025-11-15",
        front_dte=28,
        front_iv=35.2,
        back_date="2025-12-20",
        back_dte=63,
        back_iv=28.4,
        forward_vol=18.9,
        scan_id=1,
        opportunity_id=1
    )
    
    # Create sample analysis
    sample_analysis = TradeAnalysis(
        opportunity=sample_opp,
        earnings_info=None,
        is_quality_setup=True,
        rejection_reasons=[],
        probability=75.0,
        risk_reward=3.5,
        rating=8,
        thesis="Front contract is overpriced relative to forward volatility...",
        trade_structure="Sell front straddle, buy back straddle..."
    )
    
    # Generate report
    generator = ReportGenerator()
    report = generator.generate_full_report([sample_analysis], [], 1)
    
    # Save to file
    filename = "/home/ubuntu/test_report.md"
    generator.save_report(report, filename)
    
    print(f"Test report generated: {filename}")
    print("\nFirst 1000 characters:")
    print(report[:1000])


if __name__ == "__main__":
    main()

