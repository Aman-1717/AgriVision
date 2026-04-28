const LAT = 'agrivision:lastWeatherLat'
const LON = 'agrivision:lastWeatherLon'

export function persistWeatherCoords(lat: number, lon: number) {
  try {
    sessionStorage.setItem(LAT, String(lat))
    sessionStorage.setItem(LON, String(lon))
  } catch {
    /* private mode / quota */
  }
}

export function readStoredWeatherCoords(): { lat: number; lon: number } | null {
  try {
    const a = sessionStorage.getItem(LAT)
    const b = sessionStorage.getItem(LON)
    if (a == null || b == null) return null
    const lat = Number.parseFloat(a)
    const lon = Number.parseFloat(b)
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
    return { lat, lon }
  } catch {
    return null
  }
}
