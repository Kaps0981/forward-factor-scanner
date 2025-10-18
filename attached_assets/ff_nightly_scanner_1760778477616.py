#!/usr/bin/env python3.11
"""
Forward Factor Nightly Scanner Service

Automatically fetches scanner results, applies strict quality filters,
and generates trade recommendations for high-quality setups only.

Author: Manus AI
Date: October 2025
"""

import os
import sys
import json
import requests
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from polygon import RESTClient
import math

# Configuration
SCANNER_API_BASE = "https://factor-forward.replit.app/api"
POLYGON_API_KEY = os.environ.get('POLYGON_API_KEY', '')

# Quality Criteria Thresholds
MIN_FORWARD_FACTOR = 30.0  # Minimum |FF| to consider
MIN_DTE = 7  # Minimum days to expiration
MAX_DTE = 180  # Maximum days to expiration
MIN_IV = 15.0  # Minimum implied volatility
MAX_IV = 150.0  # Maximum implied volatility
MIN_PROBABILITY = 70.0  # Minimum probability of profit
MIN_RISK_REWARD = 3.0  # Minimum risk/reward ratio


@dataclass
class Opportunity:
    """Represents a Forward Factor opportunity"""
    ticker: str
    forward_factor: float
    signal: str
    front_date: str
    front_dte: int
    front_iv: float
    back_date: str
    back_dte: int
    back_iv: float
    forward_vol: float
    scan_id: int
    opportunity_id: int
    has_earnings_soon: bool = False
    
    def is_inverted(self) -> bool:
        """Check if term structure is inverted (front IV > back IV)"""
        return self.front_iv > self.back_iv
    
    def get_dte_diff(self) -> int:
        """Get the difference in DTE between back and front"""
        return self.back_dte - self.front_dte


@dataclass
class EarningsInfo:
    """Earnings information for a ticker"""
    ticker: str
    earnings_date: Optional[str]
    has_earnings_soon: bool
    front_is_pre_earnings: bool
    back_is_post_earnings: bool
    both_post_earnings: bool


@dataclass
class TradeAnalysis:
    """Complete analysis of a trading opportunity"""
    opportunity: Opportunity
    earnings_info: Optional[EarningsInfo]
    is_quality_setup: bool
    rejection_reasons: List[str]
    probability: float
    risk_reward: float
    rating: int  # 0-10
    thesis: str
    trade_structure: str


