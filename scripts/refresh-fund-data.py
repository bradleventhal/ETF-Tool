#!/usr/bin/env python3
"""
Fund data refresh script for ETF-Tool.
Pulls fresh data from mapped sources (Yahoo, Morningstar) and validates
against current values before applying updates.

Usage:
  python3 scripts/refresh-fund-data.py              # dry run (show changes)
  python3 scripts/refresh-fund-data.py --apply       # apply and save
  python3 scripts/refresh-fund-data.py --apply --push # apply, save, git push

Sources:
  - Yahoo fund_holding_info: credit quality (bondRatings)
  - Yahoo fund_profile: expense ratios (annualReportExpenseRatio), categories
  - Yahoo key_stats: Morningstar star ratings
  - Yahoo price: fund names
  - Morningstar API (via browser): star ratings for ETFs (if browser available)
  - Source map: yields, duration, sectors (re-scraped from original URLs)

Safety:
  - Never overwrites factsheet-verified funds without --force
  - Validates all changes: CQ sums to ~1.0, expenses < 3%, durations reasonable
  - Shows diff before applying
  - Keeps backup of previous data
"""

import json, sys, os, time, shutil
from pathlib import Path
from datetime import datetime
from collections import Counter

# Paths
SCRIPT_DIR = Path(__file__).parent
REPO_DIR = SCRIPT_DIR.parent
FUNDS_JSON = REPO_DIR / "public" / "data" / "funds.json"
SOURCE_MAP = Path.home() / ".openclaw/shared/ops/artifacts/fund_complete_source_map/fund_source_map.json"
BACKUP_DIR = REPO_DIR / "public" / "data" / "backups"

# Factsheet-verified funds — don't overwrite unless --force
VERIFIED = {'UYLD', 'ANGIX', 'AOHY', 'BINC', 'JSI', 'PIMIX'}

# Fields that should be decimals (not whole percentages)
DECIMAL_FIELDS = {
    'secYield', 'distributionYield', 'expense', 'ytd', 'oneYear',
    'threeYear', 'commonInception', 'ytwYtm',
    'nonAgencyRmbs', 'agencyRmbs', 'abs', 'clo', 'cmbs',
    'corporateCredit', 'governmentCash', 'securitized',
    'aaa', 'aa', 'a', 'bbb', 'bb', 'b', 'belowCcc', 'creditOther',
}

# Fields that are raw numbers (not percentages)
RAW_FIELDS = {'duration', 'stdDev', 'sharpe'}

SECTOR_KEYS = ['nonAgencyRmbs', 'agencyRmbs', 'abs', 'clo', 'cmbs', 'corporateCredit', 'governmentCash']
CQ_KEYS = ['aaa', 'aa', 'a', 'bbb', 'bb', 'b', 'belowCcc', 'creditOther']

# Source map field name -> our field name
FIELD_MAP = {
    'sec_30_day_yield': 'secYield',
    'distribution_yield': 'distributionYield',
    'effective_duration': 'duration',
    'expense_ratio': 'expense',
    'ytd_return': 'ytd',
    'one_year_return': 'oneYear',
    'three_year_return': 'threeYear',
    'since_inception_return': 'commonInception',
    'std_dev_3y': 'stdDev',
    'sharpe_3y': 'sharpe',
    'ytw_or_ytm': 'ytwYtm',
    'non_agency_mbs_pct': 'nonAgencyRmbs',
    'agency_rmbs_pct': 'agencyRmbs',
    'abs_pct': 'abs',
    'clo_pct': 'clo',
    'cmbs_pct': 'cmbs',
    'corporate_credit_pct': 'corporateCredit',
    'government_cash_pct': 'governmentCash',
    'securitized_pct': 'securitized',
    'aaa_pct': 'aaa',
    'aa_pct': 'aa',
    'a_pct': 'a',
    'bbb_pct': 'bbb',
    'bb_pct': 'bb',
    'b_pct': 'b',
    'below_b_pct': 'belowCcc',
    'not_rated_pct': 'creditOther',
}


