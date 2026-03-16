import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Film, Tv, Clock, Sparkles } from 'lucide-react';

import { AnimatedLogo } from '../components/AnimatedLogo';
import { SearchInput } from '../components/SearchInput';
import { MediaCard } from '../components/MediaCard';
import { tmdbService, type TMDBMedia, type TMDBGenre } from '../services/tmdbService';
import { apiStorage } from '../services/apiStorageService';
import { cn } from '../lib/utils';

export default function Home() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<TMDBMedia[]>([]);
  const [continueWatching, setContinueWatching] = useState<TMDBMedia[]>([]);
  const [trending, setTrending] = useState<TMDBMedia[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'all' | 'movies' | 'tv'>('all');
  const [showGenreSelector, setShowGenreSelector] = useState(false);
  const [movieGenres, setMovieGenres] = useState<TMDBGenre[]>([]);
  const [tvGenres, setTVGenres] = useState<TMDBGenre[]>([]);
  const [selectedGenre, setSelectedGenre] = useState<number | null>(null);
  const [genreResults, setGenreResults] = useState<TMDBMedia[]>([]);

  // Load continue watching
  useEffect(() => {
    const loadContinueWatching = async () => {
      const progress = await apiStorage.getWatchProgress();
      const media = await Promise.all(
        progress.slice(0, 10).map(async (p) => {
          try {
            if (p.type === 'movie') {
              return await tmdbService.getMovieDetails(p.id);
            } else {
              return await tmdbService.getTVShowDetails(p.id);
            }
          } catch (error) {
            console.error('Error loading continue watching item:', error);
            return null;
          }
        })
      );
      setContinueWatching(media.filter((m): m is TMDBMedia => m !== null));
    };

    loadContinueWatching();
  }, []);

  // Load genres
  useEffect(() => {
    const loadGenres = async () => {
      try {
        const [movies, tv] = await Promise.all([
          tmdbService.getMovieGenres(),
          tmdbService.getTVGenres()
        ]);
        setMovieGenres(movies);
        setTVGenres(tv);
      } catch (error) {
        console.error('Error loading genres:', error);
      }
    };

    loadGenres();
  }, []);

  // Load trending
  useEffect(() => {
    const loadTrending = async () => {
      try {
        const results = await tmdbService.getTrending(selectedTab === 'all' ? 'all' : selectedTab === 'movies' ? 'movie' : 'tv');
        setTrending(results);
      } catch (error) {
        console.error('Error loading trending:', error);
      }
    };

    if (!isSearching && !selectedGenre) {
      loadTrending();
    }
  }, [selectedTab, isSearching, selectedGenre]);

  // Load genre results
  useEffect(() => {
    const loadGenreResults = async () => {
      if (!selectedGenre || selectedTab === 'all') return;

      try {
        const mediaType = selectedTab === 'movies' ? 'movie' : 'tv';
        const results = await tmdbService.discoverByGenre(mediaType, selectedGenre);
        setGenreResults(results);
      } catch (error) {
        console.error('Error loading genre results:', error);
      }
    };

    if (selectedGenre && !isSearching) {
      loadGenreResults();
    }
  }, [selectedGenre, selectedTab, isSearching]);

  // Search handler with debounce
  useEffect(() => {
    const searchTimeout = setTimeout(async () => {
      if (searchQuery.trim().length < 2) {
        setIsSearching(false);
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const results = await tmdbService.searchMulti(searchQuery);
        setSearchResults(results);
      } catch (error) {
        console.error('Error searching:', error);
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(searchTimeout);
  }, [searchQuery]);

  const handleMediaClick = useCallback((media: TMDBMedia) => {
    const type = media.media_type || (media.title ? 'movie' : 'tv');
    navigate(`/watch/${type}/${media.id}`);
  }, [navigate]);

  const handleRemoveFromContinueWatching = useCallback((media: TMDBMedia) => {
    const type = media.media_type || (media.title ? 'movie' : 'tv');
    apiStorage.removeWatchProgress(media.id, type);
    setContinueWatching(prev => prev.filter(m => m.id !== media.id));
  }, []);

  const handleGenreSelect = useCallback((genreId: number) => {
    setSelectedGenre(genreId);
    setShowGenreSelector(false);
  }, []);

  const handleTabChange = useCallback((tab: 'all' | 'movies' | 'tv') => {
    setSelectedTab(tab);
    setSelectedGenre(null);
    setShowGenreSelector(false);
  }, []);

  const handleButtonClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const displayResults = isSearching ? searchResults : selectedGenre ? genreResults : trending;
  const currentGenres = selectedTab === 'movies' ? movieGenres : tvGenres;
  const selectedGenreName = currentGenres.find(g => g.id === selectedGenre)?.name;

  return (
    <div className="min-h-screen w-full relative overflow-hidden">
      {/* Main Content */}
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header */}
        <header className="w-full py-4 lg:py-8 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            {/* Logo */}
            <AnimatedLogo />

            {/* Search Bar */}
            <SearchInput
              placeholder="Search for movies or TV shows..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />

            {/* Tab Navigation */}
            {!isSearching && (
              <div className="flex items-center justify-center gap-4 mt-6 flex-wrap">
                <button
                  onClick={(e) => {
                    handleButtonClick(e);
                    handleTabChange('all');
                  }}
                  className={cn(
                    "px-6 py-2 rounded-full glass glass-hover transition-all duration-300",
                    selectedTab === 'all' && "bg-primary/30 border-primary/50"
                  )}
                >
                  All
                </button>
                <button
                  onClick={(e) => {
                    handleButtonClick(e);
                    handleTabChange('movies');
                  }}
                  className={cn(
                    "px-6 py-2 rounded-full glass glass-hover transition-all duration-300 flex items-center gap-2",
                    selectedTab === 'movies' && "bg-primary/30 border-primary/50"
                  )}
                >
                  <Film className="w-4 h-4" />
                  Movies
                </button>
                <button
                  onClick={(e) => {
                    handleButtonClick(e);
                    handleTabChange('tv');
                  }}
                  className={cn(
                    "px-6 py-2 rounded-full glass glass-hover transition-all duration-300 flex items-center gap-2",
                    selectedTab === 'tv' && "bg-primary/30 border-primary/50"
                  )}
                >
                  <Tv className="w-4 h-4" />
                  TV Shows
                </button>

                {/* Genre/Category Selector */}
                {selectedTab !== 'all' && (
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        handleButtonClick(e);
                        setShowGenreSelector(!showGenreSelector);
                      }}
                      className={cn(
                        "px-6 py-2 rounded-full glass glass-hover transition-all duration-300 flex items-center gap-2",
                        selectedGenre && "bg-secondary/30 border-secondary/50"
                      )}
                    >
                      <Sparkles className="w-4 h-4" />
                      {selectedGenreName || 'Category'}
                    </button>

                    {showGenreSelector && (
                      <div className="absolute top-full mt-2 left-0 min-w-[200px] glass rounded-2xl p-4 z-50 max-h-96 overflow-y-auto">
                        <div className="space-y-2">
                          {selectedGenre && (
                            <button
                              onClick={(e) => {
                                handleButtonClick(e);
                                setSelectedGenre(null);
                                setShowGenreSelector(false);
                              }}
                              className="w-full text-left px-4 py-2 rounded-lg glass-hover transition-all duration-300 text-sm text-muted-foreground"
                            >
                              Clear Filter
                            </button>
                          )}
                          {currentGenres.map((genre) => (
                            <button
                              key={genre.id}
                              onClick={(e) => {
                                handleButtonClick(e);
                                handleGenreSelect(genre.id);
                              }}
                              className={cn(
                                "w-full text-left px-4 py-2 rounded-lg glass-hover transition-all duration-300 text-sm",
                                selectedGenre === genre.id && "bg-secondary/30 border-secondary/50"
                              )}
                            >
                              {genre.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 pb-24 lg:pb-12">
          <div className="max-w-7xl mx-auto space-y-8 lg:space-y-12">
            {/* Continue Watching - horizontal scroll on mobile */}
            {continueWatching.length > 0 && !isSearching && (
              <section>
                <div className="flex items-center gap-3 mb-4">
                  <Clock className="w-5 h-5 lg:w-6 lg:h-6 text-primary" />
                  <h2 className="text-lg lg:text-2xl font-display font-bold text-white">
                    Continue Watching
                  </h2>
                </div>
                <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide lg:grid lg:grid-cols-5 xl:grid-cols-6 lg:overflow-x-visible">
                  {continueWatching.map((media) => (
                    <div key={media.id} className="flex-shrink-0 w-[140px] sm:w-auto snap-start">
                      <MediaCard
                        media={media}
                        onClick={() => handleMediaClick(media)}
                        onRemove={() => handleRemoveFromContinueWatching(media)}
                        showRemove
                      />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Search Results or Trending */}
            <section>
              <h2 className="text-lg lg:text-2xl font-display font-bold text-white mb-4 lg:mb-6">
                {isSearching ? 'Search Results' : selectedGenre ? `${selectedGenreName}` : 'Trending Now'}
              </h2>
              {displayResults.length > 0 ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 lg:gap-4">
                  {displayResults.map((media) => (
                    <MediaCard
                      key={media.id}
                      media={media}
                      onClick={() => handleMediaClick(media)}
                    />
                  ))}
                </div>
              ) : (
                <div className="glass rounded-2xl p-8 lg:p-12 text-center">
                  <p className="text-muted-foreground text-base lg:text-lg">
                    {isSearching ? 'No results found' : 'Loading...'}
                  </p>
                </div>
              )}
            </section>
          </div>
        </main>

        {/* Footer */}
        <footer className="w-full py-6 px-4 text-center">
          <p className="text-muted-foreground text-sm">
            Made with love by <span className="kira-gradient font-semibold">Kira</span>
          </p>
          <p className="text-muted-foreground text-xs mt-2">
            Vitro does not host any files; it pulls streams from third-party services.
          </p>
        </footer>
      </div>
    </div>
  );
}
