import { Router, Request, Response } from 'express'
import multer from 'multer'
import { ObjectId } from 'mongodb'
import { parseCSV } from '../csvParser.js'
import { getAttendeesCollection, getEventsCollection, AttendeeDocument } from '../db.js'
import { traceSpan } from '../sentry.js'
import { generateVoiceScript } from '../services/scriptGenerator.js'
import { synthesizeVoice } from '../services/voiceSynthesizer.js'

export const apiRouter = Router()

// Configure multer memory storage for CSV file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB limit
  },
})

/**
 * POST /api/upload-rsvps
 * Parses uploaded CSV file or body text and saves attendees + events to MongoDB.
 * Wrapped in Sentry transaction trace for latency and performance profiling.
 */
apiRouter.post(
  '/upload-rsvps',
  upload.single('file'),
  async (req: Request, res: Response): Promise<void> => {
    await traceSpan(
      'POST /api/upload-rsvps',
      'http.server',
      async () => {
        try {
          let csvContent = ''

          if (req.file) {
            csvContent = req.file.buffer.toString('utf-8')
          } else if (req.body?.csvText) {
            csvContent = req.body.csvText
          } else if (typeof req.body === 'string' && req.body.trim().length > 0) {
            csvContent = req.body
          } else {
            res.status(400).json({
              success: false,
              error: 'No CSV content provided. Upload a file using "file" field or send JSON with "csvText".',
            })
            return
          }

          // 1. Trace CSV Parsing
          const parseResult = await traceSpan('csv.parse_and_validate', 'task', async () => {
            return parseCSV(csvContent)
          })

          if (!parseResult.valid || parseResult.records.length === 0) {
            res.status(400).json({
              success: false,
              errors: parseResult.errors,
              message: 'CSV validation failed. Required columns: Name, Phone, Role, Event',
            })
            return
          }

          const attendeesCollection = getAttendeesCollection()
          const eventsCollection = getEventsCollection()

          // 2. Trace MongoDB Events Upsert
          const eventNames = Array.from(new Set(parseResult.records.map((r) => r.event)))
          await traceSpan('mongodb.events.upsert', 'db', async () => {
            for (const eventTitle of eventNames) {
              const countForThisEvent = parseResult.records.filter(
                (r) => r.event.toLowerCase() === eventTitle.toLowerCase()
              ).length

              await eventsCollection.updateOne(
                { title: eventTitle },
                {
                  $setOnInsert: {
                    title: eventTitle,
                    category: 'Conference',
                    campaignStatus: 'Active',
                    createdAt: new Date(),
                  },
                  $inc: { totalRsvps: countForThisEvent },
                  $set: { updatedAt: new Date() },
                },
                { upsert: true }
              )
            }
          })

          // 3. Trace Voice Prompt Generation (AI latency simulation / preparation)
          const attendeeDocs: AttendeeDocument[] = await traceSpan(
            'ai.voice_prompt_synthesis_prep',
            'ai.prep',
            async () => {
              return parseResult.records.map((rec) => {
                let script = `Hello ${rec.name}, this is Voco reminding you of your upcoming event: ${rec.event}.`
                if (rec.role.toLowerCase() === 'speaker') {
                  script = `Hello ${rec.name}, this is Voco confirming your speaker keynote for ${rec.event}. Check-in is 30 mins prior.`
                } else if (rec.role.toLowerCase() === 'vip') {
                  script = `Welcome ${rec.name}, your VIP reservation for ${rec.event} is confirmed.`
                }

                return {
                  name: rec.name,
                  phone: rec.phone,
                  role: rec.role,
                  event: rec.event,
                  voiceReminderStatus: 'Pending',
                  voiceScriptSnippet: script,
                  importedAt: new Date(),
                  updatedAt: new Date(),
                }
              })
            }
          )

          // 4. Trace MongoDB Attendees Insertion
          const insertResult = await traceSpan('mongodb.attendees.insertMany', 'db', async () => {
            return await attendeesCollection.insertMany(attendeeDocs)
          })

          res.status(201).json({
            success: true,
            message: `Successfully imported and queued ${attendeeDocs.length} attendee(s) across ${eventNames.length} event(s).`,
            importedCount: attendeeDocs.length,
            events: eventNames,
            insertedCount: insertResult.insertedCount || attendeeDocs.length,
            attendees: attendeeDocs.slice(0, 50), // Return sample in response
          })
        } catch (error) {
          console.error('[API] Error in /api/upload-rsvps:', error)
          res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error while processing CSV.',
          })
        }
      },
      {
        'http.route': '/api/upload-rsvps',
        'http.method': 'POST',
      }
    )
  }
)

/**
 * GET /api/events
 * Returns list of events from MongoDB events collection.
 */
apiRouter.get('/events', async (_req: Request, res: Response): Promise<void> => {
  await traceSpan(
    'GET /api/events',
    'http.server',
    async () => {
      try {
        const eventsCol = getEventsCollection()
        const events = await traceSpan('mongodb.events.find', 'db', async () => {
          return await eventsCol.find({}).toArray()
        })

        res.json({
          success: true,
          count: events.length,
          events,
        })
      } catch (error) {
        console.error('[API] Error in /api/events:', error)
        res.status(500).json({ success: false, error: 'Failed to retrieve events.' })
      }
    },
    { 'http.route': '/api/events' }
  )
})

