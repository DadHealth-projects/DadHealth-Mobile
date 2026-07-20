import React from 'react';
import ScreenScaffold from '../components/ScreenScaffold';

// Matches web /bond hero: section-label "THE BOND" + h1 "PARENTING".
export default function BondScreen() {
  return (
    <ScreenScaffold
      label="The Bond"
      title="Parenting"
      intro="Ideas, milestones and conversations that bring you closer to your kids."
      cards={[
        {
          icon: 'map-pin',
          title: 'Dad Date Ideas',
          description: 'Saved outings filtered by age, weather and budget.',
        },
        {
          icon: 'award',
          title: 'Milestone Tracker',
          description: 'Capture the firsts — steps, words, and everything in between.',
        },
        {
          icon: 'message-circle',
          title: 'Conversation Starters',
          description: 'Prompts that get real talk going at the dinner table.',
        },
      ]}
      ctaLabel="Plan a dad date →"
    />
  );
}
