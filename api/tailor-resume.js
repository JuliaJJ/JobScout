import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `You are a career coach specializing in UX, product design, and design engineering roles at tech companies. Given a resume and a job listing, you identify specific resume bullets worth rewording for this role and generate improved versions that incorporate the listing's language and keywords. You only suggest rewrites for content genuinely present in the resume — never invent achievements. Return only valid JSON.`

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { listing, resume } = req.body
  if (!resume?.trim()) return res.status(400).json({ error: 'No active resume found' })

  const listingContext = [
    listing.title && `Title: ${listing.title}`,
    listing.company && `Company: ${listing.company}`,
    listing.role_cluster && `Role type: ${listing.role_cluster}`,
    listing.parsed_skills?.length && `Key skills required: ${listing.parsed_skills.slice(0, 20).join(', ')}`,
    listing.parsed_requirements?.length && `Requirements:\n${listing.parsed_requirements.slice(0, 8).join('\n')}`,
  ].filter(Boolean).join('\n')

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        {
          role: 'user',
          content: `Analyze this resume against the job listing and return tailoring suggestions.

JOB LISTING:
${listingContext}

RESUME:
${resume.slice(0, 4000)}

Return exactly this JSON shape — no prose, no markdown fences:
{
  "bullet_rewrites": [
    {
      "original": "close quote of existing resume text",
      "suggestion": "rewritten version using the listing's language and framing",
      "reason": "one sentence: what this change achieves"
    }
  ],
  "keywords": ["term1", "term2"],
  "coaching": ["note1", "note2"]
}

Rules:
- bullet_rewrites: 2–4 bullets. Pick ones where the gap between resume language and JD language is largest. Quote "original" closely enough that the candidate can find it with Cmd+F. The suggestion should preserve substance while adopting the listing's vocabulary and specific framing.
- keywords: 4–6 specific terms from the JD worth incorporating that aren't already prominent in the resume (e.g. "design craft", "0→1", "design tokens", "mixed-methods research" — not generic terms like "collaboration").
- coaching: 2–3 concise strategic notes about ordering or emphasis (e.g. "Lead with your design systems work — it's the top requirement but appears third in your experience section"). Be specific, not generic.`,
        },
      ],
    })

    const text = message.content[0]?.type === 'text' ? message.content[0].text : ''
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('No JSON in response')

    const parsed = JSON.parse(match[0])
    res.json(parsed)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
