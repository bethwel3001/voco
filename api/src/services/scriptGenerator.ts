import { Sentry, traceExternalAISpan } from '../sentry.js'

export interface AttendeeInput {
  name: string
  role: string
  event: string
  phone?: string
}

export interface ScriptGenerationResult {
  script: string
  modelUsed: string
  latencyMs: number
  source: 'open-weight-remote' | 'local-simulation'
}

/**
 * Generates a strictly 2-sentence, warm, personalized reminder script using an
 * open-weight model (e.g. Llama-3 or Mistral) with Sentry latency tracing and timeout handling.
 */
export async function generateVoiceScript(
  attendee: AttendeeInput,
  options?: { timeoutMs?: number; throwOnTimeout?: boolean }
): Promise<ScriptGenerationResult> {
  const model = process.env.OPENWEIGHT_AI_MODEL || 'meta-llama/Meta-Llama-3-8B-Instruct'
  const endpoint = process.env.OPENWEIGHT_AI_API_URL?.trim()
  const apiKey = process.env.OPENWEIGHT_AI_API_KEY || ''
  const timeoutMs = options?.timeoutMs || parseInt(process.env.OPENWEIGHT_AI_TIMEOUT_MS || '6000', 10)
  const startTime = Date.now()

  return await traceExternalAISpan(
    'openweight_inference',
    async () => {
      // If a remote open-weight inference endpoint (e.g. hosted on Render, vLLM, or Ollama) is configured:
      if (endpoint) {
        try {
          const controller = new AbortController()
          const timer = setTimeout(() => controller.abort(), timeoutMs)

          const systemPrompt = `You are Voco, an intelligent voice reminder agent for event attendees.
Generate a strictly TWO-SENTENCE, warm, conversational reminder script suitable for a spoken voice call.
Rules:
1. Output EXACTLY TWO sentences. No more, no less.
2. Personalize deeply based on the attendee's name, role, and event.
3. Tone: warm, engaging, and professional.
4. Output raw spoken text only. Do not output markdown, quotes, emojis, or bullet points.`

          const userPrompt = `Attendee: ${attendee.name}
Role: ${attendee.role}
Event: ${attendee.event}

Generate the 2-sentence voice reminder script now.`

          const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
            },
            body: JSON.stringify({
              model,
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
              ],
              temperature: 0.7,
              max_tokens: 120,
            }),
            signal: controller.signal,
          })

          clearTimeout(timer)

          if (!response.ok) {
            throw new Error(`Inference endpoint returned HTTP ${response.status}: ${await response.text()}`)
          }

          const data = (await response.json()) as any
          const rawContent = data.choices?.[0]?.message?.content || data.generated_text || ''

          const finalizedScript = enforceTwoSentences(rawContent, attendee)
          const latencyMs = Date.now() - startTime

          return {
            script: finalizedScript,
            modelUsed: model,
            latencyMs,
            source: 'open-weight-remote',
          }
        } catch (error: any) {
          const latencyMs = Date.now() - startTime
          const isTimeout =
            error.name === 'AbortError' ||
            error.name === 'TimeoutError' ||
            error.message?.includes('timeout') ||
            latencyMs >= timeoutMs

          // Sentry logging for inference errors & timeouts
          Sentry.withScope((scope) => {
            scope.setTag('ai.model', model)
            scope.setTag('ai.inference_timeout', isTimeout ? 'true' : 'false')
            scope.setContext('attendee', {
              name: attendee.name,
              role: attendee.role,
              event: attendee.event,
            })
            scope.setExtra('endpoint', endpoint)
            scope.setExtra('latencyMs', latencyMs)
            scope.setExtra('timeoutMs', timeoutMs)

            if (isTimeout) {
              console.warn(`[Sentry Alert] Open-weight inference timed out after ${latencyMs}ms for ${attendee.name}`)
              Sentry.captureMessage(
                `Open-weight AI inference timeout (${model}) after ${latencyMs}ms`,
                'warning'
              )
            } else {
              console.error(`[Sentry Alert] Open-weight inference error for ${attendee.name}:`, error.message)
              Sentry.captureException(error)
            }
          })

          if (options?.throwOnTimeout && isTimeout) {
            throw new Error(`AI inference timed out after ${timeoutMs}ms`)
          }

          // Fallback to local high-fidelity generator when remote server is unreachable/times out
          console.log(`[ScriptGenerator] Falling back to local synthesis engine for ${attendee.name}`)
          return {
            script: generateLocalTwoSentenceScript(attendee),
            modelUsed: `${model} (fallback-simulated)`,
            latencyMs,
            source: 'local-simulation',
          }
        }
      }

      // Local open-weight simulation mode (for local development before Render model instance is deployed)
      // Simulates typical inference latency (120-220ms)
      const simulatedLatency = Math.floor(Math.random() * 100) + 120
      await new Promise((resolve) => setTimeout(resolve, simulatedLatency))

      const script = generateLocalTwoSentenceScript(attendee)
      return {
        script,
        modelUsed: model,
        latencyMs: Date.now() - startTime,
        source: 'local-simulation',
      }
    },
    {
      'ai.model': model,
      'attendee.name': attendee.name,
      'attendee.role': attendee.role,
      'attendee.event': attendee.event,
    }
  )
}

