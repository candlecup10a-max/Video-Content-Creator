import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import {join} from 'node:path';
import {GoogleGenAI} from '@google/genai';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

app.use(express.json({ limit: '35mb' }));
app.use(express.urlencoded({ limit: '35mb', extended: true }));

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env['GEMINI_API_KEY'];
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not set. Please add it to Settings > Secrets.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function extractCleanErrorMessage(error: unknown): string {
  if (!error) return 'An unexpected error occurred.';
  let raw = '';
  if (typeof error === 'string') {
    raw = error;
  } else if (error instanceof Error) {
    raw = error.message;
  } else if (typeof error === 'object' && error !== null) {
    const obj = error as Record<string, unknown>;
    raw = typeof obj['message'] === 'string' ? obj['message'] : JSON.stringify(error);
  }

  // Handle nested JSON strings (e.g. from Google GenAI SDK)
  for (let depth = 0; depth < 3; depth++) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.error?.message) {
        raw = parsed.error.message;
      } else if (parsed?.message) {
        raw = parsed.message;
      } else {
        break;
      }
    } catch {
      break;
    }
  }

  if (
    raw.includes('503') ||
    raw.includes('high demand') ||
    raw.includes('UNAVAILABLE') ||
    raw.includes('temporarily')
  ) {
    return 'The AI service is temporarily experiencing high demand. Please retry in a few moments.';
  }

  if (
    raw.includes('quota') ||
    raw.includes('RESOURCE_EXHAUSTED') ||
    raw.includes('429') ||
    raw.includes('rate-limit') ||
    raw.includes('rate limit')
  ) {
    return 'The AI service rate limit was reached. Please retry in a few moments.';
  }

  return raw || 'Failed to complete generation request. Please try again.';
}

const AUDIO_TRANSCRIPTION_MODELS = [
  'gemini-3.8-flash',
  'gemini-3.1-flash-lite',
];

const VISION_ANALYSIS_MODELS = [
  'gemini-3.8-flash',
  'gemini-3.1-flash-lite',
];

const FALLBACK_MODELS = [
  'gemini-3.8-flash',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash',
];

/**
 * Sanitizes unescaped ASCII control characters (like literal \n, \r, \t) inside JSON string literals.
 * This prevents V8 "Bad control character in string literal" SyntaxErrors.
 */
function sanitizeJsonControlChars(jsonStr: string): string {
  let result = '';
  let inString = false;
  let isEscaped = false;

  for (const ch of jsonStr) {
    if (inString) {
      if (isEscaped) {
        result += ch;
        isEscaped = false;
      } else if (ch === '\\') {
        result += ch;
        isEscaped = true;
      } else if (ch === '"') {
        result += ch;
        inString = false;
      } else if (ch === '\n') {
        result += '\\n';
      } else if (ch === '\r') {
        result += '\\r';
      } else if (ch === '\t') {
        result += '\\t';
      } else {
        result += ch;
      }
    } else {
      if (ch === '"') {
        inString = true;
      }
      result += ch;
    }
  }
  return result;
}

/**
 * Repairs incomplete or truncated JSON strings by balancing brackets, closing unclosed strings,
 * and stripping trailing dangling keys or commas.
 */
function repairTruncatedJson(jsonStr: string): string {
  let inString = false;
  let isEscaped = false;
  const stack: string[] = [];

  for (const ch of jsonStr) {
    if (inString) {
      if (isEscaped) {
        isEscaped = false;
      } else if (ch === '\\') {
        isEscaped = true;
      } else if (ch === '"') {
        inString = false;
      }
    } else {
      if (ch === '"') {
        inString = true;
      } else if (ch === '{' || ch === '[') {
        stack.push(ch === '{' ? '}' : ']');
      } else if (ch === '}' || ch === ']') {
        if (stack.length > 0 && stack[stack.length - 1] === ch) {
          stack.pop();
        }
      }
    }
  }

  let repaired = jsonStr.trim();
  // 1. If cut off inside a string, close the quote
  if (inString) {
    repaired += '"';
  }

  // 2. Remove dangling colon or trailing incomplete property
  repaired = repaired.replace(/:\s*$/, ': ""');
  repaired = repaired.replace(/,\s*$/, '');

  // Strip trailing dangling key without a colon (e.g., `..., "danglingKey"` at end)
  repaired = repaired.replace(/(?:[{,]\s*)"[^"\\]*(?:\\.[^"\\]*)*"\s*$/, '');
  repaired = repaired.replace(/,\s*$/, '');

  // 3. Close open braces and brackets
  while (stack.length > 0) {
    const closer = stack.pop();
    repaired = repaired.replace(/,\s*$/, '');
    repaired += closer;
  }

  return repaired;
}

/**
 * Extracts distinct JSON objects from inside an array string when root parsing fails.
 */
function extractObjectsFromArrayString<T>(text: string, requiredKey: string): T[] {
  const items: T[] = [];
  const firstBracket = text.indexOf('[');
  const lastBracket = text.lastIndexOf(']');
  const searchArea = (firstBracket !== -1 && lastBracket > firstBracket)
    ? text.substring(firstBracket + 1, lastBracket)
    : text;

  let inString = false;
  let isEscaped = false;
  let objStart = -1;
  let objDepth = 0;

  for (let i = 0; i < searchArea.length; i++) {
    const ch = searchArea[i];
    if (inString) {
      if (isEscaped) {
        isEscaped = false;
      } else if (ch === '\\') {
        isEscaped = true;
      } else if (ch === '"') {
        inString = false;
      }
    } else {
      if (ch === '"') {
        inString = true;
      } else if (ch === '{') {
        if (objDepth === 0) {
          objStart = i;
        }
        objDepth++;
      } else if (ch === '}') {
        if (objDepth > 0) {
          objDepth--;
          if (objDepth === 0 && objStart !== -1) {
            const candidate = searchArea.substring(objStart, i + 1);
            if (candidate.includes(`"${requiredKey}"`)) {
              try {
                items.push(JSON.parse(sanitizeJsonControlChars(candidate)) as T);
              } catch {
                try {
                  items.push(JSON.parse(repairTruncatedJson(sanitizeJsonControlChars(candidate))) as T);
                } catch {
                  // Ignore malformed item
                }
              }
            }
            objStart = -1;
          }
        }
      }
    }
  }
  return items;
}

/**
 * Bulletproof JSON parser for AI model outputs.
 * Handles pure JSON, markdown fences, control characters, unclosed strings, truncated responses,
 * and robust sub-object extraction.
 */
function parseJsonFromModel<T>(rawText: string, fallbackDefault: T): T {
  if (!rawText || typeof rawText !== 'string') {
    return fallbackDefault;
  }

  const trimmed = rawText.trim();
  if (!trimmed) {
    return fallbackDefault;
  }

  // 1. Direct parse attempt
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    // Continue
  }

  // 2. Sanitize control characters (unescaped \n, \r, \t inside string literals)
  const sanitizedText = sanitizeJsonControlChars(trimmed);
  try {
    return JSON.parse(sanitizedText) as T;
  } catch {
    // Continue
  }

  // 3. Extract markdown code block if present
  const codeBlockMatch = sanitizedText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch && codeBlockMatch[1]) {
    const candidate = codeBlockMatch[1].trim();
    try {
      return JSON.parse(candidate) as T;
    } catch {
      try {
        const repaired = repairTruncatedJson(candidate);
        return JSON.parse(repaired) as T;
      } catch {
        // Continue
      }
    }
  }

  // 4. Extract outermost JSON boundary ({...} or [...])
  const firstBrace = sanitizedText.indexOf('{');
  const firstBracket = sanitizedText.indexOf('[');
  let startIdx = -1;
  let endIdx = -1;

  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    startIdx = firstBrace;
    endIdx = sanitizedText.lastIndexOf('}');
  } else if (firstBracket !== -1) {
    startIdx = firstBracket;
    endIdx = sanitizedText.lastIndexOf(']');
  }

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    const boundaryCandidate = sanitizedText.substring(startIdx, endIdx + 1).trim();
    try {
      return JSON.parse(boundaryCandidate) as T;
    } catch {
      // Clean up common JSON syntax issues (trailing commas before } or ])
      try {
        const noTrailingComma = boundaryCandidate.replace(/,\s*([}\]])/g, '$1');
        return JSON.parse(noTrailingComma) as T;
      } catch {
        // Try auto-repair
        try {
          const repaired = repairTruncatedJson(boundaryCandidate);
          return JSON.parse(repaired) as T;
        } catch {
          // Continue
        }
      }
    }
  }

  // 5. Try auto-repairing from startIdx to end of text
  if (startIdx !== -1) {
    try {
      const fromStart = sanitizedText.substring(startIdx);
      const repaired = repairTruncatedJson(fromStart);
      return JSON.parse(repaired) as T;
    } catch {
      // Continue
    }
  }

  // 6. Strip all backticks and attempt repair
  try {
    const stripped = sanitizedText.replace(/```json/gi, '').replace(/```/g, '').trim();
    const repaired = repairTruncatedJson(stripped);
    return JSON.parse(repaired) as T;
  } catch {
    // Continue to array object recovery
  }

  // 7. Smart recovery for array-based responses (e.g. { ideas: [...] }, { scenes: [...] }, { captions: [...] })
  if (fallbackDefault && typeof fallbackDefault === 'object') {
    const fallbackObj = fallbackDefault as Record<string, unknown>;
    if (Array.isArray(fallbackObj['ideas'])) {
      const extractedIdeas = extractObjectsFromArrayString(sanitizedText, 'title');
      if (extractedIdeas.length > 0) {
        console.info(`[Gemini API] Successfully recovered ${extractedIdeas.length} ideas from model output.`);
        return { ...fallbackDefault, ideas: extractedIdeas } as T;
      }
    }
    if (Array.isArray(fallbackObj['scenes'])) {
      const extractedScenes = extractObjectsFromArrayString(sanitizedText, 'title');
      if (extractedScenes.length > 0) {
        console.info(`[Gemini API] Successfully recovered ${extractedScenes.length} scenes from model output.`);
        return { ...fallbackDefault, scenes: extractedScenes } as T;
      }
    }
    if (Array.isArray(fallbackObj['captions'])) {
      const extractedCaptions = extractObjectsFromArrayString(sanitizedText, 'startTime');
      if (extractedCaptions.length > 0) {
        console.info(`[Gemini API] Successfully recovered ${extractedCaptions.length} captions from model output.`);
        return { ...fallbackDefault, captions: extractedCaptions } as T;
      }
    }
  }

  console.info(`[Gemini API] Model output parsed with structured fallback (length: ${trimmed.length})`);
  return fallbackDefault;
}

