import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.from("funds").select("*").order("ticker")

    if (error) {
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
