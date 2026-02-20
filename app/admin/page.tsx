"use client"

import { useState } from "react"
import { Upload, CheckCircle2, AlertCircle, Loader2 } from "lucide-react"
import { parseFundData } from "@/lib/parse-fund-data"

export default function AdminUploadPage() {
  const [status, setStatus] = useState<"idle" | "parsing" | "uploading" | "success" | "error">("idle")
  const [message, setMessage] = useState("")
  const [fundCount, setFundCount] = useState(0)

  async function handleFile(file: File) {
    try {
      setStatus("parsing")
      setMessage("Parsing file...")

      const buffer = await file.arrayBuffer()
      const funds = parseFundData(buffer, file.name)

      if (funds.length === 0) {
        setStatus("error")
        setMessage("No fund data found in file")
        return
      }

      setStatus("uploading")
      setMessage(`Uploading ${funds.length} funds...`)

      // Serialize funds to flat DB rows
      const rows = funds.map(f => ({
        ticker: f.ticker,
        name: f.name,
        as_of_date: f.asOfDate || null,
        duration: f.duration,
        ytw_ytm: f.ytwYtm,
        distribution_yield: f.distributionYield,
        sec_yield: f.secYield,
        expense: f.expense,
        correlation: f.correlation,
        std_dev: f.stdDev,
        sharpe: f.sharpe,
        ytd: f.ytd,
        one_year: f.oneYear,
        common_inception: f.commonInception,
        three_year: f.threeYear,
        non_agency_rmbs: f.nonAgencyRmbs,
        agency_rmbs: f.agencyRmbs,
        abs: f.abs,
        clo: f.clo,
        cmbs: f.cmbs,
        securitized: f.securitized,
        corporate_credit: f.corporateCredit,
        government_cash: f.governmentCash,
        other: f.other,
        aaa: f.aaa,
        aa: f.aa,
        a: f.a,
        bbb: f.bbb,
        bb: f.bb,
        b: f.b,
        ccc: f.ccc,
        below_ccc: f.belowCcc,
        credit_other: f.creditOther,
      }))

      console.log("[v0] Sending", rows.length, "rows to API")

      const res = await fetch("/api/upload-funds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ funds: rows }),
      })

      let data
      try {
        data = await res.json()
      } catch {
        setStatus("error")
        setMessage("Server error: " + res.status + " " + res.statusText)
        return
      }

      if (!res.ok) {
        setStatus("error")
        setMessage(data.error || "Upload failed: " + res.status)
        return
      }

      setFundCount(data.count)
      setStatus("success")
      setMessage(`Successfully uploaded ${data.count} funds`)
    } catch (err) {
      setStatus("error")
      setMessage(err instanceof Error ? err.message : "Unknown error")
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4" style={{ backgroundColor: "#f8fafc" }}>
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold" style={{ color: "#0f3d6b" }}>Fund Data Admin</h1>
          <p className="mt-2 text-sm" style={{ color: "#64748b" }}>
            Upload your Excel file to update the fund database. All users will see the latest data.
          </p>
        </div>

        <div
          className="relative rounded-lg border-2 border-dashed p-10 text-center transition-colors"
          style={{ borderColor: status === "error" ? "#fca5a5" : status === "success" ? "#86efac" : "#cbd5e1", backgroundColor: "#fff" }}
          onDragOver={e => { e.preventDefault(); e.stopPropagation() }}
          onDrop={e => {
            e.preventDefault()
            e.stopPropagation()
            const file = e.dataTransfer.files?.[0]
            if (file) handleFile(file)
          }}
        >
          {status === "idle" && (
            <>
              <Upload className="mx-auto mb-3 h-10 w-10" style={{ color: "#94a3b8" }} />
              <p className="mb-1 text-sm font-medium" style={{ color: "#334155" }}>
                Drag and drop your Excel file here
              </p>
              <p className="mb-4 text-xs" style={{ color: "#94a3b8" }}>or click to browse</p>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="absolute inset-0 cursor-pointer opacity-0"
                onChange={e => {
                  const file = e.target.files?.[0]
                  if (file) handleFile(file)
                }}
              />
            </>
          )}

          {(status === "parsing" || status === "uploading") && (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-10 w-10 animate-spin" style={{ color: "#0f3d6b" }} />
              <p className="text-sm font-medium" style={{ color: "#334155" }}>{message}</p>
            </div>
          )}

          {status === "success" && (
            <div className="flex flex-col items-center gap-3">
              <CheckCircle2 className="h-10 w-10" style={{ color: "#16a34a" }} />
              <p className="text-sm font-semibold" style={{ color: "#16a34a" }}>{message}</p>
              <p className="text-xs" style={{ color: "#64748b" }}>{fundCount} funds are now live for all users</p>
              <button
                onClick={() => { setStatus("idle"); setMessage("") }}
                className="mt-2 rounded-md px-4 py-2 text-sm font-medium text-white"
                style={{ backgroundColor: "#0f3d6b" }}
              >
                Upload Again
              </button>
            </div>
          )}

          {status === "error" && (
            <div className="flex flex-col items-center gap-3">
              <AlertCircle className="h-10 w-10" style={{ color: "#dc2626" }} />
              <p className="text-sm font-semibold" style={{ color: "#dc2626" }}>{message}</p>
              <button
                onClick={() => { setStatus("idle"); setMessage("") }}
                className="mt-2 rounded-md px-4 py-2 text-sm font-medium text-white"
                style={{ backgroundColor: "#0f3d6b" }}
              >
                Try Again
              </button>
            </div>
          )}
        </div>

        <div className="mt-6 text-center">
          <a href="/" className="text-sm font-medium transition-colors hover:underline" style={{ color: "#0f3d6b" }}>
            Back to main site
          </a>
        </div>
      </div>
    </main>
  )
}