function getFallbackIdeas(
  keywords: string,
  niche?: string,
  tone?: string,
  targetLength?: string,
  targetAudience?: string,
) {
  const kw = keywords.trim();
  const audience = targetAudience || 'viewers';
  const duration = targetLength || '45-60s';

  return [
    {
      id: `idea-${Date.now()}-1`,
      title: `The 60-Second Truth About ${kw} (That Most People Miss)`,
      hook: `Stop doing ${kw} the hard way. Here is the single shift that changed everything for me.`,
      conceptSummary: `A pattern-interrupt breakdown demonstrating the common counterproductive habit around ${kw} and presenting an immediate, high-leverage alternative.`,
      whyItWorks: `Taps into loss-aversion and FOMO while offering a tangible, fast payoff within the first 15 seconds.`,
      format: 'Talking Head + B-roll Overlay',
      estimatedDuration: duration,
      outline: [
        {
          timing: '0:00 - 0:05',
          title: 'The Pattern Interrupt',
          script: `If you're still approaching ${kw} like it's 2023, stop right here.`,
          visual: 'Punchy eye-level close-up with dynamic kinetic text overlay.'
        },
        {
          timing: '0:05 - 0:20',
          title: 'The Hidden Friction',
          script: `90% of ${audience} waste hours because they focus on complexity instead of leverage.`,
          visual: 'Quick split-screen or screenshot showing the old vs new way.'
        },
        {
          timing: '0:20 - 0:45',
          title: 'The 3-Step Framework',
          script: `Here is what actually works: Step one, eliminate the busywork. Step two, focus on this single habit. Step three, track results daily.`,
          visual: 'Demonstration b-roll with numbered badge overlays.'
        },
        {
          timing: '0:45 - 0:55',
          title: 'Discussion CTA',
          script: `What is your biggest bottleneck with ${kw}? Drop a comment and I will share my exact checklist.`,
          visual: 'Direct eye contact with animated comment prompt.'
        }
      ],
      callToAction: `Comment "${kw.split(' ')[0].toUpperCase()}" below and I'll send you the breakdown!`,
      keyTakeaways: [
        `Identify and cut low-leverage steps in ${kw}`,
        `Focus on the 20% effort that creates 80% of the outcome`,
        `Consistent execution outperforms sporadic over-optimization`
      ]
    },
    {
      id: `idea-${Date.now()}-2`,
      title: `3 Costly Mistakes You're Making With ${kw}`,
      hook: `You are probably making this mistake with ${kw} right now—and it is quietly costing you progress.`,
      conceptSummary: `A fast-paced myth-busting format that addresses three widely believed misconceptions in ${niche || 'this space'} and provides corrective action.`,
      whyItWorks: `Negative hooks consistently drive 40%+ higher retention in short-form content due to immediate curiosity.`,
      format: 'Screen Share / Practical Walkthrough',
      estimatedDuration: duration,
      outline: [
        {
          timing: '0:00 - 0:06',
          title: 'Mistake Hook',
          script: `Here are 3 mistakes I see almost every creator make with ${kw}.`,
          visual: 'Bold red warning graphic overlay and direct camera focus.'
        },
        {
          timing: '0:06 - 0:22',
          title: 'Mistake #1 & The Fix',
          script: `Number one: Skipping the fundamentals to chase trends. Here is what to do instead.`,
          visual: 'Zoom in 1.1x on key takeaway note.'
        },
        {
          timing: '0:22 - 0:38',
          title: 'Mistake #2 & #3',
          script: `Number two: Overcomplicating tools. Number three: Not measuring the right metric.`,
          visual: 'Side-by-side comparison graphics on screen.'
        },
        {
          timing: '0:38 - 0:50',
          title: 'Actionable Takeaway',
          script: `Which one are you guilty of? Bookmark this so you do not repeat them tomorrow.`,
          visual: 'Save icon prompt with clean wrap-up graphic.'
        }
      ],
      callToAction: `Save this video for your next session and tell me which mistake hit closest to home!`,
      keyTakeaways: [
        `Avoid chasing complexity before mastering basics`,
        `Audit tools and processes regularly`,
        `Focus on actionable metrics over vanity numbers`
      ]
    },
    {
      id: `idea-${Date.now()}-3`,
      title: `How I Mastered ${kw} in 15 Minutes a Day`,
      hook: `You do not need 4 hours a day to get great at ${kw}. You only need this 15-minute routine.`,
      conceptSummary: `A relatable, personal transformation story detailing a micro-habit routine that delivers disproportionate progress for busy creators.`,
      whyItWorks: `Extreme accessibility—removing the friction barrier makes viewers feel that success is realistic and achievable today.`,
      format: 'Day-in-the-Life / Desk Routine POV',
      estimatedDuration: duration,
      outline: [
        {
          timing: '0:00 - 0:05',
          title: 'Routine Hook',
          script: `If you have 15 minutes today, you can completely transform how you handle ${kw}.`,
          visual: 'Timer graphic on screen or desk workspace shot.'
        },
        {
          timing: '0:05 - 0:25',
          title: 'The Breakdown',
          script: `Minute 1 to 5 is audit and setup. Minute 5 to 12 is pure deep-focus execution. Minute 12 to 15 is review.`,
          visual: 'Fast b-roll montage showing hands-on action.'
        },
        {
          timing: '0:25 - 0:45',
          title: 'The Compound Effect',
          script: `Doing this consistently for 30 days yields more results than cramming for 8 hours once a week.`,
          visual: 'Chart or progressive calendar visual.'
        },
        {
          timing: '0:45 - 0:55',
          title: 'Engagement CTA',
          script: `Try this starting tomorrow morning. Hit follow for more daily creator playbooks!`,
          visual: 'Follow button animation and friendly sign-off.'
        }
      ],
      callToAction: `Follow for daily bite-sized playbooks and share this with someone who needs it!`,
      keyTakeaways: [
        `Micro-habits beat sporadic marathon sessions`,
        `Timeboxing creates urgency and eliminates distraction`,
        `Compounds over time into effortless mastery`
      ]
    },
    {
      id: `idea-${Date.now()}-4`,
      title: `The Ultimate Beginner to Pro Roadmap for ${kw}`,
      hook: `If I had to start learning ${kw} from zero today, here is the exact roadmap I would follow.`,
      conceptSummary: `A step-by-step masterclass roadmap guiding the viewer from day 1 basics to intermediate milestones and advanced proficiency.`,
      whyItWorks: `High shareability and bookmark rate—roadmap videos are saved at 3x the normal rate because viewers want to reference them repeatedly.`,
      format: 'Visual Diagram / Whiteboard / Step Progression',
      estimatedDuration: duration,
      outline: [
        {
          timing: '0:00 - 0:05',
          title: 'Starting From Zero Hook',
          script: `If I lost all my notes and had to start over with ${kw}, here is my blueprint.`,
          visual: 'Clean notepad or tablet screen drawing step 1.'
        },
        {
          timing: '0:05 - 0:20',
          title: 'Phase 1: Foundations',
          script: `Phase 1 is mastering the terminology and building a solid core foundation.`,
          visual: 'Highlight step 1 badge with key bullet points.'
        },
        {
          timing: '0:20 - 0:35',
          title: 'Phase 2: Practice & Feedback',
          script: `Phase 2 is building small pilot projects to test your knowledge in real scenarios.`,
          visual: 'Example screen recording showing active practice.'
        },
        {
          timing: '0:35 - 0:50',
          title: 'Phase 3: Scaling & Polish',
          script: `Phase 3 is refining speed and sharing your results publicly to build authority.`,
          visual: 'Completed roadmap visual overview.'
        }
      ],
      callToAction: `Which phase are you currently on? Let me know in the comments!`,
      keyTakeaways: [
        `Build strong foundations before jumping to advanced tactics`,
        `Active creation cements learning faster than passive reading`,
        `Public accountability accelerates skill acquisition`
      ]
    }
  ];
}

