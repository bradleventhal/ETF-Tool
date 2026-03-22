import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

// Fallback funds when Supabase is unavailable
const FALLBACK_FUNDS = [
  { ticker: "UYLD", name: "Angel Oak UltraShort Income ETF", duration: 0.8, ytwYtm: 6.2, distributionYield: 6.1, secYield: 5.9, expense: 0.39, sharpe: 1.2, ytd: 4.8, oneYear: 7.2, threeYear: 4.1, morningstarRating: 4, morningstarCategory: "Ultrashort Bond" },
  { ticker: "CARY", name: "Angel Oak Income ETF", duration: 2.1, ytwYtm: 7.4, distributionYield: 7.2, secYield: 6.8, expense: 0.55, sharpe: 0.9, ytd: 5.2, oneYear: 8.1, threeYear: 4.8, morningstarRating: 4, morningstarCategory: "Short-Term Bond" },
  { ticker: "APTS", name: "Angel Oak Mortgage-Backed Secs ETF", duration: 3.2, ytwYtm: 6.8, distributionYield: 6.5, secYield: 6.2, expense: 0.49, sharpe: 0.8, ytd: 3.9, oneYear: 6.5, threeYear: 3.2, morningstarRating: 3, morningstarCategory: "Nontraditional Bond" },
  { ticker: "AOUIX", name: "Angel Oak Ultrashort Income Inst", duration: 0.6, ytwYtm: 5.9, distributionYield: 5.7, secYield: 5.5, expense: 0.45, sharpe: 1.1, ytd: 4.2, oneYear: 6.8, threeYear: 3.9, morningstarRating: 4, morningstarCategory: "Ultrashort Bond" },
  { ticker: "ANGIX", name: "Angel Oak Multi-Strategy Income Inst", duration: 2.8, ytwYtm: 7.1, distributionYield: 6.9, secYield: 6.5, expense: 0.85, sharpe: 0.7, ytd: 4.5, oneYear: 7.8, threeYear: 4.2, morningstarRating: 4, morningstarCategory: "Multisector Bond" },
  { ticker: "AOHY", name: "Angel Oak High Yield Opps Fund", duration: 3.5, ytwYtm: 8.2, distributionYield: 7.8, secYield: 7.5, expense: 0.79, sharpe: 0.6, ytd: 5.8, oneYear: 9.2, threeYear: 5.1, morningstarRating: 3, morningstarCategory: "High Yield Bond" },
  { ticker: "ASCIX", name: "Angel Oak Strategic Credit Inst", duration: 4.1, ytwYtm: 8.5, distributionYield: 8.1, secYield: 7.8, expense: 0.95, sharpe: 0.5, ytd: 6.1, oneYear: 10.2, threeYear: 5.8, morningstarRating: 3, morningstarCategory: "Multisector Bond" },
  { ticker: "VNLA", name: "Janus Henderson Short Duration Income ETF", duration: 1.2, ytwYtm: 5.4, distributionYield: 5.2, secYield: 5.0, expense: 0.23, sharpe: 1.0, ytd: 3.8, oneYear: 5.9, threeYear: 3.2, morningstarRating: 4, morningstarCategory: "Ultrashort Bond" },
  { ticker: "FLOT", name: "iShares Floating Rate Bond ETF", duration: 0.1, ytwYtm: 5.6, distributionYield: 5.5, secYield: 5.4, expense: 0.15, sharpe: 0.9, ytd: 4.1, oneYear: 6.2, threeYear: 3.5, morningstarRating: 4, morningstarCategory: "Ultrashort Bond" },
  { ticker: "ICSH", name: "BlackRock Ultra Short-Term Bond ETF", duration: 0.4, ytwYtm: 5.2, distributionYield: 5.0, secYield: 4.9, expense: 0.08, sharpe: 1.3, ytd: 3.6, oneYear: 5.5, threeYear: 3.0, morningstarRating: 5, morningstarCategory: "Ultrashort Bond" },
  { ticker: "MINT", name: "PIMCO Enhanced Short Maturity Active ETF", duration: 0.3, ytwYtm: 5.3, distributionYield: 5.1, secYield: 5.0, expense: 0.35, sharpe: 1.2, ytd: 3.7, oneYear: 5.6, threeYear: 3.1, morningstarRating: 4, morningstarCategory: "Ultrashort Bond" },
  { ticker: "SHYG", name: "iShares 0-5 Year High Yield Corp Bond ETF", duration: 2.3, ytwYtm: 7.8, distributionYield: 7.5, secYield: 7.2, expense: 0.30, sharpe: 0.7, ytd: 5.1, oneYear: 8.5, threeYear: 4.6, morningstarRating: 4, morningstarCategory: "High Yield Bond" },
  { ticker: "HYG", name: "iShares iBoxx High Yield Corporate Bond ETF", duration: 3.8, ytwYtm: 7.5, distributionYield: 7.2, secYield: 6.9, expense: 0.48, sharpe: 0.5, ytd: 4.8, oneYear: 8.1, threeYear: 4.2, morningstarRating: 3, morningstarCategory: "High Yield Bond" },
  { ticker: "JNK", name: "SPDR Bloomberg High Yield Bond ETF", duration: 3.9, ytwYtm: 7.6, distributionYield: 7.3, secYield: 7.0, expense: 0.40, sharpe: 0.5, ytd: 4.9, oneYear: 8.2, threeYear: 4.3, morningstarRating: 3, morningstarCategory: "High Yield Bond" },
  { ticker: "SJNK", name: "SPDR Bloomberg Short Term High Yield Bond ETF", duration: 2.1, ytwYtm: 7.4, distributionYield: 7.1, secYield: 6.8, expense: 0.40, sharpe: 0.6, ytd: 4.7, oneYear: 8.0, threeYear: 4.4, morningstarRating: 4, morningstarCategory: "High Yield Bond" },
]

