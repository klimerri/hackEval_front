import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from './api';

export interface UseApiResult<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => void;
}

export function useApi<T>(path: string | null, deps: unknown[] = []): UseApiResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(path));
  const [tick, setTick] = useState(0);
  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;
    if (!path) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    api
      .get<T>(path)
      .then((d) => {
        if (!cancelled.current) {
          setData(d);
          setError(null);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled.current) {
          const msg =
            e instanceof ApiError
              ? e.message
              : e instanceof Error
                ? e.message
                : 'request failed';
          setError(msg);
        }
      })
      .finally(() => {
        if (!cancelled.current) setLoading(false);
      });
    return () => {
      cancelled.current = true;
    };

  }, [path, tick, ...deps]);

  return { data, error, loading, reload: () => setTick((t) => t + 1) };
}