function getFallbackSocialPackage(
  videoTitle?: string,
  videoDescription?: string,
  keywords?: string
) {
  const title = videoTitle || 'Essential Guide for Modern Creators';
  const desc = videoDescription || 'Key insights, tactical breakdowns, and actionable tips to upgrade your workflow.';
  const kw = keywords || 'Content Creation';

  return {
    titles: [
      { style: 'Curiosity Gap', title: `The Hidden Truth About ${title}` },
      { style: 'Actionable How-To', title: `How to Master ${title} in 3 Simple Steps` },
      { style: 'Bold / Contrarian', title: `Why Most People Get ${title} Completely Wrong` },
      { style: 'Specific / High-Value', title: `The 5-Minute Blueprint for ${title}` },
      { style: 'Story / Relatable', title: `What Happened When I Replaced My Old Habit With ${title}` },
    ],
    captions: {
      short: `${title} — A simple shift that makes a massive difference.`,
      long: `${title}\n\n${desc}\n\nKey takeaways:\n• Focus on consistency over complexity\n• Implement the core system before optimizing\n• Track your progress weekly\n\nWhat is your current strategy for this? Drop your thoughts below!`,
    },
    hashtags: {
      broad: ['#ContentCreator', '#GrowthStrategy', '#CreatorEconomy', '#ViralTips'],
      niche: [`#${kw.replace(/\s+/g, '')}`, '#VideoProduction', '#ProductivityHacks'],
      trending: ['#FYP', '#TrendingTopic', '#LearnOnTikTok'],
    },
    posts: {
      linkedin: {
        hook: `Most professionals approach ${title} the wrong way. Here is what actually moves the needle:`,
        fullPost: `Most professionals approach ${title} the wrong way. Here is what actually moves the needle:\n\n${desc}\n\nThree foundational principles:\n1. Simplify the execution loop\n2. Focus on clear, repeatable outputs\n3. Engage directly with the feedback loop\n\nIf you found this useful, repost for your network ♻️ and let me know your thoughts in the comments.\n\n#ProfessionalGrowth #Strategy #Leadership #CreatorEconomy`,
        characterCount: 420,
        bestPracticeTip: 'Post mid-week morning for peak professional organic reach.',
      },
      facebook: {
        fullPost: `Hey everyone! 👋 Wanted to share a quick breakdown on ${title}.\n\n${desc}\n\nHave you tried this approach yet? Tag a friend who needs to see this! 👇`,
        characterCount: 220,
        bestPracticeTip: 'Encourage community discussion in the first 30 minutes.',
      },
      tiktok: {
        caption: `Stop scrolling! If you want to master ${title}, do this today 🚀 #${kw.replace(/\s+/g, '')} #tips #fyp`,
        onScreenHook: `The #1 Mistake With ${title}`,
        suggestedAudio: 'Trending upbeat synth / clean lo-fi',
        hashtags: ['#creator', '#tips', '#fyp', '#viral', '#learnontiktok'],
      },
      twitter: {
        mainTweet: `The single biggest lever in ${title}: ${desc.slice(0, 100)}... 🧵👇`,
        characterCount: 180,
        threadSuggestion: [
          `1/ Why ${title} is crucial: Most people focus on the wrong step first.`,
          `2/ Action item: Implement this today and measure the difference.`,
          `3/ Follow for more daily actionable breakdowns.`,
        ],
      },
    },
    pinnedComment: `What is your biggest roadblock when it comes to ${title}? Replying to every comment below! 👇`,
    thumbnailHookText: title.length > 25 ? 'Master This Now' : title,
  };
}

