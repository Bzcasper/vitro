export interface StreamServer {
  id: string;
  name: string;
  priority: number;
  baseUrl: string;
  movieUrl: (tmdbId: string) => string;
  tvUrl: (tmdbId: string, season: number, episode: number) => string;
  features: {
    autoplay?: boolean;
    subtitles?: boolean;
    quality?: string[];
  };
  healthCheck?: {
    url: string;
    timeout: number;
  };
}

export type MediaType = 'movie' | 'tv';

export interface WatchProgress {
  id: number;
  type: MediaType;
  season?: number;
  episode?: number;
  episodeName?: string;
  serverId?: string;
  timestamp?: number;
  lastWatched: number;
}

export const STREAM_SERVERS: StreamServer[] = [
  {
    id: 'vidsrc-cc',
    name: 'VidSrc CC',
    priority: 1,
    baseUrl: 'https://vidsrc.cc',
    movieUrl: (id: string) => `https://vidsrc.cc/v2/embed/movie/${id}`,
    tvUrl: (id: string, s: number, e: number) => `https://vidsrc.cc/v2/embed/tv/${id}/${s}/${e}`,
    features: {
      autoplay: true,
      subtitles: true,
      quality: ['1080p', '720p', '480p']
    },
    healthCheck: {
      url: 'https://vidsrc.cc',
      timeout: 3000
    }
  },
  {
    id: 'embed-su',
    name: 'Embed SU',
    priority: 2,
    baseUrl: 'https://embed.su',
    movieUrl: (id: string) => `https://embed.su/embed/movie/${id}`,
    tvUrl: (id: string, s: number, e: number) => `https://embed.su/embed/tv/${id}/${s}/${e}`,
    features: {
      autoplay: true,
      subtitles: true,
      quality: ['1080p', '720p', '480p']
    },
    healthCheck: {
      url: 'https://embed.su',
      timeout: 3000
    }
  },
  {
    id: 'multiembed',
    name: 'MultiEmbed',
    priority: 3,
    baseUrl: 'https://multiembed.mov',
    movieUrl: (id: string) => `https://multiembed.mov/?video_id=${id}&tmdb=1`,
    tvUrl: (id: string, s: number, e: number) => `https://multiembed.mov/?video_id=${id}&tmdb=1&s=${s}&e=${e}`,
    features: {
      autoplay: true,
      subtitles: true,
      quality: ['1080p', '720p', '480p']
    },
    healthCheck: {
      url: 'https://multiembed.mov',
      timeout: 3000
    }
  },
  {
    id: 'vidsrc-icu',
    name: 'VidSrc ICU',
    priority: 4,
    baseUrl: 'https://vidsrc.icu',
    movieUrl: (id: string) => `https://vidsrc.icu/embed/movie/${id}`,
    tvUrl: (id: string, s: number, e: number) => `https://vidsrc.icu/embed/tv/${id}/${s}/${e}`,
    features: {
      autoplay: true,
      subtitles: true,
      quality: ['1080p', '720p', '480p']
    },
    healthCheck: {
      url: 'https://vidsrc.icu',
      timeout: 3000
    }
  },
  {
    id: 'autoembed',
    name: 'AutoEmbed',
    priority: 5,
    baseUrl: 'https://autoembed.cc',
    movieUrl: (id: string) => `https://autoembed.cc/embed/oplayer.php?id=${id}`,
    tvUrl: (id: string, s: number, e: number) => `https://autoembed.cc/embed/oplayer.php?id=${id}&s=${s}&e=${e}`,
    features: {
      autoplay: true,
      subtitles: true,
      quality: ['1080p', '720p']
    },
    healthCheck: {
      url: 'https://autoembed.cc',
      timeout: 3000
    }
  },
  {
    id: 'vidsrc-xyz',
    name: 'VidSrc XYZ',
    priority: 6,
    baseUrl: 'https://vidsrc.xyz',
    movieUrl: (id: string) => `https://vidsrc.xyz/embed/movie/${id}`,
    tvUrl: (id: string, s: number, e: number) => `https://vidsrc.xyz/embed/tv/${id}/${s}/${e}`,
    features: { autoplay: true, subtitles: true, quality: ['1080p', '720p', '480p'] },
    healthCheck: { url: 'https://vidsrc.xyz', timeout: 3000 }
  },
  {
    id: 'vidsrc-dev',
    name: 'VidSrc Dev',
    priority: 7,
    baseUrl: 'https://vidsrc.dev',
    movieUrl: (id: string) => `https://vidsrc.dev/embed/movie/${id}`,
    tvUrl: (id: string, s: number, e: number) => `https://vidsrc.dev/embed/tv/${id}/${s}/${e}`,
    features: { autoplay: true, subtitles: true, quality: ['1080p', '720p', '480p'] },
    healthCheck: { url: 'https://vidsrc.dev', timeout: 3000 }
  },
  {
    id: '2embed',
    name: '2Embed',
    priority: 8,
    baseUrl: 'https://2embed.cc',
    movieUrl: (id: string) => `https://2embed.cc/embed/${id}`,
    tvUrl: (id: string, s: number, e: number) => `https://2embed.cc/embedtv/${id}&s=${s}&e=${e}`,
    features: { autoplay: true, subtitles: true, quality: ['1080p', '720p'] },
    healthCheck: { url: 'https://2embed.cc', timeout: 3000 }
  },
  {
    id: 'nontongo',
    name: 'NontonGo',
    priority: 9,
    baseUrl: 'https://nontongo.win',
    movieUrl: (id: string) => `https://nontongo.win/embed/movie/${id}`,
    tvUrl: (id: string, s: number, e: number) => `https://nontongo.win/embed/tv/${id}/${s}/${e}`,
    features: { autoplay: true, subtitles: true, quality: ['1080p', '720p'] },
    healthCheck: { url: 'https://nontongo.win', timeout: 3000 }
  },
  {
    id: 'moviesapi',
    name: 'MoviesAPI',
    priority: 10,
    baseUrl: 'https://moviesapi.club',
    movieUrl: (id: string) => `https://moviesapi.club/movie/${id}`,
    tvUrl: (id: string, s: number, e: number) => `https://moviesapi.club/tv/${id}/${s}/${e}`,
    features: { autoplay: true, subtitles: false, quality: ['1080p', '720p'] },
    healthCheck: { url: 'https://moviesapi.club', timeout: 3000 }
  },
  {
    id: 'vidlink',
    name: 'VidLink',
    priority: 11,
    baseUrl: 'https://vidlink.pro',
    movieUrl: (id: string) => `https://vidlink.pro/movie/${id}`,
    tvUrl: (id: string, s: number, e: number) => `https://vidlink.pro/tv/${id}/${s}/${e}`,
    features: { autoplay: true, subtitles: true, quality: ['1080p', '720p', '480p'] },
    healthCheck: { url: 'https://vidlink.pro', timeout: 3000 }
  }
];
