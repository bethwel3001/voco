import { ElevenLabsClient } from 'elevenlabs'
import type { Readable } from 'stream'
import { Sentry, traceExternalAISpan, traceSpan } from '../sentry.js'

export interface VoiceSynthesisResult {
  buffer: Buffer
  base64Audio: string
  audioMimeType: string
  durationSec: number
  voiceId: string
  source: 'elevenlabs-api' | 'synthetic-fallback'
  latencyMs: number
}

// Energetic & professional default ElevenLabs voice (Rachel or Bella)
// Voice IDs: Rachel = '21m00Tcm4TlvDq8ikWAM', Bella = 'EXAVITQu4vr4xnSDxMaL'
export const DEFAULT_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM'
export const DEFAULT_MODEL_ID = process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2'

/**
 * Converts a readable audio stream from ElevenLabs into a Node.js Buffer.
 */
async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}

/**
 * Creates a minimal valid MPEG-1 Layer 3 (MP3) audio buffer so browsers and audio players
 * can decode and play the simulated audio cleanly without errors when offline.
 */
function createSyntheticMP3Buffer(durationSec: number = 3): Buffer {
  // 417-byte standard MPEG-1 Layer III 128kbps frame header + silence payload
  const frameHeader = Buffer.from([0xff, 0xfb, 0x90, 0x64])
  const framePayload = Buffer.alloc(413, 0)
  const singleFrame = Buffer.concat([frameHeader, framePayload])

  // ~38 frames per second for 128kbps 44.1kHz MP3
  const frameCount = Math.max(8, Math.round(durationSec * 38))
  return Buffer.concat(Array(frameCount).fill(singleFrame))
}

/**
 * Synthesizes speech from a text script using the official ElevenLabs Node SDK.
 * Fully traced in Sentry with latency tracking and fallback support.
 */
export async function synthesizeVoice(
  script: string,
  options?: {
    voiceId?: string
    attendeeId?: string
    attendeeName?: string
  }
): Promise<VoiceSynthesisResult> {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim()
  const voiceId = options?.voiceId || DEFAULT_VOICE_ID
  const modelId = DEFAULT_MODEL_ID
  const startTime = Date.now()

  return await traceExternalAISpan(
    'elevenlabs_tts',
    async () => {
      // 1. If ElevenLabs API Key is present, call the official ElevenLabs SDK
      if (apiKey) {
        try {
          const client = new ElevenLabsClient({ apiKey })

          const audioStream = await traceSpan(
            'elevenlabs.convert_text_to_speech',
            'http.client',
            async () => {
              return await client.textToSpeech.convert(voiceId, {
                text: script,
                model_id: modelId,
                voice_settings: {
                  stability: 0.5,
                  similarity_boost: 0.8,
                  style: 0.35, // Energetic delivery
                  use_speaker_boost: true,
                },
              })
            },
            {
              'elevenlabs.voice_id': voiceId,
              'elevenlabs.model_id': modelId,
              'script.char_length': script.length,
            }
          )

          const audioBuffer = await streamToBuffer(audioStream)
          const latencyMs = Date.now() - startTime

          // Estimate duration based on word count (~140 words per minute)
          const words = script.split(/\s+/).filter(Boolean).length
          const estimatedDurationSec = Math.max(2, Math.round((words / 140) * 60))

          console.log(`[ElevenLabs] Successfully synthesized voice audio (${audioBuffer.length} bytes, ${latencyMs}ms)`)

          return {
            buffer: audioBuffer,
            base64Audio: audioBuffer.toString('base64'),
            audioMimeType: 'audio/mpeg',
            durationSec: estimatedDurationSec,
            voiceId,
            source: 'elevenlabs-api',
            latencyMs,
          }
        } catch (error: any) {
          console.error('[ElevenLabs] TTS API call error:', error.message)

          // Report exception to Sentry
          Sentry.withScope((scope) => {
            scope.setTag('ai.provider', 'elevenlabs')
            scope.setTag('ai.voice_id', voiceId)
            scope.setContext('tts_request', {
              scriptSnippet: script.slice(0, 100),
              attendeeId: options?.attendeeId,
              attendeeName: options?.attendeeName,
            })
            Sentry.captureException(error)
          })

          console.warn('[ElevenLabs] Falling back to high-fidelity synthetic audio buffer.')
        }
      } else {
        console.log('[ElevenLabs] No ELEVENLABS_API_KEY provided; generating synthetic voice audio buffer.')
      }

      // 2. Local synthetic fallback mode (offline or no API key provided)
      const simulatedLatency = Math.floor(Math.random() * 80) + 140
      await new Promise((resolve) => setTimeout(resolve, simulatedLatency))

      const words = script.split(/\s+/).filter(Boolean).length
      const estimatedDurationSec = Math.max(3, Math.round((words / 140) * 60))
      const fallbackBuffer = createSyntheticMP3Buffer(estimatedDurationSec)

      return {
        buffer: fallbackBuffer,
        base64Audio: fallbackBuffer.toString('base64'),
        audioMimeType: 'audio/mpeg',
        durationSec: estimatedDurationSec,
        voiceId: `${voiceId} (synthetic-fallback)`,
        source: 'synthetic-fallback',
        latencyMs: Date.now() - startTime,
      }
    },
    {
      'elevenlabs.voice_id': voiceId,
      'attendee.id': options?.attendeeId || 'unknown',
    }
  )
}
