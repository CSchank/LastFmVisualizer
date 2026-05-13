const BASE_URL = 'https://ws.audioscrobbler.com/2.0/'

export interface RawTrack {
  name: string
  artist: { '#text': string; mbid: string }
  album: { '#text': string; mbid: string }
  mbid: string
  date?: { uts: string; '#text': string }
  '@attr'?: { nowplaying: string }
  image?: { '#text': string; size: string }[]
}

export interface RecentTracksPage {
  recenttracks: {
    track: RawTrack[]
    '@attr': {
      user: string
      totalPages: string
      total: string
      page: string
      perPage: string
    }
  }
}

export interface UserInfo {
  user: {
    name: string
    playcount: string
    country: string
    registered: { unixtime: string }
    image: { '#text': string; size: string }[]
  }
}

export class LastFmApi {
  constructor(
    private readonly apiKey: string,
    private readonly username: string,
  ) {}

  private async fetch<T>(params: Record<string, string>): Promise<T> {
    const url = new URL(BASE_URL)
    url.searchParams.set('api_key', this.apiKey)
    url.searchParams.set('user', this.username)
    url.searchParams.set('format', 'json')
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v)
    }
    const res = await fetch(url.toString())
    if (!res.ok) throw new Error(`Last.fm API error: ${res.status}`)
    const data = await res.json()
    if (data.error) throw new Error(`Last.fm: ${data.message}`)
    return data as T
  }

  async getUserInfo(): Promise<UserInfo> {
    return this.fetch({ method: 'user.getInfo' })
  }

  async getRecentTracksPage(page: number, from?: number, to?: number): Promise<RecentTracksPage> {
    const params: Record<string, string> = {
      method: 'user.getRecentTracks',
      limit: '200',
      page: String(page),
      extended: '0',
    }
    if (from != null) params.from = String(from)
    if (to != null) params.to = String(to)
    return this.fetch(params)
  }
}
