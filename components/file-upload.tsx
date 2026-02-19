"use client"

import { useCallback, useState } from "react"
import { Upload } from "lucide-react"

interface FileUploadProps {
  onFileLoaded: (buffer: ArrayBuffer, fileName: string) => void
  hasExistingData: boolean
  fundCount: number
  lastUpdated: string | null
}

export function FileUpload({ onFileLoaded, hasExistingData }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false)

  const handleFile = useCallback(
    (file: File) => {
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

  return (
    <button
      type="button"
      onDrop={handleDrop}
      onDragOver={(e) => {
        e.preventDefault()
        setIsDragging(true)
      }}
      onDragLeave={(e) => {
        e.preventDefault()
        setIsDragging(false)
      }}
      onClick={handleClick}
      className={`flex w-full cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed px-6 py-8 transition-colors ${
        isDragging
          ? "border-primary bg-primary/5"
          : "border-border hover:border-primary/40 hover:bg-secondary/30"
      }`}
    >
      <Upload className="h-6 w-6 text-muted-foreground" />
      <p className="text-sm font-medium text-foreground">
        {hasExistingData
          ? "Drop updated file to replace data"
          : "Drop your Excel or CSV file here"}
      </p>
      <p className="text-xs text-muted-foreground">
        .xlsx, .xls, or .csv
      </p>
    </button>
  )
}
