import { useState, useRef, useEffect } from 'react'
import {
  Hourglass,
  CheckCircle2,
  PhoneCall,
  Search,
  Filter,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Send,
  Volume2,
  Calendar,
  Phone,
  RefreshCw,
  Database,
  Music,
} from 'lucide-react'
import type { VoiceCampaign, CampaignStatus } from '../types'
import { API_BASE_URL } from '../api/client'

interface CampaignsViewProps {
  campaigns: VoiceCampaign[]
  onUpdateCampaignStatus: (campaignId: string, newStatus: CampaignStatus) => Promise<void> | void
  onBatchGenerate: () => Promise<void> | void
  onBatchSend: () => void
  initialEventFilter?: string
  onRefreshLiveStatus?: () => Promise<void> | void
  isRefreshing?: boolean
  isBackendConnected?: boolean
}

export function CampaignsView({
  campaigns,
  onUpdateCampaignStatus,
  onBatchGenerate,
  onBatchSend,
  initialEventFilter = '',
  onRefreshLiveStatus,
  isRefreshing = false,
  isBackendConnected = false,
}: CampaignsViewProps) {
  const [activeTab, setActiveTab] = useState<'All' | CampaignStatus>('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedEvent, setSelectedEvent] = useState(initialEventFilter)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [isSynthesizing, setIsSynthesizing] = useState(false)
  const [isDispatching, setIsDispatching] = useState(false)
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

  // Status counts
  const pendingCount = campaigns.filter((c) => c.status === 'Pending').length
  const generatedCount = campaigns.filter((c) => c.status === 'Generated').length
  const sentCount = campaigns.filter((c) => c.status === 'Sent').length

  // Filter list
  const events = Array.from(new Set(campaigns.map((c) => c.event)))

  const filteredCampaigns = campaigns.filter((c) => {
    const matchesTab = activeTab === 'All' || c.status === activeTab
    const matchesEvent = !selectedEvent || c.event.toLowerCase() === selectedEvent.toLowerCase()
    const matchesSearch =
      c.recipientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.event.toLowerCase().includes(searchQuery.toLowerCase())

    return matchesTab && matchesEvent && matchesSearch
  })

  const handleTogglePlayAudio = (campaign: VoiceCampaign) => {
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
        console.warn(`[Audio] Streaming failed for ${url}, running audio simulation preview.`)
        setTimeout(() => {
          setPlayingId((prev) => (prev === campaign.id ? null : prev))
          audioRef.current = null
        }, (campaign.durationSec || 4) * 1000)
      }

      audio.play().catch(() => {
        // Fallback animation if browser blocks autoplay
        setTimeout(() => {
          setPlayingId((prev) => (prev === campaign.id ? null : prev))
          audioRef.current = null
        }, (campaign.durationSec || 4) * 1000)
      })
    } catch {
      setPlayingId(campaign.id)
      setTimeout(() => setPlayingId(null), 3000)
    }
  }

  const handleBatchGenerateClick = async () => {
    setIsSynthesizing(true)
    try {
      await onBatchGenerate()
    } finally {
      setIsSynthesizing(false)
    }
  }

  const handleBatchSendClick = () => {
    setIsDispatching(true)
    setTimeout(() => {
      onBatchSend()
      setIsDispatching(false)
    }, 800)
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header and Summary stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
              <Volume2 className="w-6 h-6 text-indigo-400" />
              <span>Voice Reminder Campaigns</span>
            </h1>

            {/* Live MongoDB Status Badge */}
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                isBackendConnected
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-zinc-800 text-zinc-400 border-zinc-700'
              }`}
            >
              <Database className="w-3 h-3" />
              <span>{isBackendConnected ? 'Live MongoDB Atlas' : 'Local State Mode'}</span>
            </span>
          </div>

          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Real-time status of voice reminders synthesized via Llama-3 & ElevenLabs, stored in MongoDB Atlas.
          </p>
        </div>

        {/* Action Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          {onRefreshLiveStatus && (
            <button
              onClick={() => onRefreshLiveStatus()}
              disabled={isRefreshing}
              title="Fetch latest status from MongoDB"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 hover:text-white transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-indigo-400' : ''}`} />
              <span>{isRefreshing ? 'Syncing...' : 'Sync MongoDB'}</span>
            </button>
          )}

          {pendingCount > 0 && (
            <button
              onClick={handleBatchGenerateClick}
              disabled={isSynthesizing}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/30 transition-all cursor-pointer disabled:opacity-50"
            >
              <Sparkles className={`w-3.5 h-3.5 ${isSynthesizing ? 'animate-spin' : ''}`} />
              <span>
                {isSynthesizing ? 'Synthesizing Audio...' : `Synthesize All Pending (${pendingCount})`}
              </span>
            </button>
          )}

          {generatedCount > 0 && (
            <button
              onClick={handleBatchSendClick}
              disabled={isDispatching}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              <Send className={`w-3.5 h-3.5 ${isDispatching ? 'animate-pulse' : ''}`} />
              <span>{isDispatching ? 'Dispatching...' : `Dispatch Calls (${generatedCount})`}</span>
            </button>
          )}
        </div>
      </div>

      {/* Status metric badges */}
      <div className="grid grid-cols-3 gap-3">
        <button
          onClick={() => setActiveTab('Pending')}
          className={`flex items-center justify-between p-3.5 rounded-xl border text-left transition-all ${
            activeTab === 'Pending'
              ? 'bg-amber-950/30 border-amber-500/40 ring-1 ring-amber-500/30'
              : 'bg-zinc-900/40 border-zinc-800 hover:border-zinc-700'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400 border border-amber-500/20">
              <Hourglass className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-medium text-zinc-400">Pending</div>
              <div className="text-lg font-bold text-amber-300">{pendingCount}</div>
            </div>
          </div>
          <span className="text-[11px] text-zinc-500 hidden sm:inline">Awaiting Voice Gen</span>
        </button>

        <button
          onClick={() => setActiveTab('Generated')}
          className={`flex items-center justify-between p-3.5 rounded-xl border text-left transition-all ${
            activeTab === 'Generated'
              ? 'bg-indigo-950/30 border-indigo-500/40 ring-1 ring-indigo-500/30'
              : 'bg-zinc-900/40 border-zinc-800 hover:border-zinc-700'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20">
              <Volume2 className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-medium text-zinc-400">Generated</div>
              <div className="text-lg font-bold text-indigo-300">{generatedCount}</div>
            </div>
          </div>
          <span className="text-[11px] text-zinc-500 hidden sm:inline">Voice Ready to Play</span>
        </button>

        <button
          onClick={() => setActiveTab('Sent')}
          className={`flex items-center justify-between p-3.5 rounded-xl border text-left transition-all ${
            activeTab === 'Sent'
              ? 'bg-emerald-950/30 border-emerald-500/40 ring-1 ring-emerald-500/30'
              : 'bg-zinc-900/40 border-zinc-800 hover:border-zinc-700'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-medium text-zinc-400">Sent</div>
              <div className="text-lg font-bold text-emerald-300">{sentCount}</div>
            </div>
          </div>
          <span className="text-[11px] text-zinc-500 hidden sm:inline">Delivered Calls</span>
        </button>
      </div>

      {/* Filtering toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-xl bg-zinc-900/70 border border-zinc-800">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {(['All', 'Pending', 'Generated', 'Sent'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                activeTab === tab
                  ? 'bg-zinc-800 text-white shadow-sm ring-1 ring-zinc-700'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
              }`}
            >
              {tab}{' '}
              <span className="text-[10px] text-zinc-500 ml-1">
                (
                {tab === 'All'
                  ? campaigns.length
                  : tab === 'Pending'
                    ? pendingCount
                    : tab === 'Generated'
                      ? generatedCount
                      : sentCount}
                )
              </span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {/* Event selector */}
          <div className="relative">
            <select
              value={selectedEvent}
              onChange={(e) => setSelectedEvent(e.target.value)}
              className="appearance-none pl-3 pr-8 py-1.5 text-xs bg-zinc-800 border border-zinc-700/80 rounded-lg text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="">All Events</option>
              {events.map((evt) => (
                <option key={evt} value={evt}>
                  {evt}
                </option>
              ))}
            </select>
            <Filter className="w-3.5 h-3.5 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Search bar */}
          <div className="relative flex-1 sm:w-48">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search recipient..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-zinc-800 border border-zinc-700/80 rounded-lg text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Campaigns list cards */}
      <div className="space-y-3">
        {filteredCampaigns.map((campaign) => {
          const isPlaying = playingId === campaign.id
          const hasAudioGenerated =
            campaign.status === 'Generated' || campaign.status === 'Sent' || Boolean(campaign.audioUrl)

          return (
            <div
              key={campaign.id}
              className={`p-4 rounded-xl border transition-all ${
                campaign.status === 'Pending'
                  ? 'bg-zinc-900/40 border-zinc-800/90 hover:border-amber-500/40'
                  : campaign.status === 'Generated'
                    ? 'bg-zinc-900/60 border-zinc-800/90 hover:border-indigo-500/40'
                    : 'bg-zinc-900/40 border-zinc-800/90 hover:border-emerald-500/40'
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* Recipient Details */}
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-semibold text-zinc-300 shrink-0">
                    {campaign.recipientName
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-white">{campaign.recipientName}</span>
                      <span
                        className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                          campaign.role === 'Speaker'
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                            : campaign.role === 'VIP'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : campaign.role === 'Panelist'
                                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                                : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                        }`}
                      >
                        {campaign.role}
                      </span>

                      {/* Status Pill */}
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${
                          campaign.status === 'Pending'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : campaign.status === 'Generated'
                              ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        }`}
                      >
                        {campaign.status === 'Pending' && <Hourglass className="w-3 h-3" />}
                        {campaign.status === 'Generated' && <Volume2 className="w-3 h-3" />}
                        {campaign.status === 'Sent' && <CheckCircle2 className="w-3 h-3" />}
                        <span>{campaign.status}</span>
                      </span>

                      {/* Audio Ready Tag */}
                      {hasAudioGenerated && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">
                          <Music className="w-2.5 h-2.5" />
                          <span>MP3 Synthesized</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-xs text-zinc-400">
                      <span className="flex items-center gap-1 font-mono">
                        <Phone className="w-3 h-3 text-zinc-500" />
                        {campaign.phone}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-zinc-500" />
                        {campaign.event}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions & Outcome */}
                <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                  {/* PLAY AUDIO BUTTON (Featured next to attendees who have voice files generated) */}
                  {hasAudioGenerated && (
                    <button
                      onClick={() => handleTogglePlayAudio(campaign)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                        isPlaying
                          ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/30 ring-1 ring-indigo-400'
                          : 'bg-zinc-800 hover:bg-zinc-700/90 text-zinc-200 border-zinc-700 hover:text-white'
                      }`}
                    >
                      {isPlaying ? (
                        <>
                          <Pause className="w-3.5 h-3.5 fill-current" />
                          <span>Pause Audio</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5 fill-current text-indigo-400" />
                          <span>Play Audio</span>
                        </>
                      )}
                    </button>
                  )}

                  {campaign.status === 'Pending' && (
                    <button
                      onClick={() => onUpdateCampaignStatus(campaign.id, 'Generated')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-all cursor-pointer shadow-sm"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Synthesize Voice</span>
                    </button>
                  )}

                  {campaign.status === 'Generated' && (
                    <button
                      onClick={() => onUpdateCampaignStatus(campaign.id, 'Sent')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-all cursor-pointer shadow-sm"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Dispatch Call</span>
                    </button>
                  )}

                  {campaign.status === 'Sent' && (
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <PhoneCall className="w-3 h-3" />
                        <span>Delivered ({campaign.durationSec || 20}s)</span>
                      </span>

                      <button
                        onClick={() => onUpdateCampaignStatus(campaign.id, 'Pending')}
                        title="Reset reminder to pending"
                        className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Script excerpt / Active Waveform Visualizer */}
              <div className="mt-3 pt-3 border-t border-zinc-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <p className="text-xs text-zinc-400 italic line-clamp-1">
                  &ldquo;{campaign.scriptSnippet}&rdquo;
                </p>

                {isPlaying && (
                  <div className="flex items-center gap-1.5 shrink-0 bg-indigo-950/40 px-2 py-1 rounded-md border border-indigo-500/30">
                    <span className="w-1 h-3 bg-indigo-500 animate-pulse rounded-full" />
                    <span className="w-1 h-5 bg-indigo-400 animate-pulse delay-75 rounded-full" />
                    <span className="w-1 h-2 bg-indigo-500 animate-pulse delay-150 rounded-full" />
                    <span className="w-1 h-6 bg-indigo-300 animate-pulse delay-100 rounded-full" />
                    <span className="w-1 h-4 bg-indigo-400 animate-pulse delay-200 rounded-full" />
                    <span className="text-[11px] font-mono text-indigo-300 ml-1">
                      Playing Voice Audio ({campaign.durationSec || 20}s)
                    </span>
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {filteredCampaigns.length === 0 && (
          <div className="text-center py-12 rounded-xl border border-dashed border-zinc-800 bg-zinc-950/40">
            <Volume2 className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
            <h3 className="text-sm font-medium text-zinc-300">No voice campaigns found</h3>
            <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
              There are no voice reminders matching the current filter. Upload an RSVP CSV or clear active
              filters to view all campaigns.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
