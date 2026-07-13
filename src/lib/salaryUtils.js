function representativeSalary(l) {
  if (l.salary_min && l.salary_max) return (l.salary_min + l.salary_max) / 2
  return l.salary_min || l.salary_max || null
}

function stats(values) {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
  return { n: sorted.length, min: sorted[0], median, max: sorted[sorted.length - 1] }
}

// Benchmarks a listing's compensation against market data from other listings in the
// same role_cluster + seniority_level, relaxing to role_cluster-only if there's too little data.
export function benchmarkSalary(listings, { role_cluster, seniority_level }) {
  const withSalary = (listings || [])
    .map(l => ({ ...l, _value: representativeSalary(l) }))
    .filter(l => l._value != null)

  const sameClusterAndSeniority = withSalary.filter(l =>
    role_cluster && l.role_cluster === role_cluster &&
    seniority_level && l.seniority_level === seniority_level
  )
  if (sameClusterAndSeniority.length >= 2) {
    return stats(sameClusterAndSeniority.map(l => l._value))
  }

  const sameCluster = withSalary.filter(l => role_cluster && l.role_cluster === role_cluster)
  if (sameCluster.length >= 2) {
    return stats(sameCluster.map(l => l._value))
  }

  return null
}
