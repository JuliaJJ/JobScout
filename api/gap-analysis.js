// api/gap-analysis.js
// Vercel serverless function — runs gap analysis between resume and job listings

import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `You are a senior UX/product design career coach. You give specific, actionable advice. Return ONLY valid JSON with no preamble or markdown fences. The candidate is targeting senior, staff, and lead roles in UX design, product design, design engineering, and design technologist tracks.`

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { resume, listings, portfolio } = req.body
  if (!resume || !listings?.length) {
    return res.status(400).json({ error: 'Resume and listings required' })
  }

  // Build weighted frequency maps across all listings (yes=2x, maybe=1x)
  const skillFreq = {}
  const reqFreq = {}
  const nthFreq = {}
  const clusterCounts = {}
  const seniorityCounts = {}
  const weightedTotal = listings.reduce((sum, l) => sum + (l.interest_rating === 'yes' ? 2 : 1), 0)

  listings.forEach(l => {
    const weight = l.interest_rating === 'yes' ? 2 : 1
    ;(l.skills || []).forEach(s => { skillFreq[s] = (skillFreq[s] || 0) + weight })
    ;(l.requirements || []).forEach(r => { reqFreq[r] = (reqFreq[r] || 0) + weight })
    ;(l.nice_to_haves || []).forEach(r => { nthFreq[r] = (nthFreq[r] || 0) + weight })
    if (l.role_cluster) clusterCounts[l.role_cluster] = (clusterCounts[l.role_cluster] || 0) + 1
    if (l.seniority_level) seniorityCounts[l.seniority_level] = (seniorityCounts[l.seniority_level] || 0) + 1
  })

  const fmt = (freq, n) => Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k, c]) => `${k} (${Math.round(c / weightedTotal * 100)}%)`)
    .join(', ')

  const topSkills = fmt(skillFreq, 25)
  const topRequirements = fmt(reqFreq, 20)
  const topNiceToHaves = fmt(nthFreq, 10)
  const clusterSummary = Object.entries(clusterCounts).map(([k, v]) => `${k}: ${v}`).join(', ')
  const senioritySummary = Object.entries(seniorityCounts).map(([k, v]) => `${k}: ${v}`).join(', ')

  const portfolioContext = (portfolio || []).map(p => {
    const skills = (p.skills || []).join(', ')
    const desc = (p.description || p.mdx_content || '').replace(/\s+/g, ' ').trim().slice(0, 300)
    const tags = [p.type, ...(p.role_clusters || [])].filter(Boolean).join(', ')
    return `- "${p.title}"${tags ? ` (${tags})` : ''}${skills ? ` — tagged skills: ${skills}` : ''}${desc ? `\n  ${desc}` : ''}`
  }).join('\n')

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 3200,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{
        role: 'user',
        content: `Analyze this designer's resume against their target job market and return a gap analysis.

RESUME:
${resume.slice(0, 3000)}

MARKET PROFILE (aggregated from ${listings.length} listings, weighted yes=2x / maybe=1x):
Skills: ${topSkills}
Requirements: ${topRequirements}
Nice-to-haves: ${topNiceToHaves}
Role mix: ${clusterSummary || 'n/a'}
Seniority mix: ${senioritySummary || 'n/a'}

${portfolioContext ? `PORTFOLIO PROJECTS:\n${portfolioContext}\n` : 'PORTFOLIO PROJECTS: none provided.\n'}
For each frequently-requested market skill, classify it into exactly ONE bucket:
- skills_present: clearly and explicitly demonstrated in the resume text
- skills_partial: implied or partially demonstrated in the resume but not clearly articulated
- skills_from_portfolio: NOT clearly present in the resume text, but demonstrated by one of the portfolio projects above (via its tagged skills or description) — these are resume WORDING fixes, not skill gaps, since the candidate already has the experience
- skills_missing: genuinely absent from both the resume AND the portfolio — real gaps that call for new experience or development, not just better phrasing

If no portfolio projects were provided, skills_from_portfolio must be an empty array.

Return ONLY a JSON object with this exact structure:
{
  "summary": "1-2 paragraph honest assessment of positioning, strengths, and main gaps",
  "skills_present": ["skills clearly evident in resume that are highly sought"],
  "skills_partial": ["skills implied or partially demonstrated but not clearly articulated"],
  "skills_from_portfolio": [
    {
      "skill": "the skill",
      "portfolio_piece": "exact title of the portfolio project that demonstrates it",
      "resume_suggestion": "a specific resume bullet drawing only on what that project's description says — never invent details"
    }
  ],
  "skills_missing": ["skills frequently requested that are genuinely absent from resume and portfolio"],
  "action_plan": [
    {
      "action": "short action title",
      "priority": "high|medium|low",
      "rationale": "one sentence why this matters",
      "detail": "specific tactical advice (2-3 sentences max)",
      "resume_suggestion": "one resume bullet if applicable, otherwise null"
    }
  ]
}

Do not repeat skills_from_portfolio items in the action_plan — those already have their own resume_suggestion. Keep action_plan focused on skills_missing, skills_partial, and broader positioning/application strategy. Order action_plan by impact. Include 5-7 action items. Be specific to a senior/staff UX designer with technical skills (React, JS, Swift, HTML/CSS).`
      }],
    })

    const responseText = message.content[0]?.type === 'text' ? message.content[0].text : '{}'

    let parsed
    try {
      parsed = JSON.parse(responseText.replace(/```json\n?|\n?```/g, '').trim())
    } catch {
      throw new Error('Analysis failed to parse. Please try again.')
    }

    res.json(parsed)

  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
