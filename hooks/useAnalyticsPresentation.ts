import { useEffect, useRef, useState } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { trackEvent } from '../lib/analytics';
import { createPresentation } from '../lib/analyticsSessions';
export function useAnalyticsPresentation(owner: string | undefined, event: 'onboarding_started' | 'paywall_viewed', properties: Record<string,string>, eligible = true) {
  const focused = useIsFocused();
  const gate = useRef(createPresentation());
  const [laidOut, setLaidOut] = useState(false);
  const values = JSON.stringify(properties);
  useEffect(() => {
    if (gate.current.update(owner ?? null, focused, eligible)) trackEvent(event, JSON.parse(values), owner);
  }, [owner, focused, eligible, event, values, laidOut]);
  return () => { gate.current.layout(); setLaidOut(true); };
}
