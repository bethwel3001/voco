import { useState, useRef, useEffect, useCallback } from 'react'
import {
  X,
  Upload,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  Download,
  Sparkles,
  ArrowRight,
  HelpCircle,
} from 'lucide-react'
import { parseRSVPCSV, SAMPLE_CSV_CONTENT } from '../utils/csvParser'
import type { CSVParseResult } from '../types'

interface UploadModalProps {
  isOpen: boolean
  onClose: () => void
  onImport: (records: CSVParseResult['records']) => void
}

export function UploadModal({ isOpen, onClose, onImport }: UploadModalProps) {
  const [dragActive, setDragActive] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)
  const [parseResult, setParseResult] = useState<CSVParseResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleClose = useCallback(() => {
    setFileName(null)
    setParseResult(null)
    setDragActive(false)
    onClose()
  }, [onClose])

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, handleClose])

  if (!isOpen) return null

  const processFile = (file: File) => {
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      if (text) {
        const result = parseRSVPCSV(text)
        setParseResult(result)
      }
    }
    reader.readAsText(file)
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0])
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0])
    }
  }

  const handleLoadSample = () => {
    setFileName('sample_rsvps.csv')
    const result = parseRSVPCSV(SAMPLE_CSV_CONTENT)
    setParseResult(result)
  }

  const handleDownloadSample = () => {
    const blob = new Blob([SAMPLE_CSV_CONTENT], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', 'voco_rsvp_sample.csv')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleConfirmImport = () => {
    if (parseResult && parseResult.valid && parseResult.records.length > 0) {
      onImport(parseResult.records)
      handleClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
        onClick={handleClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-950 p-6 sm:p-7 shadow-2xl shadow-indigo-950/40 z-10 animate-scaleUp">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-zinc-800/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">Upload RSVP List</h2>
              <p className="text-xs text-zinc-400">
                Import CSV with columns: <code className="text-indigo-300 font-mono">Name</code>,{' '}
                <code className="text-indigo-300 font-mono">Phone</code>,{' '}
                <code className="text-indigo-300 font-mono">Role</code>,{' '}
                <code className="text-indigo-300 font-mono">Event</code>
              </p>
            </div>
          </div>

          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="mt-5 space-y-5">
          {/* Dropzone */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative flex flex-col items-center justify-center p-6 sm:p-8 rounded-xl border-2 border-dashed transition-all cursor-pointer ${
              dragActive
                ? 'border-indigo-500 bg-indigo-500/10'
                : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900/30 hover:bg-zinc-900/60'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
            />

            <div className="w-12 h-12 rounded-full bg-zinc-800/80 border border-zinc-700/80 flex items-center justify-center text-zinc-400 mb-3">
              <Upload className="w-6 h-6 text-indigo-400" />
            </div>

            <p className="text-sm font-medium text-white text-center">
              Click to browse or drag and drop your CSV file here
            </p>
            <p className="text-xs text-zinc-500 mt-1">Accepts standard .csv exports from Eventbrite, Luma, or Google Sheets</p>

            {fileName && (
              <div className="mt-4 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-xs font-mono text-indigo-300 flex items-center gap-2">
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>{fileName}</span>
              </div>
            )}
          </div>

          {/* Quick Helper Actions */}
          <div className="flex items-center justify-between text-xs text-zinc-400 bg-zinc-900/50 p-3 rounded-lg border border-zinc-800/60">
            <div className="flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-zinc-500" />
              <span>Need a template?</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadSample}
                className="inline-flex items-center gap-1 text-zinc-300 hover:text-white font-medium hover:underline cursor-pointer"
              >
                <Download className="w-3 h-3" />
                <span>Download Sample CSV</span>
              </button>
              <span className="text-zinc-600">|</span>
              <button
                type="button"
                onClick={handleLoadSample}
                className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 font-medium cursor-pointer"
              >
                <Sparkles className="w-3 h-3" />
                <span>Load Demo Data</span>
              </button>
            </div>
          </div>

          {/* Parse Errors */}
          {parseResult && !parseResult.valid && parseResult.errors.length > 0 && (
            <div className="p-3.5 rounded-xl bg-red-950/30 border border-red-500/30 space-y-1">
              <div className="flex items-center gap-2 text-xs font-semibold text-red-400">
                <AlertCircle className="w-4 h-4" />
                <span>Validation Errors</span>
              </div>
              <ul className="text-xs text-red-300/90 list-disc list-inside space-y-0.5">
                {parseResult.errors.map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Parsed Preview Table */}
          {parseResult && parseResult.valid && parseResult.records.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Ready to import {parseResult.records.length} RSVPs</span>
                </span>
                <span className="text-zinc-500">Previewing parsed records:</span>
              </div>

              <div className="max-h-48 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-900/60 text-xs">
                <table className="w-full text-left">
                  <thead className="bg-zinc-800/80 sticky top-0 text-zinc-400 font-medium">
                    <tr>
                      <th className="p-2 pl-3">Name</th>
                      <th className="p-2">Phone</th>
                      <th className="p-2">Role</th>
                      <th className="p-2 pr-3">Event</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                    {parseResult.records.map((rec, i) => (
                      <tr key={i} className="hover:bg-zinc-800/30">
                        <td className="p-2 pl-3 font-medium text-white">{rec.name}</td>
                        <td className="p-2 font-mono text-zinc-400">{rec.phone}</td>
                        <td className="p-2">
                          <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-[10px] text-indigo-300 border border-zinc-700">
                            {rec.role}
                          </span>
                        </td>
                        <td className="p-2 pr-3 truncate max-w-[160px] text-zinc-400">{rec.event}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-zinc-800/80 flex items-center justify-end gap-3">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-900 transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            onClick={handleConfirmImport}
            disabled={!parseResult || !parseResult.valid || parseResult.records.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 rounded-lg shadow-sm shadow-indigo-600/30 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span>Import & Queue Reminders</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
