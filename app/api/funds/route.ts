import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

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
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ funds: (data ?? []).map(rowToFund) })
  } catch (err) {
    console.error("[v0] Funds fetch error:", err)
    return NextResponse.json({ error: "Failed to fetch funds" }, { status: 500 })
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
