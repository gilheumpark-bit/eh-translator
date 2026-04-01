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

function buildPrompt(params: any) {
  const { text, from, to, tone, genre, context, glossary, characterProfiles, episodeContext, storySummary, sourceText, stage } = params;

  let baseInstructions = `[SYSTEM: DETERMINISTIC TRANSLATION ENGINE]
You are a highly constrained, professional translation engine converting text from ${from} to ${to}.
<strict_directives>
1. NO YAP: Output ONLY the requested final text. NEVER output intros/outros like "Here is the translation" or "Understood".
2. FORMAT PRESERVATION: Do NOT wrap your output in markdown code blocks (\`\`\`). Do NOT alter capitalization artificially.
3. 1:1 STRUCTURE: You MUST preserve the exact paragraph/line break structure of the source text. Do not merge or split paragraphs.
4. TONE & GENRE OVERRIDE: Your output MUST strictly reflect Tone: [${tone}] and Genre: [${genre}].
</strict_directives>
`;
  if (glossary) baseInstructions += `[Glossary]:\n${glossary}\n`;
  if (characterProfiles) baseInstructions += `[Character Profiles]:\n${characterProfiles}\n`;
  if (storySummary) baseInstructions += `[Previous Story Summary]:\n${storySummary}\n`;
  if (episodeContext) {
    baseInstructions += `
CRITICAL INSTRUCTION: The following is the PREVIOUS CHAPTER'S TRANSLATION.
Use it ONLY for lore, character tone, and continuity. DO NOT translate this or include it in your output.
<previous_chapter_do_not_translate_this>
${episodeContext}
</previous_chapter_do_not_translate_this>
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
Perform a final polish. Fix any lingering awkward phrasing, typos, or grammatical errors. Ensure perfect narrative flow.
<source_text>
${sourceText}
</source_text>
<current_draft>
${text}
</current_draft>
Output ONLY the final polished draft. Never add commentary.`;
  } else if (stage === 10) {
    prompt = `${baseInstructions}
MISSION: Story Summarizer.
Extract a concise summary of the key events and new elements introduced in this chapter to append to the Story Bible. Focus on characters, locations, and major plot developments.
<chapter_text>
${text}
</chapter_text>
Output ONLY the summary points.`;
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
    const { provider = 'gemini', apiKey, model, stage = 0 } = body;

    const finalModel = model || DEFAULT_MODELS[provider] || 'gemini-2.5-flash';
    const finalApiKey = apiKey || process.env[`${provider.toUpperCase()}_API_KEY`] || '';

    if (!finalApiKey && !process.env[`${provider.toUpperCase()}_API_KEY`]) {
      return NextResponse.json({ error: `API Key missing for ${provider}` }, { status: 400 });
    }

    let aiModel;
    switch(provider) {
      case 'gemini': aiModel = createGoogleGenerativeAI({ apiKey: finalApiKey })(finalModel); break;
      case 'openai': aiModel = createOpenAI({ apiKey: finalApiKey })(finalModel); break;
      case 'claude': aiModel = createAnthropic({ apiKey: finalApiKey })(finalModel); break;
      case 'deepseek': aiModel = createDeepSeek({ apiKey: finalApiKey })(finalModel); break;
      case 'mistral': aiModel = createMistral({ apiKey: finalApiKey })(finalModel); break;
      default: return NextResponse.json({ error: `Unknown provider: ${provider}` }, { status: 400 });
    }

    const prompt = buildPrompt(body);

    // Dynamic temperature tuning: Stage 4 (Localization) requires more creativity
    const dynamicTemperature = (stage === 4) ? 0.4 : 0.1;
    const dynamicTopP = (stage === 4) ? 0.95 : 0.9;

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
    return NextResponse.json({ error: err.message || 'Translation failed' }, { status: 500 });
  }
}
