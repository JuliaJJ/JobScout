import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `You are an expert career coach specializing in UX design, product design, and design engineering interviews at tech companies. You help senior candidates prepare by anticipating likely questions and crafting smart questions to ask interviewers. Return only valid JSON — no prose, no markdown fences.`

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { listing, resume } = req.body

  const listingContext = [
    listing.title && `Title: ${listing.title}`,
    listing.company && `Company: ${listing.company}`,
    listing.role_cluster && `Role cluster: ${listing.role_cluster}`,
    listing.parsed_skills?.length && `Key skills: ${listing.parsed_skills.slice(0, 20).join(', ')}`,
    listing.parsed_requirements?.length && `Requirements:\n${listing.parsed_requirements.slice(0, 10).join('\n')}`,
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
          content: `Generate interview prep for this role.

JOB LISTING:
${listingContext}

${resume ? `CANDIDATE RESUME (excerpt):\n${resume.slice(0, 3000)}` : ''}

Return exactly this JSON shape:
{
  "behavioral": [
    {"question": "...", "category": "behavioral"}
  ],
  "design": [
    {"question": "...", "category": "design"}
  ],
  "to_ask": [
    {"question": "..."}
  ]
}

Rules:
- behavioral: 6–8 questions. Focus on leadership, influencing without authority, navigating ambiguity, cross-functional collaboration, receiving/giving feedback, and measurable impact. Tailor to the seniority implied by the role.
- design: 4–6 questions. Mix of portfolio walkthrough prompts, design process deep-dives, design critique scenarios, and role-specific challenges (e.g. design systems, research methods, handoff with engineering). Make them specific to this role cluster if possible.
- to_ask: 5–7 sharp questions the candidate should ask. Make them specific to this company and role — not generic. Show curiosity about team dynamics, design maturity, decision-making, and growth.`,
        },
      ],
    })

    const text = message.content[0]?.type === 'text' ? message.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON in response')

    const parsed = JSON.parse(jsonMatch[0])
    res.json(parsed)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
