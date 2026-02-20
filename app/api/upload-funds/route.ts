import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const funds = body.funds
    console.log("[v0] Upload received, funds count:", Array.isArray(funds) ? funds.length : "not an array")
    if (!Array.isArray(funds) || funds.length === 0) {
      return NextResponse.json({ error: "No fund data provided" }, { status: 400 })
    }
    console.log("[v0] First fund sample:", JSON.stringify(funds[0]).slice(0, 200))

    const supabase = createClient()

    // Map FundData fields to snake_case DB columns
    const rows = funds.map((f: Record<string, unknown>) => ({
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
    }))

    // Deduplicate by ticker -- keep last occurrence of each
    const deduped = Object.values(
      rows.reduce((acc: Record<string, typeof rows[0]>, row) => {
        acc[row.ticker as string] = row
        return acc
      }, {})
    )

    // Upsert by ticker -- if ticker exists, update all fields
    const { error } = await supabase
      .from("funds")
      .upsert(deduped, { onConflict: "ticker" })

    if (error) {
      console.error("[v0] Supabase upsert error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, count: rows.length })
  } catch (err) {
    console.error("[v0] Upload error:", err)
    return NextResponse.json({ error: "Failed to process upload" }, { status: 500 })
  }
}
