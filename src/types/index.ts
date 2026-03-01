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
  }
];
