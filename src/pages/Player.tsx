import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ChevronLeft, ChevronRight, Star, Calendar,
  Film, Tv, Server, ChevronDown, ExternalLink, RefreshCw, Download
} from 'lucide-react';

import { CastButton } from '../components/CastButton';
import { MobilePlayer } from '../components/MobilePlayer';
import { tmdbService, type TMDBMedia, type TMDBTVShow, type TMDBEpisode } from '../services/tmdbService';
import { getStreamUrl, getAllServers, checkAllServersHealth, getServerHealth } from '../services/streamingService';
import { apiStorage } from '../services/apiStorageService';
import { storageService } from '../services/storageService';
import { cn } from '../lib/utils';

export default function Player() {
  const { type, id } = useParams<{ type: 'movie' | 'tv'; id: string }>();
  const navigate = useNavigate();

  const [media, setMedia] = useState<TMDBMedia | TMDBTVShow | null>(null);
  const [loading, setLoading] = useState(true);
  const [streamUrl, setStreamUrl] = useState('');
  const [muxPlaybackId, setMuxPlaybackId] = useState<string | undefined>();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const [downloading, setDownloading] = useState(false);

  const servers = getAllServers();
  const [selectedServerId, setSelectedServerId] = useState<string>(
    () => storageService.getPreferredServer() || servers[0].id
  );
  const [showServerSelector, setShowServerSelector] = useState(false);

  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const [selectedEpisode, setSelectedEpisode] = useState<number>(1);
  const [episodes, setEpisodes] = useState<TMDBEpisode[]>([]);
  const [showEpisodeList, setShowEpisodeList] = useState(false);

  const [serverHealthMap, setServerHealthMap] = useState<Record<string, { healthy: boolean; latency: number }>>(getServerHealth());

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Run health checks on mount
  useEffect(() => {
    checkAllServersHealth().then((results) => {
      const map: Record<string, { healthy: boolean; latency: number }> = {};
      for (const r of results) map[r.id] = { healthy: r.healthy, latency: r.latency };
      setServerHealthMap(map);
    });
  }, []);

  // Track viewport for mobile detection
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Load media details
  useEffect(() => {
    const loadMedia = async () => {
      if (!id || !type) return;
      setLoading(true);
      try {
        let mediaData: TMDBMedia | TMDBTVShow;
        if (type === 'movie') {
          mediaData = await tmdbService.getMovieDetails(Number(id));
        } else {
          mediaData = await tmdbService.getTVShowDetails(Number(id));
          const progress = await apiStorage.getWatchProgress();
          const saved = progress.find(p => p.id === Number(id) && p.type === 'tv');
          if (saved?.season && saved?.episode) {
            setSelectedSeason(saved.season);
            setSelectedEpisode(saved.episode);
          }
        }
        setMedia(mediaData);

        // Check for Mux playback
        const mux = await apiStorage.getMuxPlayback(id, type);
        if (mux?.playbackId) setMuxPlaybackId(mux.playbackId);
      } catch (error) {
        console.error('Error loading media:', error);
      } finally {
        setLoading(false);
      }
    };
    loadMedia();
  }, [id, type]);

  // Load episodes
  useEffect(() => {
    if (type !== 'tv' || !id) return;
    const loadEpisodes = async () => {
      try {
        const seasonData = await tmdbService.getSeasonDetails(Number(id), selectedSeason);
        setEpisodes(seasonData.episodes);
      } catch (error) {
        console.error('Error loading episodes:', error);
      }
    };
    loadEpisodes();
  }, [type, id, selectedSeason]);

  // Build stream URL + save progress + cache in Redis
  useEffect(() => {
    if (!id || !type) return;

    const { url } = getStreamUrl(
      id, type,
      type === 'tv' ? selectedSeason : undefined,
      type === 'tv' ? selectedEpisode : undefined,
      selectedServerId
    );
    setStreamUrl(url);

    // Cache stream URL in Redis
    const cacheKey = type === 'movie' ? `movie_${id}` : `tv_${id}_${selectedSeason}_${selectedEpisode}`;
    apiStorage.cacheStreamUrls(cacheKey, [{ id: selectedServerId, url }]);

    // Save progress to Redis (with server memory)
    if (type === 'movie') {
      apiStorage.saveWatchProgress({ id: Number(id), type: 'movie', serverId: selectedServerId });
    } else {
      const ep = episodes.find(e => e.episode_number === selectedEpisode);
      apiStorage.saveWatchProgress({
        id: Number(id),
        type: 'tv',
        season: selectedSeason,
        episode: selectedEpisode,
        episodeName: ep?.name,
        serverId: selectedServerId,
      });
    }
  }, [id, type, selectedSeason, selectedEpisode, episodes, selectedServerId]);

  // Keyboard nav
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement === iframeRef.current) return;
      switch (e.key) {
        case 'ArrowLeft':
          if (type === 'tv') { e.preventDefault(); handleEpisodeChange('prev'); }
          break;
        case 'ArrowRight':
          if (type === 'tv') { e.preventDefault(); handleEpisodeChange('next'); }
          break;
        case 'Escape':
        case 'Backspace':
          e.preventDefault();
          navigate('/');
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [type, episodes, selectedEpisode, navigate]);

  const handleEpisodeChange = useCallback((direction: 'prev' | 'next') => {
    if (type !== 'tv') return;
    const idx = episodes.findIndex(e => e.episode_number === selectedEpisode);
    if (idx === -1) return;
    if (direction === 'prev' && idx > 0) setSelectedEpisode(episodes[idx - 1].episode_number);
    else if (direction === 'next' && idx < episodes.length - 1) setSelectedEpisode(episodes[idx + 1].episode_number);
  }, [type, episodes, selectedEpisode]);

  const handleServerChange = useCallback((serverId: string) => {
    setSelectedServerId(serverId);
    storageService.setPreferredServer(serverId);
    setShowServerSelector(false);
  }, []);

  const handleDownload = useCallback(async () => {
    if (!streamUrl || !media || downloading) return;
    setDownloading(true);
    try {
      const title = tmdbService.getTitle(media);
      const filename = `${title.replace(/[^a-zA-Z0-9]/g, '_')}_${id}`.toLowerCase();
      const res = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: streamUrl, filename }),
      });
      if (res.ok) {
        const data = await res.json();
        const downloads = JSON.parse(localStorage.getItem('vitro_downloads') || '[]');
        downloads.unshift({
          filename, url: data.url, title,
          mediaId: id, mediaType: type,
          downloadedAt: Date.now(),
        });
        localStorage.setItem('vitro_downloads', JSON.stringify(downloads));
      }
    } catch (error) {
      console.error('Download failed:', error);
    } finally {
      setDownloading(false);
    }
  }, [streamUrl, media, downloading, id, type]);

  const _handleRequestMux = useCallback(async () => {
    if (!streamUrl || !id || !type || !media) return;
    const title = tmdbService.getTitle(media);
    const result = await apiStorage.requestMuxAsset(streamUrl, title, id, type);
    if (result.playbackId) setMuxPlaybackId(result.playbackId);
  }, [streamUrl, id, type, media]);
  void _handleRequestMux;

  if (loading || !media) {
    return (
      <div className="min-h-screen w-full relative overflow-hidden flex items-center justify-center">
        <div className="relative z-10 glass p-8 rounded-2xl">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  const title = tmdbService.getTitle(media);
  const year = tmdbService.getYear(media);
  const posterUrl = tmdbService.getPosterUrl(media.poster_path);
  const currentEpisode = episodes.find(e => e.episode_number === selectedEpisode);
  const currentServer = servers.find(s => s.id === selectedServerId);
  const epIdx = episodes.findIndex(e => e.episode_number === selectedEpisode);

  // Mobile: full-screen player
  if (isMobile) {
    return (
      <MobilePlayer
        streamUrl={streamUrl}
        title={title}
        subtitle={currentEpisode ? `S${selectedSeason} E${selectedEpisode}: ${currentEpisode.name}` : year}
        onBack={() => navigate('/')}
        onNext={type === 'tv' && epIdx < episodes.length - 1 ? () => handleEpisodeChange('next') : undefined}
        onPrev={type === 'tv' && epIdx > 0 ? () => handleEpisodeChange('prev') : undefined}
        muxPlaybackId={muxPlaybackId}
      />
    );
  }

  // Desktop layout
  return (
    <div ref={containerRef} className="min-h-screen w-full relative overflow-hidden">
      <div className="min-h-screen flex flex-col p-4 sm:p-6 lg:p-8">
        {/* Top Bar */}
        <div className="mb-4 flex items-center justify-between gap-4 flex-wrap">
          <button
            onClick={() => navigate('/')}
            className="tv-focusable inline-flex items-center gap-2 glass glass-hover px-4 py-2 rounded-full transition-all duration-300 hover:scale-105"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>

          <div className="flex items-center gap-2">
            <CastButton streamUrl={streamUrl} />

            <button
              onClick={handleDownload}
              disabled={downloading}
              className="tv-focusable inline-flex items-center gap-2 glass glass-hover px-4 py-2 rounded-full transition-all duration-300 hover:scale-105 disabled:opacity-50"
            >
              <Download className={cn("w-4 h-4", downloading && "animate-bounce")} />
              <span className="text-sm">{downloading ? 'Saving...' : 'Save'}</span>
            </button>

            {/* Server Selector */}
            <div className="relative">
              <button
                onClick={() => setShowServerSelector(!showServerSelector)}
                className="tv-focusable inline-flex items-center gap-2 glass glass-hover px-4 py-2 rounded-full transition-all duration-300 hover:scale-105"
              >
                <Server className="w-4 h-4" />
                <span className="text-sm">{currentServer?.name || 'Server'}</span>
                <ChevronDown className={cn("w-4 h-4 transition-transform", showServerSelector && "rotate-180")} />
              </button>

              {showServerSelector && (
                <div className="absolute top-full mt-2 right-0 min-w-[240px] glass rounded-2xl p-3 z-50">
                  <p className="text-xs text-muted-foreground mb-2 px-2">Switch if video doesn't load</p>
                  {servers.map((server) => {
                    const health = serverHealthMap[server.id];
                    return (
                      <button
                        key={server.id}
                        onClick={() => handleServerChange(server.id)}
                        className={cn(
                          "tv-focusable w-full text-left px-3 py-2 rounded-lg glass-hover transition-all duration-300 text-sm flex items-center gap-2",
                          selectedServerId === server.id && "bg-primary/30 border-primary/50"
                        )}
                      >
                        <span className={cn(
                          "w-2 h-2 rounded-full flex-shrink-0",
                          health ? (health.healthy ? "bg-green-400" : "bg-red-400") : "bg-gray-400"
                        )} />
                        <Server className="w-3 h-3" />
                        {server.name}
                        {health?.healthy && <span className="text-xs text-muted-foreground">{health.latency}ms</span>}
                        {selectedServerId === server.id && <span className="ml-auto text-xs text-primary">Active</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 max-w-7xl mx-auto w-full">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Sidebar */}
            <div className="lg:col-span-1 space-y-6 order-2 lg:order-1">
              <div className="glass rounded-2xl p-6 space-y-4">
                <img src={posterUrl} alt={title} className="w-full rounded-xl shadow-2xl" />
                <div className="space-y-2">
                  <h1 className="text-2xl font-display font-bold text-white">{title}</h1>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {type === 'movie' ? <Film className="w-4 h-4" /> : <Tv className="w-4 h-4" />}
                    <span>{type === 'movie' ? 'Movie' : 'TV Show'}</span>
                    <span>•</span>
                    <Calendar className="w-4 h-4" />
                    <span>{year}</span>
                  </div>
                  {media.vote_average > 0 && (
                    <div className="flex items-center gap-2">
                      <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                      <span className="text-lg font-semibold">{media.vote_average.toFixed(1)}</span>
                      <span className="text-sm text-muted-foreground">/ 10</span>
                    </div>
                  )}
                  <p className="text-sm text-muted-foreground leading-relaxed">{media.overview}</p>
                </div>
              </div>
              
              {/* TV Casting Instructions */}
              <div className="glass rounded-2xl p-4 space-y-3">
                <h3 className="font-semibold text-white flex items-center gap-2">
                  <Tv className="w-4 h-4" />
                  Cast to TCL TV
                </h3>
                <div className="text-sm text-muted-foreground space-y-2">
                  <p>Streaming to TCL TV at 10.0.0.21:2506</p>
                  <ul className="list-disc list-inside space-y-1 text-xs">
                    <li>Click cast button to connect</li>
                    <li>Uses Presentation API for direct TV connection</li>
                    <li>Fallback: Open in new tab for manual casting</li>
                  </ul>
                </div>
              </div>

              {type === 'tv' && 'seasons' in media && (
                <div className="glass rounded-2xl p-6">
                  <h3 className="font-semibold mb-4">Seasons</h3>
                  <div className="grid grid-cols-3 gap-2">
                    {media.seasons.filter(s => s.season_number > 0).map((season) => (
                      <button
                        key={season.id}
                        onClick={() => { setSelectedSeason(season.season_number); setSelectedEpisode(1); }}
                        className={cn(
                          "tv-focusable px-4 py-2 rounded-lg glass glass-hover transition-all duration-300",
                          selectedSeason === season.season_number && "bg-primary/30 border-primary/50"
                        )}
                      >
                        S{season.season_number}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Player */}
            <div className="lg:col-span-2 space-y-6 order-1 lg:order-2">
              <div className="glass rounded-2xl overflow-hidden">
                <div className="relative aspect-video bg-black">
                  {streamUrl ? (
                    <iframe
                      ref={iframeRef}
                      key={streamUrl}
                      src={streamUrl}
                      className="w-full h-full"
                      sandbox="allow-scripts allow-same-origin allow-forms allow-presentation allow-popups allow-storage-access-by-user-activation"
                      referrerPolicy="no-referrer"
                      allow="autoplay; encrypted-media; fullscreen; picture-in-picture; web-share"
                      allowFullScreen
                      style={{ border: 'none' }}
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
                    </div>
                  )}

                  {streamUrl && (
                    <div className="absolute top-3 right-3 flex gap-2 z-20">
                      <button
                        onClick={() => {
                          const iframe = iframeRef.current;
                          if (iframe) { iframe.src = ''; setTimeout(() => { iframe.src = streamUrl; }, 100); }
                        }}
                        className="tv-focusable glass glass-hover p-2 rounded-full hover:scale-110 transition-all duration-300"
                        title="Reload player"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                      <a href={streamUrl} target="_blank" rel="noopener noreferrer"
                        className="tv-focusable glass glass-hover p-2 rounded-full hover:scale-110 transition-all duration-300"
                        title="Open player directly"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  )}

                  {type === 'tv' && episodes.length > 0 && (
                    <>
                      {epIdx > 0 && (
                        <button onClick={() => handleEpisodeChange('prev')}
                          className="tv-focusable absolute left-4 top-1/2 -translate-y-1/2 glass glass-hover p-3 rounded-full hover:scale-110 transition-all duration-300">
                          <ChevronLeft className="w-6 h-6" />
                        </button>
                      )}
                      {epIdx < episodes.length - 1 && (
                        <button onClick={() => handleEpisodeChange('next')}
                          className="tv-focusable absolute right-4 top-1/2 -translate-y-1/2 glass glass-hover p-3 rounded-full hover:scale-110 transition-all duration-300">
                          <ChevronRight className="w-6 h-6" />
                        </button>
                      )}
                    </>
                  )}
                </div>

                <div className="p-4">
                  {currentEpisode && (
                    <div>
                      <h3 className="font-semibold text-white">
                        Episode {currentEpisode.episode_number}: {currentEpisode.name}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">{currentEpisode.overview}</p>
                    </div>
                  )}
                </div>
              </div>

              {type === 'tv' && episodes.length > 0 && (
                <div className="glass rounded-2xl p-6">
                  <button
                    onClick={() => setShowEpisodeList(!showEpisodeList)}
                    className="tv-focusable w-full flex items-center justify-between mb-4"
                  >
                    <h3 className="font-semibold text-white">Episodes ({episodes.length})</h3>
                    <ChevronRight className={cn("w-5 h-5 transition-transform duration-300", showEpisodeList && "rotate-90")} />
                  </button>
                  {showEpisodeList && (
                    <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                      {episodes.map((episode) => (
                        <button
                          key={episode.id}
                          onClick={() => setSelectedEpisode(episode.episode_number)}
                          className={cn(
                            "tv-focusable w-full text-left p-4 rounded-lg glass glass-hover transition-all duration-300",
                            selectedEpisode === episode.episode_number && "bg-primary/30 border-primary/50"
                          )}
                        >
                          <div className="font-medium text-white">
                            Episode {episode.episode_number}: {episode.name}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{episode.overview}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
