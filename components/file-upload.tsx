"use client"

import { useCallback, useState } from "react"
import { Upload, FileSpreadsheet, Database, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

interface FileUploadProps {
  onFileLoaded: (buffer: ArrayBuffer, fileName: string) => void
  hasExistingData: boolean
  fundCount: number
  lastUpdated: string | null
}

export function FileUpload({ onFileLoaded, hasExistingData, fundCount, lastUpdated }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [showUpload, setShowUpload] = useState(false)

  const handleFile = useCallback(
    (file: File) => {
      const reader = new FileReader()
      reader.onload = () => {
        if (reader.result instanceof ArrayBuffer) {
          onFileLoaded(reader.result, file.name)
          setShowUpload(false)
        }
      }
      reader.readAsArrayBuffer(file)
    },
    [onFileLoaded]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleClick = useCallback(() => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = ".xlsx,.xls,.csv"
    input.onchange = (e) => {
      const target = e.target as HTMLInputElement
      const file = target.files?.[0]
      if (file) handleFile(file)
    }
    input.click()
  }, [handleFile])

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })
  }

  // If data exists and user hasn't requested update, show compact status
  if (hasExistingData && !showUpload) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10">
          <Database className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-card-foreground">
            {fundCount} fund{fundCount !== 1 ? "s" : ""} loaded
          </p>
          {lastUpdated && (
            <p className="text-xs text-muted-foreground">
              Last updated {formatDate(lastUpdated)}
            </p>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowUpload(true)}
          className="gap-1.5"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Update Data
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleClick}
        className={`flex w-full cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed p-8 transition-colors ${
          isDragging
            ? "border-primary bg-primary/5"
            : "border-border bg-card hover:border-primary/50 hover:bg-secondary/50"
        }`}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
          <Upload className="h-5 w-5 text-primary" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">
            {hasExistingData ? "Drop updated file to replace data" : "Drop your Excel or CSV file here"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Supports .xlsx, .xls, and .csv formats
          </p>
        </div>
      </button>
      {hasExistingData && (
        <button
          type="button"
          onClick={() => setShowUpload(false)}
          className="self-center text-xs text-muted-foreground underline-offset-2 hover:underline"
        >
          Cancel
        </button>
      )}
    </div>
  )
}
