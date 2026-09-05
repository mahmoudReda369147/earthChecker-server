const { GoogleGenerativeAI } = require('@google/generative-ai')

const API_KEY = process.env.GEMINI_API_KEY || "AIzaSyDfComqghZ2DBDUut38Q6ZPUydTwUokD2U"
const genAI = new GoogleGenerativeAI(API_KEY)

const SYSTEM_PROMPT = `You are a strict visual quality-control inspector AI.
You will receive one or more images and a set of inspection requirements from the user.

Your job:
1. Carefully examine every visible detail of each image.
2. Compare what you see against each requirement provided.
3. Decide whether the images PASS or FAIL the inspection.
4. Estimate your confidence as a percentage (0-100).
5. If the result is FAIL and a list of Module Problem Types is provided, select the single best matching problem type.

Rules:
- Be precise and objective — only judge what is clearly visible.
- A single failed requirement means the overall result is FAIL.
- When the result is FAIL, provide a clear, concise reason explaining which requirement(s) failed and why.
- When the result is FAIL, set "problemType" to the exact string matching one of the Module Problem Types provided (or a concise failure label if none match).
- When the result is PASS, set reason to null and problemType to null.
- The tolerance value (0-100) indicates how strict the inspection should be.
  100 = extremely strict (exact match required), 0 = very lenient.
  Adjust your judgement accordingly — a lower tolerance means minor deviations are acceptable.
- If multiple images are provided, evaluate ALL of them together against the requirements.

You MUST respond with ONLY a valid JSON object in this exact format, no extra text:
{
  "result": "pass" or "fail",
  "reason": "string explaining failure" or null,
  "confidence": <number 0-100>,
  "problemType": "string matching one of the Module Problem Types" or null
}`

/**
 * Analyze one or more images against user-defined requirements using Gemini AI.
 *
 * @param {string|string[]} imageUrls - Public URL(s) of the image(s) to analyze.
 * @param {object} config
 * @param {string} config.prompt    - The inspection requirements.
 * @param {number} [config.tolerance=70] - Strictness level 0-100 (higher = stricter).
 * @param {string[]} [config.problemTypes] - Available problem types configured for the module.
 * @returns {Promise<{ result: 'pass'|'fail', reason: string|null, confidence: number, problemType: string|null }>}
 */
async function analyzeImage(imageUrls, { prompt, tolerance = 70, problemTypes = [] }) {
  const urls = Array.isArray(imageUrls) ? imageUrls : [imageUrls]

  // Fetch all images in parallel
  const imageParts = await Promise.all(
    urls.map(async (url) => {
      if (url.startsWith('data:')) {
        const matches = url.match(/^data:(.+?);base64,(.+)$/)
        if (matches) {
          return { inlineData: { mimeType: matches[1], data: matches[2] } }
        }
      }
      const res = await fetch(url)
      if (!res.ok) {
        throw new Error(`Failed to fetch image at ${url} (HTTP ${res.status})`)
      }
      const arrayBuffer = await res.arrayBuffer()
      const base64 = Buffer.from(arrayBuffer).toString('base64')
      let mimeType = (res.headers.get('content-type') || 'image/jpeg').split(';')[0].split(',')[0].trim()
      if (!mimeType.startsWith('image/')) {
        mimeType = 'image/jpeg'
      }
      return { inlineData: { mimeType, data: base64 } }
    })
  )

  const formattedProblemTypes = problemTypes.length > 0
    ? problemTypes.map((t) => ` - "${t}"`).join('\n')
    : ' - "General Defect"'

  const userMessage = `Inspection requirements:\n${prompt}\n\nTolerance level: ${tolerance}/100 (${tolerance >= 80 ? 'strict' : tolerance >= 50 ? 'moderate' : 'lenient'})\n\nAvailable Module Problem Types:\n${formattedProblemTypes}\n\nNumber of images: ${urls.length}`

  const primaryModelName = 'gemini-3.6-flash'
  const fallbackModelName = 'gemini-2.5-flash'

  const generationConfig = {
    temperature: 0.1,
    maxOutputTokens: 2048,
    responseMimeType: 'application/json',
    responseSchema: {
      type: 'OBJECT',
      properties: {
        result: { type: 'STRING', enum: ['pass', 'fail'] },
        reason: { type: 'STRING', nullable: true },
        confidence: { type: 'NUMBER' },
        problemType: { type: 'STRING', nullable: true },
      },
      required: ['result', 'reason', 'confidence', 'problemType'],
    },
  }

  let result
  try {
    const model = genAI.getGenerativeModel({ model: primaryModelName })
    result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            { text: SYSTEM_PROMPT + '\n\n' + userMessage },
            ...imageParts,
          ],
        },
      ],
      generationConfig,
    })
  } catch (primaryErr) {
    console.warn(`[GeminiAgent] ${primaryModelName} failed (${primaryErr.message}). Retrying with ${fallbackModelName}...`)
    const fallbackModel = genAI.getGenerativeModel({ model: fallbackModelName })
    result = await fallbackModel.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            { text: SYSTEM_PROMPT + '\n\n' + userMessage },
            ...imageParts,
          ],
        },
      ],
      generationConfig,
    })
  }

  let text = ''
  try {
    text = result.response.text().trim()
  } catch (textErr) {
    console.error('[Gemini text extraction error]', textErr)
  }

  console.log('[Gemini inspection response text]:', text)

  let parsed = null
  if (text) {
    const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim()
    const jsonMatch = cleanText.match(/\{[\s\S]*\}/)

    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[0])
      } catch (parseErr) {
        console.error('[Gemini JSON parse error]', parseErr)
      }
    }
  }

  // Graceful fallback if JSON parsing was unsuccessful
  if (!parsed) {
    const isPass = text.toLowerCase().includes('"pass"') || (text.toLowerCase().includes('pass') && !text.toLowerCase().includes('fail'))
    parsed = {
      result:      isPass ? 'pass' : 'fail',
      reason:      isPass ? null : (text || 'Visual inspection failed requirements check'),
      confidence:  75,
      problemType: isPass ? null : (problemTypes[0] || 'General Defect'),
    }
  }

  let rawConf = Number(parsed.confidence)
  if (isNaN(rawConf)) rawConf = 75
  if (rawConf > 0 && rawConf <= 1) rawConf = Math.round(rawConf * 100)

  return {
    result:      parsed.result === 'pass' ? 'pass' : 'fail',
    reason:      parsed.result === 'pass' ? null : (parsed.reason || 'Requirement check failed'),
    confidence:  Math.min(100, Math.max(0, Math.round(rawConf))),
    problemType: parsed.result === 'pass' ? null : (parsed.problemType || problemTypes[0] || 'General Defect'),
  }
}

module.exports = { analyzeImage }
