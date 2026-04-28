export type DiseaseHistoryItem = {
  id: string
  at: string
  label: string
  confidence: number
  thumbDataUrl?: string
}

const KEY = 'agrivision:diseaseHistoryV1'
const MAX = 15

export function loadDiseaseHistory(): DiseaseHistoryItem[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (x): x is DiseaseHistoryItem =>
        x != null &&
        typeof x === 'object' &&
        typeof (x as DiseaseHistoryItem).id === 'string' &&
        typeof (x as DiseaseHistoryItem).label === 'string' &&
        typeof (x as DiseaseHistoryItem).confidence === 'number',
    )
  } catch {
    return []
  }
}

export function saveDiseaseHistory(items: DiseaseHistoryItem[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX)))
  } catch {
    /* quota / private mode */
  }
}

export function pushDiseaseHistory(entry: Omit<DiseaseHistoryItem, 'id'> & { id?: string }) {
  const id = entry.id ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
  const row: DiseaseHistoryItem = {
    id,
    at: entry.at,
    label: entry.label,
    confidence: entry.confidence,
    thumbDataUrl: entry.thumbDataUrl,
  }
  const next = [row, ...loadDiseaseHistory().filter((h) => h.id !== id)].slice(0, MAX)
  saveDiseaseHistory(next)
  return next
}

export function clearDiseaseHistory() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}

export async function imageFileToThumbDataUrl(file: File, maxPx = 96, quality = 0.72): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      try {
        const scale = Math.min(maxPx / img.width, maxPx / img.height, 1)
        const w = Math.max(1, Math.round(img.width * scale))
        const h = Math.max(1, Math.round(img.height * scale))
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          URL.revokeObjectURL(url)
          reject(new Error('No canvas context'))
          return
        }
        ctx.drawImage(img, 0, 0, w, h)
        const data = canvas.toDataURL('image/jpeg', quality)
        URL.revokeObjectURL(url)
        resolve(data)
      } catch (e) {
        URL.revokeObjectURL(url)
        reject(e)
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Image load failed'))
    }
    img.src = url
  })
}
