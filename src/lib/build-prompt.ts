export type BuildPromptParams = {
  text: string;
  from: string;
  to: string;
  tone?: string;
  genre?: string;
  context?: string;
  glossary?: string;
  characterProfiles?: string;
  continuityNotes?: string;
  episodeContext?: string;
  storySummary?: string;
  sourceText?: string;
  stage?: number;
  mode?: 'novel' | 'general';
  /** Novel-only: preserve dialogue vs narration markers and punctuation habits */
  preserveDialogueLayout?: boolean;
  /** Sub-template for general mode accuracy */
  domainPreset?: 'general' | 'legal' | 'it' | 'medical';
};

function dialogueRuleNovel(to: string): string {
  return `
5. DIALOGUE & NARRATION: Preserve quotation marks/brackets used in the source (e.g. 「」, 『』, ", '). Do not merge dialogue lines with narration lines. Keep onomatopoeia and ellipsis spacing habits unless grammatically impossible in ${to}.
`;
}

const DOMAIN_EXTRA: Record<string, string> = {
  legal:
    'DOMAIN LEGAL: Preserve defined terms, party names, article numbers, and citation formats. Do not paraphrase obligations or dates.',
  it: 'DOMAIN IT: Preserve API names, commands, paths, version numbers, and code tokens exactly. Translate comments and prose only.',
  medical:
    'DOMAIN MEDICAL: Use standard terminology for the target locale. Do not invent dosages or diagnoses; keep numbers and units exactly.',
  general: '',
};

