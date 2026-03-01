import { STREAM_SERVERS, type StreamServer } from '../types';

export function getStreamUrl(
  tmdbId: string,
  type: 'movie' | 'tv',
  season?: number,
  episode?: number,
  serverId?: string
): { url: string; server: StreamServer } {
  const server = serverId
    ? STREAM_SERVERS.find(s => s.id === serverId) ?? STREAM_SERVERS[0]
    : STREAM_SERVERS[0];

  let url: string;
  if (type === 'movie') {
    url = server.movieUrl(tmdbId);
  } else if (type === 'tv' && season !== undefined && episode !== undefined) {
    url = server.tvUrl(tmdbId, season, episode);
  } else {
    throw new Error('Invalid parameters for TV show stream');
  }

  return { url, server };
}

export function getAllServers(): StreamServer[] {
  return STREAM_SERVERS;
}