/**
 * GET /api/attendees
 * Returns list of attendees from MongoDB attendees collection, with optional ?event= filter.
 */
apiRouter.get('/attendees', async (req: Request, res: Response): Promise<void> => {
  await traceSpan(
    'GET /api/attendees',
    'http.server',
    async () => {
      try {
        const eventFilter = req.query.event as string | undefined
        const attendeesCol = getAttendeesCollection()
        const query = eventFilter ? { event: eventFilter } : {}

        const attendees = await traceSpan('mongodb.attendees.find', 'db', async () => {
          return await attendeesCol.find(query).toArray()
        })

        res.json({
          success: true,
          count: attendees.length,
          attendees,
        })
      } catch (error) {
        console.error('[API] Error in /api/attendees:', error)
        res.status(500).json({ success: false, error: 'Failed to retrieve attendees.' })
      }
    },
    { 'http.route': '/api/attendees' }
  )
})

/**
 * POST /api/generate-voice
 * Demonstrates an external AI voice synthesis latency trace via Sentry profiling.
 */
apiRouter.post('/generate-voice', async (req: Request, res: Response): Promise<void> => {
  await traceSpan(
    'POST /api/generate-voice',
    'http.server',
    async () => {
      try {
        const { attendeeId, script, voiceId } = req.body

        if (!script) {
          res.status(400).json({ success: false, error: 'Text script is required.' })
          return
        }

        const voiceResult = await synthesizeVoice(script, {
          voiceId,
          attendeeId: attendeeId || 'unknown',
        })

        const audioUrl = attendeeId ? `/api/audio/${encodeURIComponent(attendeeId)}` : undefined

        // Trace updating the attendee status to 'Generated' in MongoDB
        if (attendeeId) {
          const attendeesCol = getAttendeesCollection()
          await traceSpan('mongodb.attendees.updateStatus', 'db', async () => {
            const filter: any =
              ObjectId.isValid(attendeeId) && String(new ObjectId(attendeeId)) === attendeeId
                ? { $or: [{ phone: attendeeId }, { _id: new ObjectId(attendeeId) }] }
                : { phone: attendeeId }

            await attendeesCol.updateOne(
              filter,
              {
                $set: {
                  voiceReminderStatus: 'Generated',
                  audioBase64: voiceResult.base64Audio,
                  audioUrl,
                  audioMimeType: voiceResult.audioMimeType,
                  audioDurationSec: voiceResult.durationSec,
                  voiceId: voiceResult.voiceId,
                  updatedAt: new Date(),
                },
              }
            )
          })
        }

        res.json({
          success: true,
          message: 'Voice reminder audio synthesized successfully via ElevenLabs.',
          voiceResult: {
            audioUrl: audioUrl || `data:audio/mpeg;base64,${voiceResult.base64Audio}`,
            durationSec: voiceResult.durationSec,
            voiceId: voiceResult.voiceId,
            source: voiceResult.source,
            latencyMs: voiceResult.latencyMs,
          },
        })
      } catch (error) {
        console.error('[API] Error in /api/generate-voice:', error)
        res.status(500).json({ success: false, error: 'Failed to synthesize voice reminder.' })
      }
    },
    { 'http.route': '/api/generate-voice' }
  )
})

/**
 * POST /api/generate-scripts
 * Chained AI Pipeline:
 * 1. Open-weight model (Llama-3 / Mistral) generates strictly 2-sentence warm personalized scripts.
 * 2. ElevenLabs Text-to-Speech synthesizes the script into audio using a professional, energetic voice.
 * 3. Saves the script, audio buffer (base64), audio URL, and duration back to MongoDB attendees collection.
 * Traced comprehensively across every pipeline step with Sentry spans and error profiling.
 */