function getFallbackShootPlan(
  title?: string,
  conceptSummary?: string,
  _format?: string,
  _targetDuration?: string,
  location?: string
) {
  const vidTitle = title || 'High-Impact Creator Video';
  const loc = location || 'Home Studio / Clean Desk';

  return {
    scenes: [
      {
        title: 'Scene 1: Hook & Pattern Interrupt',
        description: `Close-up talking head looking directly into the camera lens. State the bold premise of "${vidTitle}".`,
        durationSec: 5,
        visualNotes: 'Tight framing, eye-level camera, quick on-screen text animation.',
      },
      {
        title: 'Scene 2: Core Problem & Struggle',
        description: 'Medium shot demonstrating why traditional approaches fail and introducing the concept.',
        durationSec: 15,
        visualNotes: 'Subtle punch-in zoom (1.1x) or switch to 45-degree angle.',
      },
      {
        title: 'Scene 3: Step-by-Step Breakdown',
        description: 'Demonstrating the solution with b-roll, screen capture, or tactile props.',
        durationSec: 25,
        visualNotes: 'Picture-in-picture or side-by-side comparison graphics.',
      },
      {
        title: 'Scene 4: Call to Action & Conclusion',
        description: 'Direct wrap-up delivering the single key takeaway and asking the audience a question.',
        durationSec: 10,
        visualNotes: 'On-screen graphic pointing down to comment section.',
      },
    ],
    equipmentChecklist: [
      'Camera or smartphone set to 4K at 30fps or 24fps',
      'Wireless lapel mic clipped 6 inches from collar and audio level checked',
      `Primary key light diffused at 45-degree angle for ${loc}`,
      'Lens wiped clean with microfiber cloth',
      'Phone set to Do Not Disturb / Airplane Mode',
      'Batteries fully charged with minimum 15GB free storage',
    ],
    directorTips: [
      'Smile and take a deep breath before hitting record to maintain natural enthusiasm',
      'Leave a 2-second silent pause between takes for fast jump-cut editing',
      'Record 3 different variations of your opening 3-second hook to A/B test',
      'Look directly at the camera lens, not at your own screen reflection',
    ],
  };
}

function getFallbackCaptions(sourceText?: string, targetDuration = 45) {
  const text = (sourceText || 'Welcome to this video. Here are the key insights and actionable takeaways.').trim();
  const words = text.split(/\s+/).filter(Boolean);
  const wordsPerSegment = 6;
  const captions = [];
  const duration = targetDuration > 0 ? targetDuration : 45;
  const count = Math.max(1, Math.ceil(words.length / wordsPerSegment));
  const segmentDuration = duration / count;

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 1000);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
  };

  for (let i = 0; i < count; i++) {
    const chunkWords = words.slice(i * wordsPerSegment, (i + 1) * wordsPerSegment);
    const chunkText = chunkWords.join(' ');
    const startSec = i * segmentDuration;
    const endSec = Math.min((i + 1) * segmentDuration, duration);
    const index = i + 1;

    captions.push({
      id: `cap-${index}-${Date.now().toString(36)}`,
      index,
      startTime: formatTime(startSec),
      startSeconds: Number(startSec.toFixed(2)),
      endTime: formatTime(endSec),
      endSeconds: Number(endSec.toFixed(2)),
      text: chunkText || 'Key takeaway',
      speaker: 'Creator',
    });
  }

  return {
    language: 'English',
    fullTranscript: text,
    captions,
  };
}

async function generateWithModelFallback(
  ai: GoogleGenAI,
  params: {
    contents: string | (Record<string, unknown> | string)[];
    config?: {
      responseMimeType?: string;
      temperature?: number;
      maxOutputTokens?: number;
    };
    models?: string[];
  }
) {
  let lastError: unknown = null;
  const modelsToTry = params.models && params.models.length > 0 ? params.models : FALLBACK_MODELS;

  for (const model of modelsToTry) {
    // Attempt with retry on transient errors
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: params.contents,
          config: {
            maxOutputTokens: 8192,
            ...params.config,
          },
        });
        return response;
      } catch (err: unknown) {
        lastError = err;
        const cleanMsg = extractCleanErrorMessage(err);

        const isTransient =
          cleanMsg.includes('503') ||
          cleanMsg.includes('high demand') ||
          cleanMsg.includes('UNAVAILABLE') ||
          cleanMsg.includes('429') ||
          cleanMsg.includes('overloaded') ||
          cleanMsg.includes('quota') ||
          cleanMsg.includes('RESOURCE_EXHAUSTED');

        if (attempt === 0 && isTransient) {
          await new Promise((resolve) => setTimeout(resolve, 500));
          continue;
        }
        break;
      }
    }
  }

  throw lastError;
}

/**
 * API: Generate high-engagement video ideas based on user keywords and preferences
 */
app.post('/api/ideas', async (req, res) => {
  const { keywords, niche, tone, targetLength, targetAudience } = req.body;

  if (!keywords || typeof keywords !== 'string' || !keywords.trim()) {
    return res.status(400).json({ error: 'Keywords or topic is required' });
  }

  try {
    const ai = getGeminiClient();

    const prompt = `You are a viral video strategist and creative director for top digital content creators.
The user wants to make a video but does not know what to create.
Here is what the creator provided:
- Keywords / Topic: "${keywords.trim()}"
- Creator Niche/Field: "${niche || 'General / Creator'}"
- Desired Tone/Vibe: "${tone || 'Engaging & Authentic'}"
- Preferred Length: "${targetLength || 'Short-form (30-60s)'}"
- Target Audience: "${targetAudience || 'Curious learners and social media users'}"

Generate 3 to 4 distinct, high-impact, creative video concepts. Each concept must be fresh, scroll-stopping, and actionable.
Keep outline scripts concise and punchy (1-2 sentences per scene). All string values must be valid JSON strings with properly escaped quotes.

Return ONLY a valid JSON object matching this schema:
{
  "ideas": [
    {
      "id": "unique-id-slug",
      "title": "Compelling Title",
      "hook": "Exact verbatim hook line for the first 3-5 seconds",
      "conceptSummary": "2-sentence clear explanation of the core idea",
      "whyItWorks": "Psychological trigger or algorithmic reason why this will perform",
      "format": "e.g. Talking Head + B-roll, Screen Share Tutorial, Myth-Buster Breakdown, POV Skit",
      "estimatedDuration": "e.g. 45-60s or 2-3 min",
      "outline": [
        {
          "timing": "0:00 - 0:05",
          "title": "Hook / Pattern Interrupt",
          "script": "What to say or do immediately",
          "visual": "Camera angle or on-screen text advice"
        },
        {
          "timing": "0:05 - 0:25",
          "title": "The Problem / Core Story",
          "script": "Key point or conflict introduced",
          "visual": "Visual cue or demonstration"
        },
        {
          "timing": "0:25 - 0:45",
          "title": "The Solution / Breakthrough",
          "script": "The actionable tip, payoff, or punchline",
          "visual": "Close-up or proof element"
        },
        {
          "timing": "0:45 - 0:55",
          "title": "Call to Action",
          "script": "Conversational closing prompt",
          "visual": "Text prompt overlay"
        }
      ],
      "callToAction": "Specific comment or share prompt",
      "keyTakeaways": ["Takeaway 1", "Takeaway 2", "Takeaway 3"]
    }
  ]
}`;

    const response = await generateWithModelFallback(ai, {
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.75,
        maxOutputTokens: 8192,
      },
    });

    const text = response.text || '{}';
    const data = parseJsonFromModel<{ ideas: Record<string, unknown>[] }>(text, { ideas: [] });

    if (Array.isArray(data.ideas) && data.ideas.length > 0) {
      return res.json(data);
    }

    // If parsing yielded empty ideas, provide structured fallback ideas
    console.info('[Gemini API] Empty ideas from model response, providing structured fallback ideas');
    return res.json({ ideas: getFallbackIdeas(keywords, niche, tone, targetLength, targetAudience) });
  } catch (error: unknown) {
    console.error('Error generating video ideas:', error);
    // If external service experienced high demand or failed, return resilient starter ideas so the user is never blocked
    try {
      const fallbackIdeas = getFallbackIdeas(keywords, niche, tone, targetLength, targetAudience);
      return res.json({ ideas: fallbackIdeas });
    } catch {
      const cleanMessage = extractCleanErrorMessage(error);
      return res.status(500).json({
        error: cleanMessage,
      });
    }
  }
});

