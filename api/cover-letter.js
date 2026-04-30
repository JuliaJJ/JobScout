// api/cover-letter.js
// Vercel serverless function — generates a tailored cover letter for a specific job listing

import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `You are a career writing coach specializing in UX and product design. Generate compelling, specific cover letters that highlight relevant experience and directly address role requirements. Write in first person, confident and direct. Return ONLY the cover letter text — no subject lines, no metadata, no preamble.`

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { resume, listing } = req.body
  if (!resume || !listing) {
    return res.status(400).json({ error: 'Resume and listing required' })
  }

  const listingContext = [
    `Title: ${listing.title || 'Unknown'}`,
    `Company: ${listing.company || 'Unknown'}`,
    listing.location ? `Location: ${listing.location}` : null,
    listing.seniority_level ? `Seniority: ${listing.seniority_level}` : null,
    listing.parsed_requirements?.length
      ? `Requirements:\n${listing.parsed_requirements.join('\n')}`
      : null,
    listing.parsed_nice_to_haves?.length
      ? `Nice to haves:\n${listing.parsed_nice_to_haves.join('\n')}`
      : null,
    listing.parsed_skills?.length
      ? `Key skills: ${listing.parsed_skills.join(', ')}`
      : null,
    listing.raw_text
      ? `Full job description:\n${listing.raw_text.slice(0, 3000)}`
      : null,
  ].filter(Boolean).join('\n\n')

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1200,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{
        role: 'user',
        content: `Write a cover letter for this role using the candidate's resume.

RESUME:
${resume.slice(0, 4000)}

JOB LISTING:
${listingContext}

Write 3–4 focused paragraphs. Be specific: reference the company by name, connect 2–3 concrete experiences or projects from the resume directly to this role's requirements. Avoid generic opener phrases like "I am excited to apply" or "I believe I would be a strong candidate." Start with a sentence that shows you understand what this role actually needs.`,
      }],
    })

    const text = message.content[0]?.type === 'text' ? message.content[0].text : ''
    if (!text) throw new Error('No response generated. Please try again.')

    res.json({ cover_letter: text })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