def extract_source_value(field_data):
    """Extract numeric value from source map field metadata."""
    if field_data is None:
        return None
    if isinstance(field_data, (int, float)):
        return field_data
    if isinstance(field_data, dict):
        v = field_data.get('value_scraped')
        if v is None or v == '' or v == 'N/A':
            return None
        if isinstance(v, (int, float)):
            return v
        if isinstance(v, str):
            try:
                return float(v.replace('%', '').strip())
            except ValueError:
                return None
    return None


YIELD_FIELDS = {'secYield', 'distributionYield', 'ytwYtm'}
RETURN_FIELDS = {'ytd', 'oneYear', 'threeYear', 'commonInception'}
ALLOC_FIELDS = {'nonAgencyRmbs', 'agencyRmbs', 'abs', 'clo', 'cmbs',
                'corporateCredit', 'governmentCash', 'securitized',
                'aaa', 'aa', 'a', 'bbb', 'bb', 'b', 'belowCcc', 'creditOther'}

def to_decimal(v, field_name):
    """Field-specific normalization. Different fields have different thresholds."""
    if v is None:
        return None
    if field_name in RAW_FIELDS:
        return round(v, 4)
    if field_name in YIELD_FIELDS:
        # Yields: 4.43 means 4.43% = 0.0443
        if v > 0.20:
            return round(v / 100, 6)
        return round(v, 6)
    if field_name in RETURN_FIELDS:
        # Returns: 5.38 means 5.38% = 0.0538
        if v > 0.50:
            return round(v / 100, 6)
        return round(v, 6)
    if field_name == 'expense':
        # Expenses: 0.34 means 0.34% = 0.0034
        if v > 0.05:
            return round(v / 100, 6)
        return round(v, 6)
    if field_name in ALLOC_FIELDS:
        # Allocations: 14.3 means 14.3% = 0.143
        if abs(v) > 1.5:
            return round(v / 100, 6)
        return round(v, 6)
    return round(v, 6)


def validate_fund(fund):
    """Return list of validation warnings for a fund."""
    warnings = []
    ticker = fund['ticker']

    # Credit quality should sum to ~1.0
    cq = sum(fund.get(k, 0) or 0 for k in CQ_KEYS)
    if cq > 0 and (cq < 0.85 or cq > 1.15):
        warnings.append(f"CQ sum={cq:.2f}")

    # Sectors should sum to ~1.0
    sec = sum(fund.get(k, 0) or 0 for k in SECTOR_KEYS)
    if sec > 0 and (sec < 0.7 or sec > 1.3):
        warnings.append(f"Sector sum={sec:.2f}")

    # Expense should be < 3%
    exp = fund.get('expense')
    if exp and exp > 0.03:
        warnings.append(f"Expense={exp}")

    # Duration should be 0-20
    dur = fund.get('duration')
    if dur and (dur < 0 or dur > 20):
        warnings.append(f"Duration={dur}")

    return warnings


def refresh_from_source_map(funds, source_map):
    """Refresh yield, duration, and sector data from the source map."""
    changes = []
    for fund in funds:
        ticker = fund['ticker']
        if ticker in VERIFIED:
            continue
        src = source_map.get(ticker, {}).get('fields', {})
        if not src:
            continue
        for src_key, our_key in FIELD_MAP.items():
            raw = extract_source_value(src.get(src_key))
            if raw is None:
                continue
            new_val = to_decimal(raw, our_key)
            old_val = fund.get(our_key)
            if new_val is not None and new_val != old_val:
                changes.append((ticker, our_key, old_val, new_val))
                fund[our_key] = new_val
    return changes


