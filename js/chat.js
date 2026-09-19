// =====================================================================================
// CAREGIVER HUB – AI Screening Advisor / Chat Module  (dementia.html → js/chat.js)
//
// Two operating modes:
//   1. KNOWLEDGE BASE Q&A  – curated, pre-written answers to 7 common dementia Qs
//   2. SYMPTOM SCREENING   – guided 5-question questionnaire with risk scoring
//
// Calling convention expected by dementia.html:
//   processChat(inputText: string, userName?: string) → { message, options?, riskLevel? }
//   resetChat()
//   getRandomTip()
// =====================================================================================

// ─────────────────────────────────────────────────────────────────────────────────────
// SECTION 1 – STRUCTURED KNOWLEDGE BASE
// Pre-written answers for common dementia questions.
// Each entry: { id, keywords[], answer }
// ─────────────────────────────────────────────────────────────────────────────────────
const KNOWLEDGE_BASE = [
  {
    id: 'kb_stages',
    keywords: [
      'stages', 'stage', 'phases', 'phase', 'progression', 'steps of alzheimer',
      'how does dementia progress', 'preclinical', 'mild cognitive impairment', 'mci',
      'five stages', '5 stages', 'what are the stages',
    ],
    answer:
      `📋 **Stages of Alzheimer's / Dementia**\n\n` +
      `There are **five broadly recognised stages**:\n\n` +
      `**1. Preclinical** – Brain changes occur years before symptoms appear. No noticeable memory problems yet.\n\n` +
      `**2. Mild Cognitive Impairment (MCI)** – Subtle memory or thinking changes noticed by the person or close family, but day-to-day life is mostly unaffected.\n\n` +
      `**3. Mild Dementia (Early Stage)** – Memory lapses, word-finding difficulty, trouble with complex tasks. Most people can still live somewhat independently.\n\n` +
      `**4. Moderate Dementia (Middle Stage)** – Increasing confusion, greater memory loss, more support needed for daily tasks. This is typically the longest stage.\n\n` +
      `**5. Severe Dementia (Late Stage)** – Full-time care required; significant physical and cognitive decline.\n\n` +
      `⚠️ _These are general patterns — progression differs for every person and is not tied to exact timelines._`,
  },
  {
    id: 'kb_warning_signs',
    keywords: [
      'warning sign', 'early sign', 'early symptom', 'first sign', 'how to tell',
      'how do i know', 'signs of dementia', 'signs of alzheimer', 'recognise dementia',
      'recognize dementia', 'identify dementia', 'memory loss', 'forgetful', 'forgetting',
      'misplace', 'losing things', 'mood change', 'personality change', 'financial judgment',
      'word finding', 'finding words', 'what to look for',
    ],
    answer:
      `🔍 **Early Warning Signs of Dementia / Alzheimer's**\n\n` +
      `Common early signs to watch for:\n\n` +
      `• **Memory loss disrupting daily life** – Forgetting recently learned information, important dates, or asking the same questions repeatedly.\n\n` +
      `• **Difficulty finding words** – Stopping mid-sentence, struggling to name familiar objects, or using unusual substitute words.\n\n` +
      `• **Misplacing objects** – Putting things in unusual places and being unable to retrace steps to find them.\n\n` +
      `• **Mood & personality changes** – Increased confusion, anxiety, suspicion, depression, or withdrawal from social activities.\n\n` +
      `• **Poor financial judgment** – Uncharacteristic spending decisions or difficulty managing bills and finances.\n\n` +
      `• **Trouble with planning or complex tasks** – Difficulty following a familiar recipe, managing medication schedules, or tracking monthly bills.\n\n` +
      `⚠️ _These signs don't confirm a diagnosis. Only a qualified doctor can evaluate the underlying cause._`,
  },
  {
    id: 'kb_mild_dementia',
    keywords: [
      'mild dementia', 'early dementia', 'early stage dementia', 'mild stage',
      'what happens early', 'early alzheimer', 'early phase', 'mild impairment',
      'still independent', 'can still drive', 'can still work',
      'repeating questions', 'personality shift', 'irritability',
    ],
    answer:
      `🌱 **Mild / Early-Stage Dementia**\n\n` +
      `In the mild stage, a person can **often still function fairly independently** — they may continue to drive, work, and socialise — but some challenges begin to appear:\n\n` +
      `• Memory lapses for **recent events** (though older memories remain clear)\n` +
      `• **Repeating questions** or stories within the same conversation\n` +
      `• Struggling with **complex planning** (managing finances, organising events)\n` +
      `• Personality shifts such as **increased irritability, reduced motivation**, or mild withdrawal\n` +
      `• Getting lost in **previously familiar places**\n\n` +
      `This is often the best time to plan future care arrangements, legal matters (power of attorney), and home safety modifications.\n\n` +
      `⚠️ _A doctor's evaluation is essential for an accurate individual assessment._`,
  },
  {
    id: 'kb_moderate_dementia',
    keywords: [
      'moderate dementia', 'middle dementia', 'middle stage dementia', 'moderate stage',
      'middle stage', 'moderate alzheimer', 'what happens moderate', 'supervision',
      'needs help', 'needs more help', 'greater memory', 'daily tasks difficulty',
    ],
    answer:
      `⚠️ **Moderate / Middle-Stage Dementia**\n\n` +
      `The moderate stage is typically the **longest phase** of dementia and requires increased support:\n\n` +
      `• **Greater memory loss** — forgetting personal history, family names, and recent events\n` +
      `• **Increasing confusion** about time, place, and familiar people\n` +
      `• Needs **regular assistance** with daily tasks: dressing, bathing, eating, toileting\n` +
      `• May experience **wandering**, especially at night\n` +
      `• **Paranoia, hallucinations, or delusions** may emerge\n` +
      `• Requires **more supervision and structured support** throughout the day\n\n` +
      `24/7 supervision is strongly recommended. Consider professional in-home care or a memory care facility.\n\n` +
      `⚠️ _Please consult a healthcare professional for guidance specific to your situation._`,
  },
  {
    id: 'kb_severe_dementia',
    keywords: [
      'severe dementia', 'late dementia', 'late stage dementia', 'late stage',
      'advanced dementia', 'severe alzheimer', 'end stage', 'final stage',
      'what happens late', 'around the clock', 'full time care', 'swallowing',
      'walking difficulty', 'communicate', 'pneumonia', 'infections',
      'bedridden', 'bed bound', 'loss of awareness', 'soft music', 'gentle touch',
    ],
    answer:
      `❤️ **Late / Severe-Stage Dementia**\n\n` +
      `In the late stage, a person requires **around-the-clock care** and experiences significant decline:\n\n` +
      `• **Loses awareness of surroundings** and may not recognise even close family\n` +
      `• **Declining physical abilities** — difficulty walking, swallowing, and eventually becoming bed-bound\n` +
      `• **Very limited verbal communication** — may only make sounds or not speak at all\n` +
      `• **Higher vulnerability to infections** such as pneumonia (a leading cause of death in this stage)\n` +
      `• Loss of bladder and bowel control\n\n` +
      `🎵 Even at this stage, **calm, soothing interactions can still help** — soft familiar music, gentle touch, and a calm voice can reduce distress and provide comfort.\n\n` +
      `Focus should be on **comfort, dignity, and quality of life**. Palliative and hospice care services may be appropriate.\n\n` +
      `⚠️ _Please consult a healthcare professional for care planning specific to your loved one._`,
  },
  {
    id: 'kb_lifespan',
    keywords: [
      'how long', 'life expectancy', 'lifespan', 'live after diagnosis',
      'how many years', 'survival', 'prognosis', 'years left',
      'how long do they live', 'average life', 'long will they live',
      'after diagnosis',
    ],
    answer:
      `📊 **Life Expectancy After a Dementia Diagnosis**\n\n` +
      `On average, people diagnosed with Alzheimer's at **age 65 or older** live **4 to 8 years** after diagnosis. However, some individuals live for **up to 20 years** after diagnosis.\n\n` +
      `Key factors that influence this vary greatly:\n` +
      `• **Age at diagnosis** — younger age at diagnosis often correlates with a longer overall course\n` +
      `• **How advanced the disease was** when identified\n` +
      `• **Overall health**, presence of other conditions, and quality of care\n\n` +
      `⚠️ _These are **general statistical ranges, not predictions for any individual**. Every person's experience is unique. Please speak with a neurologist for a personalised perspective._`,
  },
  {
    id: 'kb_caregiver_action',
    keywords: [
      'what should i do', 'what to do', 'caregiver advice', 'caregiver action',
      'noticed signs', 'i noticed', 'next step', 'next steps',
      'schedule appointment', 'see a doctor', 'book a doctor', 'go to doctor',
      'consult doctor', 'when to see doctor', 'cognitive games', 'activities',
      'routine', 'calming music', 'self diagnose', 'self-diagnose', 'what can help',
    ],
    answer:
      `🤝 **What Should a Caregiver Do When They Notice These Signs?**\n\n` +
      `**Step 1 — See a doctor first.** Schedule an appointment with a GP, neurologist, or geriatrician for a proper medical evaluation. **Do not attempt to self-diagnose** — only a qualified professional can determine the cause of cognitive changes.\n\n` +
      `**Step 2 — Document what you've observed.** Keep notes on specific incidents (dates, what happened) to share with the doctor. This helps with accurate assessment.\n\n` +
      `**Step 3 — Supportive activities alongside professional care.** While awaiting or following medical advice, these commonly used, non-medical tools may help:\n` +
      `   • 🧩 **Cognitive games** (puzzles, familiar card games, word games)\n` +
      `   • 📅 **Consistent daily routine** — structure reduces confusion and anxiety\n` +
      `   • 🎵 **Calming familiar music** — can reduce agitation and improve mood\n` +
      `   • 🪟 **Good lighting** — reduces evening confusion (sundowning)\n\n` +
      `⚠️ _These activities are supportive tools, not treatments. They do not replace professional medical care._`,
  },
];

