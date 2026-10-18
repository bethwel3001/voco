import type { CSVParseResult } from '../types'

/**
 * Parses raw CSV text and validates required columns: Name, Phone, Role, Event
 */
export function parseRSVPCSV(csvText: string): CSVParseResult {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  if (lines.length === 0) {
    return {
      valid: false,
      records: [],
      errors: ['The CSV file is empty.'],
      headers: [],
    }
  }

  // Parse header line
  const headerLine = lines[0]
  const rawHeaders = splitCSVLine(headerLine).map((h) => h.trim().toLowerCase())

  // Look for required headers
  const nameIdx = rawHeaders.findIndex((h) => h === 'name' || h.includes('name'))
  const phoneIdx = rawHeaders.findIndex(
    (h) => h === 'phone' || h.includes('phone') || h.includes('mobile') || h.includes('tel'),
  )
  const roleIdx = rawHeaders.findIndex((h) => h === 'role' || h.includes('role') || h.includes('type'))
  const eventIdx = rawHeaders.findIndex((h) => h === 'event' || h.includes('event'))

  const missingColumns: string[] = []
  if (nameIdx === -1) missingColumns.push('Name')
  if (phoneIdx === -1) missingColumns.push('Phone')
  if (roleIdx === -1) missingColumns.push('Role')
  if (eventIdx === -1) missingColumns.push('Event')

  if (missingColumns.length > 0) {
    return {
      valid: false,
      records: [],
      errors: [
        `Missing required column(s): ${missingColumns.join(', ')}. Expected columns: Name, Phone, Role, Event.`,
      ],
      headers: rawHeaders,
    }
  }

  const records: CSVParseResult['records'] = []
  const errors: string[] = []

  for (let i = 1; i < lines.length; i++) {
    const rawLine = lines[i]
    if (!rawLine.trim()) continue

    const cols = splitCSVLine(rawLine)
    const name = cols[nameIdx]?.trim() || ''
    const phone = cols[phoneIdx]?.trim() || ''
    const role = cols[roleIdx]?.trim() || 'Attendee'
    const event = cols[eventIdx]?.trim() || ''

    if (!name || !phone || !event) {
      errors.push(`Row ${i + 1}: Missing name, phone, or event value. (Found: "${rawLine}")`)
      continue
    }

    records.push({
      name,
      phone,
      role: role.charAt(0).toUpperCase() + role.slice(1),
      event,
    })
  }

  return {
    valid: records.length > 0 && errors.length === 0,
    records,
    errors,
    headers: ['Name', 'Phone', 'Role', 'Event'],
  }
}

function splitCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++ // Skip escaped quote
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      result.push(cleanCSVCell(current))
      current = ''
    } else {
      current += char
    }
  }
  result.push(cleanCSVCell(current))
  return result
}

function cleanCSVCell(val: string): string {
  let trimmed = val.trim()
  if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) {
    trimmed = trimmed.substring(1, trimmed.length - 1).trim()
  }
  return trimmed
}

export const SAMPLE_CSV_CONTENT = `Name,Phone,Role,Event
Dr. Aris Vance,+1 (415) 890-1201,Speaker,AI Frontiers Summit 2026
Elena Rostova,+1 (650) 441-9923,VIP,AI Frontiers Summit 2026
Marcus Sterling,+1 (212) 555-0199,Attendee,NextGen Founders Mixer
Zara Chen,+1 (408) 782-3341,Panelist,Global Voice Tech Conference
Liam O'Connor,+1 (312) 674-8820,Attendee,NextGen Founders Mixer
Sophia Patel,+1 (510) 902-1144,Speaker,Global Voice Tech Conference
`
