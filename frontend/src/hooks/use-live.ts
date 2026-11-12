import { useEffect, useState } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { getGetSessionQueryKey } from '@workspace/api-client-react';

export function invalidateData(qc: QueryClient) {
  const sessionKey = getGetSessionQueryKey()[0];
  return qc.invalidateQueries({ predicate: (q) => q.queryKey[0] !== sessionKey });
}

/** Subscribes to /api/events; falls back to polling when the stream drops. */
export function useLive(enabled: boolean) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<'live' | 'polling' | 'off'>('off');

  useEffect(() => {
    if (!enabled) return;
    let es: EventSource | null = null;
    let poll: ReturnType<typeof setInterval> | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const startPoll = () => {
      if (poll) return;
      setMode('polling');
      poll = setInterval(() => invalidateData(qc), 12000);
    };
    const stopPoll = () => {
      if (poll) clearInterval(poll);
      poll = null;
    };
    try {
      const base = import.meta.env.BASE_URL.replace(/\/$/, '');
      es = new EventSource(`${base}/api/events`.replace(/^\/\//, '/'), { withCredentials: true });
      es.onopen = () => {
        stopPoll();
        setMode('live');
      };
      es.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg?.type === 'refresh') {
            if (timer) clearTimeout(timer);
            timer = setTimeout(() => invalidateData(qc), 150);
          }
        } catch {
          /* ignore keepalive frames */
        }
      };
      es.onerror = () => startPoll();
    } catch {
      startPoll();
    }
    return () => {
      es?.close();
      stopPoll();
      if (timer) clearTimeout(timer);
      setMode('off');
    };
  }, [enabled, qc]);

  return mode;
}
