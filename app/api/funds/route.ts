import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    console.log("[v0] Funds API called, creating client...")
    console.log("[v0] SUPABASE_URL exists:", !!process.env.NEXT_PUBLIC_SUPABASE_URL)
    console.log("[v0] ANON_KEY exists:", !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    const supabase = createClient()
    console.log("[v0] Client created, querying funds...")
    const { data, error } = await supabase.from("funds").select("*").order("ticker")

    console.log("[v0] Query result - error:", error, "rows:", data?.length)

    if (error) {
      console.error("[v0] Supabase select error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Map snake_case DB columns back to camelCase FundData
    const funds = (data ?? []).map((r) => ({
      ticker: r.ticker,
      name: r.name,
      asOfDate: r.as_of_date,
      duration: r.duration,
      ytwYtm: r.ytw_ytm,
      distributionYield: r.distribution_yield,
      secYield: r.sec_yield,
      expense: r.expense,
      correlation: r.correlation,
      stdDev: r.std_dev,
      sharpe: r.sharpe,
      ytd: r.ytd,
      oneYear: r.one_year,
      commonInception: r.common_inception,
      threeYear: r.three_year,
      nonAgencyRmbs: r.non_agency_rmbs,
      agencyRmbs: r.agency_rmbs,
      abs: r.abs,
      clo: r.clo,
      cmbs: r.cmbs,
      securitized: r.securitized,
      corporateCredit: r.corporate_credit,
      governmentCash: r.government_cash,
      other: r.other,
      aaa: r.aaa,
      aa: r.aa,
      a: r.a,
      bbb: r.bbb,
      bb: r.bb,
      b: r.b,
      ccc: r.ccc,
      belowCcc: r.below_ccc,
      creditOther: r.credit_other,
    }))

    return NextResponse.json({ funds })
  } catch (err) {
    console.error("[v0] Funds fetch error:", err)
    return NextResponse.json({ error: "Failed to fetch funds" }, { status: 500 })
  }
}