class FFScannerService:
    """Forward Factor Scanner Automation Service"""
    
    def __init__(self):
        """Initialize the scanner service"""
        self.polygon_client = None
        if POLYGON_API_KEY:
            self.polygon_client = RESTClient(api_key=POLYGON_API_KEY)
        else:
            print("WARNING: POLYGON_API_KEY not set. Catalyst detection will be limited.")
    
    def get_latest_scan(self) -> Optional[Dict]:
        """Fetch the most recent scan with opportunities"""
        try:
            response = requests.get(f"{SCANNER_API_BASE}/scans", timeout=30)
            response.raise_for_status()
            data = response.json()
            
            # Find most recent scan with opportunities
            scans = data.get('scans', [])
            for scan in scans:
                if scan.get('total_opportunities', 0) > 0:
                    scan_id = scan['id']
                    print(f"Found scan {scan_id} with {scan['total_opportunities']} opportunities")
                    
                    # Fetch full scan details
                    details_response = requests.get(
                        f"{SCANNER_API_BASE}/scans/{scan_id}",
                        timeout=30
                    )
                    details_response.raise_for_status()
                    return details_response.json()
            
            print("No scans with opportunities found")
            return None
            
        except Exception as e:
            print(f"Error fetching scan data: {e}")
            return None
    
    def parse_opportunities(self, scan_data: Dict) -> List[Opportunity]:
        """Parse opportunities from scan data"""
        opportunities = []
        
        for opp in scan_data.get('opportunities', []):
            try:
                opportunity = Opportunity(
                    ticker=opp['ticker'],
                    forward_factor=float(opp['forward_factor']),
                    signal=opp['signal'],
                    front_date=opp['front_date'],
                    front_dte=int(opp['front_dte']),
                    front_iv=float(opp['front_iv']),
                    back_date=opp['back_date'],
                    back_dte=int(opp['back_dte']),
                    back_iv=float(opp['back_iv']),
                    forward_vol=float(opp['forward_vol']),
                    scan_id=scan_data['scan']['id'],
                    opportunity_id=opp['id'],
                    has_earnings_soon=(opp.get('has_earnings_soon', 'false') == 'true')
                )
                opportunities.append(opportunity)
            except (KeyError, ValueError) as e:
                print(f"Error parsing opportunity: {e}")
                continue
        
        return opportunities
    
    def get_earnings_info(self, ticker: str, front_date: str, back_date: str) -> Optional[EarningsInfo]:
        """Get earnings information for a ticker"""
        if not self.polygon_client:
            return None
        
        try:
            # Get ticker details which includes next earnings date
            ticker_details = self.polygon_client.get_ticker_details(ticker)
            
            # Try to get earnings date from results
            earnings_date = None
            if hasattr(ticker_details, 'results'):
                results = ticker_details.results
                if hasattr(results, 'next_earnings_date'):
                    earnings_date = results.next_earnings_date
            
            if not earnings_date:
                return EarningsInfo(
                    ticker=ticker,
                    earnings_date=None,
                    has_earnings_soon=False,
                    front_is_pre_earnings=False,
                    back_is_post_earnings=False,
                    both_post_earnings=False
                )
            
            # Parse dates
            earnings_dt = datetime.strptime(earnings_date, '%Y-%m-%d')
            front_dt = datetime.strptime(front_date, '%Y-%m-%d')
            back_dt = datetime.strptime(back_date, '%Y-%m-%d')
            
            # Determine earnings positioning
            front_is_pre = front_dt < earnings_dt
            back_is_post = back_dt > earnings_dt
            both_post = front_dt > earnings_dt and back_dt > earnings_dt
            has_earnings_soon = abs((earnings_dt - datetime.now()).days) < 60
            
            return EarningsInfo(
                ticker=ticker,
                earnings_date=earnings_date,
                has_earnings_soon=has_earnings_soon,
                front_is_pre_earnings=front_is_pre,
                back_is_post_earnings=back_is_post,
                both_post_earnings=both_post
            )
            
        except Exception as e:
            print(f"Error fetching earnings for {ticker}: {e}")
            return None
    
    def verify_forward_factor(self, opp: Opportunity) -> Tuple[float, bool]:
        """Verify the Forward Factor calculation
        
        FF = (Front IV / Forward Vol) - 1
        
        The scanner provides forward_vol already calculated.
        """
        try:
            # Calculate FF from forward_vol provided by scanner
            if opp.forward_vol == 0:
                return 0.0, False
            
            calculated_ff = ((opp.front_iv / opp.forward_vol) - 1) * 100
            
            # Verify it matches (within 2% tolerance)
            matches = abs(calculated_ff - opp.forward_factor) < 2.0
            
            return calculated_ff, matches
            
        except Exception as e:
            print(f"Error verifying FF calculation: {e}")
            return 0.0, False
    
    def calculate_probability(self, opp: Opportunity) -> float:
        """
        Calculate probability of profit based on volatility mispricing
        
        Higher |FF| = stronger signal = higher probability
        This is a simplified model - actual probability depends on trade structure
        """
        abs_ff = abs(opp.forward_factor)
        
        # Base probability on Forward Factor magnitude
        base_prob = 50.0
        if abs_ff >= 80:
            base_prob = 85.0
        elif abs_ff >= 60:
            base_prob = 80.0
        elif abs_ff >= 40:
            base_prob = 75.0
        elif abs_ff >= 30:
            base_prob = 70.0
        elif abs_ff >= 20:
            base_prob = 65.0
        else:
            base_prob = 60.0
        
        # Reduce if earnings catalyst present
        if opp.has_earnings_soon:
            base_prob *= 0.85
        
        return base_prob
    
    def calculate_risk_reward(self, opp: Opportunity) -> float:
        """
        Calculate risk/reward ratio
        
        For calendar spreads:
        - Max loss = debit paid (typically ~20-30% of front premium)
        - Max gain = difference in premiums at expiration
        
        This is a simplified estimate
        """
        abs_ff = abs(opp.forward_factor)
        
        # Higher FF = better risk/reward
        if abs_ff >= 80:
            return 5.0
        elif abs_ff >= 60:
            return 4.0
        elif abs_ff >= 40:
            return 3.5
        elif abs_ff >= 30:
            return 3.0
        elif abs_ff >= 20:
            return 2.5
        else:
            return 2.0
    
    def apply_quality_filters(self, opp: Opportunity, earnings_info: Optional[EarningsInfo]) -> Tuple[bool, List[str]]:
        """
        Apply strict quality filters to opportunity
        
        Returns: (is_quality_setup, rejection_reasons)
        """
        rejection_reasons = []
        
        # Filter 1: Forward Factor magnitude
        if abs(opp.forward_factor) < MIN_FORWARD_FACTOR:
            rejection_reasons.append(f"Forward Factor too low: {opp.forward_factor:.1f}% (need >{MIN_FORWARD_FACTOR}%)")
        
        # Filter 2: DTE range
        if opp.front_dte < MIN_DTE:
            rejection_reasons.append(f"Front DTE too short: {opp.front_dte} days (need >{MIN_DTE})")
        if opp.front_dte > MAX_DTE:
            rejection_reasons.append(f"Front DTE too long: {opp.front_dte} days (need <{MAX_DTE})")
        
        # Filter 3: IV range
        if opp.front_iv < MIN_IV:
            rejection_reasons.append(f"Front IV too low: {opp.front_iv:.1f}% (need >{MIN_IV}%)")
        if opp.front_iv > MAX_IV:
            rejection_reasons.append(f"Front IV too high: {opp.front_iv:.1f}% (need <{MAX_IV}%)")
        
        # Filter 4: Catalyst validation
        # Only reject if there's a known catalyst AND inverted structure
        # Allow inverted structures if no catalyst (could be genuine mispricing)
        if opp.has_earnings_soon and opp.is_inverted():
            # Has earnings catalyst with inverted structure - be cautious
            if abs(opp.forward_factor) < 40.0:
                rejection_reasons.append(
                    f"FALSE SIGNAL: Inverted term structure (front IV {opp.front_iv:.1f}% > back IV {opp.back_iv:.1f}%) "
                    f"with earnings soon likely indicates post-earnings IV decay. "
                    f"FF {opp.forward_factor:.1f}% not strong enough to override (need >40% with earnings catalyst)"
                )
        
        # Filter 5: Verify calculation
        calculated_ff, matches = self.verify_forward_factor(opp)
        if not matches:
            rejection_reasons.append(
                f"Forward Factor calculation mismatch: "
                f"reported {opp.forward_factor:.1f}%, calculated {calculated_ff:.1f}%"
            )
        
        # Filter 6: DTE difference (need reasonable spread)
        dte_diff = opp.get_dte_diff()
        if dte_diff < 3:
            rejection_reasons.append(f"DTE difference too small: {dte_diff} days (need >3)")
        
        is_quality = len(rejection_reasons) == 0
        return is_quality, rejection_reasons
    
    def generate_thesis(self, opp: Opportunity, earnings_info: Optional[EarningsInfo]) -> str:
        """Generate trading thesis for the opportunity"""
        if opp.forward_factor > 0:
            # Positive FF: Front is overpriced
            direction = "SELL FRONT / BUY BACK"
            explanation = (
                f"Front contract IV ({opp.front_iv:.1f}%) is significantly elevated compared to "
                f"the implied forward volatility ({opp.forward_vol:.1f}%). This {opp.forward_factor:.1f}% "
                f"premium suggests the front contract is overpriced relative to the back contract "
                f"({opp.back_iv:.1f}% IV)."
            )
        else:
            # Negative FF: Front is underpriced
            direction = "BUY FRONT / SELL BACK"
            explanation = (
                f"Front contract IV ({opp.front_iv:.1f}%) is significantly depressed compared to "
                f"the implied forward volatility ({opp.forward_vol:.1f}%). This {abs(opp.forward_factor):.1f}% "
                f"discount suggests the front contract is underpriced relative to the back contract "
                f"({opp.back_iv:.1f}% IV)."
            )
        
        # Add catalyst information
        catalyst_info = ""
        if earnings_info and earnings_info.earnings_date:
            catalyst_info = (
                f"\n\nCATALYST: Earnings on {earnings_info.earnings_date}. "
            )
            if earnings_info.front_is_pre_earnings and earnings_info.back_is_post_earnings:
                catalyst_info += (
                    "Front expires before earnings, back expires after. "
                    "This creates a natural volatility term structure around the event."
                )
            elif earnings_info.both_post_earnings:
                catalyst_info += (
                    "Both contracts expire after earnings. "
                    "IV differential may reflect post-earnings volatility decay."
                )
        else:
            # Use has_earnings_soon flag from scanner
            if opp.has_earnings_soon:
                catalyst_info = (
                    "\n\n⚠️ CATALYST: Earnings expected soon (per scanner data). "
                    "This volatility mispricing may be event-driven. Verify earnings date manually before trading."
                )
            else:
                catalyst_info = (
                    "\n\n✓ NO IMMINENT CATALYST: No earnings expected soon per scanner data. "
                    "However, always verify earnings calendar manually before trading."
                )
        
        return f"{direction}\n\n{explanation}{catalyst_info}"
    
    def generate_trade_structure(self, opp: Opportunity) -> str:
        """Generate recommended trade structure"""
        if opp.forward_factor > 0:
            # Sell front, buy back
            return (
                f"**Calendar Spread (Credit)**\n"
                f"- Sell {opp.ticker} {opp.front_date} ATM straddle/strangle\n"
                f"- Buy {opp.ticker} {opp.back_date} ATM straddle/strangle\n"
                f"- Net credit from elevated front IV\n"
                f"- Profit from front IV decay and/or time decay"
            )
        else:
            # Buy front, sell back
            return (
                f"**Reverse Calendar Spread (Debit)**\n"
                f"- Buy {opp.ticker} {opp.front_date} ATM straddle/strangle\n"
                f"- Sell {opp.ticker} {opp.back_date} ATM straddle/strangle\n"
                f"- Net debit to capture underpriced front IV\n"
                f"- Profit from front IV expansion"
            )
    
    def calculate_rating(self, opp: Opportunity, earnings_info: Optional[EarningsInfo], 
                        probability: float, risk_reward: float) -> int:
        """Calculate quality rating (0-10)"""
        rating = 5  # Base rating
        
        # Bonus for high Forward Factor
        abs_ff = abs(opp.forward_factor)
        if abs_ff >= 80:
            rating += 3
        elif abs_ff >= 60:
            rating += 2
        elif abs_ff >= 40:
            rating += 1
        
        # Bonus for clear catalyst
        if earnings_info and earnings_info.has_earnings_soon:
            if earnings_info.front_is_pre_earnings and earnings_info.back_is_post_earnings:
                rating += 1  # Clear event-driven setup
        
        # Bonus for good DTE range (sweet spot: 20-60 days)
        if 20 <= opp.front_dte <= 60:
            rating += 1
        
        # Penalty for inverted structure
        if opp.is_inverted():
            rating -= 1
        
        # Bonus for high probability
        if probability >= 80:
            rating += 1
        
        # Bonus for excellent risk/reward
        if risk_reward >= 4.0:
            rating += 1
        
        return max(0, min(10, rating))
    
    def analyze_opportunity(self, opp: Opportunity) -> TradeAnalysis:
        """Perform complete analysis of an opportunity"""
        # Get earnings information
        earnings_info = self.get_earnings_info(opp.ticker, opp.front_date, opp.back_date)
        
        # Apply quality filters
        is_quality, rejection_reasons = self.apply_quality_filters(opp, earnings_info)
        
        # Calculate metrics
        probability = self.calculate_probability(opp)
        risk_reward = self.calculate_risk_reward(opp)
        
        # Generate thesis and trade structure
        thesis = self.generate_thesis(opp, earnings_info)
        trade_structure = self.generate_trade_structure(opp)
        
        # Calculate rating
        rating = self.calculate_rating(opp, earnings_info, probability, risk_reward)
        
        return TradeAnalysis(
            opportunity=opp,
            earnings_info=earnings_info,
            is_quality_setup=is_quality,
            rejection_reasons=rejection_reasons,
            probability=probability,
            risk_reward=risk_reward,
            rating=rating,
            thesis=thesis,
            trade_structure=trade_structure
        )
    
    def run_analysis(self) -> Tuple[List[TradeAnalysis], List[TradeAnalysis]]:
        """
        Run complete analysis pipeline
        
        Returns: (quality_setups, rejected_setups)
        """
        print("=" * 80)
        print("FORWARD FACTOR NIGHTLY SCANNER")
        print("=" * 80)
        print(f"Run Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print()
        
        # Fetch latest scan
        print("Fetching latest scan data...")
        scan_data = self.get_latest_scan()
        
        if not scan_data:
            print("No scan data available")
            return [], []
        
        # Parse opportunities
        opportunities = self.parse_opportunities(scan_data)
        print(f"Found {len(opportunities)} opportunities to analyze")
        print()
        
        # Analyze each opportunity
        quality_setups = []
        rejected_setups = []
        
        for i, opp in enumerate(opportunities, 1):
            print(f"Analyzing {i}/{len(opportunities)}: {opp.ticker} (FF: {opp.forward_factor:+.1f}%)")
            analysis = self.analyze_opportunity(opp)
            
            if analysis.is_quality_setup:
                quality_setups.append(analysis)
                print(f"  ✓ QUALITY SETUP - Rating: {analysis.rating}/10")
            else:
                rejected_setups.append(analysis)
                print(f"  ✗ REJECTED: {analysis.rejection_reasons[0]}")
            print()
        
        # Sort quality setups by rating
        quality_setups.sort(key=lambda x: x.rating, reverse=True)
        
        print("=" * 80)
        print(f"ANALYSIS COMPLETE")
        print(f"Quality Setups: {len(quality_setups)}")
        print(f"Rejected: {len(rejected_setups)}")
        print("=" * 80)
        
        return quality_setups, rejected_setups


def main():
    """Main entry point"""
    scanner = FFScannerService()
    quality_setups, rejected_setups = scanner.run_analysis()
    
    # Return counts for testing
    return len(quality_setups), len(rejected_setups)


if __name__ == "__main__":
    main()

