import { describe, expect, it } from 'vitest';
import { buildPrompt } from './build-prompt';

describe('buildPrompt', () => {
  it('includes glossary when provided', () => {
    const p = buildPrompt({
      text: 'hello',
      from: 'en',
      to: 'ko',
      glossary: 'foo => bar',
      stage: 0,
      mode: 'novel',
    });
    expect(p).toContain('foo => bar');
    expect(p).toContain('Glossary');
  });

  it('uses story bible summarizer for stage 10', () => {
    const p = buildPrompt({
      text: 'chapter',
      from: 'ja',
      to: 'ko',
      stage: 10,
      mode: 'novel',
    });
    expect(p).toContain('STORY BIBLE SUMMARIZER');
    expect(p).toContain('CONFLICT CHECK');
  });

  it('adds dialogue rule for novel mode', () => {
    const p = buildPrompt({
      text: 'x',
      from: 'ja',
      to: 'ko',
      stage: 0,
      mode: 'novel',
      preserveDialogueLayout: true,
    });
    expect(p).toContain('DIALOGUE & NARRATION');
  });
});
