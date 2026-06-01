// Last.fm stopped serving real artist/album images in 2019; their APIs now
// return this placeholder star hash for missing artwork. Treat it as "no image".
export const LASTFM_PLACEHOLDER = '2a96cbd8b46e442fc41c2b86b821562f'

export function isLastFmPlaceholder(url: string | null | undefined): boolean {
  return !!url && url.includes(LASTFM_PLACEHOLDER)
}
