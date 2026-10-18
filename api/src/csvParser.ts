export interface ParsedRSVP {
  name: string
  phone: string
  role: string
  event: string
}

export interface CSVParseResult {
  valid: boolean
  records: ParsedRSVP[]
  errors: string[]
  headers: string[]
}

/**
 * Lean CSV parser that splits lines and handles quotes without heavy dependencies.
 */
export function parseCSV(rawText: string): CSVParseResult {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  if (lines.length === 0) {
    return {
      valid: false,
      records: [],
      errors: ['Uploaded CSV is empty.'],
      headers: [],
    }
  }

  // Parse header
  const headerLine = lines[0]
  const rawHeaders = splitCSVLine(headerLine).map((h) => h.toLowerCase().trim())

  const nameIdx = rawHeaders.findIndex((h) => h === 'name' || h.includes('name'))
  const phoneIdx = rawHeaders.findIndex(
    (h) => h === 'phone' || h.includes('phone') || h.includes('mobile') || h.includes('tel')
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
        `Missing required columns: ${missingColumns.join(', ')}. Expected headers: Name, Phone, Role, Event.`,
      ],
      headers: rawHeaders,
    }
  }

  const records: ParsedRSVP[] = []
  const errors: string[] = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim()) continue

    const cols = splitCSVLine(line)
    const name = cols[nameIdx]?.trim() || ''
    const phone = cols[phoneIdx]?.trim() || ''
    const role = cols[roleIdx]?.trim() || 'Attendee'
    const event = cols[eventIdx]?.trim() || ''

    if (!name || !phone || !event) {
      errors.push(`Row ${i + 1}: Missing name, phone, or event value. (Raw: "${line}")`)
      continue
    }

    records.push({
      name,
      phone,
      role: role.charAt(0).toUpperCase() + role.slice(1).toLowerCase(),
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