// Standard disclaimer appended to all KB answers
const DISCLAIMER =
  '\n\n_⚕️ This is general information only, not a medical diagnosis. ' +
  'For anything specific to an individual\'s condition, medication, or treatment, ' +
  'please consult a qualified healthcare professional._';

// Quick-option label → KB entry id mapping
const QUICK_MAP = {
  '❓ What are the stages of dementia?':         'kb_stages',
  '🔍 What are the early warning signs?':        'kb_warning_signs',
  '🌱 What happens in early-stage dementia?':    'kb_mild_dementia',
  '⚠️ What happens in moderate-stage dementia?': 'kb_moderate_dementia',
  '❤️ What happens in late-stage dementia?':     'kb_severe_dementia',
  '📊 How long do people live after diagnosis?': 'kb_lifespan',
  '🤝 What should a caregiver do first?':        'kb_caregiver_action',
};

// Options shown after answering a KB question
const KB_OPTIONS = [
  '❓ What are the stages of dementia?',
  '🔍 What are the early warning signs?',
  '🌱 What happens in early-stage dementia?',
  '⚠️ What happens in moderate-stage dementia?',
  '❤️ What happens in late-stage dementia?',
  '📊 How long do people live after diagnosis?',
  '🤝 What should a caregiver do first?',
  '📋 Run symptom screening',
];

