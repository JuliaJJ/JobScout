// api/project-suggestions.js
// Vercel serverless function — suggests portfolio projects to build to close skill gaps

import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `You are a career coach for a designer with strong technical/build skills, targeting senior, staff, and lead roles across UX design, product design, design engineering, and design technologist tracks. You give specific, actionable advice. Return ONLY valid JSON with no preamble or markdown fences.

When suggesting portfolio projects, you prioritize real, functional, buildable software — working apps, tools, browser extensions, CLIs, automations, plugins, small services — over design case studies, redesign concepts, UX audits, or documentation exercises. A written case study will exist for whatever gets built regardless of its subject, so it is never the differentiator and should never be the suggestion itself. The candidate's design background should shape HOW they build something — the interaction design, information architecture, and craft baked into it — not BE the subject of what they build.`

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
${interestsContext ? `PERSONAL INTERESTS / HOBBIES:\n${interestsContext}\n` : 'PERSONAL INTERESTS / HOBBIES: none provided.\n'}
Suggest 3-5 project ideas, ordered by impact. Requirements for every suggestion:
- The deliverable must be a real, functional, working piece of software that runs and does something — an app, tool, browser extension, CLI, automation, small service, or plugin. Never suggest a redesign concept, UX audit, case study, or documentation exercise as the project itself — a write-up will exist for whatever gets built regardless, so it isn't the point.
- The candidate's design judgment (interaction design, information architecture, accessibility) should inform how the thing is built, not be what it's about — avoid projects centered on "redesigning" an existing product's UI as a concept exercise. Prefer solving a real, concrete problem through working software where good design is part of the craft, not the headline.
- Each should target one or more of the skills above, be distinct from the existing portfolio (don't suggest something too similar to a project already listed), and be realistically scoped for someone building it alongside a job search.

${interestsContext ? `An interest doesn't need to relate to the skill itself to count as a genuine tie-in — it can simply inspire the project's subject matter or domain. For example, an interest in cooking doesn't need to involve "cooking skills," but could inspire a recipe-organizing app that happens to demonstrate service design or information architecture. Actively look for a domain connection like this for at least one or two of your suggestions before concluding none applies — but still don't force a tie-in onto every suggestion if nothing reasonable comes to mind for it.\n` : ''}

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
