const { GoogleGenerativeAI } = require('@google/generative-ai')

const genAI = new GoogleGenerativeAI("AIzaSyDfComqghZ2DBDUut38Q6ZPUydTwUokD2U")

const SYSTEM_PROMPT = `You are a strict visual quality-control inspector AI.
You will receive one or more images and a set of inspection requirements from the user.

Your job:
1. Carefully examine every visible detail of each image.
2. Compare what you see against each requirement provided.
3. Decide whether the images PASS or FAIL the inspection.
4. Estimate your confidence as a percentage (0-100).

Rules:
- Be precise and objective — only judge what is clearly visible.
- A single failed requirement means the overall result is FAIL.
- When the result is FAIL, provide a clear, concise reason explaining which requirement(s) failed and why.
- When the result is PASS, set reason to null.
- The tolerance value (0-100) indicates how strict the inspection should be.
  100 = extremely strict (exact match required), 0 = very lenient.
  Adjust your judgement accordingly — a lower tolerance means minor deviations are acceptable.
- If multiple images are provided, evaluate ALL of them together against the requirements.

You MUST respond with ONLY a valid JSON object in this exact format, no extra text:
{
  "result": "pass" or "fail",
  "reason": "string explaining failure" or null,
  "confidence": <number 0-100>
}`

/**
 * Analyze one or more images against user-defined requirements using Gemini AI.
 *
 * @param {string|string[]} imageUrls - Public URL(s) of the image(s) to analyze.
 * @param {object} config
 * @param {string} config.prompt    - The inspection requirements.
 * @param {number} [config.tolerance=70] - Strictness level 0-100 (higher = stricter).
 * @returns {Promise<{ result: 'pass'|'fail', reason: string|null, confidence: number }>}
 */
async function analyzeImage(imageUrls, { prompt, tolerance = 70 }) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

  const urls = Array.isArray(imageUrls) ? imageUrls : [imageUrls]

  // Fetch all images in parallel
  const imageParts = await Promise.all(
    urls.map(async (url) => {
      const res = await fetch(url)
      const arrayBuffer = await res.arrayBuffer()
      const base64 = Buffer.from(arrayBuffer).toString('base64')
      const mimeType = res.headers.get('content-type') || 'image/jpeg'
      return { inlineData: { mimeType, data: base64 } }
    })
  )

  const userMessage = `Inspection requirements:\n${prompt}\n\nTolerance level: ${tolerance}/100 (${tolerance >= 80 ? 'strict' : tolerance >= 50 ? 'moderate' : 'lenient'})\n\nNumber of images: ${urls.length}`

  const result = await model.generateContent({
    contents: [
      {
        role: 'user',
        parts: [
          { text: SYSTEM_PROMPT + '\n\n' + userMessage },
          ...imageParts,
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 512,
    },
  })

  const text = result.response.text().trim()

  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('Gemini returned an invalid response format')
  }

  const parsed = JSON.parse(jsonMatch[0])

  return {
    result:     parsed.result === 'pass' ? 'pass' : 'fail',
    reason:     parsed.result === 'pass' ? null : (parsed.reason || 'Unknown reason'),
    confidence: Math.min(100, Math.max(0, Number(parsed.confidence) || 0)),
  }
}

module.exports = { analyzeImage }
