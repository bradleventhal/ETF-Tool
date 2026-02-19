"use client"

import { useCallback, useState } from "react"
import { Upload } from "lucide-react"

interface FileUploadProps {
  onFileLoaded: (buffer: ArrayBuffer, fileName: string) => void
  compact?: boolean
}

export function FileUpload({ onFileLoaded, compact }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false)

  const handleFile = useCallback(
    (file: File) => {
      const reader = new FileReader()
      reader.onload = () => { if (reader.result instanceof ArrayBuffer) onFileLoaded(reader.result, file.name) }
      reader.readAsArrayBuffer(file)
    },
    [onFileLoaded]
  )

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handleClick = useCallback(() => {
    const input = document.createElement("input")
    input.type = "file"; input.accept = ".xlsx,.xls,.csv"
    input.onchange = (e) => { const file = (e.target as HTMLInputElement).files?.[0]; if (file) handleFile(file) }
    input.click()
  }, [handleFile])

  return (
    <button
      type="button"
      onDrop={handleDrop}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
      onDragLeave={(e) => { e.preventDefault(); setIsDragging(false) }}
      onClick={handleClick}
      className={`flex w-full cursor-pointer flex-col items-center gap-2 rounded-md border-2 border-dashed transition-colors ${
        isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/30 hover:bg-muted/50"
      } ${compact ? "px-4 py-4" : "px-6 py-8"}`}
    >
      <Upload className={`text-muted-foreground/60 ${compact ? "h-4 w-4" : "h-5 w-5"}`} />
      <p className={`font-medium text-foreground ${compact ? "text-xs" : "text-sm"}`}>
        Drop your Excel or CSV file here
      </p>
      <p className="text-[11px] text-muted-foreground">.xlsx, .xls, or .csv</p>
    </button>
  )
}
