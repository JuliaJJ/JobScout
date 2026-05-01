import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { text } = req.body
  if (!text?.trim()) return res.status(400).json({ error: 'Resume text required' })

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4000,
      system: [
        {
          type: 'text',
          text: 'You are a resume parser. Extract structured data from resume text. Return ONLY valid JSON with no preamble, explanation, or markdown fences.',
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{
        role: 'user',
        content: `Parse this resume into structured JSON. Extract all content accurately. Split experience descriptions into individual bullet points. Group skills into logical categories. Use sequential IDs like exp_1, edu_1, skill_1, cert_1.

Return this exact schema:
{
  "summary": "professional summary text, or empty string if none",
  "experience": [
    {
      "id": "exp_1",
      "title": "job title",
      "company": "company name",
      "location": "city, state or Remote",
      "startDate": "Mon YYYY",
      "endDate": "Mon YYYY, or empty string if current role",
      "current": false,
      "bullets": ["achievement or responsibility as complete sentence", "..."]
    }
  ],
  "education": [
    {
      "id": "edu_1",
      "degree": "degree type e.g. Bachelor of Fine Arts",
      "field": "field of study e.g. Graphic Design",
      "institution": "school name",
      "graduationYear": "YYYY"
    }
  ],
  "skills": [
    {
      "id": "skill_1",
      "category": "category name e.g. Design Tools",
      "items": ["Figma", "Sketch", "..."]
    }
  ],
  "certifications": [
    {
      "id": "cert_1",
      "name": "certification name",
      "issuer": "issuing organization",
      "year": "YYYY"
    }
  ]
}

RESUME:
${text.slice(0, 5000)}`,
      }],
    })

    const responseText = message.content[0]?.type === 'text' ? message.content[0].text : '{}'

    let parsed
    try {
      parsed = JSON.parse(responseText.replace(/```json\n?|\n?```/g, '').trim())
    } catch {
      throw new Error('Failed to parse resume structure — please try again')
    }

    res.json(parsed)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
