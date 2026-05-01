export function serialize(s) {
  const parts = []

  if (s.summary?.trim()) {
    parts.push('SUMMARY\n\n' + s.summary.trim())
  }

  if (s.experience?.length) {
    const lines = s.experience.map(e => {
      const header = [e.title, e.company, e.location].filter(Boolean).join(' · ')
      const dates = e.current ? `${e.startDate} – Present` : [e.startDate, e.endDate].filter(Boolean).join(' – ')
      const bullets = (e.bullets || []).filter(Boolean).map(b => `• ${b}`).join('\n')
      return [header, dates, bullets].filter(Boolean).join('\n')
    }).join('\n\n')
    parts.push('EXPERIENCE\n\n' + lines)
  }

  if (s.education?.length) {
    const lines = s.education.map(e => {
      const degField = [e.degree, e.field].filter(Boolean).join(' in ')
      const instYear = [e.institution, e.graduationYear].filter(Boolean).join(', ')
      return [degField, instYear].filter(Boolean).join('\n')
    }).join('\n\n')
    parts.push('EDUCATION\n\n' + lines)
  }

  if (s.skills?.length) {
    const lines = s.skills
      .filter(g => g.category || g.items?.length)
      .map(g => `${g.category}: ${(g.items || []).join(', ')}`)
      .join('\n')
    if (lines) parts.push('SKILLS\n\n' + lines)
  }

  if (s.certifications?.length) {
    const lines = s.certifications
      .filter(c => c.name)
      .map(c => `${c.name}${c.issuer ? ' — ' + c.issuer : ''}${c.year ? ` (${c.year})` : ''}`)
      .join('\n')
    if (lines) parts.push('CERTIFICATIONS\n\n' + lines)
  }

  return parts.join('\n\n──────────────────\n\n')
}
