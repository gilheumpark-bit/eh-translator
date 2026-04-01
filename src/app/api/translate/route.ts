import { NextRequest, NextResponse } from 'next/server';
import { streamText, generateText } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { createMistral } from '@ai-sdk/mistral';

const DEFAULT_MODELS: Record<string, string> = {
  gemini: 'gemini-2.5-flash',
  openai: 'gpt-4o',
  claude: 'claude-3-5-sonnet-latest',
  deepseek: 'deepseek-chat',
  mistral: 'mistral-large-latest',
};

const ALLOWED_PROVIDERS = new Set(Object.keys(DEFAULT_MODELS));

function buildPrompt(params: any) {
  const { text, from, to, tone, genre, context, glossary, characterProfiles, continuityNotes, episodeContext, storySummary, sourceText, stage, mode = 'novel' } = params;

  if (stage === 10) {
    return `[SYSTEM: STORY BIBLE SUMMARIZER]
You are updating the running Story Bible for a serialized novel translation workspace.
<strict_directives>
1. Output ONLY concise bullet points.
2. Focus on newly introduced facts, character shifts, relationship movement, locations, powers, factions, promises, clues, and unresolved hooks.
3. Do NOT repeat unchanged background unless the chapter meaningfully updates it.
4. Preserve names, titles, spellings, and terminology exactly as they appear in the chapter text.
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

  let baseInstructions = `[SYSTEM: DETERMINISTIC TRANSLATION ENGINE — MODE: ${mode === 'general' ? 'GENERAL ACCURACY' : 'NOVEL SPECIALIST'}]
You are a highly constrained, professional translation engine converting text from ${from} to ${to}.
<strict_directives>
1. NO YAP: Output ONLY the requested final text. NEVER output intros/outros like "Here is the translation" or "Understood".
2. FORMAT PRESERVATION: Do NOT wrap your output in markdown code blocks (\`\`\`). Do NOT alter capitalization artificially.
3. 1:1 STRUCTURE: You MUST preserve the exact paragraph/line break structure of the source text. Do not merge or split paragraphs.
${mode === 'general'
  ? '4. STRICT ACCURACY: Prioritize factual accuracy above all else. Do NOT add creative interpretation. Preserve technical terms, proper nouns, and numeric data exactly.'
  : `4. TONE & GENRE OVERRIDE: Your output MUST strictly reflect Tone: [${tone}] and Genre: [${genre}].`}
</strict_directives>
`;
  if (glossary) baseInstructions += `[Glossary]:\n${glossary}\n`;
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { provider = 'gemini', apiKey, model, stage = 0, mode = 'novel' } = body;

    if (!ALLOWED_PROVIDERS.has(provider)) {
      return NextResponse.json({ error: '지원하지 않는 번역 엔진입니다.' }, { status: 400 });
    }

    const finalModel = model || DEFAULT_MODELS[provider] || 'gemini-2.5-flash';
    const finalApiKey = apiKey || process.env[`${provider.toUpperCase()}_API_KEY`] || '';

    if (!finalApiKey && !process.env[`${provider.toUpperCase()}_API_KEY`]) {
      return NextResponse.json({ error: '선택한 번역 엔진의 API 키가 설정되지 않았습니다.' }, { status: 400 });
    }

    let aiModel;
    switch(provider) {
      case 'gemini': aiModel = createGoogleGenerativeAI({ apiKey: finalApiKey })(finalModel); break;
      case 'openai': aiModel = createOpenAI({ apiKey: finalApiKey })(finalModel); break;
      case 'claude': aiModel = createAnthropic({ apiKey: finalApiKey })(finalModel); break;
      case 'deepseek': aiModel = createDeepSeek({ apiKey: finalApiKey })(finalModel); break;
      case 'mistral': aiModel = createMistral({ apiKey: finalApiKey })(finalModel); break;
      default: return NextResponse.json({ error: '지원하지 않는 번역 엔진입니다.' }, { status: 400 });
    }

    const prompt = buildPrompt(body);

    // Dynamic temperature tuning: Stage 4 (Localization) requires more creativity; general mode stays flat
    const dynamicTemperature = (stage === 4 && mode === 'novel') ? 0.4 : 0.1;
    const dynamicTopP = (stage === 4 && mode === 'novel') ? 0.95 : 0.9;

    if (stage === 10 || stage === 0) {
      const { text } = await generateText({
        model: aiModel,
        prompt: prompt,
        temperature: dynamicTemperature,
        topP: dynamicTopP,
      });
      return NextResponse.json({ result: text, stage });
    }

    const resultStream = await streamText({
      model: aiModel,
      prompt: prompt,
      temperature: dynamicTemperature,
      topP: dynamicTopP,
    });

    return resultStream.toTextStreamResponse();
  } catch (err: any) {
    console.error('Translation Error:', err);
    return NextResponse.json({ error: '번역 처리 중 서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' }, { status: 500 });
  }
}
