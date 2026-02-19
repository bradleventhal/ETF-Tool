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
      className={`flex w-full cursor-pointer flex-col items-center gap-2 rounded border-2 border-dashed px-6 py-6 transition-colors ${
        isDragging ? "border-blue-500 bg-blue-500/5" : "border-[#1e3048] hover:border-blue-500/30 hover:bg-[#0f1c2e]"
      }`}
    >
      <Upload className="h-5 w-5 text-slate-500" />
      <p className="text-sm font-medium text-slate-300">
        {hasExistingData ? "Drop updated file to replace data" : "Drop your Excel or CSV file here"}
      </p>
      <p className="text-[11px] text-slate-600">.xlsx, .xls, or .csv</p>
    </button>
  )
}
