// Feature 52: Unit test: affirmation detection ('mm-hmm', 'yeah', 'uh-huh')
/**
 * Unit test for affirmation detection in semantic VAD
 * Tests that back-channel cues are correctly classified as affirmations
 */

import { classifyUtterance, shouldPauseAgent } from '@/lib/semantic-vad';

describe('Semantic VAD - Affirmation Detection', () => {
  const defaultContext = {
    agentSpeaking: true,
    conversationStage: 'pitch' as const,
  };

  it('should classify "mm-hmm" as affirmation with high confidence', async () => {
    const result = await classifyUtterance('mm-hmm', defaultContext);

    expect(result.type).toBe('affirmation');
    expect(result.confidence).toBeGreaterThan(0.9);
    expect(result.utterance).toBe('mm-hmm');
  });

  it('should classify "yeah" as affirmation', async () => {
    const result = await classifyUtterance('yeah', defaultContext);

    expect(result.type).toBe('affirmation');
    expect(result.confidence).toBeGreaterThan(0.9);
  });

  it('should classify "uh-huh" as affirmation', async () => {
    const result = await classifyUtterance('uh-huh', defaultContext);

    expect(result.type).toBe('affirmation');
    expect(result.confidence).toBeGreaterThan(0.9);
  });

  it('should classify "okay" as affirmation', async () => {
    const result = await classifyUtterance('okay', defaultContext);

    expect(result.type).toBe('affirmation');
    expect(result.confidence).toBeGreaterThan(0.9);
  });

  it('should classify "right" as affirmation', async () => {
    const result = await classifyUtterance('right', defaultContext);

    expect(result.type).toBe('affirmation');
    expect(result.confidence).toBeGreaterThan(0.9);
  });

  it('should classify "got it" as affirmation', async () => {
    const result = await classifyUtterance('got it', defaultContext);

    expect(result.type).toBe('affirmation');
    expect(result.confidence).toBeGreaterThan(0.9);
  });

  it('should classify "I see" as affirmation', async () => {
    const result = await classifyUtterance('I see', defaultContext);

    expect(result.type).toBe('affirmation');
    expect(result.confidence).toBeGreaterThan(0.9);
  });

  it('should classify "sure" as affirmation', async () => {
    const result = await classifyUtterance('sure', defaultContext);

    expect(result.type).toBe('affirmation');
    expect(result.confidence).toBeGreaterThan(0.9);
  });

  it('should classify "yep" as affirmation', async () => {
    const result = await classifyUtterance('yep', defaultContext);

    expect(result.type).toBe('affirmation');
    expect(result.confidence).toBeGreaterThan(0.9);
  });

  it('should classify "yup" as affirmation', async () => {
    const result = await classifyUtterance('yup', defaultContext);

    expect(result.type).toBe('affirmation');
    expect(result.confidence).toBeGreaterThan(0.9);
  });

  it('should classify "mhmm" (variant spelling) as affirmation', async () => {
    const result = await classifyUtterance('mhmm', defaultContext);

    expect(result.type).toBe('affirmation');
    expect(result.confidence).toBeGreaterThan(0.9);
  });

  it('should classify "ok" (short form) as affirmation', async () => {
    const result = await classifyUtterance('ok', defaultContext);

    expect(result.type).toBe('affirmation');
    expect(result.confidence).toBeGreaterThan(0.9);
  });

  it('should NOT pause agent for affirmations (any sensitivity)', async () => {
    const classification = await classifyUtterance('mm-hmm', defaultContext);

    expect(shouldPauseAgent(classification, 'low')).toBe(false);
    expect(shouldPauseAgent(classification, 'medium')).toBe(false);
    expect(shouldPauseAgent(classification, 'high')).toBe(false);
  });

  it('should handle case-insensitive affirmations', async () => {
    const result1 = await classifyUtterance('YEAH', defaultContext);
    const result2 = await classifyUtterance('Yeah', defaultContext);
    const result3 = await classifyUtterance('yEaH', defaultContext);

    expect(result1.type).toBe('affirmation');
    expect(result2.type).toBe('affirmation');
    expect(result3.type).toBe('affirmation');
  });

  it('should handle affirmations with extra whitespace', async () => {
    const result = await classifyUtterance('  mm-hmm  ', defaultContext);

    expect(result.type).toBe('affirmation');
    expect(result.confidence).toBeGreaterThan(0.9);
  });

  it('should distinguish affirmations from real interrupts', async () => {
    const affirmation = await classifyUtterance('yeah', defaultContext);
    const interrupt = await classifyUtterance('wait', defaultContext);

    expect(affirmation.type).toBe('affirmation');
    expect(interrupt.type).toBe('real-interrupt');
  });

  it('should distinguish affirmations from fillers', async () => {
    const affirmation = await classifyUtterance('yeah', defaultContext);
    const filler = await classifyUtterance('um', defaultContext);

    expect(affirmation.type).toBe('affirmation');
    expect(filler.type).toBe('filler');
  });

  it('should provide reasoning for affirmation classifications', async () => {
    const result = await classifyUtterance('mm-hmm', defaultContext);

    expect(result.reasoning).toBeTruthy();
    expect(result.reasoning).toContain('affirmation' || 'acknowledgment' || 'engagement');
  });
});
