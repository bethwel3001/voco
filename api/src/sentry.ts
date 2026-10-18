import * as Sentry from '@sentry/node'
import { nodeProfilingIntegration } from '@sentry/profiling-node'

let isSentryInitialized = false

/**
 * Initialize Sentry error reporting, performance transaction tracing, and CPU profiling.
 * Must be executed before any other application code or route handlers.
 */
export function initSentry(): void {
  if (isSentryInitialized) return

  const dsn = process.env.SENTRY_DSN?.trim()
  const environment = process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development'
  const tracesSampleRate = parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '1.0')
  const profilesSampleRate = parseFloat(process.env.SENTRY_PROFILES_SAMPLE_RATE || '1.0')

  Sentry.init({
    dsn: dsn || undefined,
    environment,
    integrations: [
      nodeProfilingIntegration(),
    ],
    // Tracing
    tracesSampleRate: isNaN(tracesSampleRate) ? 1.0 : tracesSampleRate,
    // Profiling
    profileSessionSampleRate: isNaN(profilesSampleRate) ? 1.0 : profilesSampleRate,
  })

  isSentryInitialized = true
  if (dsn) {
    console.log(`[Sentry] Initialized with tracing (rate=${tracesSampleRate}) and profiling (rate=${profilesSampleRate})`)
  } else {
    console.log('[Sentry] Initialized in local mode (no SENTRY_DSN provided; spans will run in no-op tracing mode)')
  }
}

/**
 * Executes an async operation wrapped in a Sentry trace span to monitor latency.
 */
export async function traceSpan<T>(
  name: string,
  op: string,
  fn: () => Promise<T>,
  attributes?: Record<string, string | number | boolean>
): Promise<T> {
  return await Sentry.startSpan(
    {
      name,
      op,
      attributes,
    },
    async (span) => {
      try {
        const result = await fn()
        span?.setStatus({ code: 1 }) // ok
        return result
      } catch (error) {
        span?.setStatus({ code: 2, message: error instanceof Error ? error.message : String(error) }) // error
        Sentry.captureException(error)
        throw error
      }
    }
  )
}

/**
 * Specialized helper to trace external AI API call latency (e.g. ElevenLabs, OpenAI, Gemini Voice)
 */
export async function traceExternalAISpan<T>(
  apiName: string,
  fn: () => Promise<T>,
  metadata?: Record<string, string | number | boolean>
): Promise<T> {
  return await traceSpan(
    `ai.external.${apiName}`,
    'http.client',
    fn,
    {
      'ai.provider': apiName,
      ...metadata,
    }
  )
}

export { Sentry }
