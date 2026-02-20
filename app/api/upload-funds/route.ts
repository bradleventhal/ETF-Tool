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
    console.log("[v0] First fund keys:", Object.keys(funds[0]).join(", "))

    const supabase = createClient()

    // Rows arrive pre-formatted in snake_case from admin page
    // Add updated_at and deduplicate by ticker
    const deduped = Object.values(
      funds.reduce((acc: Record<string, Record<string, unknown>>, row: Record<string, unknown>) => {
        if (row.ticker) {
          acc[row.ticker as string] = { ...row, updated_at: new Date().toISOString() }
        }
        return acc
      }, {})
    )

    console.log("[v0] Deduped count:", deduped.length)

    // Upsert in batches of 20
    const BATCH = 20
    for (let i = 0; i < deduped.length; i += BATCH) {
      const batch = deduped.slice(i, i + BATCH)
      const { error } = await supabase
        .from("funds")
        .upsert(batch, { onConflict: "ticker" })

      if (error) {
        console.error("[v0] Supabase upsert error:", JSON.stringify(error))
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true, count: deduped.length })
  } catch (err) {
    console.error("[v0] Upload error:", err)
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to process upload" }, { status: 500 })
  }
}
