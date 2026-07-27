// api/project-suggestions.js
// Vercel serverless function — suggests portfolio projects to build to close skill gaps

import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `You are a senior UX/product design career coach. You give specific, actionable advice. Return ONLY valid JSON with no preamble or markdown fences. The candidate is targeting senior, staff, and lead roles in UX design, product design, design engineering, and design technologist tracks.`

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { skills_missing, skills_partial, portfolio, interests } = req.body
  if (!skills_missing?.length && !skills_partial?.length) {
    return res.status(400).json({ error: 'No skill gaps to build projects around' })
  }

  const portfolioContext = (portfolio || []).map(p => {
    const skills = (p.skills || []).join(', ')
    const desc = (p.description || p.mdx_content || '').replace(/\s+/g, ' ').trim().slice(0, 300)
    const tags = [p.type, ...(p.role_clusters || [])].filter(Boolean).join(', ')
    return `- "${p.title}"${tags ? ` (${tags})` : ''}${skills ? ` — tagged skills: ${skills}` : ''}${desc ? `\n  ${desc}` : ''}`
  }).join('\n')

  const interestsContext = (interests || []).map(i =>
    `- ${i.label}${i.notes ? `: ${i.notes.replace(/\s+/g, ' ').trim().slice(0, 200)}` : ''}`
  ).join('\n')

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1600,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{
        role: 'user',
        content: `Suggest concrete portfolio projects worth building to close this designer's skill gaps.

SKILLS TO DEVELOP:
- Genuinely missing (no evidence in resume or portfolio): ${skills_missing?.length ? skills_missing.join(', ') : 'none'}
- Partial / underdeveloped (implied but not clearly demonstrated): ${skills_partial?.length ? skills_partial.join(', ') : 'none'}

${portfolioContext ? `EXISTING PORTFOLIO PROJECTS:\n${portfolioContext}\n` : 'EXISTING PORTFOLIO PROJECTS: none provided.\n'}
${interestsContext ? `PERSONAL INTERESTS / HOBBIES (use for color and personalization only where a genuine fit exists — never force a contrived connection):\n${interestsContext}\n` : 'PERSONAL INTERESTS / HOBBIES: none provided.\n'}
Suggest 3-5 project ideas, ordered by impact. Each should target one or more of the skills above, be distinct from the existing portfolio (don't suggest something too similar to a project already listed), and be realistically scoped for someone building it alongside a job search.

Return ONLY a JSON object with this exact structure:
{
  "suggestions": [
    {
      "title": "short, specific project name",
      "rationale": "1-2 sentences on why this closes a real, market-relevant gap",
      "skills_targeted": ["skill", "skill"],
      "scope": "a short effort estimate, e.g. 'weekend build' or '1-2 week project'",
      "tech_suggestions": ["tool or technology", "..."],
      "interest_tie_in": "one sentence naming the specific interest this draws on, or null if none applies"
    }
  ]
}`,
      }],
    })

    const responseText = message.content[0]?.type === 'text' ? message.content[0].text : '{}'

    let parsed
    try {
      parsed = JSON.parse(responseText.replace(/```json\n?|\n?```/g, '').trim())
    } catch {
      throw new Error('Suggestions failed to parse. Please try again.')
    }

    res.json(parsed)

  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