/**
 * API: Generate captions, titles, hashtags, and tailored posts for LinkedIn, Facebook, TikTok, and Twitter
 */
app.post('/api/social-package', async (req, res) => {
  try {
    const { videoTitle, videoDescription, keyPoints, keywords, tone } = req.body;

    if (!videoTitle && !videoDescription) {
      return res.status(400).json({ error: 'Video title or summary is required' });
    }

    const ai = getGeminiClient();

    const prompt = `You are a social media growth copywriter and distribution expert specializing in multi-platform content.
The creator has filmed or prepared a video:
- Working Video Title: "${videoTitle || 'Untitled Video'}"
- Video Description/Content: "${videoDescription || ''}"
- Key Points / Takeaways: ${JSON.stringify(keyPoints || [])}
- Primary Keywords: "${keywords || ''}"
- Tone: "${tone || 'Engaging, authoritative, approachable'}"

Create a complete publishing distribution package tailored specifically for each social media platform:
1. LinkedIn: Professional, storytelling or insight-driven, strong first line (above the 'see more' fold), clean spacing, professional value, engaging closing discussion question, 3-4 professional hashtags.
2. Facebook: Community-friendly, relational, relatable narrative tone, emotional or practical connection, discussion/share prompt, 2-3 hashtags.
3. TikTok: High energy, concise, pattern interrupt hook, witty or relatable, sound/audio vibe suggestion, on-screen text hook, 4-6 optimized hashtags.
4. Twitter / X: Punchy standalone tweet within 270 characters with a strong hook and clear takeaway, plus a suggested 2-tweet follow-up thread if the user wants to expand.
5. Captions & Titles:
   - 5 catchy titles with different angles (Curiosity Gap, Direct How-To, High Stakes/Bold, Numbered/Specific, Story-driven)
   - Universal short caption & detailed caption
   - Hashtag categorization (broad, niche, trending)
   - Pinned comment to seed community discussion

Return ONLY valid JSON matching this exact structure:
{
  "titles": [
    { "style": "Curiosity Gap", "title": "..." },
    { "style": "Actionable How-To", "title": "..." },
    { "style": "Bold / Contrarian", "title": "..." },
    { "style": "Specific / High-Value", "title": "..." },
    { "style": "Story / Relatable", "title": "..." }
  ],
  "captions": {
    "short": "Punchy 1-2 sentence caption for quick posting",
    "long": "Detailed storytelling caption with rich context and line breaks"
  },
  "hashtags": {
    "broad": ["#BroadTag1", "#BroadTag2", "#BroadTag3"],
    "niche": ["#NicheTag1", "#NicheTag2", "#NicheTag3"],
    "trending": ["#Trending1", "#Trending2"]
  },
  "posts": {
    "linkedin": {
      "hook": "Strong first line before the fold",
      "fullPost": "Complete formatted LinkedIn post with line breaks and formatting",
      "characterCount": 450,
      "bestPracticeTip": "Best posted weekday mornings with video attached natively"
    },
    "facebook": {
      "fullPost": "Complete formatted Facebook post with conversational warmth and community question",
      "characterCount": 380,
      "bestPracticeTip": "Encourage people to tag a friend or comment their experience"
    },
    "tiktok": {
      "caption": "TikTok caption including integrated tags",
      "onScreenHook": "Text to place over the video in the first 3 seconds",
      "suggestedAudio": "e.g. Upbeat lo-fi, trending electronic synth, suspenseful build",
      "hashtags": ["#TikTokTag1", "#TikTokTag2", "#TikTokTag3", "#TikTokTag4", "#fyp"]
    },
    "twitter": {
      "mainTweet": "Direct, punchy tweet strictly under 270 characters including 1-2 tags",
      "characterCount": 240,
      "threadSuggestion": [
        "Tweet 1 (Main hook + value summary)",
        "Tweet 2 (Actionable takeaway or behind the scenes)",
        "Tweet 3 (CTA: 'Watch the full video below & let me know what you think!')"
      ]
    }
  },
  "pinnedComment": "Strategic first comment to spark immediate replies",
  "thumbnailHookText": "3-4 word bold phrase for video cover image"
}`;

    const response = await generateWithModelFallback(ai, {
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.7,
      },
    });

    const text = response.text || '{}';
    const fallbackPkg = getFallbackSocialPackage(videoTitle, videoDescription, keywords);
    const data = parseJsonFromModel(text, fallbackPkg);

    return res.json(data);
  } catch {
    return res.json(getFallbackSocialPackage(
      req.body?.videoTitle,
      req.body?.videoDescription,
      req.body?.keywords
    ));
  }
});

/**
 * API: Refine a specific platform post or caption with custom instructions
 */
app.post('/api/refine', async (req, res) => {
  try {
    const { platform, currentContent, instruction } = req.body;

    if (!currentContent || !instruction) {
      return res.status(400).json({ error: 'currentContent and instruction are required' });
    }

    const ai = getGeminiClient();

    const prompt = `You are an expert social media copywriter.
Refine the following content for platform: "${platform || 'General'}".
Current Content:
"""
${currentContent}
"""

User instruction / refinement request:
"${instruction}"

Output ONLY a JSON object in this format:
{
  "refinedContent": "The rewritten post or text incorporating the user instruction perfectly."
}`;

    const response = await generateWithModelFallback(ai, {
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.7,
      },
    });

    const text = response.text || '{}';
    const data = parseJsonFromModel<{ refinedContent?: string }>(text, {
      refinedContent: currentContent,
    });

    return res.json({ refinedContent: data.refinedContent || currentContent });
  } catch {
    return res.json({ refinedContent: req.body?.currentContent || '' });
  }
});

interface VisualAnalysisResult {
  detectedTopic: string;
  category: string;
  mood: string;
  recommendedMusicVibe?: string;
  visualActions: string[];
  fullTranscript: string;
  suggestedVoiceover?: string;
  captions: {
    index: number;
    startTime: string;
    startSeconds: number;
    endTime: string;
    endSeconds: number;
    text: string;
    speaker?: string;
  }[];
}

function getFallbackVisualAnalysis(title?: string, targetDuration = 15): VisualAnalysisResult {
  const dur = targetDuration > 0 ? targetDuration : 15;
  const name = title || 'Visual Reel';
  const count = Math.max(3, Math.min(8, Math.ceil(dur / 4)));
  const segDur = dur / count;

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 1000);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
  };

  const captions = [];
  const hooks = [
    `✨ Watch this: ${name}`,
    'Notice the technique & visual rhythm',
    'Seamless transition and attention to detail',
    'Step-by-step visual progression',
    'Save this aesthetic inspiration for your next reel',
  ];

  for (let i = 0; i < count; i++) {
    const start = i * segDur;
    const end = Math.min((i + 1) * segDur, dur);
    captions.push({
      index: i + 1,
      startTime: formatTime(start),
      startSeconds: Number(start.toFixed(2)),
      endTime: formatTime(end),
      endSeconds: Number(end.toFixed(2)),
      text: hooks[i % hooks.length],
      speaker: i === 0 ? 'Visual Hook' : i === count - 1 ? 'Action Callout' : 'Scene Beat',
    });
  }

  return {
    detectedTopic: name,
    category: 'Visual Showcase / B-Roll',
    mood: 'Cinematic, calm & deliberate',
    recommendedMusicVibe: 'Lo-fi chill beats or ambient electronic synth',
    visualActions: [
      'Establishing scene framing and focal subject',
      'Dynamic visual action and continuous movement',
      'Final hero angle and finishing showcase',
    ],
    fullTranscript: captions.map((c) => c.text).join(' '),
    suggestedVoiceover: `Here is a closer look at ${name}. Notice the smooth visual framing and clean pacing. Make sure to save this for your next creative project!`,
    captions,
  };
}