export function buildPrompt(params: BuildPromptParams): string {
  const {
    text,
    from,
    to,
    tone = 'natural',
    genre = 'Novel',
    context,
    glossary,
    characterProfiles,
    continuityNotes,
    episodeContext,
    storySummary,
    sourceText,
    stage,
    mode = 'novel',
    preserveDialogueLayout = true,
    domainPreset = 'general',
  } = params;

  if (stage === 10) {
    return `[SYSTEM: STORY BIBLE SUMMARIZER]
You are updating the running Story Bible for a serialized novel translation workspace.
<strict_directives>
1. Output ONLY concise bullet points.
2. Focus on newly introduced facts, character shifts, relationship movement, locations, powers, factions, promises, clues, and unresolved hooks.
3. Do NOT repeat unchanged background unless the chapter meaningfully updates it.
4. Preserve names, titles, spellings, and terminology exactly as they appear in the chapter text.
5. If a new honorific or name variant CONFLICTS with an earlier bullet in [Current Story Bible], add a line "CONFLICT CHECK:" explaining the discrepancy briefly — do not silently overwrite established facts.
</strict_directives>
${storySummary ? `[Current Story Bible]:\n${storySummary}\n` : ''}
${characterProfiles ? `[Character Profiles]:\n${characterProfiles}\n` : ''}
${context ? `[World Lore]:\n${context}\n` : ''}
${continuityNotes ? `[Cross Project Continuity Notes]:\n${continuityNotes}\n` : ''}
<chapter_text>
${text}
</chapter_text>
Output ONLY the summary points.`;
  }

  const domainLine = DOMAIN_EXTRA[domainPreset] || '';

  let baseInstructions = `[SYSTEM: DETERMINISTIC TRANSLATION ENGINE — MODE: ${mode === 'general' ? 'GENERAL ACCURACY' : 'NOVEL SPECIALIST'}]
You are a highly constrained, professional translation engine converting text from ${from} to ${to}.
<strict_directives>
1. NO YAP: Output ONLY the requested final text. NEVER output intros/outros like "Here is the translation" or "Understood".
2. FORMAT PRESERVATION: Do NOT wrap your output in markdown code blocks (\`\`\`). Do NOT alter capitalization artificially.
3. 1:1 STRUCTURE: You MUST preserve the exact paragraph/line break structure of the source text. Do not merge or split paragraphs.
${mode === 'general'
  ? `4. STRICT ACCURACY: Prioritize factual accuracy above all else. Do NOT add creative interpretation. Preserve technical terms, proper nouns, and numeric data exactly.
${domainLine}`
  : `4. TONE & GENRE OVERRIDE: Your output MUST strictly reflect Tone: [${tone}] and Genre: [${genre}].
${preserveDialogueLayout ? dialogueRuleNovel(to) : ''}`}
</strict_directives>
`;
  if (glossary) baseInstructions += `[Glossary — apply these term mappings consistently]:\n${glossary}\n`;
  if (characterProfiles) baseInstructions += `[Character Profiles]:\n${characterProfiles}\n`;
  if (storySummary) baseInstructions += `[Previous Story Summary]:\n${storySummary}\n`;
  if (continuityNotes) baseInstructions += `[Cross Project Continuity Notes]:\n${continuityNotes}\n`;
  if (episodeContext) {
    baseInstructions += `
CRITICAL INSTRUCTION: The following excerpts are PREVIOUS TRANSLATED CHAPTERS or approved continuity references.
Use them ONLY for lore, pacing, callbacks, and character tone consistency. DO NOT translate this or include it in your output.
<continuity_reference_do_not_translate_this>
${episodeContext}
</continuity_reference_do_not_translate_this>
`;
  }
  if (context) baseInstructions += `Additional Context:\n${context}\n`;

  let prompt = '';

  if (stage === 1) {
    prompt = `${baseInstructions}
MISSION: Stage 1 (Draft Translator).
Provide a highly accurate, 1:1 structural draft translation of the source text. Do not miss any sentences.
<source_text>
${text}
</source_text>`;
  } else if (stage === 2) {
    prompt = `${baseInstructions}
MISSION: Stage 2 (Lore/Tone Editor).
Review the Source Text and the Current Draft. Fix character speech patterns, honorifics, and respect the Character Profiles strictly.
<source_text>
${sourceText}
</source_text>
<current_draft>
${text}
</current_draft>
Output ONLY the revised draft.`;
  } else if (stage === 3) {
    prompt = `${baseInstructions}
MISSION: Stage 3 (Pacing & Rhythm Agent).
Ensure the translation matches the original author's sentence length, rhythm, and pacing. Keep short impacts short, and long descriptive sentences flowing.
<source_text>
${sourceText}
</source_text>
<current_draft>
${text}
</current_draft>
Output ONLY the revised draft.`;
  } else if (stage === 4) {
    prompt = `${baseInstructions}
MISSION: Stage 4 (Target Culture & Native Resonance Expert).
Your ultimate goal is **Total Cultural Immersion into the ${to} native culture**.
Analyze the source text for foreign idioms, wordplay, pop-culture references, historical contexts, and subtle social dynamics (like honorifics or politeness levels).
You MUST completely transcreate these elements using equivalent cultural touchstones, idioms, and expressions that are highly natural to native ${to} speakers. 
- If translating to Korean/Japanese, strictly calibrate honorifics/politeness levels between characters and adapt subtle emotional nuances.
- If translating to English/Western languages, convert Eastern idioms into equivalent Western cultural idioms.
If a literal translation is even slightly awkward or foreign-sounding, rewrite the sentence entirely from the perspective of a native ${to} writer, while protecting the core narrative facts.
<source_text>
${sourceText}
</source_text>
<current_draft>
${text}
</current_draft>
Output ONLY the revised draft.`;
  } else if (stage === 5) {
    prompt = `${baseInstructions}
MISSION: Stage 5 (Chief Editor).
${mode === 'general'
  ? 'Fix grammar errors, typos, and unnatural phrasing. Do NOT change the meaning or add creative embellishment. Keep it factual and precise.'
  : 'Perform a final polish. Fix any lingering awkward phrasing, typos, or grammatical errors. Ensure perfect narrative flow.'}
<source_text>
${sourceText}
</source_text>
<current_draft>
${text}
</current_draft>
Output ONLY the final polished draft. Never add commentary.`;
  } else {
    prompt = `${baseInstructions}
Analyze the text or translate directly depending on the prompt:
<text>
${text}
</text>`;
  }

  return prompt;
}
