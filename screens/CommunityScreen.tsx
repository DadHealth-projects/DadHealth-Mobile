import React from 'react';
import ScreenScaffold from '../components/ScreenScaffold';

// Matches web /community: section-label "THE CIRCLE" + h1 "COMMUNITY".
export default function CommunityScreen() {
  return (
    <ScreenScaffold
      label="The Circle"
      title="Community"
      intro="Thousands of dads swapping wins, questions and hard-won advice."
      cards={[
        {
          icon: 'message-square',
          title: 'The Feed',
          description: 'Share a win or ask for help — post openly or anonymously.',
        },
        {
          icon: 'users',
          title: 'Circles',
          description: 'Smaller groups for new dads, co-parents and fitness.',
        },
        {
          icon: 'radio',
          title: 'Live Sessions',
          description: 'Weekly AMAs with coaches, therapists and other dads.',
        },
      ]}
      ctaLabel="Join the conversation →"
    />
  );
}
