// Feature 53: Unit test: real interruption detection ('wait', 'stop', 'hold on')
/**
 * Unit test for real interruption detection in semantic VAD
 * Tests that clear interruption signals are correctly classified
 */

import { classifyUtterance, shouldPauseAgent } from '@/lib/semantic-vad';

describe('Semantic VAD - Real Interruption Detection', () => {
  const defaultContext = {
    agentSpeaking: true,
    conversationStage: 'pitch' as const,
  };

  it('should classify "wait" as real-interrupt', async () => {
    const result = await classifyUtterance('wait', defaultContext);

    expect(result.type).toBe('real-interrupt');
    expect(result.confidence).toBeGreaterThan(0.8);
  });

  it('should classify "stop" as real-interrupt', async () => {
    const result = await classifyUtterance('stop', defaultContext);

    expect(result.type).toBe('real-interrupt');
    expect(result.confidence).toBeGreaterThan(0.8);
  });

  it('should classify "hold on" as real-interrupt', async () => {
    const result = await classifyUtterance('hold on', defaultContext);

    expect(result.type).toBe('real-interrupt');
    expect(result.confidence).toBeGreaterThan(0.8);
  });

  it('should classify "excuse me" as real-interrupt', async () => {
    const result = await classifyUtterance('excuse me', defaultContext);

    expect(result.type).toBe('real-interrupt');
    expect(result.confidence).toBeGreaterThan(0.8);
  });

  it('should classify objections as real-interrupt', async () => {
    const result = await classifyUtterance("I don't think that's right", defaultContext);

    expect(result.type).toBe('real-interrupt');
    expect(result.confidence).toBeGreaterThan(0.6);
  });

  it('should classify questions as real-interrupt', async () => {
    const result = await classifyUtterance('can I ask a question', defaultContext);

    expect(result.type).toBe('real-interrupt');
    expect(result.confidence).toBeGreaterThan(0.6);
  });

  it('should classify substantive responses as real-interrupt', async () => {
    const result = await classifyUtterance("I'm not interested", defaultContext);

    expect(result.type).toBe('real-interrupt');
    expect(result.confidence).toBeGreaterThan(0.6);
  });

  it('should PAUSE agent for real interrupts with high confidence (all sensitivities)', async () => {
    const classification = await classifyUtterance('wait', defaultContext);

    expect(shouldPauseAgent(classification, 'low')).toBe(true);
    expect(shouldPauseAgent(classification, 'medium')).toBe(true);
    expect(shouldPauseAgent(classification, 'high')).toBe(true);
  });

  it('should pause agent for interrupts at low sensitivity only if confidence is very high', async () => {
    const classification = {
      type: 'real-interrupt' as const,
      confidence: 0.75,
      utterance: 'test',
    };

    expect(shouldPauseAgent(classification, 'low')).toBe(false); // threshold 0.85
    expect(shouldPauseAgent(classification, 'medium')).toBe(true); // threshold 0.70
    expect(shouldPauseAgent(classification, 'high')).toBe(true); // threshold 0.55
  });

  it('should handle case-insensitive interrupts', async () => {
    const result1 = await classifyUtterance('WAIT', defaultContext);
    const result2 = await classifyUtterance('Wait', defaultContext);
    const result3 = await classifyUtterance('wAiT', defaultContext);

    expect(result1.type).toBe('real-interrupt');
    expect(result2.type).toBe('real-interrupt');
    expect(result3.type).toBe('real-interrupt');
  });

  it('should handle interrupts with extra whitespace', async () => {
    const result = await classifyUtterance('  hold on  ', defaultContext);

    expect(result.type).toBe('real-interrupt');
    expect(result.confidence).toBeGreaterThan(0.8);
  });

  it('should NOT pause for low confidence interrupts at low sensitivity', async () => {
    const classification = {
      type: 'real-interrupt' as const,
      confidence: 0.5, // Below all thresholds
      utterance: 'ambiguous',
    };

    expect(shouldPauseAgent(classification, 'low')).toBe(false);
    expect(shouldPauseAgent(classification, 'medium')).toBe(false);
    expect(shouldPauseAgent(classification, 'high')).toBe(false);
  });

  it('should pause for medium confidence interrupts at high sensitivity', async () => {
    const classification = {
      type: 'real-interrupt' as const,
      confidence: 0.65, // Above high threshold (0.55), below medium (0.70)
      utterance: 'test',
    };

    expect(shouldPauseAgent(classification, 'low')).toBe(false);
    expect(shouldPauseAgent(classification, 'medium')).toBe(false);
    expect(shouldPauseAgent(classification, 'high')).toBe(true);
  });

  it('should provide reasoning for interrupt classifications', async () => {
    const result = await classifyUtterance('wait', defaultContext);

    expect(result.reasoning).toBeTruthy();
    expect(typeof result.reasoning).toBe('string');
  });

  it('should distinguish interrupts from affirmations', async () => {
    const interrupt = await classifyUtterance('wait', defaultContext);
    const affirmation = await classifyUtterance('okay', defaultContext);

    expect(interrupt.type).toBe('real-interrupt');
    expect(affirmation.type).toBe('affirmation');
  });

  it('should distinguish interrupts from fillers', async () => {
    const interrupt = await classifyUtterance('stop', defaultContext);
    const filler = await classifyUtterance('um', defaultContext);

    expect(interrupt.type).toBe('real-interrupt');
    expect(filler.type).toBe('filler');
  });

  it('should classify polite interrupts correctly', async () => {
    const result = await classifyUtterance('sorry to interrupt, but', defaultContext);

    expect(result.type).toBe('real-interrupt');
  });

  it('should classify urgent interrupts with high confidence', async () => {
    const result = await classifyUtterance('stop right now', defaultContext);

    expect(result.type).toBe('real-interrupt');
    expect(result.confidence).toBeGreaterThan(0.85);
  });
});
