function result(state, recommendation, primaryAction) {
  return { primary: { state, recommendation, action: primaryAction } };
}

function checkInRecommendation(moodValue, stressLevel, energyLevel, connectionLevel) {
  const lowest = [];
  if (moodValue === 1) {
    lowest.push({
      pillar: 'Mind',
      state: 'You deserve support today.',
      recommendation: 'A five-minute Mind Reset is here if it helps.',
      action: { label: 'Start Mind Reset', action: 'breathing' },
    });
  }
  if (energyLevel === 1) {
    lowest.push({
      pillar: 'Body',
      state: 'Take today at your pace.',
      recommendation: 'A free workout is available whenever movement feels right.',
      action: { label: 'Find a free workout', action: 'body' },
    });
  }
  if (connectionLevel === 1) {
    lowest.push({
      pillar: 'Bond',
      state: 'Small moments of connection count.',
      recommendation: 'Choose one simple moment together today.',
      action: { label: 'Open Bond', action: 'bond' },
    });
  }

  if (lowest.length > 0) {
    const primary = lowest[0];
    return result(primary.state, primary.recommendation, primary.action);
  }

  if (stressLevel !== null && stressLevel >= 4) {
    return result(
      "You're feeling stressed today.",
      'Take a five-minute Mind Reset before anything else.',
      { label: 'Start Mind Reset', action: 'breathing' },
    );
  }

  if (moodValue <= 2) {
    return result(
      "Today's a low one.",
      'Write one line in your journal. Naming it is the part that helps.',
      { label: 'Open journal', action: 'journal' },
    );
  }

  if (stressLevel !== null && stressLevel === 3) {
    return result(
      "You're carrying some tension today.",
      'A five-minute Mind Reset will give you space to settle.',
      { label: 'Start Mind Reset', action: 'breathing' },
    );
  }

  return result(
    "You're in a good place today.",
    'Use it — pick one intentional moment with your kids before bedtime.',
    { label: 'Open Bond', action: 'bond' },
  );
}

module.exports = { checkInRecommendation };
