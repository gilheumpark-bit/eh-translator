import { NextRequest, NextResponse } from 'next/server';
import { streamText, generateText } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { createMistral } from '@ai-sdk/mistral';
import { buildPrompt, type BuildPromptParams } from '@/lib/build-prompt';

const DEFAULT_MODELS: Record<string, string> = {
  gemini: 'gemini-2.5-flash',
  openai: 'gpt-4o',
  claude: 'claude-3-5-sonnet-latest',
  deepseek: 'deepseek-chat',
  mistral: 'mistral-large-latest',
};

const ALLOWED_PROVIDERS = new Set(Object.keys(DEFAULT_MODELS));

function approxTokens(s: string): number {
  return Math.ceil(s.length / 4);
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as BuildPromptParams & {
      provider?: string;
      apiKey?: string;
      model?: string;
      stage?: number;
      mode?: 'novel' | 'general';
    };
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
    switch (provider) {
      case 'gemini':
        aiModel = createGoogleGenerativeAI({ apiKey: finalApiKey })(finalModel);
        break;
      case 'openai':
        aiModel = createOpenAI({ apiKey: finalApiKey })(finalModel);
        break;
      case 'claude':
        aiModel = createAnthropic({ apiKey: finalApiKey })(finalModel);
        break;
      case 'deepseek':
        aiModel = createDeepSeek({ apiKey: finalApiKey })(finalModel);
        break;
      case 'mistral':
        aiModel = createMistral({ apiKey: finalApiKey })(finalModel);
        break;
      default:
        return NextResponse.json({ error: '지원하지 않는 번역 엔진입니다.' }, { status: 400 });
    }

    const prompt = buildPrompt(body);
    const promptTokens = approxTokens(prompt);

    const dynamicTemperature = stage === 4 && mode === 'novel' ? 0.4 : 0.1;
    const dynamicTopP = stage === 4 && mode === 'novel' ? 0.95 : 0.9;

    if (stage === 10 || stage === 0) {
      const { text } = await generateText({
        model: aiModel,
        prompt: prompt,
        temperature: dynamicTemperature,
        topP: dynamicTopP,
      });
      return NextResponse.json(
        { result: text, stage, approxPromptTokens: promptTokens },
        { headers: { 'X-Approx-Prompt-Tokens': String(promptTokens) } }
      );
    }

    const resultStream = await streamText({
      model: aiModel,
      prompt: prompt,
      temperature: dynamicTemperature,
      topP: dynamicTopP,
    });

    const res = resultStream.toTextStreamResponse();
    res.headers.set('X-Approx-Prompt-Tokens', String(promptTokens));
    return res;
  } catch (err: unknown) {
    console.error('Translation Error:', err);
    return NextResponse.json({ error: '번역 처리 중 서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' }, { status: 500 });
  }
}
