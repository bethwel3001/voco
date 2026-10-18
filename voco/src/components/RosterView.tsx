import { useState } from 'react'
import { Users, Search, Filter, Phone, Calendar, Upload, FileSpreadsheet } from 'lucide-react'
import type { RSVPRecord } from '../types'

interface RosterViewProps {
  rsvps: RSVPRecord[]
  onOpenUpload: () => void
}

export function RosterView({ rsvps, onOpenUpload }: RosterViewProps) {
  const [search, setSearch] = useState('')
  const [selectedRole, setSelectedRole] = useState('All')
  const [selectedEvent, setSelectedEvent] = useState('All')

  const roles = ['All', ...Array.from(new Set(rsvps.map((r) => r.role)))]
  const events = ['All', ...Array.from(new Set(rsvps.map((r) => r.event)))]

  const filteredRsvps = rsvps.filter((r) => {
    const matchesSearch =
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.phone.toLowerCase().includes(search.toLowerCase()) ||
      r.event.toLowerCase().includes(search.toLowerCase())
    const matchesRole = selectedRole === 'All' || r.role === selectedRole
    const matchesEvent = selectedEvent === 'All' || r.event === selectedEvent
    return matchesSearch && matchesRole && matchesEvent
  })

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Users className="w-6 h-6 text-indigo-400" />
            <span>RSVP Attendee Roster</span>
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Confirmed guests and role registrations imported from CSV lists.
          </p>
        </div>

        <button
          onClick={onOpenUpload}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-sm transition-all cursor-pointer self-start sm:self-auto"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>Upload CSV List</span>
        </button>
      </div>

      {/* Filter toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-xl bg-zinc-900/70 border border-zinc-800">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Role selector */}
          <div className="relative">
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="appearance-none pl-3 pr-8 py-1.5 text-xs bg-zinc-800 border border-zinc-700/80 rounded-lg text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            >
              {roles.map((role) => (
                <option key={role} value={role}>
                  Role: {role}
                </option>
              ))}
            </select>
            <Filter className="w-3.5 h-3.5 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Event selector */}
          <div className="relative">
            <select
              value={selectedEvent}
              onChange={(e) => setSelectedEvent(e.target.value)}
              className="appearance-none pl-3 pr-8 py-1.5 text-xs bg-zinc-800 border border-zinc-700/80 rounded-lg text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            >
              {events.map((evt) => (
                <option key={evt} value={evt}>
                  Event: {evt}
                </option>
              ))}
            </select>
            <Calendar className="w-3.5 h-3.5 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Search */}
        <div className="relative sm:w-56">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by name, phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-zinc-800 border border-zinc-700/80 rounded-lg text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Table view */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-800/80 text-zinc-400 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Attendee</th>
                <th className="py-3 px-4">Phone</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Event</th>
                <th className="py-3 px-4 text-right">Imported</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
              {filteredRsvps.map((rsvp) => (
                <tr key={rsvp.id} className="hover:bg-zinc-800/30 transition-colors">
                  <td className="py-3 px-4 font-medium text-white flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[10px] text-zinc-300 font-mono">
                      {rsvp.name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .slice(0, 2)
                        .toUpperCase()}
                    </div>
                    <span>{rsvp.name}</span>
                  </td>
                  <td className="py-3 px-4 font-mono text-zinc-400">
                    <span className="inline-flex items-center gap-1">
                      <Phone className="w-3 h-3 text-zinc-500" />
                      {rsvp.phone}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${
                        rsvp.role === 'Speaker'
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                          : rsvp.role === 'VIP'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : rsvp.role === 'Panelist'
                              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                              : 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                      }`}
                    >
                      {rsvp.role}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-zinc-300 font-medium">{rsvp.event}</td>
                  <td className="py-3 px-4 text-right font-mono text-zinc-500 text-[11px]">
                    {rsvp.createdAt}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredRsvps.length === 0 && (
          <div className="text-center py-12">
            <FileSpreadsheet className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
            <div className="text-xs text-zinc-400">No RSVPs match your search</div>
          </div>
        )}
      </div>
    </div>
  )
}