/**
 * Enforces strictly TWO sentences from the generated text, preserving honorifics (Dr., Mr., etc.).
 */
export function enforceTwoSentences(rawText: string, attendee: AttendeeInput): string {
  // Strip common artifacts: quotes, prefixes like "Here is your script:", markdown
  let cleaned = rawText
    .replace(/^(here is|here's|script:|voice script:)[^\n]*\n+/i, '')
    .replace(/^["'`]|["'`]$/g, '')
    .replace(/\*\*/g, '')
    .trim()

  const sentences = splitIntoSentences(cleaned)

  if (sentences.length >= 2) {
    // Exactly take the first 2 sentences
    return sentences.slice(0, 2).join(' ')
  }

  // If model produced only 1 sentence or unusual formatting, augment to ensure exactly 2 sentences
  if (sentences.length === 1) {
    const firstSentence = sentences[0]
    const closing = getRoleBasedClosingSentence(attendee.role, attendee.event)
    return `${firstSentence} ${closing}`
  }

  // Fallback to local template if parsing failed
  return generateLocalTwoSentenceScript(attendee)
}

/**
 * Splits text into sentences while protecting abbreviations and honorifics (e.g. Dr., Mr., Ms., Prof.)
 */
export function splitIntoSentences(text: string): string[] {
  const protectedText = text.replace(
    /\b(Dr|Mr|Mrs|Ms|Prof|Sr|Jr|Inc|Ltd|vs)\./gi,
    (_match, prefix) => `${prefix}__DOT__`
  )

  const sentences = protectedText
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"'])/)
    .map((s) => s.replace(/__DOT__/g, '.').trim())
    .filter((s) => s.length > 0)

  return sentences
}

/**
 * High-quality, strictly 2-sentence voice reminder generator based on attendee role and event.
 */
function generateLocalTwoSentenceScript(attendee: AttendeeInput): string {
  const { name, role, event } = attendee
  const cleanRole = role.toLowerCase().trim()

  if (cleanRole === 'speaker' || cleanRole.includes('keynote')) {
    return `Hello ${name}, this is Voco calling with an important check-in for your upcoming presentation at ${event}. Your stage briefing begins thirty minutes before your session, and our AV team is looking forward to welcoming you!`
  }

  if (cleanRole === 'vip') {
    return `Good day ${name}, Voco is delighted to confirm that your VIP priority credentials for ${event} are fully active. Your reserved parking pass and exclusive lounge access will be waiting for you upon arrival.`
  }

  if (cleanRole === 'panelist') {
    return `Hi ${name}, this is Voco reminding you of your upcoming panel discussion at ${event}. Tech checks and audio calibration will commence fifteen minutes prior to going live on stage.`
  }

  if (cleanRole === 'organizer' || cleanRole === 'crew') {
    return `Hello ${name}, this is your Voco briefing reminder for ${event}. Team muster is scheduled at the main auditorium desk, and all attendee roster feeds are currently synced.`
  }

  // Default Attendee
  return `Hi ${name}, this is Voco with a friendly reminder that ${event} is taking place soon. We have your seat reserved and look forward to sharing an inspiring experience with you!`
}

function getRoleBasedClosingSentence(role: string, event: string): string {
  const cleanRole = role.toLowerCase().trim()
  if (cleanRole.includes('speaker')) {
    return `Our backstage tech team will be ready to assist you thirty minutes prior to your presentation.`
  }
  if (cleanRole.includes('vip')) {
    return `Your dedicated concierge desk and VIP lounge credentials will be ready upon arrival.`
  }
  if (cleanRole.includes('panelist')) {
    return `Please join the audio preparation room fifteen minutes prior to stage call.`
  }
  return `We have your reservation confirmed and can't wait to see you at ${event}!`
}