// ─────────────────────────────────────────────────────────────────────────────────────
// SECTION 2 – SYMPTOM SCREENING QUESTIONNAIRE
// ─────────────────────────────────────────────────────────────────────────────────────
const QUESTIONS = [
  {
    id: 'q1',
    text: "Let's do a quick symptom check-in.\n\nHow is the patient's **memory** today?",
    options: [
      'Mild forgetfulness (names, dates)',
      'Moderate – losing things often, confused',
      'Severe – cannot recognize family members',
    ],
    scores: [1, 2, 3],
  },
  {
    id: 'q2',
    text: "How is the patient's **behaviour & mood** recently?",
    options: [
      'Mostly calm, occasional mood swings',
      'Frequent agitation, repetitive questions',
      'Aggression, hallucinations, or extreme distress',
    ],
    scores: [1, 2, 3],
  },
  {
    id: 'q3',
    text: 'Has the patient **wandered or tried to leave** the safe area recently?',
    options: [
      'No, has not wandered',
      'Once or twice, but was managed',
      'Multiple times – it is a daily concern',
    ],
    scores: [0, 2, 3],
  },
  {
    id: 'q4',
    text: 'How is the patient managing **daily activities** (eating, bathing, dressing)?',
    options: [
      'Mostly independent with little help',
      'Needs regular assistance',
      'Fully dependent on caregiver',
    ],
    scores: [1, 2, 3],
  },
  {
    id: 'q5',
    text: 'How are **you** feeling as the caregiver today?',
    options: [
      'Managing well, feeling supported',
      'Stressed and tired, need a break',
      'Overwhelmed – feeling burnout or hopelessness',
    ],
    scores: [0, 1, 2],
  },
];

