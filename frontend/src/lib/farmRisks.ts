import type { DiseaseHistoryItem } from './diseaseHistory'

export type RiskLevel = 'low' | 'moderate' | 'elevated'

export function computeDiseaseRisks(history: DiseaseHistoryItem[]): {
  level: RiskLevel
  flagKeys: ('repeatPattern' | 'lowConfidence')[]
} {
  const flagKeys: ('repeatPattern' | 'lowConfidence')[] = []
  if (history.length === 0) {
    return { level: 'low', flagKeys: [] }
  }

  const now = Date.now()
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000
  const recent = history.filter((h) => new Date(h.at).getTime() >= weekAgo)
  const labels = new Map<string, number>()
  for (const h of recent) {
    const n = h.label.toLowerCase()
    labels.set(n, (labels.get(n) ?? 0) + 1)
  }
  for (const [label, c] of labels) {
    if (c >= 2 && !label.includes('health')) {
      if (!flagKeys.includes('repeatPattern')) flagKeys.push('repeatPattern')
      break
    }
  }

  const lowConf = history.filter((h) => h.confidence < 55 && !/health/i.test(h.label))
  if (lowConf.length > 0) {
    flagKeys.push('lowConfidence')
  }

  const unhealthy = recent.filter((h) => !/health/i.test(h.label))
  let level: RiskLevel = 'low'
  if (unhealthy.length >= 4 || flagKeys.includes('repeatPattern')) {
    level = 'elevated'
  } else if (unhealthy.length >= 2 || flagKeys.length > 0) {
    level = 'moderate'
  }

  return { level, flagKeys }
}

export function countByLabel(history: DiseaseHistoryItem[]) {
  const m = new Map<string, number>()
  for (const h of history) {
    m.set(h.label, (m.get(h.label) ?? 0) + 1)
  }
  return [...m.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
}

export function historyTimeline(history: DiseaseHistoryItem[]) {
  const byDay = new Map<string, number>()
  for (const h of history) {
    const d = new Date(h.at)
    if (Number.isNaN(d.getTime())) continue
    const key = d.toISOString().slice(0, 10)
    byDay.set(key, (byDay.get(key) ?? 0) + 1)
  }
  return [...byDay.entries()]
    .map(([date, checks]) => ({ date, checks }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-30)
}
