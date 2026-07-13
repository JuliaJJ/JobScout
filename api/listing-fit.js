// api/listing-fit.js
// Vercel serverless function — scoped gap check between the resume/portfolio and a single job listing

import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `You are a senior UX/product design career coach. You give specific, honest fit assessments. Return ONLY valid JSON with no preamble or markdown fences. The candidate is targeting senior, staff, and lead roles in UX design, product design, design engineering, and design technologist tracks.`

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { listing, resume, portfolio } = req.body
  if (!listing || !resume) {
    return res.status(400).json({ error: 'Listing and resume required' })
  }

  const listingContext = [
    `Title: ${listing.title || 'Unknown'}`,
    listing.company && `Company: ${listing.company}`,
    listing.seniority_level && `Seniority: ${listing.seniority_level}`,
    listing.parsed_skills?.length && `Skills: ${listing.parsed_skills.join(', ')}`,
    listing.parsed_requirements?.length && `Requirements:\n${listing.parsed_requirements.join('\n')}`,
    listing.parsed_nice_to_haves?.length && `Nice to haves:\n${listing.parsed_nice_to_haves.join('\n')}`,
  ].filter(Boolean).join('\n')

  const portfolioContext = (portfolio || []).map(p => {
    const skills = (p.skills || []).join(', ')
    const desc = (p.description || p.mdx_content || '').replace(/\s+/g, ' ').trim().slice(0, 300)
    const tags = [p.type, ...(p.role_clusters || [])].filter(Boolean).join(', ')
    return `- "${p.title}"${tags ? ` (${tags})` : ''}${skills ? ` — tagged skills: ${skills}` : ''}${desc ? `\n  ${desc}` : ''}`
  }).join('\n')

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1400,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{
        role: 'user',
        content: `Assess this candidate's fit for a single job listing.

RESUME:
${resume.slice(0, 3000)}

JOB LISTING:
${listingContext}

${portfolioContext ? `PORTFOLIO PROJECTS:\n${portfolioContext}\n` : 'PORTFOLIO PROJECTS: none provided.\n'}
For each skill or requirement in the listing, classify it into exactly ONE bucket:
- skills_present: clearly and explicitly demonstrated in the resume text
- skills_partial: implied or partially demonstrated in the resume but not clearly articulated
- skills_from_portfolio: NOT clearly present in the resume text, but demonstrated by one of the portfolio projects above — a resume WORDING fix, not a skill gap
- skills_missing: genuinely absent from both the resume AND the portfolio — a real gap

If no portfolio projects were provided, skills_from_portfolio must be an empty array.

Return ONLY a JSON object with this exact structure:
{
  "summary": "1-2 sentence honest fit assessment for this specific role",
  "skills_present": ["..."],
  "skills_partial": ["..."],
  "skills_from_portfolio": [
    { "skill": "...", "portfolio_piece": "exact title of the portfolio project", "resume_suggestion": "a specific resume bullet drawing only on what that project's description says" }
  ],
  "skills_missing": ["..."]
}`,
      }],
    })

    const text = message.content[0]?.type === 'text' ? message.content[0].text : '{}'
    let parsed
    try {
      parsed = JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim())
    } catch {
      throw new Error('Fit check failed to parse. Please try again.')
    }

    res.json(parsed)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
