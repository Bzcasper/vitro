import { type WatchProgress, type MediaType } from '../types';
import { storageService } from './storageService';

class ApiStorageService {
  private async request<T>(url: string, options?: RequestInit): Promise<T> {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
    return res.json();
  }

  async getWatchProgress(userId?: string): Promise<WatchProgress[]> {
    try {
      const params = userId ? `?userId=${encodeURIComponent(userId)}` : '';
      return await this.request<WatchProgress[]>(`/api/progress${params}`);
    } catch (error) {
      console.error('API getWatchProgress failed, falling back to localStorage:', error);
      return storageService.getWatchProgress();
    }
  }

  async saveWatchProgress(
    progress: Omit<WatchProgress, 'lastWatched'>,
    userId?: string
  ): Promise<void> {
    try {
      const params = userId ? `?userId=${encodeURIComponent(userId)}` : '';
      await this.request(`/api/progress${params}`, {
        method: 'POST',
        body: JSON.stringify(progress),
      });
    } catch (error) {
      console.error('API saveWatchProgress failed, falling back to localStorage:', error);
      storageService.saveWatchProgress(progress);
    }
  }

  async removeWatchProgress(
    id: number,
    type: MediaType,
    userId?: string
  ): Promise<void> {
    try {
      const params = new URLSearchParams({ id: String(id), type });
      if (userId) params.set('userId', userId);
      await this.request(`/api/progress?${params}`, { method: 'DELETE' });
    } catch (error) {
      console.error('API removeWatchProgress failed, falling back to localStorage:', error);
      storageService.removeWatchProgress(id, type);
    }
  }

  async cacheStreamUrls(
    key: string,
    servers: { id: string; url: string }[]
  ): Promise<void> {
    try {
      await this.request('/api/stream-cache', {
        method: 'POST',
        body: JSON.stringify({ key, servers }),
      });
    } catch (error) {
      console.error('API cacheStreamUrls failed:', error);
    }
  }

  async getCachedStreamUrls(
    key: string
  ): Promise<{ id: string; url: string }[] | null> {
    try {
      return await this.request<{ id: string; url: string }[]>(
        `/api/stream-cache?key=${encodeURIComponent(key)}`
      );
    } catch (error) {
      console.error('API getCachedStreamUrls failed:', error);
      return null;
    }
  }

  async requestMuxAsset(
    url: string,
    title: string,
    mediaId: string,
    mediaType: MediaType
  ): Promise<{ playbackId?: string; assetId?: string }> {
    try {
      return await this.request('/api/mux-asset', {
        method: 'POST',
        body: JSON.stringify({ url, title, mediaId, mediaType }),
      });
    } catch (error) {
      console.error('API requestMuxAsset failed:', error);
      return {};
    }
  }

  async getMuxPlayback(
    mediaId: string,
    mediaType: MediaType
  ): Promise<{ playbackId?: string } | null> {
    try {
      const params = new URLSearchParams({ mediaId, mediaType });
      return await this.request<{ playbackId?: string }>(
        `/api/mux-asset?${params}`
      );
    } catch (error) {
      console.error('API getMuxPlayback failed:', error);
      return null;
    }
  }
}

export const apiStorage = new ApiStorageService();
