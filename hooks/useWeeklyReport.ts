
import { useEffect, useState } from 'react';

import { useNetworkStatus } from '../contexts/NetworkContext';
import { fetchProInsight } from '../lib/proInsights';
import type { WeeklyReport } from '../lib/weeklyReport';

type ReportState = {
  report: WeeklyReport | null;
  loading: boolean;
  error: boolean;
};

const reportCache = new Map<string, WeeklyReport | null>();
const inFlightReports = new Map<string, Promise<WeeklyReport | null>>();

function weekKey(date: Date): string {
  const utc = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const day = new Date(utc).getUTCDay();
  const monday = new Date(utc - ((day + 6) % 7) * 86400000);
  return monday.toISOString().slice(0, 10);
}

function fetchReport(key: string): Promise<WeeklyReport | null> {
  const existing = inFlightReports.get(key);
  if (existing) return existing;

  const request = fetchProInsight<{ report: WeeklyReport | null }>('weekly-report')
    .then((result) => {
      reportCache.set(key, result.report);
      return result.report;
    })
    .finally(() => {
      inFlightReports.delete(key);
    });

  inFlightReports.set(key, request);
  return request;
}

export function useWeeklyReport(
  userId: string | undefined,
  isPro: boolean,
  enabled: boolean,
) {
  const { isOffline } = useNetworkStatus();
  const key = userId ? `${userId}:${weekKey(new Date())}` : null;

  const [state, setState] = useState<ReportState>({
    report: null,
    loading: false,
    error: false,
  });

  useEffect(() => {
    let active = true;

    if (!key || !isPro || !enabled) {
      setState({ report: null, loading: false, error: false });
      return () => {
        active = false;
      };
    }

    if (reportCache.has(key)) {
      setState({
        report: reportCache.get(key) ?? null,
        loading: false,
        error: false,
      });
      return () => {
        active = false;
      };
    }

    if (isOffline) {
      setState({
        report: null,
        loading: false,
        error: true,
      });
      return () => {
        active = false;
      };
    }

    setState({
      report: null,
      loading: true,
      error: false,
    });

    void fetchReport(key)
      .then((report) => {
        if (active) {
          setState({ report, loading: false, error: false });
        }
      })
      .catch(() => {
        if (active) {
          setState({ report: null, loading: false, error: true });
        }
      });

    return () => {
      active = false;
    };
  }, [key, isPro, enabled, isOffline]);

  return state;
}