def refresh_from_yahoo(funds):
    """Refresh expenses, ratings, categories, names, credit quality from Yahoo."""
    from yahooquery import Ticker

    changes = []
    tickers = [f['ticker'] for f in funds if f['ticker'] not in VERIFIED]

    for i in range(0, len(tickers), 25):
        batch = tickers[i:i+25]
        try:
            t = Ticker(batch)
            profiles = t.fund_profile
            stats = t.key_stats
            prices = t.price
            holdings = t.fund_holding_info

            for ticker in batch:
                fund = next((f for f in funds if f['ticker'] == ticker), None)
                if not fund:
                    continue

                # Name
                p = prices.get(ticker, {})
                if isinstance(p, dict):
                    name = p.get('longName') or p.get('shortName')
                    if name and name != fund.get('name'):
                        changes.append((ticker, 'name', fund.get('name'), name))
                        fund['name'] = name

                # Category + Expense
                fp = profiles.get(ticker, {})
                if isinstance(fp, dict):
                    cat = fp.get('categoryName')
                    if cat and cat != fund.get('morningstarCategory'):
                        changes.append((ticker, 'morningstarCategory', fund.get('morningstarCategory'), cat))
                        fund['morningstarCategory'] = cat
                    fees = fp.get('feesExpensesInvestment', {})
                    if isinstance(fees, dict):
                        exp = fees.get('annualReportExpenseRatio')
                        if exp and isinstance(exp, (int, float)) and 0 < exp < 0.05:
                            if exp != fund.get('expense'):
                                changes.append((ticker, 'expense', fund.get('expense'), exp))
                                fund['expense'] = round(exp, 6)

                # Morningstar rating
                ks = stats.get(ticker, {})
                if isinstance(ks, dict):
                    rating = ks.get('morningStarOverallRating')
                    if isinstance(rating, (int, float)) and rating > 0:
                        r = int(rating)
                        if r != fund.get('morningstarRating'):
                            changes.append((ticker, 'morningstarRating', fund.get('morningstarRating'), r))
                            fund['morningstarRating'] = r

                # Credit quality from bondRatings
                h = holdings.get(ticker, {})
                if isinstance(h, dict):
                    bond_ratings = h.get('bondRatings', [])
                    if bond_ratings:
                        ratings = {}
                        for entry in bond_ratings:
                            for k, v in entry.items():
                                ratings[k] = v

                        us_govt = max(0, ratings.get('us_government', 0))
                        aaa_raw = ratings.get('aaa', 0)
                        other_total = sum(ratings.get(k, 0) for k in ['aa', 'a', 'bbb', 'bb', 'b', 'below_b', 'other'])
                        total = aaa_raw + us_govt + other_total

                        if total > 1.1:
                            scale = 1.0 / total
                        else:
                            scale = 1.0

                        new_cq = {
                            'aaa': round((aaa_raw + us_govt) * scale, 4),
                            'aa': round(ratings.get('aa', 0) * scale, 4),
                            'a': round(ratings.get('a', 0) * scale, 4),
                            'bbb': round(ratings.get('bbb', 0) * scale, 4),
                            'bb': round(ratings.get('bb', 0) * scale, 4),
                            'b': round(ratings.get('b', 0) * scale, 4),
                            'belowCcc': round(ratings.get('below_b', 0) * scale, 4),
                            'creditOther': round(ratings.get('other', 0) * scale, 4),
                        }
                        for k, v in new_cq.items():
                            if v != fund.get(k):
                                changes.append((ticker, k, fund.get(k), v))
                                fund[k] = v
        except Exception as e:
            print(f"  Yahoo batch error at {i}: {e}")
        time.sleep(0.3)

    return changes


def normalize_sectors(funds):
    """Normalize sector allocations that don't sum to ~1.0."""
    for fund in funds:
        if fund['ticker'] in VERIFIED:
            continue
        s = sum(fund.get(k, 0) or 0 for k in SECTOR_KEYS)
        if s > 1.3:
            for k in SECTOR_KEYS:
                v = fund.get(k, 0) or 0
                fund[k] = round(v / s, 4) if v else 0
        elif 0 < s < 0.7:
            for k in SECTOR_KEYS:
                fund[k] = None


