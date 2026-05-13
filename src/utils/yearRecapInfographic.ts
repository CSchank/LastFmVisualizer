interface TopArtistRecap {
  name: string
  plays: number
  imageDataUrl?: string | null
}

interface TopAlbumRecap {
  name: string
  plays: number
  imageDataUrl?: string | null
}

export interface YearRecapInfographicData {
  year: number
  totalPlays: number
  activeDays: number
  uniqueArtists: number
  uniqueAlbums: number
  uniqueTracks: number
  topArtists: TopArtistRecap[]
  topTracks?: { name: string; plays: number }[]
  topAlbum?: TopAlbumRecap
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function truncate(value: string, maxChars: number): string {
  if (value.length <= maxChars) return value
  return `${value.slice(0, Math.max(0, maxChars - 1))}…`
}

const RANK_COLORS = ['#f59e0b', '#94a3b8', '#b45309', '#6b7280', '#6b7280']

const W = 1200
const H = 1080

export function buildSvg(data: YearRecapInfographicData, preview = false): string {
  const topArtists = data.topArtists.slice(0, 5)
  const topTracks = (data.topTracks ?? []).slice(0, 5)

  const maxArtistPlays = topArtists[0]?.plays ?? 1
  const maxTrackPlays = topTracks[0]?.plays ?? 1

  // ── defs: clip paths for circular artist images and rounded album art ────
  const ARTIST_IMG_CX = 128
  const ARTIST_IMG_R = 36
  const CONTENT_Y = 332

  const artistClipPaths = topArtists
    .map((a, i) => {
      if (!a.imageDataUrl) return ''
      const cy = CONTENT_Y + i * 108 + 44
      return `<clipPath id="ac${i}"><circle cx="${ARTIST_IMG_CX}" cy="${cy}" r="${ARTIST_IMG_R}"/></clipPath>`
    })
    .join('')

  const ALBUM_IMG_X = 644
  const ALBUM_IMG_Y = 720
  const ALBUM_IMG_W = 148
  const ALBUM_IMG_H = 148
  const albumClipPath = data.topAlbum?.imageDataUrl
    ? `<clipPath id="albumClip"><rect x="${ALBUM_IMG_X}" y="${ALBUM_IMG_Y}" width="${ALBUM_IMG_W}" height="${ALBUM_IMG_H}" rx="10"/></clipPath>`
    : ''

  // ── stats row ────────────────────────────────────────────────────────────
  const stats = [
    { label: 'Plays', value: data.totalPlays.toLocaleString() },
    { label: 'Active Days', value: data.activeDays.toLocaleString() },
    { label: 'Artists', value: data.uniqueArtists.toLocaleString() },
    { label: 'Albums', value: data.uniqueAlbums.toLocaleString() },
    { label: 'Tracks', value: data.uniqueTracks.toLocaleString() },
  ]
  const STAT_W = 214
  const STAT_GAP = 10
  const STAT_START_X = Math.round((W - (stats.length * STAT_W + (stats.length - 1) * STAT_GAP)) / 2)

  const statCards = stats
    .map((s, i) => {
      const x = STAT_START_X + i * (STAT_W + STAT_GAP)
      return `
      <rect x="${x}" y="178" width="${STAT_W}" height="100" rx="14" fill="#ffffff"/>
      <text x="${x + STAT_W / 2}" y="232" font-size="36" font-weight="800" fill="#111827" text-anchor="middle" font-family="system-ui,sans-serif">${escapeXml(s.value)}</text>
      <text x="${x + STAT_W / 2}" y="258" font-size="13" fill="#9ca3af" text-anchor="middle" font-family="system-ui,sans-serif">${escapeXml(s.label)}</text>`
    })
    .join('')

  // ── artist cards (left column x=30..574) ────────────────────────────────
  const ARTIST_TEXT_X = 178
  const ARTIST_BAR_MAX_W = 544 - (ARTIST_TEXT_X - 30) - 30

  const artistCards = topArtists
    .map((a, i) => {
      const cardY = CONTENT_Y + i * 108
      const cy = cardY + 44
      const rankColor = RANK_COLORS[i] ?? '#6b7280'
      const barW = Math.max(4, Math.round((a.plays / maxArtistPlays) * ARTIST_BAR_MAX_W))

      const img = a.imageDataUrl
        ? `<image href="${escapeXml(a.imageDataUrl)}" x="${ARTIST_IMG_CX - ARTIST_IMG_R}" y="${cy - ARTIST_IMG_R}" width="${ARTIST_IMG_R * 2}" height="${ARTIST_IMG_R * 2}" preserveAspectRatio="xMidYMid slice" clip-path="url(#ac${i})"/>`
        : `<circle cx="${ARTIST_IMG_CX}" cy="${cy}" r="${ARTIST_IMG_R}" fill="#fca5a5"/>`

      return `
      <rect x="30" y="${cardY}" width="544" height="88" rx="12" fill="#ffffff"/>
      <circle cx="62" cy="${cy}" r="20" fill="${rankColor}"/>
      <text x="62" y="${cy + 6}" font-size="14" font-weight="700" fill="#ffffff" text-anchor="middle" font-family="system-ui,sans-serif">${i + 1}</text>
      <circle cx="${ARTIST_IMG_CX}" cy="${cy}" r="${ARTIST_IMG_R}" fill="#f3f4f6"/>
      ${img}
      <text x="${ARTIST_TEXT_X}" y="${cardY + 27}" font-size="16" font-weight="700" fill="#111827" font-family="system-ui,sans-serif">${escapeXml(truncate(a.name, 28))}</text>
      <text x="${ARTIST_TEXT_X}" y="${cardY + 47}" font-size="12" fill="#9ca3af" font-family="system-ui,sans-serif">${a.plays.toLocaleString()} plays</text>
      <rect x="${ARTIST_TEXT_X}" y="${cardY + 61}" width="${ARTIST_BAR_MAX_W}" height="6" rx="3" fill="#f3f4f6"/>
      <rect x="${ARTIST_TEXT_X}" y="${cardY + 61}" width="${barW}" height="6" rx="3" fill="#ef4444"/>`
    })
    .join('')

  // ── track rows (right column x=626..1170) ────────────────────────────────
  const TRACK_BADGE_CX = 652
  const TRACK_TEXT_X = 680
  const TRACK_BAR_MAX_W = 1170 - TRACK_TEXT_X - 20

  const trackRows = topTracks
    .map((t, i) => {
      const rowY = CONTENT_Y + i * 72
      const rankColor = RANK_COLORS[i] ?? '#6b7280'
      const barW = Math.max(4, Math.round((t.plays / maxTrackPlays) * TRACK_BAR_MAX_W))
      const namePart = t.name.split(' — ')[0] ?? t.name
      const artistPart = t.name.split(' — ').slice(1).join(' — ')

      return `
      <rect x="626" y="${rowY}" width="544" height="62" rx="12" fill="#ffffff"/>
      <circle cx="${TRACK_BADGE_CX}" cy="${rowY + 31}" r="16" fill="${rankColor}"/>
      <text x="${TRACK_BADGE_CX}" y="${rowY + 36}" font-size="13" font-weight="700" fill="#ffffff" text-anchor="middle" font-family="system-ui,sans-serif">${i + 1}</text>
      <text x="${TRACK_TEXT_X}" y="${rowY + 19}" font-size="14" font-weight="700" fill="#111827" font-family="system-ui,sans-serif">${escapeXml(truncate(namePart, 38))}</text>
      <text x="${TRACK_TEXT_X}" y="${rowY + 36}" font-size="12" fill="#9ca3af" font-family="system-ui,sans-serif">${escapeXml(truncate(artistPart, 38))}</text>
      <rect x="${TRACK_TEXT_X}" y="${rowY + 47}" width="${TRACK_BAR_MAX_W}" height="5" rx="2.5" fill="#f3f4f6"/>
      <rect x="${TRACK_TEXT_X}" y="${rowY + 47}" width="${barW}" height="5" rx="2.5" fill="#ef4444"/>
      <text x="1150" y="${rowY + 36}" font-size="11" fill="#d1d5db" text-anchor="end" font-family="system-ui,sans-serif">${t.plays.toLocaleString()}</text>`
    })
    .join('')

  // ── top album (right column, below tracks) ───────────────────────────────
  // 5 track rows: CONTENT_Y + 4*72 + 62 = 332 + 288 + 62 = 682. Album starts at 698.
  const ALBUM_CARD_Y = CONTENT_Y + 5 * 72 + 14
  const albumTitle = data.topAlbum?.name.split(' — ')[0] ?? data.topAlbum?.name ?? ''
  const albumArtist = data.topAlbum?.name.split(' — ').slice(1).join(' — ') ?? ''

  const topAlbumSection = data.topAlbum
    ? `
      <rect x="626" y="${ALBUM_CARD_Y}" width="544" height="250" rx="14" fill="#ffffff"/>
      <text x="644" y="${ALBUM_CARD_Y + 28}" font-size="11" font-weight="700" fill="#9ca3af" letter-spacing="1.5" font-family="system-ui,sans-serif">TOP ALBUM</text>
      <rect x="${ALBUM_IMG_X}" y="${ALBUM_IMG_Y}" width="${ALBUM_IMG_W}" height="${ALBUM_IMG_H}" rx="10" fill="#fecaca"/>
      ${data.topAlbum.imageDataUrl
        ? `<image href="${escapeXml(data.topAlbum.imageDataUrl)}" x="${ALBUM_IMG_X}" y="${ALBUM_IMG_Y}" width="${ALBUM_IMG_W}" height="${ALBUM_IMG_H}" preserveAspectRatio="xMidYMid slice" clip-path="url(#albumClip)"/>`
        : ''
      }
      <text x="810" y="${ALBUM_IMG_Y + 46}" font-size="18" font-weight="800" fill="#111827" font-family="system-ui,sans-serif">${escapeXml(truncate(albumTitle, 22))}</text>
      <text x="810" y="${ALBUM_IMG_Y + 70}" font-size="13" fill="#6b7280" font-family="system-ui,sans-serif">${escapeXml(truncate(albumArtist, 26))}</text>
      <text x="810" y="${ALBUM_IMG_Y + 98}" font-size="13" fill="#ef4444" font-weight="600" font-family="system-ui,sans-serif">${data.topAlbum.plays.toLocaleString()} plays</text>`
    : ''

  const svgAttrs = preview
    ? `viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block"`
    : `width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"`
  return `<svg xmlns="http://www.w3.org/2000/svg" ${svgAttrs}>
  <defs>
    <linearGradient id="hdr" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#7f1d1d"/>
      <stop offset="100%" stop-color="#dc2626"/>
    </linearGradient>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#fef2f2"/>
      <stop offset="100%" stop-color="#f3f4f6"/>
    </linearGradient>
    ${artistClipPaths}
    ${albumClipPath}
  </defs>

  <rect width="${W}" height="${H}" fill="url(#bg)"/>

  <!-- Header -->
  <rect width="${W}" height="162" fill="url(#hdr)"/>
  <circle cx="${W - 60}" cy="30" r="90" fill="#ffffff" fill-opacity="0.06"/>
  <circle cx="${W - 20}" cy="100" r="55" fill="#ffffff" fill-opacity="0.05"/>
  <text x="52" y="94" font-size="66" font-weight="800" fill="#ffffff" font-family="system-ui,sans-serif">${data.year}</text>
  <text x="52" y="138" font-size="28" font-weight="300" fill="#fca5a5" font-family="system-ui,sans-serif">Year in Review</text>
  <text x="${W - 44}" y="138" font-size="13" fill="#fca5a5" text-anchor="end" font-family="system-ui,sans-serif">Last.fm Visualizer</text>

  <!-- Stats -->
  ${statCards}

  <!-- Section labels -->
  <text x="30" y="318" font-size="11" font-weight="700" fill="#9ca3af" letter-spacing="1.5" font-family="system-ui,sans-serif">TOP ARTISTS</text>
  <text x="626" y="318" font-size="11" font-weight="700" fill="#9ca3af" letter-spacing="1.5" font-family="system-ui,sans-serif">TOP TRACKS</text>

  <!-- Artist cards -->
  ${artistCards}

  <!-- Track rows -->
  ${trackRows}

  <!-- Top album -->
  ${topAlbumSection}

  <!-- Footer -->
  <text x="${W / 2}" y="${H - 22}" font-size="12" fill="#d1d5db" text-anchor="middle" font-family="system-ui,sans-serif">Generated by Last.fm Visualizer · ${data.year}</text>
</svg>`
}

export async function imageUrlToDataUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      console.warn(`Infographic image fetch failed (${response.status}): ${url}`)
      return null
    }
    const blob = await response.blob()
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(String(reader.result))
      reader.onerror = () => reject(new Error(`Could not read image blob for ${url}`))
      reader.readAsDataURL(blob)
    })
  } catch (error) {
    console.warn(`Infographic image fetch failed: ${url}`, error)
    return null
  }
}

export async function downloadYearRecapInfographicPng(data: YearRecapInfographicData): Promise<void> {
  const svgText = buildSvg(data)
  const svgBlob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' })
  const svgUrl = URL.createObjectURL(svgBlob)
  const image = new Image()

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () => reject(new Error('Could not render infographic SVG.'))
    image.src = svgUrl
  })

  const scale = 2
  const canvas = document.createElement('canvas')
  canvas.width = W * scale
  canvas.height = H * scale
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    URL.revokeObjectURL(svgUrl)
    throw new Error('Could not initialize canvas for infographic export.')
  }
  ctx.scale(scale, scale)
  ctx.drawImage(image, 0, 0, W, H)

  const pngBlob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(blob => {
      if (!blob) {
        reject(new Error('Could not encode infographic PNG.'))
        return
      }
      resolve(blob)
    }, 'image/png')
  })

  URL.revokeObjectURL(svgUrl)

  const pngUrl = URL.createObjectURL(pngBlob)
  const a = document.createElement('a')
  a.href = pngUrl
  a.download = `lastfm-recap-${data.year}.png`
  a.click()
  URL.revokeObjectURL(pngUrl)
}
