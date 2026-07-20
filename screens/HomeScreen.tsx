import React from 'react';
import ScreenScaffold from '../components/ScreenScaffold';

export default function HomeScreen() {
  return (
    <ScreenScaffold
      label="Dashboard"
      title="Dad Health"
      intro="Your daily briefing — fitness, headspace, family and community in one place."
      cards={[
        {
          icon: 'activity',
          title: "Today's Training",
          description: 'A 25-minute session built around your recovery and goals.',
        },
        {
          icon: 'trending-up',
          title: 'Your Streak',
          description: '5 days strong. Consistency beats intensity — keep showing up.',
        },
        {
          icon: 'sun',
          title: 'Daily Check-in',
          description: 'Log how you slept and how you feel to spot the patterns.',
        },
      ]}
      ctaLabel="Start your day →"
    />
  );
}
