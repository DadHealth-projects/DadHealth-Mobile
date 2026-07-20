import React from 'react';
import ScreenScaffold from '../components/ScreenScaffold';

// Matches web /mind hero: section-label "MENTAL HEALTH" + h1 "MENTAL HEALTH".
export default function MindScreen() {
  return (
    <ScreenScaffold
      label="Mental Health"
      title="Mental Health"
      intro="It's okay to not be okay. Breathe, reflect, and reach out when you need to."
      cards={[
        {
          icon: 'edit-3',
          title: 'Evening Journal',
          description: 'Pick a starter or write freely — this space is just for you.',
        },
        {
          icon: 'bar-chart-2',
          title: 'Mood Trend',
          description: 'Your 7-day mood pattern, correlated with sleep to spot triggers.',
        },
        {
          icon: 'life-buoy',
          title: 'Find a Therapist',
          description: 'Dad-friendly sessions with evening and weekend slots.',
        },
      ]}
      ctaLabel="Begin breathing →"
    />
  );
}
