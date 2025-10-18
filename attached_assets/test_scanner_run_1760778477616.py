#!/usr/bin/env python3.11
"""
Test run of Forward Factor Scanner (bypasses calendar check)
"""

import os
from datetime import datetime
from ff_nightly_scanner import FFScannerService
from ff_report_generator import ReportGenerator


def main():
    """Test run of scanner"""
    
    print("=" * 80)
    print("FORWARD FACTOR SCANNER - TEST RUN")
    print("=" * 80)
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
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
    
    # Get scan ID
    scan_id = 0
    if quality_setups:
        scan_id = quality_setups[0].opportunity.scan_id
    elif rejected_setups:
        scan_id = rejected_setups[0].opportunity.scan_id
    
    report = generator.generate_full_report(quality_setups, rejected_setups, scan_id)
    
    # Save report
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    report_dir = "/home/ubuntu/ff_reports"
    os.makedirs(report_dir, exist_ok=True)
    
    report_filename = f"{report_dir}/ff_scan_test_{timestamp}.md"
    generator.save_report(report, report_filename)
    
    print(f"✅ Report saved: {report_filename}")
    print()
    
    # Print summary
    print("=" * 80)
    print("TEST SCAN COMPLETE")
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
        print("ℹ️  No quality setups found (this is normal and expected)")
    
    print()
    print("=" * 80)
    
    return report_filename


if __name__ == "__main__":
    main()

