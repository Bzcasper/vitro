import { type WatchProgress } from '../types';

class StorageService {
  private readonly PROGRESS_KEY = 'vitro_watch_progress';
  private readonly SERVER_KEY = 'vitro_preferred_server';
  private readonly MAX_HISTORY = 20;

  getWatchProgress(): WatchProgress[] {
    try {
      const data = localStorage.getItem(this.PROGRESS_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error reading watch progress:', error);
      return [];
    }
  }

  saveWatchProgress(progress: Omit<WatchProgress, 'lastWatched'>): void {
    try {
      const allProgress = this.getWatchProgress();
      const existingIndex = allProgress.findIndex(
        (p) => p.id === progress.id && p.type === progress.type
      );

      const newProgress: WatchProgress = {
        ...progress,
        lastWatched: Date.now()
      };

      if (existingIndex !== -1) {
        allProgress[existingIndex] = newProgress;
      } else {
        allProgress.unshift(newProgress);
        if (allProgress.length > this.MAX_HISTORY) {
          allProgress.pop();
        }
      }

      localStorage.setItem(this.PROGRESS_KEY, JSON.stringify(allProgress));
    } catch (error) {
      console.error('Error saving watch progress:', error);
    }
  }

  removeWatchProgress(id: number, type: 'movie' | 'tv'): void {
    try {
      const allProgress = this.getWatchProgress();
      const filtered = allProgress.filter((p) => !(p.id === id && p.type === type));
      localStorage.setItem(this.PROGRESS_KEY, JSON.stringify(filtered));
    } catch (error) {
      console.error('Error removing watch progress:', error);
    }
  }

  clearAllProgress(): void {
    try {
      localStorage.removeItem(this.PROGRESS_KEY);
    } catch (error) {
      console.error('Error clearing watch progress:', error);
    }
  }

  getPreferredServer(): string | null {
    try {
      return localStorage.getItem(this.SERVER_KEY);
    } catch {
      return null;
    }
  }

  setPreferredServer(serverId: string): void {
    try {
      localStorage.setItem(this.SERVER_KEY, serverId);
    } catch (error) {
      console.error('Error saving preferred server:', error);
    }
  }
}

export const storageService = new StorageService();