const RISK_LEVELS = [
  { min: 0,  max: 4,  level: 'Low',      icon: '✅', msg: "The patient appears to be in an **early/stable stage**. Continue current care routines and schedule a check-up within 3 months." },
  { min: 5,  max: 9,  level: 'Moderate', icon: '⚠️', msg: "There are signs of **moderate progression**. Consider consulting a neurologist soon and adding safety measures at home." },
  { min: 10, max: 99, level: 'Severe',   icon: '🚨', msg: "**Urgent attention needed.** The patient shows signs of severe dementia. Please book an emergency consultation immediately." },
];

const TIPS = {
  Low: [
    '💊 Ensure medications are taken on schedule',
    '🧩 Engage in daily cognitive games (puzzles, card games)',
    '🚶 30-minute walks in a safe, familiar environment',
    '📅 Maintain a consistent daily routine',
  ],
  Moderate: [
    '🔒 Install door safety locks and motion sensors',
    '🆔 Ensure patient has an ID bracelet at all times',
    '📞 Save all emergency contacts on a visible notepad',
    '🧠 Book a memory clinic assessment this week',
    '🛌 Ensure patient has a safe sleep environment',
  ],
  Severe: [
    '🚨 Consider 24/7 professional care or memory care facility',
    '🏥 Request an urgent neurology consultation today',
    '📋 Inform all family members of current patient status',
    '🔴 Activate emergency care plan immediately',
    '💙 Reach out to a caregiver support group for yourself',
  ],
};

// ─────────────────────────────────────────────────────────────────────────────────────
// SECTION 3 – CONVERSATION STATE
// ─────────────────────────────────────────────────────────────────────────────────────
let chatState = {
  mode: 'menu',     // 'menu' | 'screening'
  step: 0,
  totalScore: 0,
  answers: [],
  riskLevel: null,
};

