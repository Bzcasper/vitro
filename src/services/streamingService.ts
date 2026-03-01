import { STREAM_SERVERS, type StreamServer } from '../types';

const SERVER_HEALTH_KEY = 'vitro_server_health';
const HEALTH_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

interface ServerHealth {
  id: string;
  healthy: boolean;
  latency: number;
  lastChecked: number;
  failCount: number;
}

function getHealthCache(): Record<string, ServerHealth> {
  try {
    const data = localStorage.getItem(SERVER_HEALTH_KEY);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

function saveHealthCache(cache: Record<string, ServerHealth>): void {
  try {
    localStorage.setItem(SERVER_HEALTH_KEY, JSON.stringify(cache));
  } catch {
    // ignore
  }
}

export async function checkServerHealth(server: StreamServer): Promise<ServerHealth> {
  const start = performance.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), server.healthCheck?.timeout || 3000);

    await fetch(server.healthCheck?.url || server.baseUrl, {
      method: 'HEAD',
      mode: 'no-cors',
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const latency = Math.round(performance.now() - start);
    return { id: server.id, healthy: true, latency, lastChecked: Date.now(), failCount: 0 };
  } catch {
    const latency = Math.round(performance.now() - start);
    const cache = getHealthCache();
    const prev = cache[server.id];
    return {
      id: server.id,
      healthy: false,
      latency,
      lastChecked: Date.now(),
      failCount: (prev?.failCount || 0) + 1,
    };
  }
}

export async function checkAllServersHealth(): Promise<ServerHealth[]> {
  const results = await Promise.allSettled(
    STREAM_SERVERS.map((s) => checkServerHealth(s))
  );

  const health: Record<string, ServerHealth> = {};
  for (const result of results) {
    if (result.status === 'fulfilled') {
      health[result.value.id] = result.value;
    }
  }
  saveHealthCache(health);
  return Object.values(health);
}

export function getHealthyServers(): StreamServer[] {
  const cache = getHealthCache();
  const now = Date.now();

  return STREAM_SERVERS
    .filter((s) => {
      const h = cache[s.id];
      // Include if never checked, or healthy, or check is stale
      if (!h) return true;
      if (now - h.lastChecked > HEALTH_CHECK_INTERVAL) return true;
      return h.healthy;
    })
    .sort((a, b) => {
      const ha = cache[a.id];
      const hb = cache[b.id];
      // Sort by latency if both have health data
      if (ha && hb && ha.healthy && hb.healthy) {
        return ha.latency - hb.latency;
      }
      return a.priority - b.priority;
    });
}

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

export async function getStreamUrlWithFailover(
  tmdbId: string,
  type: 'movie' | 'tv',
  season?: number,
  episode?: number,
  preferredServerId?: string
): Promise<{ url: string; server: StreamServer }> {
  // Try preferred server first
  if (preferredServerId) {
    const preferred = STREAM_SERVERS.find(s => s.id === preferredServerId);
    if (preferred) {
      const health = await checkServerHealth(preferred);
      if (health.healthy) {
        return getStreamUrl(tmdbId, type, season, episode, preferredServerId);
      }
    }
  }

  // Fall through healthy servers by priority/latency
  const healthy = getHealthyServers();
  for (const server of healthy) {
    try {
      return getStreamUrl(tmdbId, type, season, episode, server.id);
    } catch {
      continue;
    }
  }

  // Last resort: first server
  return getStreamUrl(tmdbId, type, season, episode);
}

export function getAllServers(): StreamServer[] {
  return STREAM_SERVERS;
}

export function getServerHealth(): Record<string, ServerHealth> {
  return getHealthCache();
}
