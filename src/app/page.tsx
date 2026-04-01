'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useAuth, SignInButton, UserButton } from '@clerk/nextjs';
import { saveProjectToCloud, loadProjectFromCloud } from '@/lib/supabase';

const LANGUAGES = [
  { code: 'Korean', label: '한국어', flag: '🇰🇷' },
  { code: 'English', label: 'English', flag: '🇺🇸' },
  { code: 'Japanese', label: '日本語', flag: '🇯🇵' },
  { code: 'Chinese', label: '中文', flag: '🇨🇳' },
];

const PROVIDERS = [
  { id: 'gemini', label: 'Google Gemini', role: '1차 초안 (컨텍스트 파악)', models: ['gemini-2.0-flash', 'gemini-1.5-pro'] },
  { id: 'deepseek', label: 'DeepSeek', role: '2차 교정 (수리적, 논리적 흐름)', models: ['deepseek-chat', 'deepseek-reasoner'] },
  { id: 'claude', label: 'Anthropic Claude', role: '3차 퇴고 (문학적 감성/유창성)', models: ['claude-3-5-sonnet-20240620', 'claude-3-opus-20240229'] },
  { id: 'openai', label: 'OpenAI GPT', role: '4차 검수 (지시어 엄수 및 검증)', models: ['gpt-4o', 'gpt-4o-mini'] },
  { id: 'mistral', label: 'Mistral AI', role: '사전 분석 (스타일 분석)', models: ['mistral-large-latest'] },
];

const TONES = [
  { id: 'natural', label: '자연스럽게' },
  { id: 'literary', label: '문학적' },
  { id: 'casual', label: '구어체' },
  { id: 'formal', label: '격식체' },
  { id: 'poetic', label: '시적' },
];

const GENRES = [
  { id: 'General', label: '일반 소설' },
  { id: 'Fantasy', label: '판타지' },
  { id: 'Romance', label: '로맨스 / BL' },
  { id: 'MartialArts', label: '무협 / 선협' },
  { id: 'Sci-Fi', label: 'SF / 사이버펑크' },
  { id: 'Horror', label: '공포 / 스릴러' },
];

interface Chapter {
  name: string;
  content: string;
  result: string;
  isDone: boolean;
  stageProgress?: number; // 1~4: 진행 중인 단계, 5: 완료
}