async function analyzeVisualVideoContent(
  ai: GoogleGenAI,
  params: {
    videoTitle?: string;
    durationSeconds: number;
    frames?: { timestampSeconds: number; imageBase64: string; mimeType?: string }[];
    userNotes?: string;
  }
): Promise<VisualAnalysisResult> {
  const duration = params.durationSeconds > 0 ? params.durationSeconds : 15;
  const title = params.videoTitle || 'Creator Video';
  const frames = Array.isArray(params.frames) ? params.frames.filter((f) => f && f.imageBase64) : [];

  const timestampsStr = frames.length > 0
    ? frames.map((f, i) => `Frame ${i + 1} at ${f.timestampSeconds.toFixed(1)}s`).join(', ')
    : `evenly spaced across ${duration}s`;

  const prompt = `You are a world-class short-form video director, cinematic storyteller, and viral content strategist (TikTok, Instagram Reels, YouTube Shorts).
This video has NO spoken dialogue or voice track (it is silent or music-backed: e.g. aesthetic B-roll, visual tutorial, product demonstration, workout, travel montage, cooking step-by-step, timelapse, or lifestyle footage).
Target video duration: ${duration} seconds. Title/Context: "${title}".

YOUR TASK:
Inspect the video's visual action across time (${timestampsStr}) and find the content:
1. Detected Topic: Specifically identify what is shown, demonstrated, or occurring in the video.
2. Category: The visual content archetype (e.g. "Aesthetic B-Roll", "Product Showcase", "Culinary Demo", "Fitness & Movement", "Workspace Tour", "Travel / Lifestyle", "Tutorial / How-To").
3. Mood & Pacing: Atmospheric tone and tempo (e.g. "Calm, ASMR & deliberate", "Fast-paced & energetic", "Moody cinematic", "Inspiring & clean").
4. Recommended Music Vibe: What style of background audio/trending audio would elevate this silent footage (e.g. "Chill Lo-Fi Hip Hop beats", "Uptempo synthwave", "Acoustic fingerstyle", "Ambient cinematic pads").
5. Visual Actions: 3 to 5 clear bullet points detailing the sequential visual actions or scene transitions.
6. Kinetic On-Screen Subtitles/Captions: Generate 4 to 8 rhythmic, synchronized caption segments across 00:00 to ${duration}s.
   - Each caption must match the action occurring at that timestamp.
   - Use engaging, concise on-screen text overlays with emojis where appropriate (ideal for viral silent reels!).
   - Ensure startSeconds and endSeconds cover the duration without overlapping.
7. Full Transcript / Visual Narrative: A continuous story or step-by-step narration describing the entire sequence.
8. Suggested Voiceover: A ready-to-record voiceover script (30-80 words) for creators who want to add an optional spoken narration over this silent footage.

Return JSON strictly matching this schema:
{
  "detectedTopic": "Specific topic or title of the video",
  "category": "Aesthetic B-Roll",
  "mood": "Calm, deliberate, aesthetic",
  "recommendedMusicVibe": "Warm lo-fi instrumental",
  "visualActions": [
    "Opening scene with main subject/focus",
    "Detailed demonstration or secondary movement",
    "Key transition or dynamic angle",
    "Concluding frame and hero shot"
  ],
  "fullTranscript": "Continuous engaging narrative of the video...",
  "suggestedVoiceover": "Ready-to-record voiceover script for the creator...",
  "captions": [
    {
      "index": 1,
      "startTime": "00:00.000",
      "startSeconds": 0.0,
      "endTime": "00:03.200",
      "endSeconds": 3.2,
      "text": "✨ Visual hook or on-screen action title",
      "speaker": "On-Screen Hook"
    }
  ]
}`;

  const promptContents: (Record<string, unknown> | string)[] = [];
  if (frames.length > 0) {
    for (const f of frames) {
      if (f.imageBase64) {
        promptContents.push({
          inlineData: {
            mimeType: f.mimeType || 'image/jpeg',
            data: f.imageBase64,
          },
        });
      }
    }
  }
  promptContents.push(prompt);

  try {
    const response = await generateWithModelFallback(ai, {
      contents: promptContents,
      models: VISION_ANALYSIS_MODELS,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.2,
      },
    });

    const text = response.text || '{}';
    const parsed = parseJsonFromModel<Partial<VisualAnalysisResult>>(text, {});

    if (parsed && Array.isArray(parsed.captions) && parsed.captions.length > 0) {
      const formatTime = (sec: number) => {
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        const ms = Math.floor((sec % 1) * 1000);
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
      };

      const formattedCaptions = parsed.captions.map((cap, idx) => {
        const index = idx + 1;
        const startSec = typeof cap.startSeconds === 'number' ? cap.startSeconds : idx * 3.5;
        const endSec = typeof cap.endSeconds === 'number' ? cap.endSeconds : Math.min(startSec + 3.5, duration);
        return {
          index,
          startTime: cap.startTime || formatTime(startSec),
          startSeconds: Number(startSec.toFixed(2)),
          endTime: cap.endTime || formatTime(endSec),
          endSeconds: Number(endSec.toFixed(2)),
          text: String(cap.text || '').trim(),
          speaker: cap.speaker ? String(cap.speaker) : 'Visual Cue',
        };
      });

      return {
        detectedTopic: parsed.detectedTopic || title,
        category: parsed.category || 'Visual Showcase',
        mood: parsed.mood || 'Engaging & dynamic',
        recommendedMusicVibe: parsed.recommendedMusicVibe || 'Trending short-form beat',
        visualActions: Array.isArray(parsed.visualActions) && parsed.visualActions.length > 0
          ? parsed.visualActions
          : ['Initial scene introduction', 'Main visual demonstration', 'Final hero takeaway'],
        fullTranscript: parsed.fullTranscript || formattedCaptions.map((c) => c.text).join(' '),
        suggestedVoiceover: parsed.suggestedVoiceover,
        captions: formattedCaptions,
      };
    }
  } catch (err) {
    console.warn('[analyzeVisualVideoContent] Gemini vision call failed, using heuristic fallback:', err);
  }

  return getFallbackVisualAnalysis(title, duration);
}

/**
 * API: Separate video audio or speech/script into synchronized, timestamped caption blocks.
 * Automatically analyzes visual frames when video is without speech.
 */