function num(v: unknown): number | null {
  if (v == null) return null
  const n = Number(v)
  return isNaN(n) ? null : n
}

function rowToFund(r: Record<string, unknown>) {
  return {
    ticker: r.ticker,
    name: r.name,
    asOfDate: r.as_of_date,
    duration: num(r.duration),
    ytwYtm: num(r.ytw_ytm),
    distributionYield: num(r.distribution_yield),
    secYield: num(r.sec_yield),
    expense: num(r.expense),
    correlation: num(r.correlation),
    stdDev: num(r.std_dev),
    sharpe: num(r.sharpe),
    ytd: num(r.ytd),
    oneYear: num(r.one_year),
    commonInception: num(r.common_inception),
    threeYear: num(r.three_year),
    nonAgencyRmbs: num(r.non_agency_rmbs),
    agencyRmbs: num(r.agency_rmbs),
    abs: num(r.abs),
    clo: num(r.clo),
    cmbs: num(r.cmbs),
    securitized: num(r.securitized),
    corporateCredit: num(r.corporate_credit),
    governmentCash: num(r.government_cash),
    other: num(r.other),
    aaa: num(r.aaa),
    aa: num(r.aa),
    a: num(r.a),
    bbb: num(r.bbb),
    bb: num(r.bb),
    b: num(r.b),
    ccc: num(r.ccc),
    belowCcc: num(r.below_ccc),
    creditOther: num(r.credit_other),
    morningstarRating: num(r.morningstar_rating),
    morningstarCategory: r.morningstar_category as string | null,
  }
}

function fundToRow(f: Record<string, unknown>) {
  return {
    ticker: f.ticker,
    name: f.name,
    as_of_date: f.asOfDate ?? null,
    duration: f.duration ?? null,
    ytw_ytm: f.ytwYtm ?? null,
    distribution_yield: f.distributionYield ?? null,
    sec_yield: f.secYield ?? null,
    expense: f.expense ?? null,
    correlation: f.correlation ?? null,
    std_dev: f.stdDev ?? null,
    sharpe: f.sharpe ?? null,
    ytd: f.ytd ?? null,
    one_year: f.oneYear ?? null,
    common_inception: f.commonInception ?? null,
    three_year: f.threeYear ?? null,
    non_agency_rmbs: f.nonAgencyRmbs ?? null,
    agency_rmbs: f.agencyRmbs ?? null,
    abs: f.abs ?? null,
    clo: f.clo ?? null,
    cmbs: f.cmbs ?? null,
    securitized: f.securitized ?? null,
    corporate_credit: f.corporateCredit ?? null,
    government_cash: f.governmentCash ?? null,
    other: f.other ?? null,
    aaa: f.aaa ?? null,
    aa: f.aa ?? null,
    a: f.a ?? null,
    bbb: f.bbb ?? null,
    bb: f.bb ?? null,
    b: f.b ?? null,
    ccc: f.ccc ?? null,
    below_ccc: f.belowCcc ?? null,
    credit_other: f.creditOther ?? null,
    updated_at: new Date().toISOString(),
  }
}

export async function GET() {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.from("funds").select("*").order("ticker")
    if (error || !data || data.length === 0) {
      // Return fallback funds when Supabase fails or is empty
      return NextResponse.json({ funds: FALLBACK_FUNDS })
    }
    return NextResponse.json({ funds: data.map(rowToFund) })
  } catch (err) {
    console.error("[v0] Funds fetch error:", err)
    // Return fallback funds on any error
    return NextResponse.json({ funds: FALLBACK_FUNDS })
  }
}

export async function POST(req: Request) {
  try {
    const { funds } = await req.json() as { funds: Record<string, unknown>[] }
    if (!Array.isArray(funds) || funds.length === 0) {
      return NextResponse.json({ error: "No funds provided" }, { status: 400 })
    }

    const supabase = createClient()

    // Upsert each fund by ticker
    const rows = funds.map(fundToRow)
    const { error } = await supabase.from("funds").upsert(rows, { onConflict: "ticker" })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true, count: rows.length })
  } catch (err) {
    console.error("[v0] Funds save error:", err)
    return NextResponse.json({ error: "Failed to save funds" }, { status: 500 })
  }
}
