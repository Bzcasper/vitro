import { useState, useCallback, useEffect, useRef } from 'react';

interface UseCastReturn {
  isCastAvailable: boolean;
  isCasting: boolean;
  startCast: (url: string) => Promise<void>;
  stopCast: () => void;
}

export function useCast(): UseCastReturn {
  const [isCastAvailable, setIsCastAvailable] = useState(false);
  const [isCasting, setIsCasting] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const connectionRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const requestRef = useRef<any>(null);

  useEffect(() => {
    setIsCastAvailable(typeof navigator !== 'undefined' && 'presentation' in navigator);
  }, []);

  const startCast = useCallback(async (url: string) => {
    if (!('presentation' in navigator)) return;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const request = new (window as any).PresentationRequest([url]);
      requestRef.current = request;

      const connection = await request.start();
      connectionRef.current = connection;
      setIsCasting(true);

      connection.onclose = () => {
        connectionRef.current = null;
        setIsCasting(false);
      };

      connection.onterminate = () => {
        connectionRef.current = null;
        setIsCasting(false);
      };
    } catch (error) {
      if ((error as DOMException).name !== 'AbortError') {
        console.error('Cast failed:', error);
      }
    }
  }, []);

  const stopCast = useCallback(() => {
    if (connectionRef.current) {
      connectionRef.current.terminate();
      connectionRef.current = null;
      setIsCasting(false);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (connectionRef.current) {
        connectionRef.current.terminate();
        connectionRef.current = null;
      }
    };
  }, []);

  return { isCastAvailable, isCasting, startCast, stopCast };
}