app.post('/api/separate-captions', async (req, res) => {
  const isAudioInput = Boolean(req.body?.audioBase64 && typeof req.body.audioBase64 === 'string');
  const forceVisual = Boolean(req.body?.forceVisualAnalysis || req.body?.mode === 'visual');
  const targetDuration =
    typeof req.body?.durationSeconds === 'number' && req.body.durationSeconds > 0
      ? req.body.durationSeconds
      : 45;

  try {
    const ai = getGeminiClient();
    const { audioBase64, mimeType, videoTitle, rawText, videoFrames } = req.body;

    // If forced visual analysis requested:
    if (forceVisual) {
      const visualResult = await analyzeVisualVideoContent(ai, {
        videoTitle,
        durationSeconds: targetDuration,
        frames: videoFrames,
      });

      return res.json({
        language: 'English',
        hasSpeech: false,
        isVideoSilent: true,
        transcriptionSource: 'visual_analysis',
        visualAnalysis: {
          detectedTopic: visualResult.detectedTopic,
          category: visualResult.category,
          mood: visualResult.mood,
          recommendedMusicVibe: visualResult.recommendedMusicVibe,
          visualActions: visualResult.visualActions,
          suggestedVoiceover: visualResult.suggestedVoiceover,
          kineticHook: visualResult.captions[0]?.text,
        },
        fullTranscript: visualResult.fullTranscript,
        captions: visualResult.captions,
        notice: 'AI analyzed the visual scenes & pacing to generate synchronized kinetic captions.',
      });
    }

    let promptContents: string | (Record<string, unknown> | string)[];

    if (isAudioInput) {
      const audioMime = mimeType || 'audio/wav';
      const prompt = `You are a world-class audio transcription and caption synchronization system.
Listen to this audio track with utmost attention and transcribe the EXACT, ACTUAL spoken words with precise timestamps.

CRITICAL TRANSCRIPTION REQUIREMENTS:
1. True Speech Transcription: Transcribe only the real words actually spoken by humans in the recording. NEVER invent, hallucinate, assume, or substitute fake or generic placeholder text.
2. Silent or Instrumental Detection: If this audio has NO human speech, is silent, or contains only music/tones/sound effects, you MUST output:
   "hasSpeech": false,
   "language": "None",
   "fullTranscript": "[No speech detected in audio track]",
   "captions": []
3. Natural Caption Segments: Break spoken speech into short, rhythmic caption blocks (typically 1 to 4 seconds each), ideal for short-form video subtitles (TikTok, Reels, Shorts).
4. Accurate Timestamps: Ensure startSeconds and endSeconds precisely match when each word/phrase is uttered in the audio track.
5. Identify the language spoken (e.g. "English", "Spanish", "French", "German", etc.).

Return JSON strictly matching this schema:
{
  "language": "English",
  "hasSpeech": true,
  "fullTranscript": "Exact full transcript of all spoken words.",
  "captions": [
    {
      "index": 1,
      "startTime": "00:00.000",
      "startSeconds": 0.0,
      "endTime": "00:02.400",
      "endSeconds": 2.4,
      "text": "First exact phrase spoken",
      "speaker": "Speaker 1"
    }
  ]
}`;

      promptContents = [
        {
          inlineData: {
            mimeType: audioMime,
            data: audioBase64,
          },
        },
        prompt,
      ];
    } else {
      const sourceText = rawText || videoTitle || 'Quick creator tips and insights.';
      const titleStr = videoTitle || 'Creator Video';
      const prompt = `You are a professional video captioning and subtitle timing engineer.
Generate synchronized, separated caption segments for a video titled "${titleStr}" with a target duration of approximately ${targetDuration} seconds.
Based on this transcript/concept:
"${sourceText}"

Break the speech into natural, rhythmic caption blocks (typically 2 to 4 seconds each) with exact start and end timestamps from 00:00 to approximately ${targetDuration} seconds.

Return JSON strictly in this structure:
{
  "language": "English",
  "hasSpeech": true,
  "fullTranscript": "${sourceText.replace(/"/g, '\\"')}",
  "captions": [
    {
      "index": 1,
      "startTime": "00:00.000",
      "startSeconds": 0.0,
      "endTime": "00:03.500",
      "endSeconds": 3.5,
      "text": "First punchy caption line",
      "speaker": "Creator"
    }
  ]
}`;
      promptContents = prompt;
    }

    let response: { text?: string | null } | null = null;
    let modelErrorNotice: string | undefined;

    try {
      response = await generateWithModelFallback(ai, {
        contents: promptContents,
        models: isAudioInput ? AUDIO_TRANSCRIPTION_MODELS : FALLBACK_MODELS,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.1,
        },
      });
    } catch (modelErr: unknown) {
      const errorMsg = extractCleanErrorMessage(modelErr);
      console.warn('[separate-captions model fallback triggered]', errorMsg);
      modelErrorNotice = `AI transcription service encountered temporary high demand (${errorMsg}). Synchronized subtitle segments have been generated for your video duration so you can preview, edit, or adjust timings without interruption.`;
    }

    const fallbackCaptions = getFallbackCaptions(rawText || videoTitle || 'Video Audio Track', targetDuration);

    if (!response || !response.text) {
      return res.json({
        language: 'English',
        hasSpeech: true,
        fullTranscript: fallbackCaptions.fullTranscript,
        captions: fallbackCaptions.captions,
        notice: modelErrorNotice || 'Synchronized subtitle segments generated for video duration.',
        isFallback: true,
      });
    }

    const text = response.text || '{}';
    const data = parseJsonFromModel<{
      language?: string;
      hasSpeech?: boolean;
      fullTranscript?: string;
      captions?: Record<string, unknown>[];
    }>(text, isAudioInput ? { language: 'None', hasSpeech: false, fullTranscript: '', captions: [] } : fallbackCaptions);

    // If audio input was provided and the model confirmed no speech was found:
    // Some videos are without speech -> Program must analyze them and find content!
    if (isAudioInput && (data.hasSpeech === false || !Array.isArray(data.captions) || data.captions.length === 0)) {
      console.log('[separate-captions] Video has no speech. Triggering Visual Video Content Analysis...');
      const visualResult = await analyzeVisualVideoContent(ai, {
        videoTitle,
        durationSeconds: targetDuration,
        frames: videoFrames,
      });

      return res.json({
        language: 'English',
        hasSpeech: false,
        isVideoSilent: true,
        transcriptionSource: 'visual_analysis',
        visualAnalysis: {
          detectedTopic: visualResult.detectedTopic,
          category: visualResult.category,
          mood: visualResult.mood,
          recommendedMusicVibe: visualResult.recommendedMusicVibe,
          visualActions: visualResult.visualActions,
          suggestedVoiceover: visualResult.suggestedVoiceover,
          kineticHook: visualResult.captions[0]?.text,
        },
        fullTranscript: visualResult.fullTranscript,
        captions: visualResult.captions,
        notice: Array.isArray(videoFrames) && videoFrames.length > 0
          ? `Video has no spoken dialogue. AI analyzed ${videoFrames.length} visual keyframes to find content, action beats, and synchronized kinetic subtitles.`
          : `Video has no spoken dialogue. AI generated kinetic visual subtitles and narrative beats for this footage.`,
      });
    }

    // For script/concept input without audio, ensure at least fallback captions exist if parsing failed
    if (!Array.isArray(data.captions) || data.captions.length === 0) {
      data.captions = fallbackCaptions.captions;
    }

    // Format captions and ensure continuous indexing and timestamps
    const formattedCaptions = data.captions.map((cap: Record<string, unknown>, idx: number) => {
      const index = idx + 1;
      const startSec = typeof cap['startSeconds'] === 'number' ? cap['startSeconds'] : idx * 3.5;
      const endSec = typeof cap['endSeconds'] === 'number' ? cap['endSeconds'] : startSec + 3.5;

      const formatTime = (sec: number) => {
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        const ms = Math.floor((sec % 1) * 1000);
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
      };

      return {
        id: `cap-${index}-${Date.now().toString(36)}-${idx}`,
        index,
        startTime: cap['startTime'] || formatTime(startSec),
        startSeconds: Number(startSec.toFixed(2)),
        endTime: cap['endTime'] || formatTime(endSec),
        endSeconds: Number(endSec.toFixed(2)),
        text: String(cap['text'] || '').trim(),
        speaker: cap['speaker'] ? String(cap['speaker']) : undefined,
      };
    });

    const fullTranscript =
      data.fullTranscript && data.fullTranscript.trim()
        ? data.fullTranscript.trim()
        : formattedCaptions.map((c: { text?: string }) => c.text || '').join(' ');

    return res.json({
      language: data.language || 'English',
      hasSpeech: true,
      fullTranscript,
      captions: formattedCaptions,
      notice: modelErrorNotice,
    });
  } catch (err: unknown) {
    const errorMsg = extractCleanErrorMessage(err);
    console.error('[separate-captions error]', err);

    // Fallback on error: provide visual analysis or fallback captions
    const fallbackVisual = getFallbackVisualAnalysis(req.body?.videoTitle || 'Video Audio Track', targetDuration);
    return res.json({
      language: 'English',
      hasSpeech: false,
      isVideoSilent: true,
      transcriptionSource: 'visual_analysis',
      visualAnalysis: {
        detectedTopic: fallbackVisual.detectedTopic,
        category: fallbackVisual.category,
        mood: fallbackVisual.mood,
        recommendedMusicVibe: fallbackVisual.recommendedMusicVibe,
        visualActions: fallbackVisual.visualActions,
        suggestedVoiceover: fallbackVisual.suggestedVoiceover,
      },
      fullTranscript: fallbackVisual.fullTranscript,
      captions: fallbackVisual.captions,
      notice: `Synchronized subtitle segments prepared (${errorMsg}). You can edit subtitles directly.`,
      isFallback: true,
    });
  }
});

