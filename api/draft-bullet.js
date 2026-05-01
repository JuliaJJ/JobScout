import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { skill, description, roles } = req.body
  if (!skill || !description?.trim()) return res.status(400).json({ error: 'Skill and description required' })

  const rolesContext = roles?.length
    ? `\n\nCandidate's roles for context:\n${roles.map(r => `- ${r.title} at ${r.company}`).join('\n')}`
    : ''

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      system: [
        {
          type: 'text',
          text: 'You are a senior UX/product design resume writer. Write polished, specific resume bullets for a senior/staff-level designer with design engineering experience (React, Swift, HTML/CSS). Return ONLY valid JSON with no preamble or markdown fences.',
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{
        role: 'user',
        content: `Write 3 resume bullet variants demonstrating the skill: "${skill}"

The candidate describes their experience as:
"${description.trim()}"${rolesContext}

Rules for each bullet:
- Open with a strong past-tense action verb (Led, Designed, Built, Established, Partnered, etc.)
- Be concrete — name tools, outcomes, scale, or team context where inferable from the description
- Target senior/staff UX designer voice — strategic and cross-functional
- One sentence, 20–35 words max
- Vary the opening verb and angle across all 3 variants

Return ONLY: { "bullets": ["bullet 1", "bullet 2", "bullet 3"] }`,
      }],
    })

    const text = message.content[0]?.type === 'text' ? message.content[0].text : '{}'
    let parsed
    try {
      parsed = JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim())
    } catch {
      throw new Error('Failed to generate bullets — please try again')
    }

    res.json(parsed)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