// ─────────────────────────────────────────────────────────────────────────────────────
// SECTION 4 – KB KEYWORD MATCHER
// Scores each KB entry against the user's input and returns the best match.
// ─────────────────────────────────────────────────────────────────────────────────────
function matchKnowledgeBase(input) {
  const lower = input.toLowerCase().trim();
  let bestEntry = null;
  let bestScore = 0;

  for (const entry of KNOWLEDGE_BASE) {
    let score = 0;
    for (const kw of entry.keywords) {
      if (lower.includes(kw.toLowerCase())) {
        // Weight by keyword length (more specific matches score higher)
        score += kw.split(' ').length;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestEntry = entry;
    }
  }

  return bestScore > 0 ? bestEntry : null;
}

// ─────────────────────────────────────────────────────────────────────────────────────
// SECTION 5 – MAIN PROCESS FUNCTION
// Called by dementia.html as: processChat(inputText, userName)
// Returns: { message: string, options?: string[], riskLevel?: string }
// ─────────────────────────────────────────────────────────────────────────────────────
export function processChat(inputText = '', userName = '') {
  const nameStr = userName ? `, ${userName.split(' ')[0]}` : '';
  const lc = String(inputText).toLowerCase().trim();

  // ── GREETING / START ──────────────────────────────────────────────────────────────
  if (inputText === '__start__') {
    chatState = { mode: 'menu', step: 0, totalScore: 0, answers: [], riskLevel: null };
    return {
      message:
        `👋 Hello${nameStr}! I'm your **AI Caregiver Advisor**.\n\n` +
        `I can help in two ways:\n\n` +
        `🔍 **Ask me a question** about dementia — stages, warning signs, what to expect, life expectancy, or caregiver advice.\n\n` +
        `📋 **Run a symptom check** — a short 5-question screening to assess the patient's current condition.\n\n` +
        `What would you like to do?`,
      options: [
        '📋 Run symptom screening',
        '❓ What are the stages of dementia?',
        '🔍 What are the early warning signs?',
        '🌱 What happens in early-stage dementia?',
        '⚠️ What happens in moderate-stage dementia?',
        '❤️ What happens in late-stage dementia?',
        '📊 How long do people live after diagnosis?',
        '🤝 What should a caregiver do first?',
      ],
    };
  }

  // ── SCREENING TRIGGER ─────────────────────────────────────────────────────────────
  const isScreeningTrigger =
    inputText === '📋 Run symptom screening' ||
    inputText === '📋 Run symptom screening again' ||
    lc.includes('symptom') || lc.includes('screening') ||
    lc.includes('assessment') || (lc.includes('run') && lc.includes('check'));

  if (isScreeningTrigger && chatState.mode !== 'screening') {
    chatState = { mode: 'screening', step: 0, totalScore: 0, answers: [], riskLevel: null };
    const q = QUESTIONS[0];
    return {
      message:
        `📋 **Symptom Screening** — 5 quick questions\n\n` +
        `_This gives a general picture of the patient's current condition. It is not a medical diagnosis._\n\n` +
        q.text,
      options: q.options,
    };
  }

  // ── SCREENING IN PROGRESS ─────────────────────────────────────────────────────────
  if (chatState.mode === 'screening' && chatState.step < QUESTIONS.length) {
    const q = QUESTIONS[chatState.step];
    const answerIdx = q.options.indexOf(inputText);

    if (answerIdx !== -1) {
      chatState.totalScore += q.scores[answerIdx];
      chatState.answers.push(inputText);
      chatState.step++;

      if (chatState.step < QUESTIONS.length) {
        const nextQ = QUESTIONS[chatState.step];
        return { message: nextQ.text, options: nextQ.options };
      }

      // ── All 5 answered — compute result ──────────────────────────────────────────
      const risk = RISK_LEVELS.find(r => chatState.totalScore >= r.min && chatState.totalScore <= r.max);
      chatState.riskLevel = risk.level;
      chatState.mode = 'menu';

      const tipsText = TIPS[risk.level].map(t => `• ${t}`).join('\n');
      return {
        message:
          `**Assessment Complete** ${risk.icon}\n\n` +
          `Score: ${chatState.totalScore} / 14 points\n\n` +
          `${risk.msg}\n\n` +
          `**Recommended Actions:**\n${tipsText}\n\n` +
          `_⚕️ This screening is for general awareness only — not a medical diagnosis. Please consult a healthcare professional for proper evaluation._\n\n` +
          `Would you like to ask a dementia knowledge question?`,
        options: [
          '❓ What are the stages of dementia?',
          '🔍 What are the early warning signs?',
          '🤝 What should a caregiver do first?',
          '📋 Run symptom screening again',
        ],
        riskLevel: risk.level,
      };
    }
    // Answer text didn't match a screening option — fall through to KB lookup
  }

  // ── QUICK-OPTION SHORTCUTS ────────────────────────────────────────────────────────
  if (QUICK_MAP[inputText]) {
    const kbEntry = KNOWLEDGE_BASE.find(e => e.id === QUICK_MAP[inputText]);
    if (kbEntry) {
      return { message: kbEntry.answer + DISCLAIMER, options: KB_OPTIONS };
    }
  }

  // ── FREE-TEXT KB LOOKUP ───────────────────────────────────────────────────────────
  const matched = matchKnowledgeBase(inputText);
  if (matched) {
    return { message: matched.answer + DISCLAIMER, options: KB_OPTIONS };
  }

  // ── OUT-OF-SCOPE GRACEFUL DECLINE ─────────────────────────────────────────────────
  return {
    message:
      `🩺 I'm not able to answer that specific question.\n\n` +
      `I'm designed to provide general information about dementia stages, warning signs, and caregiver guidance only.\n\n` +
      `For questions about **individual diagnosis, medications, or specific treatment plans**, please consult a qualified healthcare professional.\n\n` +
      `Here are things I **can** help with:`,
    options: KB_OPTIONS,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────────
// SECTION 6 – UTILITIES
// ─────────────────────────────────────────────────────────────────────────────────────

/**
 * Reset the advisor to its initial state.
 */
export function resetChat() {
  chatState = { mode: 'menu', step: 0, totalScore: 0, answers: [], riskLevel: null };
}

/**
 * Get a random caregiver tip.
 */
export function getRandomTip() {
  const tips = [
    "💙 Remember: you can't pour from an empty cup. Take regular breaks.",
    "🧠 Consistency in daily routine helps dementia patients feel secure.",
    "🎵 Familiar music can calm agitation — even in late-stage dementia.",
    "🪟 Good lighting reduces confusion, especially in the evenings.",
    "📖 Reminiscence therapy using old photos can improve mood.",
    "🤝 Join a local caregiver support group — you're not alone.",
    "💊 Use pill organizers and alarms to manage medication schedules.",
    "🚿 Schedule bathing at the patient's preferred time of day.",
    "🧩 Cognitive games like puzzles support brain engagement in early stages.",
    "📅 Write down key daily events — it helps both patient and caregiver.",
  ];
  return tips[Math.floor(Math.random() * tips.length)];
}
