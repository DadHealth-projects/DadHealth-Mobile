import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useNetworkStatus } from '../contexts/NetworkContext';
import { createMindPlanController, requestMindPlanWithRetry, type PlanView } from '../lib/mindPlan';

export function useMindPlan(owner: string | undefined, accessSignal: boolean | null, focused: boolean) {
  const { isOffline } = useNetworkStatus();
  const current = useRef(owner); current.current = owner;
  const signalKey = `${owner ?? ''}:${String(accessSignal)}`;
  const configuredKey = useRef(signalKey);
  const [state, setState] = useState<{ owner: string; key: string; view: PlanView } | null>(null);
  const scope = useRef<{ owner: string; controller: ReturnType<typeof createMindPlanController> } | null>(null);
  useEffect(() => {
    if (!owner) { setState(null); return; }
    const controller = createMindPlanController(owner, requestMindPlanWithRetry, view => {
      if (current.current === owner) setState({ owner, key: configuredKey.current, view });
    });
    scope.current = { owner, controller };
    return () => { controller.dispose(); if (scope.current?.controller === controller) scope.current = null; };
  }, [owner]);
  useEffect(() => {
    const controller = scope.current?.controller;
    configuredKey.current = signalKey;
    controller?.invalidate();
    controller?.setOffline(isOffline);
  }, [owner, accessSignal, isOffline]);
  useEffect(() => {
    if (focused && !isOffline) void scope.current?.controller.refresh();
  }, [focused, owner, accessSignal, isOffline]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active' && focused) void scope.current?.controller.refresh();
    });
    return () => subscription.remove();
  }, [focused]);
  const refresh = useCallback(() => scope.current && scope.current.owner === current.current ? scope.current.controller.refresh() : Promise.resolve(), []);
  const start = useCallback(() => { if (scope.current && scope.current.owner === current.current) void scope.current.controller.mutate({ kind: 'start' }); }, []);
  const complete = useCallback((planId: string, actionNumber: number) => {
    if (scope.current && scope.current.owner === current.current) void scope.current.controller.mutate({ kind: 'complete', planId, actionNumber });
  }, []);
  const view = state && state.owner === owner && state.key === signalKey ? state.view : null;
  return { view: isOffline ? null : view, isOffline, refresh, start, complete };
}
