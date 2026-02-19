"use client"

import { useCallback, useState } from "react"
import { Upload, FileSpreadsheet, X } from "lucide-react"

interface FileUploadProps {
  onFileLoaded: (buffer: ArrayBuffer, fileName: string) => void
}

export function FileUpload({ onFileLoaded }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)

  const handleFile = useCallback(
    (file: File) => {
      setFileName(file.name)
      const reader = new FileReader()
      reader.onload = () => {
        if (reader.result instanceof ArrayBuffer) {
          onFileLoaded(reader.result, file.name)
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

  const clearFile = useCallback(() => {
    setFileName(null)
  }, [])

  if (fileName) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-4">
        <FileSpreadsheet className="h-5 w-5 shrink-0 text-primary" />
        <span className="flex-1 truncate text-sm font-medium text-card-foreground">
          {fileName}
        </span>
        <button
          onClick={clearFile}
          className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          aria-label="Remove file"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    )
  }

  return (
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
          Drop your Excel or CSV file here
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Supports .xlsx, .xls, and .csv formats
        </p>
      </div>
    </button>
  )
}
