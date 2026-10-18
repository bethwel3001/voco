import type { VoiceCampaign } from '../types'

export const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  (typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:3000'
    : '')

export interface BackendAttendee {
  _id?: string
  name: string
  phone: string
  role: string
  event: string
  voiceReminderStatus: 'Pending' | 'Generated' | 'Sent'
  voiceScriptSnippet?: string
  audioBase64?: string
  audioUrl?: string
  audioDurationSec?: number
  voiceId?: string
  aiModelUsed?: string
  generatedAt?: string
  importedAt?: string
  updatedAt?: string
}

export interface BackendEvent {
  _id?: string
  title: string
  date?: string
  time?: string
  location?: string
  category?: string
  totalRsvps: number
  campaignStatus?: 'Active' | 'Scheduled' | 'Completed' | 'Draft'
  createdAt?: string
  updatedAt?: string
}

/**
 * Fetch live attendees from MongoDB Atlas via the backend API.
 */
export async function fetchLiveAttendees(event?: string): Promise<BackendAttendee[]> {
  try {
    const url = event
      ? `${API_BASE_URL}/api/attendees?event=${encodeURIComponent(event)}`
      : `${API_BASE_URL}/api/attendees`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP error ${res.status}`)
    const data = await res.json()
    return data.attendees || []
  } catch (err) {
    console.warn('[Voco API] Could not fetch live attendees from backend, using local store:', err)
    return []
  }
}

/**
 * Fetch live upcoming events from MongoDB Atlas.
 */
export async function fetchLiveEvents(): Promise<BackendEvent[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/events`)
    if (!res.ok) throw new Error(`HTTP error ${res.status}`)
    const data = await res.json()
    return data.events || []
  } catch (err) {
    console.warn('[Voco API] Could not fetch live events from backend:', err)
    return []
  }
}

/**
 * Upload CSV text to backend for MongoDB Atlas persistence.
 */
export async function uploadRSVPCSV(csvText: string): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/api/upload-rsvps`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ csvText }),
  })
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}))
    throw new Error(errData.message || errData.error || `Upload failed with status ${res.status}`)
  }
  return await res.json()
}

/**
 * Trigger the chained open-weight AI (Llama-3/Mistral) + ElevenLabs TTS voice pipeline.
 */
export async function triggerVoicePipeline(options?: {
  event?: string
  limit?: number
  attendeeId?: string
}): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/api/generate-scripts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options || {}),
  })
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}))
    throw new Error(errData.message || errData.error || `Generation failed with status ${res.status}`)
  }
  return await res.json()
}

/**
 * Returns the absolute streaming URL for an attendee's synthesized audio.
 */
export function getAudioStreamUrl(phone: string): string {
  return `${API_BASE_URL}/api/audio/${encodeURIComponent(phone)}`
}

/**
 * Maps a backend attendee document to a frontend VoiceCampaign model.
 */
export function mapAttendeeToCampaign(attendee: BackendAttendee): VoiceCampaign {
  const audioUrl = attendee.audioBase64
    ? `data:audio/mpeg;base64,${attendee.audioBase64}`
    : attendee.audioUrl || getAudioStreamUrl(attendee.phone)

  return {
    id: attendee._id || `cmp-${attendee.phone}-${attendee.event}`,
    recipientName: attendee.name,
    phone: attendee.phone,
    role: attendee.role,
    event: attendee.event,
    status: attendee.voiceReminderStatus,
    scriptSnippet: attendee.voiceScriptSnippet || 'Awaiting script generation...',
    durationSec: attendee.audioDurationSec || 20,
    audioUrl,
    voiceId: attendee.voiceId,
    aiModelUsed: attendee.aiModelUsed,
    generatedAt: attendee.generatedAt,
    updatedAt: attendee.updatedAt || 'Just now',
    callOutcome: attendee.voiceReminderStatus === 'Sent' ? 'Delivered' : undefined,
  }
}

/**
 * Checks backend health status.
 */
export async function checkBackendHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/health`, { signal: AbortSignal.timeout(3000) })
    return res.ok
  } catch {
    return false
  }
}
