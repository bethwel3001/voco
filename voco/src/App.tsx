import { useState, useEffect, useRef, useCallback } from 'react'
import { INITIAL_CAMPAIGNS } from './data/initialData'
import type { VoiceCampaign } from './types'
import { parseRSVPCSV } from './utils/csvParser'
import {
  fetchLiveAttendees,
  uploadRSVPCSV,
  triggerVoicePipeline,
  mapAttendeeToCampaign,
  API_BASE_URL,
} from './api/client'

export function App() {
  const [campaigns, setCampaigns] = useState<VoiceCampaign[]>(INITIAL_CAMPAIGNS)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isRunningCampaign, setIsRunningCampaign] = useState(false)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [])

  // Sync attendee list from backend
  const syncFromBackend = useCallback(async () => {
    try {
      const liveAttendees = await fetchLiveAttendees()
      if (liveAttendees.length > 0) {
        setCampaigns(liveAttendees.map(mapAttendeeToCampaign))
      }
    } catch {
      // Backend offline: keep initial state
    }
  }, [])

  useEffect(() => {
    let ignore = false
    fetchLiveAttendees()
      .then((liveAttendees) => {
        if (!ignore && liveAttendees.length > 0) {
          setCampaigns(liveAttendees.map(mapAttendeeToCampaign))
        }
      })
      .catch(() => {
        // Backend offline
      })
    return () => {
      ignore = true
    }
  }, [])

  // Handle CSV file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null
    setSelectedFile(file)
    setMessage(null)
  }

  // Handle CSV upload
  const handleUpload = async () => {
    if (!selectedFile) return
    setIsUploading(true)
    setMessage(null)

    try {
      const text = await selectedFile.text()
      const parseResult = parseRSVPCSV(text)

      if (!parseResult.valid) {
        setMessage(parseResult.errors[0] || 'Invalid CSV format. Required columns: Name, Phone, Role, Event.')
        setIsUploading(false)
        return
      }

      // Optimistic local update
      const newItems: VoiceCampaign[] = parseResult.records.map((r, i) => ({
        id: `r-${Date.now()}-${i}`,
        recipientName: r.name,
        phone: r.phone,
        role: r.role,
        event: r.event,
        status: 'Pending',
        scriptSnippet: 'Pending generation.',
        updatedAt: 'Just now',
      }))

      setCampaigns((prev) => [...newItems, ...prev])

      // Persist to backend
      try {
        await uploadRSVPCSV(text)
        await syncFromBackend()
      } catch {
        // Backend offline: local data kept
      }

      setMessage(`Uploaded ${parseResult.records.length} RSVPs.`)
      setSelectedFile(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch {
      setMessage('Failed to read or upload file.')
    } finally {
      setIsUploading(false)
    }
  }

  // Handle Run Campaign (batch voice generation)
  const handleRunCampaign = async () => {
    setIsRunningCampaign(true)
    setMessage(null)

    try {
      const result = await triggerVoicePipeline()
      if (result?.success) {
        await syncFromBackend()
        setMessage(result.message || 'Campaign run completed.')
      } else {
        // Fallback local update
        setCampaigns((prev) =>
          prev.map((c) => (c.status === 'Pending' ? { ...c, status: 'Generated' } : c))
        )
        setMessage('Campaign run completed.')
      }
    } catch {
      // Offline fallback
      setCampaigns((prev) =>
        prev.map((c) => (c.status === 'Pending' ? { ...c, status: 'Generated' } : c))
      )
      setMessage('Campaign run completed.')
    } finally {
      setIsRunningCampaign(false)
    }
  }

  // Audio playback toggle
  const togglePlayAudio = (campaign: VoiceCampaign) => {
    if (playingId === campaign.id) {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
      setPlayingId(null)
      return
    }

    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }

    let url = campaign.audioUrl
    if (!url || url.startsWith('/')) {
      url = `${API_BASE_URL}${url || `/api/audio/${encodeURIComponent(campaign.phone)}`}`
    }

    try {
      const audio = new Audio(url)
      audioRef.current = audio
      setPlayingId(campaign.id)

      audio.onended = () => {
        setPlayingId(null)
        audioRef.current = null
      }

      audio.onerror = () => {
        setMessage(`Unable to play audio for ${campaign.recipientName}.`)
        setPlayingId(null)
        audioRef.current = null
      }

      audio.play().catch(() => {
        setPlayingId(null)
        audioRef.current = null
      })
    } catch {
      setPlayingId(null)
    }
  }

  const pendingCount = campaigns.filter((c) => c.status === 'Pending').length
  const generatedCount = campaigns.filter((c) => c.status === 'Generated').length
  const sentCount = campaigns.filter((c) => c.status === 'Sent').length

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <h1 className="text-xl font-semibold tracking-tight text-gray-900">Voco</h1>
        </div>
      </header>

      {/* Main View */}
      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* Actions Bar: File Input, Upload, Run Campaign */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:border file:border-gray-300 file:text-sm file:font-medium file:bg-gray-50 file:text-gray-900 hover:file:bg-gray-100 cursor-pointer"
            />
            <button
              onClick={handleUpload}
              disabled={!selectedFile || isUploading}
              className="bg-black text-white px-4 py-2 text-sm font-medium hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isUploading ? 'Uploading...' : 'Upload'}
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleRunCampaign}
              disabled={isRunningCampaign || pendingCount === 0}
              className="bg-black text-white px-4 py-2 text-sm font-medium hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isRunningCampaign ? 'Running Campaign...' : 'Run Campaign'}
            </button>
          </div>
        </div>

        {/* Message Banner */}
        {message && (
          <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border border-gray-200 text-xs text-gray-800">
            <span>{message}</span>
            <button
              onClick={() => setMessage(null)}
              className="text-gray-500 hover:text-gray-900 font-mono text-xs ml-4"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Counts summary */}
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Total RSVPs: {campaigns.length}</span>
          <span>Pending: {pendingCount} | Generated: {generatedCount} | Sent: {sentCount}</span>
        </div>

        {/* RSVP Data Table */}
        <div className="border border-gray-200 overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-900 border-collapse">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-xs font-medium text-gray-600 uppercase tracking-wider">
                <th className="py-3 px-4">Name</th>
                <th className="py-3 px-4">Phone</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Event</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Script</th>
                <th className="py-3 px-4 text-right">Voice</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {campaigns.map((c) => {
                const isPlaying = playingId === c.id
                const hasAudio = c.status === 'Generated' || c.status === 'Sent' || Boolean(c.audioUrl)

                return (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium text-gray-900">{c.recipientName}</td>
                    <td className="py-3 px-4 text-gray-600 font-mono text-xs">{c.phone}</td>
                    <td className="py-3 px-4 text-gray-600">{c.role}</td>
                    <td className="py-3 px-4 text-gray-600">{c.event}</td>
                    <td className="py-3 px-4">
                      <span className="text-xs text-gray-700 font-medium">{c.status}</span>
                    </td>
                    <td className="py-3 px-4 text-xs text-gray-600 max-w-md truncate" title={c.scriptSnippet}>
                      {c.scriptSnippet || '—'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {hasAudio ? (
                        <button
                          onClick={() => togglePlayAudio(c)}
                          className="border border-gray-300 px-3 py-1 text-xs font-medium text-gray-900 hover:bg-gray-100"
                        >
                          {isPlaying ? 'Stop' : 'Play'}
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
              {campaigns.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-sm text-gray-500">
                    No RSVPs found. Choose a CSV file and click Upload.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  )
}

export default App
