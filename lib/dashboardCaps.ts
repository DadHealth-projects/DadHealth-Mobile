/**
 * Display caps copied from the web dashboard
 * (`components/home/dashboardPreview/useDashboardPreviewData.ts`).
 * Applied at render time; the hook fetches the same page sizes the web hook does.
 */
export const CAPS = {
  reminders: 5,
  goals: 4,
  dadDates: 3,
  circles: 3,
  milestones: 6,
  badges: 4,
} as const;
