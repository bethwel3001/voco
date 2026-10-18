import { useState } from 'react'
import {
  Calendar,
  MapPin,
  Clock,
  Users,
  Upload,
  ArrowRight,
  Search,
  CheckCircle2,
  Hourglass,
  Sparkles,
  Radio,
  FileSpreadsheet,
} from 'lucide-react'
import type { EventItem, VoiceCampaign } from '../types'

interface DashboardViewProps {
  events: EventItem[]
  campaigns: VoiceCampaign[]
  onOpenUpload: () => void
  onSelectEventForCampaigns: (eventTitle: string) => void
}

export function DashboardView({
  events,
  campaigns,
  onOpenUpload,
  onSelectEventForCampaigns,
}: DashboardViewProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('All')

  // Calculate metrics
  const totalRsvps = events.reduce((sum, e) => sum + e.totalRsvps, 0)
  const pendingCampaigns = campaigns.filter((c) => c.status === 'Pending').length
  const generatedCampaigns = campaigns.filter((c) => c.status === 'Generated').length
  const sentCampaigns = campaigns.filter((c) => c.status === 'Sent').length

  const filteredEvents = events.filter((e) => {
    const matchesSearch =
      e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.location.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = selectedCategory === 'All' || e.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  // Unique categories
  const categories = ['All', ...Array.from(new Set(events.map((e) => e.category)))]

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Top Banner / Hero Intro */}
      <div className="relative overflow-hidden rounded-2xl border border-zinc-800/80 bg-gradient-to-b from-zinc-900/90 via-zinc-900/40 to-zinc-950 p-6 sm:p-8">
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-12 w-64 h-64 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>Voice Reminder Pipeline Ready</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Upcoming Events & Voice Reminders
            </h1>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Automate personalized phone reminders for your upcoming event attendees. Upload your RSVP CSV
              list, synthesize conversational voice calls, and track dispatch status in real-time.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={onOpenUpload}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-lg shadow-indigo-600/25 ring-1 ring-indigo-400/30 transition-all cursor-pointer group"
            >
              <Upload className="w-4 h-4 transition-transform group-hover:-translate-y-0.5" />
              <span>Upload RSVP List</span>
            </button>
          </div>
        </div>

        {/* Quick KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-8 pt-6 border-t border-zinc-800/60">
          <div className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
            <div className="flex items-center justify-between text-xs font-medium text-zinc-400 mb-1">
              <span>Upcoming Events</span>
              <Calendar className="w-4 h-4 text-zinc-500" />
            </div>
            <div className="text-2xl font-bold text-white tracking-tight">{events.length}</div>
            <div className="text-[11px] text-zinc-500 mt-1">Scheduled next 30 days</div>
          </div>

          <div className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
            <div className="flex items-center justify-between text-xs font-medium text-zinc-400 mb-1">
              <span>Total Confirmed RSVPs</span>
              <Users className="w-4 h-4 text-zinc-500" />
            </div>
            <div className="text-2xl font-bold text-white tracking-tight">{totalRsvps.toLocaleString()}</div>
            <div className="text-[11px] text-zinc-500 mt-1">Across all active rosters</div>
          </div>

          <div className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
            <div className="flex items-center justify-between text-xs font-medium text-amber-400/90 mb-1">
              <span>Pending Voice AI</span>
              <Hourglass className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-amber-300 tracking-tight">{pendingCampaigns}</div>
            <div className="text-[11px] text-zinc-500 mt-1">Ready for voice synthesis</div>
          </div>

          <div className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
            <div className="flex items-center justify-between text-xs font-medium text-emerald-400/90 mb-1">
              <span>Delivered Reminders</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-emerald-300 tracking-tight">{sentCampaigns}</div>
            <div className="text-[11px] text-zinc-500 mt-1">
              {generatedCampaigns} generated & queued
            </div>
          </div>
        </div>
      </div>

      {/* Events Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white tracking-tight flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-400" />
              <span>Upcoming Events</span>
              <span className="text-xs font-normal text-zinc-500">({filteredEvents.length})</span>
            </h2>
            <p className="text-xs text-zinc-400">Events scheduled for voice reminders and attendee outreach</p>
          </div>

          <div className="flex items-center gap-2">
            {/* Category pills */}
            <div className="hidden sm:flex items-center bg-zinc-900/90 p-1 rounded-lg border border-zinc-800">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2.5 py-1 text-xs rounded-md font-medium transition-all ${
                    selectedCategory === cat
                      ? 'bg-zinc-800 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                placeholder="Search events or venue..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full sm:w-56 pl-9 pr-3 py-1.5 text-xs bg-zinc-900/90 border border-zinc-800 rounded-lg text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
              />
            </div>
          </div>
        </div>

        {/* Events Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredEvents.map((event) => {
            // Calculate event campaigns
            const eventCampaigns = campaigns.filter(
              (c) => c.event.toLowerCase() === event.title.toLowerCase(),
            )
            const eventPending = eventCampaigns.filter((c) => c.status === 'Pending').length
            const eventGenerated = eventCampaigns.filter((c) => c.status === 'Generated').length
            const eventSent = eventCampaigns.filter((c) => c.status === 'Sent').length
            const totalVoice = eventCampaigns.length

            return (
              <div
                key={event.id}
                className="group relative flex flex-col justify-between rounded-xl border border-zinc-800/80 bg-zinc-900/50 hover:bg-zinc-900/80 hover:border-zinc-700/80 p-5 transition-all duration-200"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-zinc-800/90 text-indigo-300 border border-zinc-700/60">
                      {event.category}
                    </span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
                        event.campaignStatus === 'Active'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : event.campaignStatus === 'Scheduled'
                            ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                            : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                      }`}
                    >
                      {event.campaignStatus}
                    </span>
                  </div>

                  <h3 className="mt-3 text-base font-semibold text-white group-hover:text-indigo-300 transition-colors">
                    {event.title}
                  </h3>

                  <div className="mt-3 space-y-1.5 text-xs text-zinc-400">
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                      <span>
                        {event.date} • {event.time}
                      </span>
                      <span className="ml-auto text-[11px] font-medium text-zinc-500">
                        In {event.daysUntil} days
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                      <span className="truncate">{event.location}</span>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <Users className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                      <span className="text-zinc-300 font-medium">{event.totalRsvps} RSVPs registered</span>
                    </div>
                  </div>
                </div>

                {/* Voice Reminder Campaign Status bar */}
                <div className="mt-5 pt-4 border-t border-zinc-800/60">
                  <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-2">
                    <span className="flex items-center gap-1.5">
                      <Radio className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Voice Campaign</span>
                    </span>
                    <span className="font-mono text-zinc-300">
                      {totalVoice > 0 ? `${eventSent}/${totalVoice} Dispatched` : 'No campaigns queued'}
                    </span>
                  </div>

                  {/* Progress bar */}
                  {totalVoice > 0 ? (
                    <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden flex">
                      <div
                        className="bg-emerald-500 h-full transition-all"
                        style={{ width: `${(eventSent / totalVoice) * 100}%` }}
                        title={`${eventSent} Sent`}
                      />
                      <div
                        className="bg-indigo-500 h-full transition-all"
                        style={{ width: `${(eventGenerated / totalVoice) * 100}%` }}
                        title={`${eventGenerated} Generated`}
                      />
                      <div
                        className="bg-amber-500 h-full transition-all"
                        style={{ width: `${(eventPending / totalVoice) * 100}%` }}
                        title={`${eventPending} Pending`}
                      />
                    </div>
                  ) : (
                    <div className="w-full h-1.5 bg-zinc-800 rounded-full" />
                  )}

                  <div className="mt-4 flex items-center justify-between">
                    <button
                      onClick={() => onSelectEventForCampaigns(event.title)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
                    >
                      <span>View campaigns</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={onOpenUpload}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700/80 rounded-lg transition-colors"
                    >
                      <FileSpreadsheet className="w-3 h-3 text-zinc-400" />
                      <span>Import CSV</span>
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {filteredEvents.length === 0 && (
          <div className="text-center py-12 rounded-xl border border-dashed border-zinc-800 bg-zinc-950/40">
            <Calendar className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
            <h3 className="text-sm font-medium text-zinc-300">No events found</h3>
            <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
              No events matched your search query. Try selecting &quot;All&quot; or upload an RSVP CSV to
              register new events.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
