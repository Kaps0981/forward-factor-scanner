#!/usr/bin/env python3.11
"""
Forward Factor Nightly Scanner - Main Entry Point

Integrates all components:
- Scanner service (data fetching and analysis)
- Trading calendar (holiday detection)
- Report generator (markdown reports)

Run this script nightly to get trade recommendations.
"""

import sys
import os
from datetime import datetime
from ff_nightly_scanner import FFScannerService
from ff_scheduler import TradingCalendar
from ff_report_generator import ReportGenerator


def main():
    """Main entry point for nightly scanner"""
    
    print("=" * 80)
    print("FORWARD FACTOR NIGHTLY SCANNER")
    print("=" * 80)
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    
    # Check trading calendar
    calendar = TradingCalendar()
    schedule_info = calendar.get_run_schedule_info()
    
    print("Trading Calendar Check:")
    print(f"  Current Date: {schedule_info['current_time']}")
    print(f"  Is Trading Day: {schedule_info['is_trading_day']}")
    print(f"  Should Run Tonight: {schedule_info['should_run_tonight']}")
    print(f"  Next Trading Day: {schedule_info['next_trading_day']}")
    print()
    
    # Check if we should run
    if not schedule_info['should_run_tonight']:
        print("⏸️  Scanner will not run tonight:")
        if not schedule_info['is_weekday']:
            print("   - Today is a weekend")
        else:
            print("   - Tomorrow is not a trading day (holiday)")
        print()
        print("Next scheduled run: Next weeknight before a trading day")
        print("=" * 80)
        return
    
    print("✅ Proceeding with scan (weeknight before trading day)")
    print()
    
    # Run scanner analysis
    print("Running Forward Factor analysis...")
    print("-" * 80)
    scanner = FFScannerService()
    quality_setups, rejected_setups = scanner.run_analysis()
    print()
    
    # Generate report
    print("Generating report...")
    generator = ReportGenerator()
    
    # Get scan ID from first opportunity (if any)
    scan_id = 0
    if quality_setups:
        scan_id = quality_setups[0].opportunity.scan_id
    elif rejected_setups:
        scan_id = rejected_setups[0].opportunity.scan_id
    
    report = generator.generate_full_report(quality_setups, rejected_setups, scan_id)
    
    # Save report with timestamp
    timestamp = datetime.now().strftime('%Y%m%d')
    report_dir = "/home/ubuntu/ff_reports"
    os.makedirs(report_dir, exist_ok=True)
    
    report_filename = f"{report_dir}/ff_scan_{timestamp}.md"
    generator.save_report(report, report_filename)
    
    print(f"✅ Report saved: {report_filename}")
    print()
    
    # Print summary
    print("=" * 80)
    print("SCAN COMPLETE")
    print("=" * 80)
    print(f"Quality Setups: {len(quality_setups)}")
    print(f"Rejected: {len(rejected_setups)}")
    print(f"Report: {report_filename}")
    
    if len(quality_setups) > 0:
        print()
        print("🎯 HIGH-QUALITY OPPORTUNITIES FOUND:")
        for i, analysis in enumerate(quality_setups, 1):
            opp = analysis.opportunity
            print(f"  {i}. {opp.ticker} - FF: {opp.forward_factor:+.1f}% - Rating: {analysis.rating}/10")
    else:
        print()
        print("ℹ️  No quality setups found tonight (this is normal)")
        print("   The scanner is highly selective and rejects most signals")
    
    print()
    print("=" * 80)
    print(f"Completed: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 80)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\nScanner interrupted by user")
        sys.exit(0)
    except Exception as e:
        print(f"\n\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

