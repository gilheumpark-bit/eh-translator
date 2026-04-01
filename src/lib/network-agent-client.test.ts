import { describe, it, expect } from 'vitest';
import { buildTranslationIndexContent } from './network-agent-client';

describe('buildTranslationIndexContent', () => {
  it('includes project name and chapters', () => {
    const s = buildTranslationIndexContent({
      projectName: 'P1',
      chapters: [{ name: 'Ch1', content: 'あ', result: '아' }],
      worldContext: 'W',
      characterProfiles: '',
      storySummary: '',
      glossaryText: 'a=>b',
    });
    expect(s).toContain('# P1');
    expect(s).toContain('Ch1');
    expect(s).toContain('あ');
    expect(s).toContain('아');
    expect(s).toContain('Glossary');
  });
});
