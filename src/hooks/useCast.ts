import { useState, useCallback, useEffect, useRef } from 'react';

type CastMethod = 'chromecast' | 'presentation' | 'external';

interface UseCastReturn {
  isCastAvailable: boolean;
  isCasting: boolean;
  castMethod: CastMethod | null;
  startCast: (url: string) => Promise<void>;
  stopCast: () => void;
  castDeviceName: string | null;
}

declare global {
  interface Window {
    __onGCastApiAvailable?: (isAvailable: boolean) => void;
    chrome?: {
      cast?: {
        isAvailable: boolean;
        SessionRequest: new (appId: string) => unknown;
        ApiConfig: new (
          sessionRequest: unknown,
          sessionListener: (session: ChromecastSession) => void,
          receiverListener: (availability: string) => void
        ) => unknown;
        initialize: (
          config: unknown,
          onSuccess: () => void,
          onError: (err: unknown) => void
        ) => void;
        requestSession: (
          onSuccess: (session: ChromecastSession) => void,
          onError: (err: unknown) => void
        ) => void;
        media: {
          MediaInfo: new (url: string, contentType: string) => { metadata: unknown };
          LoadRequest: new (mediaInfo: unknown) => unknown;
          GenericMediaMetadata: new () => { title?: string };
        };
      };
    };
  }
}

interface ChromecastSession {
  loadMedia: (
    request: unknown,
    onSuccess: () => void,
    onError: (err: unknown) => void
  ) => void;
  stop: (onSuccess: () => void, onError: (err: unknown) => void) => void;
  receiver?: { friendlyName?: string };
}

// Default Chromecast app ID (default media receiver)
const CAST_APP_ID = 'CC1AD845';
const CAST_SCRIPT = 'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1';

function loadCastSDK(): Promise<void> {
  return new Promise((resolve) => {
    if (window.chrome?.cast?.isAvailable) {
      resolve();
      return;
    }

    // Check if script already loaded
    if (document.querySelector(`script[src*="cast_sender"]`)) {
      window.__onGCastApiAvailable = (isAvailable) => {
        if (isAvailable) resolve();
      };
      return;
    }

    window.__onGCastApiAvailable = (isAvailable) => {
      if (isAvailable) resolve();
    };

    const script = document.createElement('script');
    script.src = CAST_SCRIPT;
    script.async = true;
    document.head.appendChild(script);

    // Timeout fallback
    setTimeout(resolve, 5000);
  });
}

export function useCast(): UseCastReturn {
  const [isCastAvailable, setIsCastAvailable] = useState(false);
  const [isCasting, setIsCasting] = useState(false);
  const [castMethod, setCastMethod] = useState<CastMethod | null>(null);
  const [castDeviceName, setCastDeviceName] = useState<string | null>(null);
  const sessionRef = useRef<ChromecastSession | null>(null);
  const presentationRef = useRef<unknown>(null);

  // Detect available cast methods
  useEffect(() => {
    let mounted = true;

    const detect = async () => {
      // Try loading Chromecast SDK
      try {
        await loadCastSDK();
        if (!mounted) return;

        if (window.chrome?.cast) {
          const sessionRequest = new window.chrome.cast.SessionRequest(CAST_APP_ID);
          const apiConfig = new window.chrome.cast.ApiConfig(
            sessionRequest,
            (session) => {
              sessionRef.current = session;
              setIsCasting(true);
              setCastMethod('chromecast');
              setCastDeviceName(session.receiver?.friendlyName || 'TV');
            },
            (availability) => {
              if (mounted) setIsCastAvailable(availability === 'available');
            }
          );

          window.chrome.cast.initialize(
            apiConfig,
            () => { if (mounted) setIsCastAvailable(true); },
            () => {}
          );
          return;
        }
      } catch {
        // Chromecast not available
      }

      // Fallback: Presentation API
      if (typeof navigator !== 'undefined' && 'presentation' in navigator) {
        if (mounted) setIsCastAvailable(true);
        return;
      }

      // Always available via external link
      if (mounted) setIsCastAvailable(true);
    };

    detect();
    return () => { mounted = false; };
  }, []);

  const startCast = useCallback(async (url: string) => {
    // Method 1: Google Cast / Chromecast (works with TCL, any Chromecast built-in TV)
    if (window.chrome?.cast?.isAvailable) {
      try {
        await new Promise<void>((resolve, reject) => {
          window.chrome!.cast!.requestSession(
            (session) => {
              sessionRef.current = session;
              setCastDeviceName(session.receiver?.friendlyName || 'TV');

              const mediaInfo = new window.chrome!.cast!.media.MediaInfo(url, 'video/mp4');
              const metadata = new window.chrome!.cast!.media.GenericMediaMetadata();
              metadata.title = 'Vitro Stream';
              mediaInfo.metadata = metadata;

              const request = new window.chrome!.cast!.media.LoadRequest(mediaInfo);
              session.loadMedia(request, () => resolve(), (err) => reject(err));
            },
            (err) => reject(err)
          );
        });
        setIsCasting(true);
        setCastMethod('chromecast');
        return;
      } catch (err) {
        console.warn('Chromecast failed, trying fallback:', err);
      }
    }

    // Method 2: Presentation API (DLNA-compatible, works with smart TVs)
    if ('presentation' in navigator) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const request = new (window as any).PresentationRequest([url]);
        presentationRef.current = request;
        const connection = await request.start();
        presentationRef.current = connection;
        setIsCasting(true);
        setCastMethod('presentation');
        setCastDeviceName('Smart TV');

        connection.onclose = () => {
          presentationRef.current = null;
          setIsCasting(false);
          setCastMethod(null);
          setCastDeviceName(null);
        };
        connection.onterminate = () => {
          presentationRef.current = null;
          setIsCasting(false);
          setCastMethod(null);
          setCastDeviceName(null);
        };
        return;
      } catch (err) {
        if ((err as DOMException).name !== 'AbortError') {
          console.warn('Presentation API failed:', err);
        }
      }
    }

    // Method 3: Open in new window (universal fallback - user can cast tab from browser)
    window.open(url, '_blank', 'noopener,noreferrer');
    setCastMethod('external');
  }, []);

  const stopCast = useCallback(() => {
    // Stop Chromecast
    if (sessionRef.current) {
      sessionRef.current.stop(() => {}, () => {});
      sessionRef.current = null;
    }

    // Stop Presentation
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (presentationRef.current && typeof (presentationRef.current as any).terminate === 'function') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (presentationRef.current as any).terminate();
      presentationRef.current = null;
    }

    setIsCasting(false);
    setCastMethod(null);
    setCastDeviceName(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (sessionRef.current) {
        sessionRef.current.stop(() => {}, () => {});
        sessionRef.current = null;
      }
    };
  }, []);

  return { isCastAvailable, isCasting, castMethod, startCast, stopCast, castDeviceName };
}
