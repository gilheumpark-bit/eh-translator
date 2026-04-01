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

  let baseInstructions = `You are a professional literary translator translating a novel from ${from} to ${to}.\nGenre: ${genre}\nTone: ${tone}\n`;
  if (glossary) baseInstructions += `Glossary:\n${glossary}\n`;
  if (characterProfiles) baseInstructions += `Character Profiles:\n${characterProfiles}\n`;
  if (storySummary) baseInstructions += `Previous Summary:\n${storySummary}\n`;
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
MISSION: Agent 1 (Draft Translator). You are the Chief Translator.
Focus on structural accuracy and establishing the initial draft. Do not miss any sentences.
Translate the following source text:
<source_text>
${text}
</source_text>`;
  } else if (stage === 2) {
    prompt = `${baseInstructions}
MISSION: Agent 2 (Lore Editor). You are the Lore/Character Tone Master.
Review the Source Text and the Current Draft. Fix character speech patterns, honorifics, and respect the character profiles.
<source_text>
${sourceText}
</source_text>
<current_draft>
${text}
</current_draft>
Output ONLY the revised draft.`;
  } else if (stage === 3) {
    prompt = `${baseInstructions}
MISSION: Agent 3 (Pacing Agent). You are the Pacing/Rhythm Supervisor.
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
MISSION: Agent 4 (Subtext Analyst). You are the Subtext and Metaphor Expert.
Identify implied meanings and foreshadowing in the source text and ensure they are preserved or localized correctly in the draft without being overly literal.
<source_text>
${sourceText}
</source_text>
<current_draft>
${text}
</current_draft>
Output ONLY the revised draft.`;
  } else if (stage === 5) {
    prompt = `${baseInstructions}
MISSION: Agent 5 (Chief Reviewer). You are the Editor-in-Chief.
Perform a final polish. Fix any lingering awkward phrasing, typos, or grammatical errors. Ensure perfect narrative flow.
<source_text>
${sourceText}
</source_text>
<current_draft>
${text}
</current_draft>
Output ONLY the final polished draft.`;
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

    if (stage === 10 || stage === 0) {
      const { text } = await generateText({
        model: aiModel,
        prompt: prompt,
        temperature: 0.3,
      });
      return NextResponse.json({ result: text, stage });
    }

    const resultStream = await streamText({
      model: aiModel,
      prompt: prompt,
      temperature: 0.3,
    });

    return resultStream.toTextStreamResponse();
  } catch (err: any) {
    console.error('Translation Error:', err);
    return NextResponse.json({ error: err.message || 'Translation failed' }, { status: 500 });
  }
}
