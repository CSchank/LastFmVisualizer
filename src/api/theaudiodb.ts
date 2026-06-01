const AUDIODB_BASE = 'https://www.theaudiodb.com/api/v1/json'
const TEST_API_KEY = '2'

export async function fetchArtistImageFromAudioDb(artist: string): Promise<string | null> {
  const url = `${AUDIODB_BASE}/${TEST_API_KEY}/search.php?s=${encodeURIComponent(artist)}`
  const response = await fetch(url)
  if (!response.ok) return null

  const data = await response.json()
  const match = data.artists?.[0]
  if (!match) return null

  return match.strArtistThumb || match.strArtistFanart || null
}
