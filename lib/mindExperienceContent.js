// Draft Mind experience copy. Jamie approval required before treating as final.
const MIND_JOURNAL_PROMPTS = {
  low: [
    "What's weighing on you most?",
    "What's one thing in your control today?",
    'What small step could help today?',
  ],
  positive: [
    'What went well, and what did you do to help that?',
    'Who or what helped make that possible?',
    "What's one thing you want to carry into tomorrow?",
  ],
  neutral: [
    "What's on your mind right now?",
    'What feels most important today?',
    "What's one small next step that feels manageable?",
  ],
};

const TEXT_A_MATE_DRAFT = "Hey, I've had a lot on my mind. Are you free for a quick chat?";

function selectMindJournalPrompts(checkIn) {
  const answers = [checkIn?.mood_value, checkIn?.energy_level, checkIn?.connection_level];
  if (answers.some((value) => value != null && value >= 1 && value <= 2)) return MIND_JOURNAL_PROMPTS.low;
  if (answers.every((value) => value != null && value >= 4 && value <= 5)) return MIND_JOURNAL_PROMPTS.positive;
  return MIND_JOURNAL_PROMPTS.neutral;
}

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

module.exports = { MIND_JOURNAL_PROMPTS, TEXT_A_MATE_DRAFT, selectMindJournalPrompts, localDateKey };