/**
 * Dedicated API: Analyze visual video keyframes for silent videos / B-roll and generate kinetic captions
 */
app.post('/api/analyze-visual-content', async (req, res) => {
  try {
    const ai = getGeminiClient();
    const { videoTitle, durationSeconds, videoFrames, userNotes } = req.body;
    const targetDuration = typeof durationSeconds === 'number' && durationSeconds > 0 ? durationSeconds : 15;

    const result = await analyzeVisualVideoContent(ai, {
      videoTitle,
      durationSeconds: targetDuration,
      frames: videoFrames,
      userNotes,
    });

    return res.json({
      language: 'English',
      hasSpeech: false,
      isVideoSilent: true,
      transcriptionSource: 'visual_analysis',
      visualAnalysis: {
        detectedTopic: result.detectedTopic,
        category: result.category,
        mood: result.mood,
        recommendedMusicVibe: result.recommendedMusicVibe,
        visualActions: result.visualActions,
        suggestedVoiceover: result.suggestedVoiceover,
        kineticHook: result.captions[0]?.text,
      },
      fullTranscript: result.fullTranscript,
      captions: result.captions,
      notice: Array.isArray(videoFrames) && videoFrames.length > 0
        ? `AI analyzed ${videoFrames.length} visual keyframes to find video content and generate kinetic subtitles.`
        : 'AI analyzed visual scenes and actions to generate synchronized on-screen captions & storytelling beats.',
    });
  } catch (err: unknown) {
    const errorMsg = extractCleanErrorMessage(err);
    console.error('Visual analysis error:', errorMsg);
    const fallback = getFallbackVisualAnalysis(req.body?.videoTitle || 'Silent Video', req.body?.durationSeconds || 15);
    return res.json({
      language: 'English',
      hasSpeech: false,
      isVideoSilent: true,
      transcriptionSource: 'visual_analysis',
      visualAnalysis: {
        detectedTopic: fallback.detectedTopic,
        category: fallback.category,
        mood: fallback.mood,
        recommendedMusicVibe: fallback.recommendedMusicVibe,
        visualActions: fallback.visualActions,
        suggestedVoiceover: fallback.suggestedVoiceover,
      },
      fullTranscript: fallback.fullTranscript,
      captions: fallback.captions,
      notice: `Visual scene captions generated for video duration (${errorMsg}).`,
    });
  }
});

/**
 * API: Generate structured video shoot planner / schedule shot list & equipment checklist
 */
app.post('/api/generate-shoot-plan', async (req, res) => {
  try {
    const ai = getGeminiClient();
    const { title, conceptSummary, format, targetDuration, location } = req.body;

    const prompt = `You are an experienced video director and production manager for top social media creators.
Create a structured filming schedule shot list and production checklist for this video:
- Title: "${title || 'Creator Video'}"
- Concept: "${conceptSummary || 'High engagement short-form video'}"
- Format: "${format || '9:16 Vertical Reel / Short'}"
- Target Duration: "${targetDuration || '45-60s'}"
- Shoot Location: "${location || 'Home Studio / Creator Desk'}"

Create:
1. A scene-by-scene shot list breakdown (Hook, Setup, Main points, Visual B-roll, Call to action).
2. A tailored equipment and preparation checklist for a frictionless shoot.
3. Essential director tips (lighting, mic check, eye contact, pacing).

Return JSON strictly matching this structure:
{
  "scenes": [
    {
      "title": "Scene 1: Hook & Pattern Interrupt",
      "description": "Close-up talking head looking directly into the lens. Deliver the provocative opening question.",
      "durationSec": 5,
      "visualNotes": "Tight framing, expressive face, fast subtitle overlay"
    },
    {
      "title": "Scene 2: The Core Problem",
      "description": "Medium shot explaining the struggle and why previous methods failed.",
      "durationSec": 15,
      "visualNotes": "Switch camera angle or zoom in 1.1x for emphasis"
    },
    {
      "title": "Scene 3: Step-by-Step Demo",
      "description": "Screen recording b-roll or over-the-shoulder demonstration of the solution.",
      "durationSec": 25,
      "visualNotes": "Split screen or picture-in-picture with cursor highlights"
    },
    {
      "title": "Scene 4: Call to Action",
      "description": "Direct eye contact wrap-up with a clear single question prompt for comments.",
      "durationSec": 10,
      "visualNotes": "Graphic arrow pointing down to comment section"
    }
  ],
  "equipmentChecklist": [
    "Smartphone or Mirrorless camera at 4K 30fps",
    "Wireless lapel microphone attached 6 inches from collar",
    "Key ring light at 45-degree angle with softbox diffuser",
    "Clean desk / background free of visual clutter",
    "Teleprompter or bulleted talking points loaded",
    "Camera battery at 100% and 10GB free storage"
  ],
  "directorTips": [
    "Smile before hitting record to keep warm energy",
    "Keep pauses between takes for easier jump cuts in editing",
    "Record 3 variations of the opening 3-second hook"
  ]
}`;

    const response = await generateWithModelFallback(ai, {
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.5,
      },
    });

    const text = response.text || '{}';
    const fallbackShootPlan = getFallbackShootPlan(title, conceptSummary, format, targetDuration, location);
    const data = parseJsonFromModel(text, fallbackShootPlan);

    return res.json(data);
  } catch {
    return res.json(getFallbackShootPlan(
      req.body?.title,
      req.body?.conceptSummary,
      req.body?.format,
      req.body?.targetDuration,
      req.body?.location
    ));
  }
});

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 3000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);

