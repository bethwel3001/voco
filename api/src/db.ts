import { MongoClient, Db, Collection, ObjectId } from 'mongodb'
import { traceSpan } from './sentry.js'

export interface EventDocument {
  _id?: ObjectId
  title: string
  date?: string
  time?: string
  location?: string
  category?: string
  totalRsvps: number
  campaignStatus?: 'Active' | 'Scheduled' | 'Completed' | 'Draft'
  createdAt: Date
  updatedAt: Date
}

export interface AttendeeDocument {
  _id?: ObjectId
  name: string
  phone: string
  role: string
  event: string
  eventId?: ObjectId
  voiceReminderStatus: 'Pending' | 'Generated' | 'Sent'
  voiceScriptSnippet?: string
  audioBase64?: string
  audioUrl?: string
  audioMimeType?: string
  audioDurationSec?: number
  voiceId?: string
  aiModelUsed?: string
  generatedAt?: Date
  importedAt: Date
  updatedAt: Date
}

let client: MongoClient | null = null
let db: Db | null = null

// Fallback in-memory storage for offline development when MongoDB Atlas is not yet configured
class InMemoryCollection<T extends { _id?: any }> {
  private items: T[] = []
  name: string

  constructor(name: string) {
    this.name = name
  }

  async insertOne(doc: T) {
    const item = { ...doc, _id: new ObjectId() }
    this.items.push(item)
    return { acknowledged: true, insertedId: item._id }
  }

  async insertMany(docs: T[]) {
    const insertedIds: Record<number, ObjectId> = {}
    docs.forEach((d, idx) => {
      const item = { ...d, _id: new ObjectId() }
      this.items.push(item)
      insertedIds[idx] = item._id
    })
    return { acknowledged: true, insertedCount: docs.length, insertedIds }
  }

  find(filter: any = {}) {
    let result = [...this.items]
    if (filter) {
      if (filter.event) {
        result = result.filter((item: any) => item.event?.toLowerCase() === filter.event.toLowerCase())
      }
      if (filter.voiceReminderStatus) {
        result = result.filter((item: any) => item.voiceReminderStatus === filter.voiceReminderStatus)
      }
      if (filter.phone) {
        result = result.filter((item: any) => item.phone === filter.phone)
      }
      if (filter._id) {
        result = result.filter((item: any) => String(item._id) === String(filter._id))
      }
      if (filter.$or && Array.isArray(filter.$or)) {
        result = result.filter((item: any) =>
          filter.$or.some((sub: any) => {
            if (sub.phone && item.phone === sub.phone) return true
            if (sub._id && String(item._id) === String(sub._id)) return true
            return false
          })
        )
      }
    }
    return {
      toArray: async () => result,
      sort: () => ({ toArray: async () => result }),
      limit: () => ({ toArray: async () => result }),
    }
  }

  async findOne(filter: any) {
    if (filter.title) {
      return this.items.find((item: any) => item.title?.toLowerCase() === filter.title.toLowerCase()) || null
    }
    if (filter.phone && filter.event) {
      return (
        this.items.find(
          (item: any) =>
            item.phone === filter.phone && item.event?.toLowerCase() === filter.event.toLowerCase()
        ) || null
      )
    }
    if (filter.$or && Array.isArray(filter.$or)) {
      return (
        this.items.find((item: any) =>
          filter.$or.some((sub: any) => {
            if (sub.phone && item.phone === sub.phone) return true
            if (sub._id && String(item._id) === String(sub._id)) return true
            return false
          })
        ) || null
      )
    }
    if (filter.phone) {
      return this.items.find((item: any) => item.phone === filter.phone) || null
    }
    if (filter._id) {
      return this.items.find((item: any) => String(item._id) === String(filter._id)) || null
    }
    return this.items[0] || null
  }