export default function Home() {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [activeChapterIndex, setActiveChapterIndex] = useState<number | null>(null);
  const [source, setSource] = useState('');
  const [result, setResult] = useState('');
  const [from, setFrom] = useState('Korean');
  const [to, setTo] = useState('English');
  const [provider, setProvider] = useState('gemini');
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [model, setModel] = useState('');
  const [glossary, setGlossary] = useState('');
  const [tone, setTone] = useState('natural');
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [error, setError] = useState('');
  const [showGlossary, setShowGlossary] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [genre, setGenre] = useState('General');
  const [context, setContext] = useState('');
  const [worldContext, setWorldContext] = useState('');
  const [characterProfiles, setCharacterProfiles] = useState('');
  const [showCharacters, setShowCharacters] = useState(false);
  const [storySummary, setStorySummary] = useState('');
  const [showSummary, setShowSummary] = useState(false);
  const [isZenMode, setIsZenMode] = useState(false);
  const { isLoaded: isAuthLoaded, userId } = useAuth();
  const [backResult, setBackResult] = useState('');
  const [history, setHistory] = useState<{ from: string; to: string; source: string; result: string; time: number }[]>([]);
  const [fileList, setFileList] = useState<string[]>([]);
  const [styleAnalysis, setStyleAnalysis] = useState<any>(null);
  const [isCatMode, setIsCatMode] = useState(false);
  const [lockedFeature, setLockedFeature] = useState<string | null>(null);

  const isLoaded = useRef(false);

  // Sync active chapter with source/result
  useEffect(() => {
    if (activeChapterIndex !== null && chapters[activeChapterIndex]) {
      setSource(chapters[activeChapterIndex].content);
      setResult(chapters[activeChapterIndex].result);
    }
  }, [activeChapterIndex]);

  // Update chapter content when source/result changes (Debounced to prevent UI lag)
  useEffect(() => {
    if (activeChapterIndex !== null && chapters[activeChapterIndex]) {
       const timer = setTimeout(() => {
         setChapters(prev => {
           if (!prev[activeChapterIndex]) return prev;
           if (prev[activeChapterIndex].content === source && prev[activeChapterIndex].result === result) return prev;
           const next = [...prev];
           next[activeChapterIndex] = { ...next[activeChapterIndex], content: source, result: result };
           return next;
         });
       }, 300); // 300ms defer
       return () => clearTimeout(timer);
    }
  }, [source, result, activeChapterIndex]);

  // --- Persistence ---
  useEffect(() => {
    if (typeof window === 'undefined' || !isAuthLoaded || isLoaded.current) return;
    
    const loadState = async () => {
      let s = null;
      if (userId) {
         try {
           s = await loadProjectFromCloud(userId, 'default_session');
         } catch(e) { console.error('Cloud load failed', e); }
      }
      
      if (!s) {
         const savedState = localStorage.getItem('eh-translator-v2-state');
         if (savedState) {
           try { s = JSON.parse(savedState); } catch(e) { console.error(e); }
         }
      }

      if (s) {
        if (s.chapters !== undefined) setChapters(s.chapters);
        if (s.activeChapterIndex !== undefined) setActiveChapterIndex(s.activeChapterIndex);
        if (s.from !== undefined) setFrom(s.from);
        if (s.to !== undefined) setTo(s.to);
        if (s.provider !== undefined) setProvider(s.provider);
        if (s.apiKeys !== undefined) setApiKeys(s.apiKeys);
        else if (s.apiKey) setApiKeys({ [s.provider || 'gemini']: s.apiKey });
        if (s.model !== undefined) setModel(s.model);
        if (s.glossary !== undefined) setGlossary(s.glossary);
        if (s.tone !== undefined) setTone(s.tone);
        if (s.history !== undefined) setHistory(s.history);
        if (s.worldContext !== undefined) setWorldContext(s.worldContext);
        if (s.genre !== undefined) setGenre(s.genre);
        
        // v3.0 Additional states
        if (s.characterProfiles !== undefined) setCharacterProfiles(s.characterProfiles);
        if (s.storySummary !== undefined) setStorySummary(s.storySummary);
      }
      isLoaded.current = true;
    }
    
    loadState();
  }, [isAuthLoaded, userId]);

  // Auto-save (Debounced to prevent rendering freezes)
  useEffect(() => {
    if (!isLoaded.current) return;
    const state = { chapters, activeChapterIndex, from, to, provider, apiKeys, model, glossary, tone, genre, context, worldContext, history, characterProfiles, storySummary };
    
    const saveTimer = setTimeout(() => {
      localStorage.setItem('eh-translator-v2-state', JSON.stringify(state));
      // [A안] Supabase 클라우드 실시간 자동 동기화 (userId가 있을 때만)
      if (userId) {
        saveProjectToCloud(userId, 'default_session', state).catch(console.error);
      }
    }, 3000); 
    return () => clearTimeout(saveTimer);
  }, [chapters, activeChapterIndex, from, to, provider, apiKeys, model, glossary, tone, genre, context, worldContext, history, characterProfiles, storySummary]);

  const exportData = () => {
    const state = { source, result, from, to, provider, apiKeys, model, glossary, tone, history, fileList };
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `eh-translator-data-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importDocument = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setLoading(true);
    
    try {
      let newChapters: Chapter[] = [];
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileName = file.name;
        
        // 로컬 텍스트 바로 읽기
        if (fileName.toLowerCase().endsWith('.txt') || fileName.toLowerCase().endsWith('.md')) {
           const content = await file.text();
           newChapters.push({ name: fileName, content, result: '', isDone: false, stageProgress: 1 });
           continue;
        }

        // DOCX, EPUB, PDF는 서버 구동 파서(B안) 사용
        const formData = new FormData();
        formData.append('file', file);
        
        const res = await fetch('/api/upload', {
           method: 'POST',
           body: formData,
        });

        if (!res.ok) {
           const err = await res.json().catch(()=>({error: res.statusText}));
           throw new Error(err.error || 'Upload failed');
        }

        const data = await res.json();
        if (data.chapters && data.chapters.length > 0) {
           data.chapters.forEach((ch: any) => {
              newChapters.push({ name: `${fileName} - ${ch.title}`, content: ch.content, result: '', isDone: false, stageProgress: 1 });
           });
        }
      }
      
      const updatedChapters = [...chapters, ...newChapters];
      setChapters(updatedChapters);
      if (newChapters.length > 0) {
        setActiveChapterIndex(chapters.length); 
      }
      alert(`${files.length}개 원고에서 ${newChapters.length}개의 챕터를 성공적으로 추출했습니다.`);
    } catch (err) {
      console.error(err);
      alert('파일 형식 파싱에 실패했습니다 (EPUB, PDF, DOCX만 지원). 에러: ' + (err instanceof Error ? err.message : 'Unknown'));
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  const analyzeStyle = useCallback(async () => {
    if (!source.trim()) {
      setError('분석할 텍스트를 입력하세요');
      return;
    }
    setLoading(true);
    setStatusMsg('스타일 분석 중...');
    setError('');

    try {
      const p0 = apiKeys['mistral'] ? 'mistral' : provider;
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: source.slice(0, 5000), from, to, provider: p0, apiKey: apiKeys[p0], model: '', stage: 0 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      let parsed;
      try {
        parsed = JSON.parse(data.result);
      } catch (e) {
        const jsonMatch = data.result.match(/\{[\s\S]*\}/);
        if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
        else throw new Error('Analysis format error');
      }

      setStyleAnalysis(parsed);
      const matchedGenre = GENRES.find(g => g.id.toLowerCase() === parsed.genre.toLowerCase());
      if (matchedGenre) setGenre(matchedGenre.id);
      
      const matchedTone = TONES.find(t => t.id.toLowerCase() === parsed.tone.toLowerCase());
      if (matchedTone) setTone(matchedTone.id);

      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Style analysis failed');
    } finally {
      setLoading(false);
      setStatusMsg('');
    }
  }, [source, from, to, provider, apiKeys, model]);

  const translate = useCallback(async () => {
    if (!source.trim()) {
      setError('번역할 텍스트를 입력하세요');
      return;
    }
    setLoading(true);
    setError('');
    setBackResult('');

    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text: source, from, to, provider, apiKey: apiKeys[provider] || '', model, glossary, tone, genre, 
          context: `${context}\n\n[World/Lore]: ${worldContext}` 
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Translation failed');
      setResult(data.result);
      setHistory(prev => [{ from, to, source: source.slice(0, 50), result: data.result.slice(0, 50), time: Date.now() }, ...prev.slice(0, 19)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [source, from, to, provider, apiKeys, model, glossary, tone, genre, context, worldContext]);

  const refineResult = useCallback(async () => {
    if (!result.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text: result, 
          from: to, 
          to: to, 
          provider: apiKeys['claude'] ? 'claude' : provider, 
          apiKey: apiKeys['claude'] ? apiKeys['claude'] : (apiKeys[provider] || ''), 
          model: '', 
          glossary, 
          tone, 
          genre, 
          context: `Refinement request. Context: ${context}\nLore: ${worldContext}` 
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(data.result);
    } catch (err) {
        setError(err instanceof Error ? err.message : 'Refinement failed');
    } finally {
        setLoading(false);
    }
  }, [result, to, provider, apiKeys, model, glossary, tone, genre, context, worldContext]);

  const backTranslate = useCallback(async () => {
    if (!result.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text: result, 
          from: to, 
          to: from, 
          provider, 
          apiKey: apiKeys[provider] || '', 
          model, 
          tone: 'natural',
          genre: 'General',
          context: 'CHECK: Translate back strictly for verification.'
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setBackResult(data.result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Back-translation failed');
    } finally {
      setLoading(false);
    }
  }, [result, from, to, provider, apiKeys, model]);
  const fetchStream = async (payload: any, onChunk: (text: string) => void, maxRetries = 2): Promise<string> => {
    let attempts = 0;
    while (attempts <= maxRetries) {
      try {
        const res = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: res.statusText }));
          throw new Error(err.error || 'API Error');
        }
        const reader = res.body?.getReader();
        if (!reader) throw new Error('No readable stream');
        const decoder = new TextDecoder();
        let fullText = '';
        while (true) {
          const { value, done } = await reader.read();
          if (done) {
            // [3번 문제] 중간에 문장이 끊겼는지 종결어미 휴리스틱 검사
            const trimmed = fullText.trim();
            if (trimmed.length > 0 && !trimmed.match(/[\.\?\!\”\"\'\>다요]$/)) {
               if (attempts < maxRetries) throw new Error('Stream interrupted prematurely');
            }
            break;
          }
          if (value) {
            fullText += decoder.decode(value, { stream: true });
            onChunk(fullText);
          }
        }
        return fullText;
      } catch (err: any) {
        attempts++;
        if (attempts > maxRetries) throw err;
        console.warn(`Stream failed. Retrying... (${attempts}/${maxRetries})`);
        await new Promise(r => setTimeout(r, 2000));
        onChunk(`(네트워크 오류로 재시도 중... ${attempts}/${maxRetries})\n\n`);
      }
    }
    return '';
  };

  const runDeepPipeline = async (text: string, currentRes: string, startStage: number, onProgress: (msg: string) => void, onSave: (r: string, s: number) => void, episodeContext: string = '', pipelineStorySummary: string = storySummary) => {
    if (!text.trim()) return currentRes;
    const payload = { from, to, model, glossary, tone, genre, context: `${context}\nLore: ${worldContext}`, characterProfiles, episodeContext, storySummary: pipelineStorySummary };
    
    let tempResult = currentRes || text;

    if (startStage <= 1) {
      const p1 = apiKeys['gemini'] ? 'gemini' : provider;
      onProgress(`에이전트 1 (수석 번역가) 가동 중... (via ${p1})`);
      tempResult = await fetchStream({ ...payload, provider: p1, apiKey: apiKeys[p1], text, sourceText: text, stage: 1 }, (chunk) => onSave(chunk, 1));
      onSave(tempResult, 2);
    }

    if (startStage <= 2) {
      const p2 = apiKeys['deepseek'] ? 'deepseek' : provider;
      onProgress(`에이전트 2 (고증/로어 마스터) 점검 중... (via ${p2})`);
      tempResult = await fetchStream({ ...payload, provider: p2, apiKey: apiKeys[p2], text: tempResult, sourceText: text, stage: 2 }, (chunk) => onSave(chunk, 2));
      onSave(tempResult, 3);
    }

    if (startStage <= 3) {
      const p3 = apiKeys['claude'] ? 'claude' : provider;
      onProgress(`에이전트 3 (문체/호흡 감독관) 수정 중... (via ${p3})`);
      tempResult = await fetchStream({ ...payload, provider: p3, apiKey: apiKeys[p3], text: tempResult, sourceText: text, stage: 3 }, (chunk) => onSave(chunk, 3));
      onSave(tempResult, 4);
    }

    if (startStage <= 4) {
      const p4 = apiKeys['openai'] ? 'openai' : provider;
      onProgress(`에이전트 4 (은유/복선 분석가) 심층 투입... (via ${p4})`);
      tempResult = await fetchStream({ ...payload, provider: p4, apiKey: apiKeys[p4], text: tempResult, sourceText: text, stage: 4 }, (chunk) => onSave(chunk, 4));
      onSave(tempResult, 5);
    }

    if (startStage <= 5) {
      const p5 = apiKeys['mistral'] ? 'mistral' : (apiKeys['deepseek'] ? 'deepseek' : provider);
      onProgress(`에이전트 5 (총괄 편집장) 윤문 및 픽업... (via ${p5})`);
      tempResult = await fetchStream({ ...payload, provider: p5, apiKey: apiKeys[p5], text: tempResult, sourceText: text, stage: 5 }, (chunk) => onSave(chunk, 5));
      onSave(tempResult, 6);
    }
    
    return tempResult;
  };

  const deepTranslate = useCallback(async () => {
    if (!source.trim()) {
      setError('번역할 텍스트를 입력하세요');
      return;
    }
    setLoading(true);
    setError('');
    setStatusMsg('파이프라인 시작...');
    
    const chapter = activeChapterIndex !== null ? chapters[activeChapterIndex] : null;
    const startStage = chapter?.stageProgress || 1;
    let currentRes = chapter?.result || '';

    try {
      const epCtx = activeChapterIndex && activeChapterIndex > 0 ? (chapters[activeChapterIndex - 1].result || chapters[activeChapterIndex - 1].content) : '';

      const finalResult = await runDeepPipeline(
        source, 
        currentRes, 
        startStage, 
        (msg) => setStatusMsg(msg),
        (part, stage) => {
          setResult(part); 
          if (activeChapterIndex !== null) {
            setChapters(prev => {
              const next = [...prev];
              next[activeChapterIndex] = { ...next[activeChapterIndex], result: part, stageProgress: stage };
              return next;
            });
          }
        },
        epCtx,
        storySummary
      );
      setResult(finalResult);
      if (activeChapterIndex !== null) {
          setChapters(prev => {
            const next = [...prev];
            next[activeChapterIndex] = { ...next[activeChapterIndex], isDone: true, stageProgress: 6 };
            return next;
          });
      }
      setHistory(prev => [{ from, to, source: source.slice(0, 50), result: finalResult.slice(0, 50), time: Date.now() }, ...prev.slice(0, 19)]);
    } catch(err) {
      setError(`오류: ${err instanceof Error ? err.message : 'Unknown'}\n(재실행 시 실패 지점부터 자동 재개됩니다)`);
    } finally {
      setLoading(false);
      setStatusMsg('');
    }
  }, [source, from, to, provider, apiKeys, model, glossary, tone, genre, context, worldContext, activeChapterIndex, chapters]);

  // [2번 문제] 병렬 비선형 큐 번역엔진 적용
  const batchTranslateAll = async () => {
    if (chapters.length === 0) return;
    if (!confirm(`${chapters.length}개의 모든 챕터를 [고속 병렬 큐]를 사용해 번역하시겠습니까?\n이전 번역이 덜 된 챕터는 인공지능이 원문(Source)을 기반으로 문맥을 추론하며 최고 속도로 동시 처리합니다.`)) return;
    
    setLoading(true);
    setStatusMsg('병렬 파이프라인 엔진 가동 초읽기...');
    try {
      const CONCURRENCY = 3; // 동시 번역 쓰레드 개수
      let activePromises: Promise<void>[] = [];
      let currentStorySummary = storySummary;

      for (let i = 0; i < chapters.length; i++) {
        const target = chapters[i];
        if (target.isDone || target.stageProgress === 6) continue;
        
        if (activePromises.length >= CONCURRENCY) {
           await Promise.race(activePromises);
        }
        
        const p = (async () => {
           try {
             const startStage = target.stageProgress || 1;
             const currentRes = target.result || '';
             
             // 병렬 큐: 이전 챕터가 진행 중이라면 원문(content)을 컨텍스트로 전달
             const epCtx = i > 0 ? (chapters[i - 1].result || chapters[i - 1].content) : '';
             
             const result = await runDeepPipeline(
                target.content, 
                currentRes,
                startStage,
                (msg) => setStatusMsg(`${i + 1}/${chapters.length} - ${msg}`),
                (part, stage) => {
                   setChapters(curr => {
                      const updated = [...curr];
                      updated[i] = { ...updated[i], result: part, stageProgress: stage };
                      return updated;
                   });
                },
                epCtx,
                currentStorySummary
             );
             setChapters(curr => {
                const updated = [...curr];
                updated[i] = { ...updated[i], result, isDone: true, stageProgress: 6 };
                return updated;
             });
           } catch(e) {
              console.error(`Chapter ${i+1} failed`, e);
           }
        })();
        
        activePromises.push(p);
        p.finally(() => {
           activePromises = activePromises.filter(curr => curr !== p);
        });
      }
      
      await Promise.all(activePromises);
      alert('모든 챕터 번역이 병렬 처리로 초고속 완료되었습니다.');
    } catch (err) {
      alert(`병렬 번역 엔진 중 오류: ${err instanceof Error ? err.message : 'Unknown'}`);    } finally {
       setLoading(false);
       setStatusMsg('');
    }
  };

  const downloadAllResults = () => {
    if (chapters.length === 0) return;
    const fullText = chapters.map(ch => `[${ch.name}]\n\n${ch.result || '(미번역)'}`).join('\n\n' + '='.repeat(30) + '\n\n');
    const blob = new Blob([fullText], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `eh-translator-full-result-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const importData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const s = JSON.parse(ev.target?.result as string);
        if (s.source !== undefined) setSource(s.source);
        if (s.result !== undefined) setResult(s.result);
        if (s.from !== undefined) setFrom(s.from);
        if (s.to !== undefined) setTo(s.to);
        if (s.provider !== undefined) setProvider(s.provider);
        if (s.apiKeys !== undefined) setApiKeys(s.apiKeys);
        else if (s.apiKey !== undefined) setApiKeys({ [s.provider || 'gemini']: s.apiKey });
        if (s.model !== undefined) setModel(s.model);
        if (s.glossary !== undefined) setGlossary(s.glossary);
        if (s.tone !== undefined) setTone(s.tone);
        if (s.history !== undefined) setHistory(s.history);
        alert('성공적으로 불러왔습니다!');
      } catch (err) {
        alert('잘못된 형식의 파일입니다.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const swap = () => { setFrom(to); setTo(from); setSource(result); setResult(''); };
  const currentProvider = PROVIDERS.find(p => p.id === provider);

  return (
    <div className={`min-h-screen bg-black text-gray-100 font-sans selection:bg-purple-500/30 ${isZenMode ? 'zen-mode' : ''}`}>
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-black/80 backdrop-blur-xl border-b border-gray-900 z-50 flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-black bg-linear-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent tracking-tighter">
            EH-TRANSLATOR <span className="text-[10px] text-gray-600 font-normal ml-1">v3.0 SaaS</span>
          </h1>
          <div className="hidden lg:flex items-center gap-2 px-2 py-0.5 bg-gray-900 border border-gray-800 rounded cursor-pointer hover:bg-gray-800 transition-colors" onClick={() => setLockedFeature('Enterprise 팀스페이스 및 권한 관리 대시보드')}>
             <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Plan:</span>
             <span className="text-[10px] font-bold text-emerald-400">Personal (Free)</span>
          </div>
          <div className="hidden xl:flex items-center gap-2 px-2 py-1 bg-gray-900/50 border border-gray-800/50 rounded cursor-pointer hover:bg-gray-800 transition-colors" onClick={() => setLockedFeature('SaaS 종량제 과금 모델 (토큰 시스템)')}>
            <div className="w-24 bg-gray-800 h-1.5 rounded-full overflow-hidden">
               <div className="bg-purple-500 h-full w-[15%]"></div>
            </div>
            <span className="text-[9px] text-gray-500 font-mono">15K / 100K Tokens</span>
          </div>
          {activeChapterIndex !== null && chapters[activeChapterIndex] && (
            <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-gray-900 rounded-full border border-gray-800">
               <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
               <span className="text-[10px] text-gray-400 font-medium">{chapters[activeChapterIndex].name} 작업 중</span>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          {isAuthLoaded && !userId && (
            <SignInButton mode="modal">
              <button className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-[10px] font-bold text-white transition-all shadow-lg shadow-indigo-500/20">
                🚀 시작하기
              </button>
            </SignInButton>
          )}
          {isAuthLoaded && userId && (
            <UserButton appearance={{ elements: { userButtonAvatarBox: "shadow-lg shadow-purple-500/20 w-8 h-8" } }} />
          )}

          <button 
            onClick={() => setIsZenMode(!isZenMode)}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${isZenMode ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-500/30' : 'bg-gray-900 border-gray-800 text-gray-400 hover:border-gray-700'}`}
          >
            {isZenMode ? '🧘 ZEN MODE ON' : '👁️ FOCUS MODE'}
          </button>
          <button onClick={() => setShowSettings(!showSettings)} 
            className="p-2 hover:bg-gray-900 rounded-lg transition-colors border border-transparent hover:border-gray-800">
            ⚙️
          </button>
        </div>
      </header>

      <main className="pt-20 flex h-[calc(100vh-80px)] overflow-hidden">
        {/* Left Sidebar: Chapters */}
        {!isZenMode && (
          <aside className="w-64 border-r border-gray-900 bg-gray-950/20 overflow-y-auto p-4 hidden lg:block">
            <div className="flex flex-col gap-2 mb-4">
              <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">Chapters</h3>
                <label className="cursor-pointer p-1.5 bg-gray-900 hover:bg-gray-800 rounded border border-gray-800 transition-colors">
                  <span className="text-[10px]">➕ 일반 텍스트 추가</span>
                  <input type="file" multiple onChange={importDocument} className="hidden" accept=".txt,.md" />
                </label>
              </div>
              <div className="flex gap-2 justify-end mb-2">
                <label className="cursor-pointer text-[10px] px-2 py-1 bg-purple-900/40 border border-purple-500/50 text-purple-300 hover:bg-purple-900/60 transition-colors flex items-center justify-center rounded-lg shadow-sm w-1/3">
                  <span className="font-bold">EPUB</span>
                  <input type="file" multiple onChange={importDocument} className="hidden" accept=".epub" />
                </label>
                <label className="cursor-pointer text-[10px] px-2 py-1 bg-red-900/40 border border-red-500/50 text-red-300 hover:bg-red-900/60 transition-colors flex items-center justify-center rounded-lg shadow-sm w-1/3">
                  <span className="font-bold">PDF</span>
                  <input type="file" multiple onChange={importDocument} className="hidden" accept=".pdf" />
                </label>
                <label className="cursor-pointer text-[10px] px-2 py-1 bg-blue-900/40 border border-blue-500/50 text-blue-300 hover:bg-blue-900/60 transition-colors flex items-center justify-center rounded-lg shadow-sm w-1/3">
                  <span className="font-bold">DOCX</span>
                  <input type="file" multiple onChange={importDocument} className="hidden" accept=".docx" />
                </label>
              </div>
            </div>

            {chapters.length > 0 && (
              <div className="flex gap-2 mb-3">
                <button onClick={batchTranslateAll} disabled={loading} className="flex-1 bg-purple-900/30 hover:bg-purple-900/50 text-[9px] py-1.5 rounded-lg border border-purple-800/30 transition-all">
                  ALL TRANSLATE
                </button>
                <button onClick={downloadAllResults} className="flex-1 bg-gray-900 hover:bg-gray-800 text-[9px] py-1.5 rounded-lg border border-gray-800 transition-all">
                  DOWNLOAD ALL
                </button>
              </div>
            )}
            
            <div className="space-y-1">
              {chapters.length === 0 && (
                <div className="text-[10px] text-gray-700 text-center py-10 italic">불러온 파일이 없습니다.</div>
              )}
              {chapters.map((ch, idx) => (
                <div 
                  key={idx}
                  onClick={() => setActiveChapterIndex(idx)}
                  className={`group flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all border ${activeChapterIndex === idx ? 'bg-purple-900/20 border-purple-900/50 text-purple-200' : 'border-transparent hover:bg-gray-900/50 text-gray-500'}`}
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <span className={`text-[9px] font-mono px-1 rounded ${ch.isDone ? 'bg-green-500/20 text-green-400' : 'opacity-40'}`}>
                      {ch.isDone ? '✓' : (idx + 1)}
                    </span>
                    <span className={`text-xs truncate ${ch.isDone ? 'text-gray-300' : 'text-gray-500'}`}>{ch.name}</span>
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setChapters(prev => prev.filter((_, i) => i !== idx)); if(activeChapterIndex === idx) setActiveChapterIndex(null); }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 text-[10px]"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </aside>
        )}

        {/* Center: Editor Area */}
        <section className={`flex-1 overflow-y-auto px-6 pb-20 transition-all ${isZenMode ? 'max-w-5xl mx-auto' : ''}`}>
          {/* Style Analysis Result (Compact) */}
          {styleAnalysis && !isZenMode && (
            <div className="mb-6 animate-in fade-in slide-in-from-top-4 duration-700">
               <div className="p-4 rounded-2xl bg-linear-to-br from-purple-950/40 to-indigo-950/40 border border-purple-900/30 flex items-center justify-between">
                 <div>
                    <h4 className="text-[10px] text-purple-400 font-bold uppercase tracking-widest mb-1">AI Style Feedback</h4>
                    <p className="text-sm text-purple-100 font-medium">이 글은 <span className="underline decoration-purple-500">{styleAnalysis.genre}</span> 장르의 <span className="underline decoration-indigo-500">{styleAnalysis.tone}</span> 톤을 가지고 있습니다.</p>
                 </div>
                 <div className="flex gap-2">
                   <div className="text-center px-3 border-r border-purple-900/30">
                     <div className="text-[9px] text-purple-500 uppercase">Fluency</div>
                     <div className="text-xs font-bold text-white">{styleAnalysis.metric.fluency}</div>
                   </div>
                   <div className="text-center px-3">
                     <div className="text-[9px] text-purple-500 uppercase">Immersive</div>
                     <div className="text-xs font-bold text-white">{styleAnalysis.metric.immersion}</div>
                   </div>
                 </div>
               </div>
            </div>
          )}

          {/* Settings Overlay */}
          {showSettings && (
            <div className="mb-6 p-5 rounded-3xl bg-gray-900 border border-gray-800 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <label className="text-[10px] text-purple-400 uppercase font-bold mb-2 flex tracking-widest items-center gap-2">
                    Ensemble API Keys 
                    <span className="text-[8px] px-1.5 py-0.5 bg-purple-900 text-purple-200 rounded">REQUIRED FOR 4-STAGE PIPELINE</span>
                  </label>
                  <div className="space-y-2">
                    {PROVIDERS.map(p => (
                      <div key={p.id} className="flex gap-2 items-center">
                        <span className="w-28 text-[9px] text-gray-500 uppercase tracking-wider">{p.label}</span>
                        <input 
                          type="password" 
                          value={apiKeys[p.id] || ''} 
                          onChange={(e) => setApiKeys({...apiKeys, [p.id]: e.target.value})} 
                          placeholder={`${p.role}`} 
                          className="flex-1 bg-black border border-gray-800 focus:border-purple-500/50 rounded-lg px-3 py-1.5 text-xs outline-none transition-all placeholder:text-[10px]" 
                        />
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] text-gray-500 uppercase font-bold mb-1 block tracking-widest">Base Provider (For Fast Draft)</label>
                    <select value={provider} onChange={(e) => setProvider(e.target.value)} className="w-full bg-black border border-gray-800 rounded-lg px-3 py-2 text-xs">
                      {PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 uppercase font-bold mb-1 block tracking-widest">Backup Management</label>
                    <div className="flex gap-2">
                        <button onClick={exportData} className="flex-1 bg-gray-800 hover:bg-gray-700 py-2 rounded-lg text-[9px] font-bold">EXPORTS</button>
                        <label className="flex-1 bg-gray-800 hover:bg-gray-700 py-2 rounded-lg text-[9px] font-bold text-center cursor-pointer">
                          IMPORTS
                          <input type="file" onChange={importData} className="hidden" />
                        </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {isCatMode ? (
            <div className="col-span-1 lg:col-span-2 space-y-3 h-[70vh] overflow-y-auto pr-2 scrollbar-hide">
              {source.split('\n').map((sLine, idx) => {
                 const rLines = result.split('\n');
                 const rLine = rLines[idx] || '';
                 if(!sLine.trim() && !rLine.trim()) return null;
                 return (
                   <div key={idx} className="flex flex-col md:flex-row gap-2 bg-gray-900/50 p-4 rounded-3xl border border-gray-800 hover:border-gray-700 transition-colors">
                     <textarea 
                        value={sLine} 
                        onChange={(e) => { const arr = source.split('\n'); arr[idx] = e.target.value; setSource(arr.join('\n')) }}
                        className="w-full bg-transparent text-gray-400 text-xs resize-none outline-none leading-relaxed min-h-[60px]"
                        placeholder="원문..."
                     />
                     <textarea 
                        value={rLine} 
                        onChange={(e) => { const arr = result.split('\n'); arr[idx] = e.target.value; setResult(arr.join('\n')) }}
                        className="w-full bg-transparent text-indigo-300 font-bold text-xs resize-none outline-none leading-relaxed min-h-[60px]"
                        placeholder="번역..."
                     />
                   </div>
                 )
              })}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Source Column */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                   <div className="flex items-center gap-3">
                     <select value={from} onChange={(e) => setFrom(e.target.value)}
                       className="bg-transparent text-xs font-bold text-gray-400 outline-none border-b border-gray-800 pb-1 focus:border-purple-500 transition-all">
                       {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
                     </select>
                     <span className="text-gray-700">→</span>
                     <select value={to} onChange={(e) => setTo(e.target.value)}
                       className="bg-transparent text-xs font-bold text-indigo-400 outline-none border-b border-gray-800 pb-1 focus:border-indigo-500 transition-all">
                       {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
                     </select>
                   </div>
                   <button onClick={analyzeStyle} className="text-[10px] text-gray-600 hover:text-purple-400 transition-colors">⚡ AI 분석</button>
                </div>
                
                <div className="relative group">
                  <textarea 
                    value={source} onChange={(e) => setSource(e.target.value)}
                    placeholder="원고를 입력하거나 파일을 추가하세요..."
                    className="w-full h-[65vh] bg-gray-900/30 backdrop-blur-sm border border-gray-800 rounded-3xl p-6 text-sm leading-relaxed resize-none focus:ring-1 focus:ring-purple-500/50 outline-none transition-all scrollbar-hide"
                  />
                  <div className="absolute bottom-4 right-6 text-[10px] text-gray-700 font-mono uppercase">
                    {source.length.toLocaleString()} Chars
                  </div>
                </div>
              </div>

              {/* Result Column */}
              <div className="space-y-3">
                <div className="flex items-center justify-between h-7">
                  <div className="flex gap-2">
                    {result && !isZenMode && (
                      <>
                        <button onClick={refineResult} className="text-[10px] bg-indigo-950/50 hover:bg-indigo-900 text-indigo-300 px-2 py-0.5 rounded border border-indigo-900/50 transition-all">🪄 다듬기</button>
                        <button onClick={backTranslate} className="text-[10px] bg-emerald-950/50 hover:bg-emerald-900 text-emerald-300 px-2 py-0.5 rounded border border-emerald-900/50 transition-all">🔍 무결성 검수</button>
                      </>
                    )}
                  </div>
                  <div className="text-[10px] text-indigo-500/50 font-bold uppercase tracking-widest">Translated Draft</div>
                </div>

                <div className="relative group">
                  <textarea 
                    value={result} readOnly={loading} onChange={(e) => setResult(e.target.value)}
                    placeholder={loading ? "번역 작업이 진행 중입니다..." : "결과물이 여기에 표시됩니다..."}
                    className={`w-full h-[65vh] bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-3xl p-6 text-sm leading-relaxed resize-none transition-all outline-none ${loading ? 'opacity-40 animate-pulse' : ''} ${result ? 'focus:border-indigo-500' : ''}`}
                  />
                  {result && (
                    <button onClick={() => { navigator.clipboard.writeText(result); alert('복사되었습니다!'); }}
                      className="absolute top-4 right-5 p-2 bg-gray-800/80 hover:bg-gray-700 rounded-xl transition-all opacity-0 group-hover:opacity-100">
                      📋
                    </button>
                  )}
                  <div className="absolute bottom-4 right-6 text-[10px] text-gray-700 font-mono uppercase">
                    {result.length.toLocaleString()} Chars
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Action Bar */}
          <div className="mt-8 flex gap-4 max-w-4xl mx-auto">
            <button 
              onClick={translate} 
              disabled={loading || !source.trim()}
              className="flex-1 py-4 bg-gray-900 hover:bg-gray-850 rounded-2xl text-[11px] font-black tracking-widest text-gray-400 border border-gray-800 transition-all disabled:opacity-20"
            >
              FAST DRAFT
            </button>
            <button 
              onClick={deepTranslate} 
              disabled={loading || !source.trim()}
              className="flex-2 py-4 bg-linear-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 rounded-2xl text-[11px] font-black tracking-widest text-white shadow-xl shadow-purple-500/20 transition-all disabled:opacity-20 relative overflow-hidden"
            >
              {statusMsg ? (
                <div className="flex items-center justify-center gap-2">
                  <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce"></span>
                  {statusMsg}
                </div>
              ) : 'PRO NOVEL PIPELINE (5-STAGE)'}
            </button>
          </div>
        </section>

        {/* Right Sidebar: Context & Lore */}
        {!isZenMode && (
          <aside className="w-80 border-l border-gray-900 bg-gray-950/20 overflow-y-auto p-5 hidden xl:block space-y-6">
            <div>
              <h3 className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-3 flex items-center justify-between">
                World Context (Lore)
                <span className="text-[8px] px-1.5 bg-gray-900 rounded">FIXED</span>
              </h3>
              <textarea 
                value={worldContext} onChange={(e) => setWorldContext(e.target.value)}
                placeholder="고정된 세계관, 고유 명사 설정을 적어주세요. 모든 번역에 반영됩니다."
                className="w-full h-32 bg-gray-900 border border-gray-800 rounded-xl p-3 text-[11px] leading-relaxed resize-none focus:border-indigo-500 transition-colors placeholder:text-gray-700"
              />
            </div>

            <div>
              <h3 className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-3 flex items-center justify-between">
                Character Tone Profiles
                <button onClick={() => setShowCharacters(!showCharacters)} className="text-purple-500 font-normal">Edit</button>
              </h3>
              {showCharacters && (
                <textarea 
                  value={characterProfiles} onChange={(e) => setCharacterProfiles(e.target.value)}
                  placeholder="예: 
엘라: 10살 소녀, 존댓말, 짧은 문장
카일: 빙의한 현대인 독백, 시니컬, 반말"
                  className="w-full h-32 bg-gray-900 border border-emerald-900/40 focus:border-emerald-500 rounded-xl p-3 text-[10px] mb-3 font-mono placeholder:text-gray-700 transition-colors"
                />
              )}
            </div>

            <div>
              <h3 className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-3 flex items-center justify-between">
                Story Bible (Summary)
                <button onClick={() => setShowSummary(!showSummary)} className="text-purple-500 font-normal">Edit</button>
              </h3>
              {showSummary && (
                <textarea 
                  value={storySummary} onChange={(e) => setStorySummary(e.target.value)}
                  placeholder="요약본이 이 곳에 자동 누적되어 다음 화 번역의 일관성을 유지합니다."
                  className="w-full h-40 bg-gray-900 border border-indigo-900/40 focus:border-indigo-500 rounded-xl p-3 text-[10px] mb-3 font-mono placeholder:text-gray-700 transition-colors scrollbar-hide"
                />
              )}
            </div>

            <div>
              <h3 className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-3 flex items-center justify-between">
                Terms (Glossary)
                <button onClick={() => setShowGlossary(!showGlossary)} className="text-purple-500 font-normal">Edit</button>
              </h3>
              {showGlossary && (
                <textarea 
                  value={glossary} onChange={(e) => setGlossary(e.target.value)}
                  placeholder="노아 = NOA\n의회 = Council"
                  className="w-full h-32 bg-gray-900 border border-gray-800 rounded-xl p-3 text-[10px] mb-3 font-mono"
                />
              )}
              <div className="grid grid-cols-2 gap-2 mb-4">
                {TONES.map(t => (
                  <button key={t.id} onClick={() => setTone(t.id)}
                    className={`px-2 py-1.5 rounded-lg text-[9px] border transition-all ${tone === t.id ? 'bg-indigo-900/40 border-indigo-500 text-indigo-300' : 'bg-gray-900 border-gray-800 text-gray-600 hover:border-gray-700'}`}>
                    {t.label}
                  </button>
                ))}
              </div>
              <select value={genre} onChange={(e) => setGenre(e.target.value)}
                className="w-full bg-gray-900 border border-gray-800 rounded-xl px-3 py-2 text-[10px] text-gray-300 outline-none">
                {GENRES.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
              </select>
            </div>

            <div className="pt-6 border-t border-gray-900">
               <HistoryComponent history={history} setFrom={setFrom} setTo={setTo} setHistory={setHistory} />
            </div>
          </aside>
        )}
      </main>

      {/* Back-translation Overlay */}
      {backResult && (
        <div className="fixed bottom-10 right-10 w-96 bg-gray-950 border border-emerald-900/50 rounded-3xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-500">
           <div className="p-4 bg-emerald-950/20 border-b border-emerald-900/30 flex items-center justify-between">
              <h4 className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Back-Translation Integrity</h4>
              <button onClick={() => setBackResult('')} className="text-emerald-700 hover:text-emerald-500">✕</button>
           </div>
           <div className="p-5 text-[11px] text-emerald-100/80 leading-relaxed max-h-80 overflow-y-auto">
             {backResult}
           </div>
           <div className="px-5 py-3 bg-black/40 text-[9px] text-emerald-900">
             * 원문과 의미가 일치하는지 한글로 빠르게 확인하세요.
           </div>
        </div>
      )}

      {/* Locked Feature SaaS Modal */}
      {lockedFeature && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-gray-950 border border-gray-800 rounded-3xl p-8 max-w-sm w-full shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-linear-to-r from-purple-500 to-indigo-500"></div>
            <button onClick={() => setLockedFeature(null)} className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors">✕</button>
            <div className="w-16 h-16 bg-gray-900 rounded-full flex items-center justify-center text-2xl mb-6 mx-auto border border-gray-800">
              🔒
            </div>
            <h2 className="text-xl font-black text-center mb-2 bg-linear-to-r from-gray-100 to-gray-400 bg-clip-text text-transparent">Enterprise Feature</h2>
            <p className="text-gray-400 text-sm text-center mb-8 px-4 leading-relaxed">
              <span className="text-purple-400 font-bold block mb-2">{lockedFeature}</span>
              이 기능은 추후 B2B 기업용 플랜 또는 정식 SaaS 런칭 시 완전 개방될 예정입니다!
            </p>
            <button onClick={() => setLockedFeature(null)} className="w-full bg-white text-black font-black text-sm py-4 rounded-xl hover:bg-gray-200 transition-colors">
              알겠습니다
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function HistoryComponent({ history, setFrom, setTo, setHistory }: any) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">Recent Logs</h3>
        <button onClick={() => { if(confirm('기록을 지울까요?')) setHistory([]); }} className="text-[9px] text-gray-800 hover:text-red-900">CLEAR</button>
      </div>
      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 scrollbar-hide">
        {history.length === 0 && <div className="text-[10px] text-gray-800 py-4 text-center">No logs found.</div>}
        {history.map((h: any, i: number) => (
          <div key={i} className="p-2 rounded-xl bg-gray-900/30 border border-gray-900/50 hover:border-gray-800 transition-all cursor-pointer group"
            onClick={() => { setFrom(h.from); setTo(h.to); alert('언어 설정 복구됨'); }}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[8px] text-gray-700 font-mono">{new Date(h.time).toLocaleTimeString()}</span>
              <span className="text-[8px] px-1 bg-gray-900 rounded">{h.from}→{h.to}</span>
            </div>
            <p className="text-[10px] text-gray-500 truncate">{h.source}...</p>
          </div>
        ))}
      </div>
    </div>
  );
}
