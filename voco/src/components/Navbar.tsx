import { Mic, Calendar, Radio, Users, Upload, Sparkles } from 'lucide-react'

interface NavbarProps {
  currentTab: 'dashboard' | 'campaigns' | 'roster'
  onTabChange: (tab: 'dashboard' | 'campaigns' | 'roster') => void
  onOpenUpload: () => void
  pendingCount: number
}

export function Navbar({ currentTab, onTabChange, onOpenUpload, pendingCount }: NavbarProps) {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 text-white shadow-lg shadow-indigo-500/20 ring-1 ring-white/20">
              <Mic className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold tracking-tight text-white font-mono">VOCO</span>
                <span className="text-[10px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded bg-zinc-800/90 text-zinc-400 border border-zinc-700/50">
                  Voice Engine
                </span>
              </div>
              <p className="text-xs text-zinc-400">Intelligent Event Voice Reminders</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => onTabChange('dashboard')}
              className={`flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-lg transition-all ${
                currentTab === 'dashboard'
                  ? 'bg-zinc-800/90 text-white shadow-sm ring-1 ring-zinc-700/60'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>Events</span>
            </button>

            <button
              onClick={() => onTabChange('campaigns')}
              className={`relative flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-lg transition-all ${
                currentTab === 'campaigns'
                  ? 'bg-zinc-800/90 text-white shadow-sm ring-1 ring-zinc-700/60'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
              }`}
            >
              <Radio className="w-4 h-4" />
              <span>Campaigns</span>
              {pendingCount > 0 && (
                <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {pendingCount}
                </span>
              )}
            </button>

            <button
              onClick={() => onTabChange('roster')}
              className={`flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-lg transition-all ${
                currentTab === 'roster'
                  ? 'bg-zinc-800/90 text-white shadow-sm ring-1 ring-zinc-700/60'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>RSVP Roster</span>
            </button>
          </nav>

          {/* Action button */}
          <div className="flex items-center gap-3">
            <button
              onClick={onOpenUpload}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 rounded-lg shadow-sm shadow-indigo-600/30 ring-1 ring-indigo-400/30 transition-all cursor-pointer group"
            >
              <Upload className="w-4 h-4 transition-transform group-hover:-translate-y-0.5" />
              <span>Upload RSVP List</span>
              <Sparkles className="w-3.5 h-3.5 text-indigo-200 opacity-70 group-hover:opacity-100" />
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