  async updateOne(filter: any, update: any, options?: { upsert?: boolean }) {
    let existingIndex = -1
    if (filter.title) {
      existingIndex = this.items.findIndex(
        (item: any) => item.title?.toLowerCase() === filter.title.toLowerCase()
      )
    } else if (filter.phone && filter.event) {
      existingIndex = this.items.findIndex(
        (item: any) =>
          item.phone === filter.phone && item.event?.toLowerCase() === filter.event.toLowerCase()
      )
    } else if (filter.$or && Array.isArray(filter.$or)) {
      existingIndex = this.items.findIndex((item: any) =>
        filter.$or.some((sub: any) => {
          if (sub.phone && item.phone === sub.phone) return true
          if (sub._id && String(item._id) === String(sub._id)) return true
          return false
        })
      )
    } else if (filter.phone) {
      existingIndex = this.items.findIndex((item: any) => item.phone === filter.phone)
    } else if (filter._id) {
      existingIndex = this.items.findIndex(
        (item: any) => String(item._id) === String(filter._id)
      )
    }

    if (existingIndex !== -1) {
      const current = this.items[existingIndex]
      if (update.$inc?.totalRsvps) {
        ;(current as any).totalRsvps = ((current as any).totalRsvps || 0) + update.$inc.totalRsvps
      }
      if (update.$set) {
        Object.assign(current, update.$set)
      }
      ;(current as any).updatedAt = new Date()
      return { matchedCount: 1, modifiedCount: 1, upsertedId: null }
    } else if (options?.upsert) {
      const newItem: any = {
        _id: new ObjectId(),
        ...filter,
        ...(update.$setOnInsert || {}),
        ...(update.$set || {}),
        totalRsvps: update.$inc?.totalRsvps || 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      this.items.push(newItem)
      return { matchedCount: 0, modifiedCount: 0, upsertedId: newItem._id }
    }
    return { matchedCount: 0, modifiedCount: 0, upsertedId: null }
  }

  async createIndex() {
    return 'in_memory_index'
  }
}

const memoryEvents = new InMemoryCollection<EventDocument>('events')
const memoryAttendees = new InMemoryCollection<AttendeeDocument>('attendees')
let isUsingMemoryFallback = false

/**
 * Connect to MongoDB Atlas using the official native driver.
 */
export async function connectToDatabase(): Promise<{ db: Db | null; isMemory: boolean }> {
  if (db && client) {
    return { db, isMemory: isUsingMemoryFallback }
  }

  const uri = process.env.MONGODB_URI
  const dbName = process.env.MONGODB_DB_NAME || 'voco'

  if (!uri) {
    console.warn('[MongoDB] No MONGODB_URI provided in environment. Using in-memory fallback for local dev.')
    isUsingMemoryFallback = true
    return { db: null, isMemory: true }
  }

  return await traceSpan('mongodb.connect', 'db', async () => {
    try {
      console.log(`[MongoDB] Connecting to MongoDB Atlas (${uri.replace(/:([^:@]+)@/, ':****@')})...`)
      client = new MongoClient(uri, {
        connectTimeoutMS: 5000,
        serverSelectionTimeoutMS: 5000,
        maxPoolSize: 20,
        minPoolSize: 2,
      })

      await client.connect()
      db = client.db(dbName)
      isUsingMemoryFallback = false
      console.log(`[MongoDB] Connected successfully to database: "${dbName}"`)

      // Ensure indexes on events and attendees
      await initDatabaseIndexes()

      return { db, isMemory: false }
    } catch (err) {
      console.warn(`[MongoDB] Could not establish connection to MongoDB: ${(err as Error).message}`)
      console.warn('[MongoDB] Activating in-memory fallback adapter so API endpoints remain responsive.')
      isUsingMemoryFallback = true
      return { db: null, isMemory: true }
    }
  })
}

/**
 * Initialize indexes on collections: events and attendees
 */
export async function initDatabaseIndexes(): Promise<void> {
  const eventsCol = getEventsCollection()
  const attendeesCol = getAttendeesCollection()

  try {
    await eventsCol.createIndex({ title: 1 }, { unique: false })
    await attendeesCol.createIndex({ event: 1, phone: 1 })
    await attendeesCol.createIndex({ voiceReminderStatus: 1 })
  } catch (err) {
    console.warn('[MongoDB] Index creation notice:', (err as Error).message)
  }
}

/**
 * Access the `events` collection
 */
export function getEventsCollection(): Collection<EventDocument> | InMemoryCollection<EventDocument> {
  if (isUsingMemoryFallback || !db) {
    return memoryEvents as any
  }
  return db.collection<EventDocument>('events')
}

/**
 * Access the `attendees` collection
 */
export function getAttendeesCollection(): Collection<AttendeeDocument> | InMemoryCollection<AttendeeDocument> {
  if (isUsingMemoryFallback || !db) {
    return memoryAttendees as any
  }
  return db.collection<AttendeeDocument>('attendees')
}

/**
 * Close MongoDB connection cleanly (useful for Render graceful shutdown)
 */
export async function closeDatabase(): Promise<void> {
  if (client) {
    await client.close()
    client = null
    db = null
    console.log('[MongoDB] Connection closed cleanly.')
  }
}
