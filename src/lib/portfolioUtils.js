// Only show pieces explicitly tagged to the given role cluster.
// If there's no cluster to match against, or a piece has no clusters set, treat it as relevant.
export function filterRelevantPortfolio(pieces, roleCluster) {
  return (pieces || []).filter(p =>
    !roleCluster || !p.role_clusters?.length || p.role_clusters.includes(roleCluster)
  )
}