apiRouter.post('/generate-scripts', async (req: Request, res: Response): Promise<void> => {
  await traceSpan(
    'POST /api/generate-scripts',
    'http.server',
    async () => {
      try {
        const { event, limit = 50, attendeeId, voiceId } = req.body || {}
        const attendeesCol = getAttendeesCollection()

        // 1. Query pending attendees from MongoDB
        const query: any = { voiceReminderStatus: 'Pending' }
        if (event) query.event = event
        if (attendeeId) {
          if (ObjectId.isValid(attendeeId) && String(new ObjectId(attendeeId)) === attendeeId) {
            query.$or = [{ phone: attendeeId }, { _id: new ObjectId(attendeeId) }]
          } else {
            query.phone = attendeeId
          }
        }

        const pendingAttendees = await traceSpan('mongodb.attendees.findPending', 'db', async () => {
          return await attendeesCol.find(query).toArray()
        })

        const toProcess = pendingAttendees.slice(0, Number(limit))

        if (toProcess.length === 0) {
          res.json({
            success: true,
            message: 'No pending attendees found to generate voice reminders for.',
            generatedCount: 0,
            attendees: [],
          })
          return
        }

        const generatedList: any[] = []

        // 2. Iterate through pending attendees and run the chained AI pipeline
        for (const attendee of toProcess) {
          const attendeeSlug = attendee.name.replace(/\s+/g, '_')

          await traceSpan(
            `pipeline.attendee.${attendeeSlug}`,
            'pipeline.chain',
            async () => {
              // Pipeline Step 1: Open-weight model text script generation
              const scriptResult = await traceSpan(
                'ai.text_script_generation',
                'ai.inference',
                async () => {
                  return await generateVoiceScript({
                    name: attendee.name,
                    role: attendee.role,
                    event: attendee.event,
                    phone: attendee.phone,
                  })
                },
                {
                  'attendee.name': attendee.name,
                  'attendee.role': attendee.role,
                  'attendee.event': attendee.event,
                }
              )

              // Pipeline Step 2: ElevenLabs Text-to-Speech audio synthesis
              const voiceResult = await traceSpan(
                'ai.elevenlabs_voice_synthesis',
                'ai.tts',
                async () => {
                  return await synthesizeVoice(scriptResult.script, {
                    voiceId,
                    attendeeId: String(attendee._id || attendee.phone),
                    attendeeName: attendee.name,
                  })
                },
                {
                  'attendee.name': attendee.name,
                  'script.char_length': scriptResult.script.length,
                }
              )

              // Lightweight direct streaming endpoint URL
              const audioStreamUrl = `/api/audio/${encodeURIComponent(attendee.phone)}`

              // Pipeline Step 3: Persist text script, audio data, and status to MongoDB document
              await traceSpan(
                'mongodb.attendees.saveVoiceAndScript',
                'db',
                async () => {
                  await attendeesCol.updateOne(
                    { phone: attendee.phone, event: attendee.event },
                    {
                      $set: {
                        voiceScriptSnippet: scriptResult.script,
                        voiceReminderStatus: 'Generated',
                        audioBase64: voiceResult.base64Audio,
                        audioUrl: audioStreamUrl,
                        audioMimeType: voiceResult.audioMimeType,
                        audioDurationSec: voiceResult.durationSec,
                        voiceId: voiceResult.voiceId,
                        aiModelUsed: scriptResult.modelUsed,
                        generatedAt: new Date(),
                        updatedAt: new Date(),
                      },
                    }
                  )
                },
                {
                  'attendee.phone': attendee.phone,
                  'audio.bytes': voiceResult.buffer.length,
                }
              )

              generatedList.push({
                id: attendee._id,
                name: attendee.name,
                phone: attendee.phone,
                role: attendee.role,
                event: attendee.event,
                script: scriptResult.script,
                status: 'Generated',
                audioUrl: audioStreamUrl,
                audioDurationSec: voiceResult.durationSec,
                voiceId: voiceResult.voiceId,
                voiceSource: voiceResult.source,
                aiModelUsed: scriptResult.modelUsed,
                scriptLatencyMs: scriptResult.latencyMs,
                voiceLatencyMs: voiceResult.latencyMs,
                totalLatencyMs: scriptResult.latencyMs + voiceResult.latencyMs,
              })
            }
          )
        }

        res.json({
          success: true,
          message: `Successfully synthesized personalized voice reminders for ${generatedList.length} attendee(s).`,
          generatedCount: generatedList.length,
          attendees: generatedList,
        })
      } catch (error) {
        console.error('[API] Error in /api/generate-scripts pipeline:', error)
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Internal error during voice script generation pipeline.',
        })
      }
    },
    {
      'http.route': '/api/generate-scripts',
      'http.method': 'POST',
    }
  )
})

/**
 * GET /api/audio/:id
 * Streams the synthesized MP3 audio for an attendee directly from MongoDB storage.
 */
apiRouter.get('/audio/:id', async (req: Request, res: Response): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
  const id = decodeURIComponent(rawId || '')

  await traceSpan(
    'GET /api/audio/:id',
    'http.server',
    async () => {
      try {
        const attendeesCol = getAttendeesCollection()

        const attendee = await traceSpan('mongodb.attendees.findAudio', 'db', async () => {
          const filter: any =
            ObjectId.isValid(id) && String(new ObjectId(id)) === id
              ? { $or: [{ phone: id }, { _id: new ObjectId(id) }] }
              : { phone: id }

          return await attendeesCol.findOne(filter)
        })

        if (!attendee || !attendee.audioBase64) {
          res.status(404).json({
            success: false,
            error: 'Synthesized voice audio not found for attendee.',
          })
          return
        }

        const audioBuffer = Buffer.from(attendee.audioBase64, 'base64')

        res.set({
          'Content-Type': attendee.audioMimeType || 'audio/mpeg',
          'Content-Length': audioBuffer.length.toString(),
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'public, max-age=86400',
        })

        res.send(audioBuffer)
      } catch (error) {
        console.error('[API] Error in /api/audio/:id:', error)
        res.status(500).json({ success: false, error: 'Failed to stream audio.' })
      }
    },
    {
      'http.route': '/api/audio/:id',
      'attendee.id': id,
    }
  )
})


