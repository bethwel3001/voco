import dotenv from 'dotenv'
dotenv.config()

// Sentry must be initialized before other modules are loaded
import { initSentry, Sentry } from './sentry.js'
initSentry()

import express, { Request, Response } from 'express'
import cors from 'cors'
import { connectToDatabase, closeDatabase } from './db.js'
import { apiRouter } from './routes/rsvps.js'

const app = express()
const PORT = process.env.PORT || 3000

// Middleware
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
)

// Body parsers
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))
app.use(express.text({ type: ['text/csv', 'text/plain'], limit: '10mb' }))

// Health Check for Render
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'voco-api',
  })
})

// Root route
app.get('/', (_req: Request, res: Response) => {
  res.json({
    name: 'Voco API',
    description: 'AI Voice Reminder Campaigns & RSVP Management Backend',
    version: '1.0.0',
    endpoints: {
      health: 'GET /health',
      uploadRsvps: 'POST /api/upload-rsvps',
      events: 'GET /api/events',
      attendees: 'GET /api/attendees',
      generateScripts: 'POST /api/generate-scripts',
      generateVoice: 'POST /api/generate-voice',
      audioStream: 'GET /api/audio/:id',
    },
  })
})

// API Router
app.use('/api', apiRouter)

// Sentry Error Handler (attaches to express)
Sentry.setupExpressErrorHandler(app)

// Generic error fallback
app.use((err: any, _req: Request, res: Response, _next: express.NextFunction) => {
  console.error('[Server Error]:', err)
  res.status(500).json({
    success: false,
    error: err?.message || 'Internal server error',
  })
})

// Connect to MongoDB and start listening
async function startServer() {
  try {
    await connectToDatabase()

    const server = app.listen(PORT, () => {
      console.log(`🚀 [Voco API] Server running on http://localhost:${PORT}`)
      console.log(`📊 [Voco API] Health check at http://localhost:${PORT}/health`)
      console.log(`📤 [Voco API] Upload endpoint: POST http://localhost:${PORT}/api/upload-rsvps`)
    })

    // Graceful shutdown for Render
    const shutdown = async (signal: string) => {
      console.log(`\n[Voco API] Received ${signal}. Shutting down gracefully...`)
      server.close(async () => {
        await closeDatabase()
        process.exit(0)
      })
    }

    process.on('SIGTERM', () => shutdown('SIGTERM'))
    process.on('SIGINT', () => shutdown('SIGINT'))
  } catch (error) {
    console.error('[Voco API] Fatal startup error:', error)
    process.exit(1)
  }
}

startServer()
