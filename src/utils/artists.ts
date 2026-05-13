// Splits "Taylor Swift feat. Ed Sheeran & Future" → ["Taylor Swift", "Ed Sheeran", "Future"]
// Uses rawArtists (all artist strings in your DB) to protect band names like "Iron & Wine":
// if the left side of a "&" is a known artist, that "&" is a collaborator separator.

const FEAT_RE = /\s+(?:feat\.?|ft\.?|featuring|with)\s+/i
const X_RE = /\s+x\s+/i

function splitAmpersand(str: string, raw: Set<string>): string[] {
  const idx = str.lastIndexOf(' & ')
  if (idx === -1) return [str]

  const left = str.slice(0, idx).trim()
  const right = str.slice(idx + 3).trim()

  if (raw.has(left)) {
    // Left side is a known artist — this & is a collaborator separator
    return [...splitAmpersand(left, raw), ...splitAmpersand(right, raw)]
  }
  if (raw.has(str)) {
    // Full string is a known artist (e.g. "Iron & Wine") — don't split
    return [str]
  }
  // Unknown on both sides — split anyway (handles e.g. "Marshmello & Jonas Brothers"
  // when neither appears as-is in rawArtists alone)
  return [left, ...splitAmpersand(right, raw)]
}

export function splitArtists(artist: string, raw: Set<string>): string[] {
  // Split on feat./ft./featuring/with and x
  const byFeat = artist.split(FEAT_RE)
  const parts: string[] = []
  for (const p of byFeat) {
    // also split on " x " (case-insensitive)
    parts.push(...p.split(X_RE))
  }

  const [primaryRaw, ...featureParts] = parts
  const primary = primaryRaw.trim()

  const results: string[] = splitAmpersand(primary, raw)

  for (const feat of featureParts) {
    // Feature artists: split on & and comma more aggressively
    const byAmp = splitAmpersand(feat.trim(), raw)
    for (const part of byAmp) {
      results.push(...part.split(/\s*,\s*/).map(s => s.trim()).filter(Boolean))
    }
  }

  return [...new Set(results.filter(Boolean))]
}

export function buildRawArtistSet(scrobbles: { artist: string }[]): Set<string> {
  return new Set(scrobbles.map(s => s.artist))
}