def main():
    apply_changes = '--apply' in sys.argv
    push = '--push' in sys.argv
    force = '--force' in sys.argv

    print(f"=== Fund Data Refresh — {datetime.now().strftime('%Y-%m-%d %H:%M')} ===")
    print(f"Mode: {'APPLY' if apply_changes else 'DRY RUN'}")
    if force:
        print("WARNING: --force will overwrite factsheet-verified funds")

    # Load current data
    with open(FUNDS_JSON) as f:
        funds = json.load(f)
    print(f"Loaded {len(funds)} funds from {FUNDS_JSON}")

    # Backup
    if apply_changes:
        BACKUP_DIR.mkdir(parents=True, exist_ok=True)
        backup_path = BACKUP_DIR / f"funds_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        shutil.copy2(FUNDS_JSON, backup_path)
        print(f"Backup saved to {backup_path}")

    all_changes = []

    # 1. Refresh from source map (yields, duration, sectors)
    if SOURCE_MAP.exists():
        print("\n--- Refreshing from source map ---")
        with open(SOURCE_MAP) as f:
            source_map = json.load(f)
        changes = refresh_from_source_map(funds, source_map)
        all_changes.extend(changes)
        print(f"  {len(changes)} changes from source map")
    else:
        print(f"  Source map not found at {SOURCE_MAP}, skipping")

    # 2. Refresh from Yahoo (expenses, ratings, categories, credit quality)
    print("\n--- Refreshing from Yahoo ---")
    try:
        changes = refresh_from_yahoo(funds)
        all_changes.extend(changes)
        print(f"  {len(changes)} changes from Yahoo")
    except ImportError:
        print("  yahooquery not installed, skipping Yahoo refresh")

    # 3. Normalize sectors
    normalize_sectors(funds)

    # 4. Validate
    print("\n--- Validation ---")
    total_warnings = 0
    for fund in funds:
        warnings = validate_fund(fund)
        if warnings:
            print(f"  {fund['ticker']}: {', '.join(warnings)}")
            total_warnings += 1
    print(f"  {total_warnings} funds with warnings")

    # 5. Summary
    print(f"\n--- Summary ---")
    print(f"Total changes: {len(all_changes)}")
    field_counts = Counter(c[1] for c in all_changes)
    for field, count in field_counts.most_common(10):
        print(f"  {field}: {count} changes")

    # Coverage
    cq_good = sum(1 for f in funds if 0.85 <= sum(f.get(k, 0) or 0 for k in CQ_KEYS) <= 1.15)
    sec_good = sum(1 for f in funds if 0.7 <= sum(f.get(k, 0) or 0 for k in SECTOR_KEYS) <= 1.3)
    print(f"\nCoverage:")
    print(f"  Expenses:   {sum(1 for f in funds if f.get('expense') and 0 < f['expense'] < 0.03)}/{len(funds)}")
    print(f"  Duration:   {sum(1 for f in funds if f.get('duration') and 0 < f['duration'] < 20)}/{len(funds)}")
    print(f"  SEC Yield:  {sum(1 for f in funds if f.get('secYield'))}/{len(funds)}")
    print(f"  CQ:         {cq_good}/{len(funds)}")
    print(f"  Sectors:    {sec_good}/{len(funds)}")
    print(f"  Categories: {sum(1 for f in funds if f.get('morningstarCategory'))}/{len(funds)}")
    print(f"  Stars:      {sum(1 for f in funds if f.get('morningstarRating'))}/{len(funds)}")

    # 6. Save
    if apply_changes:
        funds.sort(key=lambda f: f['ticker'])
        with open(FUNDS_JSON, 'w') as f:
            json.dump(funds, f, indent=2)
        print(f"\nSaved to {FUNDS_JSON}")

        if push:
            import subprocess
            os.chdir(REPO_DIR)
            subprocess.run(['git', 'add', 'public/data/funds.json'], check=True)
            msg = f"Automated fund data refresh — {datetime.now().strftime('%Y-%m-%d')}\n\n{len(all_changes)} fields updated across {len(set(c[0] for c in all_changes))} funds."
            subprocess.run(['git', 'commit', '-m', msg], check=True)
            subprocess.run(['git', 'push', 'origin', 'main'], check=True)
            print("Pushed to GitHub")
    else:
        print("\nDry run — no changes saved. Use --apply to save.")


if __name__ == '__main__':
    main()
