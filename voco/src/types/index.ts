export type CampaignStatus = 'Pending' | 'Generated' | 'Sent'

export interface RSVPRecord {
  id: string
  name: string
  phone: string
  role: string
  event: string
  createdAt: string
}

export interface EventItem {
  id: string
  title: string
  date: string
  time: string
  location: string
  totalRsvps: number
  campaignStatus: 'Active' | 'Scheduled' | 'Completed' | 'Draft'
  category: 'Conference' | 'VIP Dinner' | 'Hackathon' | 'Workshop' | 'Meetup'
  daysUntil: number
}

export interface VoiceCampaign {
  id: string
  recipientName: string
  phone: string
  role: string
  event: string
  status: CampaignStatus
  scriptSnippet: string
  durationSec?: number
  audioUrl?: string
  voiceId?: string
  voiceSource?: string
  aiModelUsed?: string
  generatedAt?: string
  updatedAt: string
  callOutcome?: 'Delivered' | 'Voicemail' | 'Queued' | 'Failed'
}

export interface CSVParseResult {
  valid: boolean
  records: Omit<RSVPRecord, 'id' | 'createdAt'>[]
  errors: string[]
  headers: string[]
}
