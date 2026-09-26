import { createContext, useContext } from 'react';

type ScreenContentReadyReporter = (ready: boolean) => void;

export const ScreenContentReadyContext = createContext<ScreenContentReadyReporter>(() => {});

export function useScreenContentReady() {
  return useContext(ScreenContentReadyContext);
}
