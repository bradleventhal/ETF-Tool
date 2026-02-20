"use client"

import { useState, useCallback } from "react"
import { Upload, CheckCircle2, AlertCircle, Loader2 } from "lucide-react"
import * as XLSX from "xlsx"
import { parseFundData } from "@/lib/parse-fund-data"

export default function AdminUploadPage() {
  const [status, setStatus] = useState<"idle" | "parsing" | "uploading" | "success" | "error">("idle")
  const [message, setMessage] = useState("")
  const [fundCount, setFundCount] = useState(0)
  const [dragOver, setDragOver] = useState(false)

  const processFile = useCallback(async (file: File) => {
    setStatus("parsing")
    setMessage("Parsing Excel file...")

    try {
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: "array" })
      const sheetName = workbook.SheetNames.find(n => n.toLowerCase().includes("raw")) || workbook.SheetNames[0]
      const sheet = workbook.Sheets[sheetName]
      const rows = XLSX.utils.sheet_to_json(sheet)
      const funds = parseFundData(rows)

      if (funds.length === 0) {
        setStatus("error")
        setMessage("No fund data found in the sheet. Make sure the sheet has a 'Ticker' column.")
        return
      }

      setStatus("uploading")
      setMessage(`Uploading ${funds.length} funds to database...`)

      const res = await fetch("/api/upload-funds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ funds }),
      })

      const result = await res.json()

      if (!res.ok) {
        setStatus("error")
        setMessage(result.error || "Upload failed")
        return
      }

      setFundCount(result.count)
      setStatus("success")
      setMessage(`Successfully uploaded ${result.count} funds`)
    } catch (err) {
      setStatus("error")
      setMessage(err instanceof Error ? err.message : "Failed to process file")
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }, [processFile])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }, [processFile])

  return (
    <div className="flex min-h-screen items-center justify-center p-6" style={{ backgroundColor: "#f8fafc" }}>
      <div className="w-full max-w-lg">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "#0f3d6b" }}>Fund Data Admin</h1>
          <p className="mt-2 text-sm" style={{ color: "#64748b" }}>Upload your Excel file to update the fund database. All users will see the latest data.</p>
        </div>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 transition-colors"
          style={{
            borderColor: dragOver ? "#0f3d6b" : "#cbd5e1",
            backgroundColor: dragOver ? "#f0f7ff" : "#fff",
          }}
        >
          {status === "idle" && (
            <>
              <Upload size={40} style={{ color: "#94a3b8" }} />
              <p className="mt-4 text-sm font-medium" style={{ color: "#334155" }}>Drag and drop your Excel file here</p>
              <p className="mt-1 text-xs" style={{ color: "#94a3b8" }}>or</p>
              <label className="mt-3 cursor-pointer rounded-md px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90" style={{ backgroundColor: "#0f3d6b" }}>
                Browse Files
                <input type="file" accept=".xlsx,.xls" onChange={handleFileInput} className="hidden" />
              </label>
            </>
          )}

          {(status === "parsing" || status === "uploading") && (
            <div className="flex flex-col items-center gap-3">
              <Loader2 size={32} className="animate-spin" style={{ color: "#0f3d6b" }} />
              <p className="text-sm font-medium" style={{ color: "#334155" }}>{message}</p>
            </div>
          )}

          {status === "success" && (
            <div className="flex flex-col items-center gap-3">
              <CheckCircle2 size={40} style={{ color: "#16a34a" }} />
              <p className="text-sm font-medium" style={{ color: "#16a34a" }}>{message}</p>
              <p className="text-xs" style={{ color: "#64748b" }}>{fundCount} funds are now live for all users</p>
              <button
                onClick={() => { setStatus("idle"); setMessage("") }}
                className="mt-2 rounded-md px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90"
                style={{ backgroundColor: "#0f3d6b" }}
              >
                Upload Again
              </button>
            </div>
          )}

          {status === "error" && (
            <div className="flex flex-col items-center gap-3">
              <AlertCircle size={40} style={{ color: "#dc2626" }} />
              <p className="text-sm font-medium" style={{ color: "#dc2626" }}>{message}</p>
              <button
                onClick={() => { setStatus("idle"); setMessage("") }}
                className="mt-2 rounded-md px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90"
                style={{ backgroundColor: "#0f3d6b" }}
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
