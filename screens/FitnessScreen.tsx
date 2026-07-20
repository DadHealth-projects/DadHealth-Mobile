import React from 'react';
import ScreenScaffold from '../components/ScreenScaffold';

// Matches web /fitness hero: section-label "TODAY'S WORKOUT" + h1 "FITNESS AND NUTRITION".
export default function FitnessScreen() {
  return (
    <ScreenScaffold
      label="Today's Workout"
      title="Fitness and Nutrition"
      intro="Strength, conditioning and meals tailored to a busy dad's schedule."
      cards={[
        {
          icon: 'zap',
          title: "Today's Moves",
          description: 'Six exercises, supersetted. Under 30 minutes, no equipment needed.',
        },
        {
          icon: 'bar-chart-2',
          title: 'Progress This Month',
          description: 'Sessions, volume and personal bests tracked automatically.',
        },
        {
          icon: 'coffee',
          title: 'Meal Planner',
          description: 'A personalised meal plan and grocery list built around your goals.',
        },
      ]}
      ctaLabel="View workout →"
    />
  );
}
