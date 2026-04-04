/**
 * Unit test: Call Stage Classifier
 * Feature 121: Verify call stage detection logic
 *
 * This test verifies the call stage classifier correctly identifies:
 * 1. Greeting stage (first 1-3 messages)
 * 2. Discovery stage (asking questions)
 * 3. Pitch stage (presenting offers/solutions)
 * 4. Objections stage (handling concerns)
 * 5. Close stage (booking/scheduling/next steps)
 */

import { detectCallStage } from '@/app/dashboard/components/CallStageIndicator';

describe('Call Stage Classifier', () => {
  describe('Greeting stage', () => {
    it('should detect greeting with first message', () => {
      const messages = [
        { role: 'agent', content: 'Hello! Thanks for calling.' },
      ];

      const stage = detectCallStage(messages);
      expect(stage).toBe('greeting');
    });

    it('should detect greeting with 2-3 initial messages', () => {
      const messages = [
        { role: 'agent', content: 'Hello! Thanks for calling.' },
        { role: 'user', content: 'Hi there!' },
        { role: 'agent', content: 'How can I help you today?' },
      ];

      const stage = detectCallStage(messages);
      expect(stage).toBe('greeting');
    });

    it('should not stay in greeting after 4+ messages', () => {
      const messages = [
        { role: 'agent', content: 'Hello! Thanks for calling.' },
        { role: 'user', content: 'Hi there!' },
        { role: 'agent', content: 'How can I help you today?' },
        { role: 'user', content: 'I need help with something' },
      ];

      const stage = detectCallStage(messages);
      expect(stage).not.toBe('greeting');
    });
  });

  describe('Discovery stage', () => {
    it('should detect discovery with question keywords', () => {
      const messages = [
        { role: 'agent', content: 'Hello! Thanks for calling.' },
        { role: 'user', content: 'Hi, I need help.' },
        { role: 'agent', content: 'What brings you in today?' },
        { role: 'user', content: "I'm looking for information about your services" },
        { role: 'agent', content: 'Tell me more about what you need.' },
      ];

      const stage = detectCallStage(messages);
      expect(stage).toBe('discovery');
    });

    it('should detect discovery with "what" questions', () => {
      const messages = [
        { role: 'agent', content: 'Hello!' },
        { role: 'user', content: 'Hi' },
        { role: 'agent', content: 'What are you looking for today?' },
        { role: 'user', content: 'Not sure yet' },
      ];

      const stage = detectCallStage(messages);
      expect(stage).toBe('discovery');
    });

    it('should detect discovery with "how" questions', () => {
      const messages = [
        { role: 'agent', content: 'Hello!' },
        { role: 'user', content: 'Hi' },
        { role: 'agent', content: 'How can I assist you today?' },
        { role: 'user', content: 'I have a question' },
      ];

      const stage = detectCallStage(messages);
      expect(stage).toBe('discovery');
    });

    it('should detect discovery with "when" questions', () => {
      const messages = [
        { role: 'agent', content: 'Hello!' },
        { role: 'user', content: 'Hi' },
        { role: 'agent', content: 'When would you like to schedule this?' },
        { role: 'user', content: 'Maybe next week' },
      ];

      const stage = detectCallStage(messages);
      expect(stage).toBe('discovery');
    });
  });

  describe('Pitch stage', () => {
    it('should detect pitch with offer keywords', () => {
      const messages = [
        { role: 'agent', content: 'Hello!' },
        { role: 'user', content: 'Hi, looking for pricing' },
        { role: 'agent', content: 'Great! We have a special offer for you today.' },
        { role: 'user', content: 'Tell me more' },
      ];

      const stage = detectCallStage(messages);
      expect(stage).toBe('pitch');
    });

    it('should detect pitch with solution keywords', () => {
      const messages = [
        { role: 'agent', content: 'Hello!' },
        { role: 'user', content: 'I need help' },
        { role: 'agent', content: 'I have the perfect solution for you.' },
        { role: 'user', content: 'What is it?' },
      ];

      const stage = detectCallStage(messages);
      expect(stage).toBe('pitch');
    });

    it('should detect pitch with pricing discussion', () => {
      const messages = [
        { role: 'agent', content: 'Hello!' },
        { role: 'user', content: 'What do you offer?' },
        { role: 'agent', content: 'Our pricing starts at $49 per month.' },
        { role: 'user', content: 'Interesting' },
      ];

      const stage = detectCallStage(messages);
      expect(stage).toBe('pitch');
    });

    it('should detect pitch with "we can help" language', () => {
      const messages = [
        { role: 'agent', content: 'Hello!' },
        { role: 'user', content: 'Can you help me?' },
        { role: 'agent', content: 'We can definitely help you with that!' },
        { role: 'user', content: 'Great' },
      ];

      const stage = detectCallStage(messages);
      expect(stage).toBe('pitch');
    });

    it('should detect pitch with plan discussion', () => {
      const messages = [
        { role: 'agent', content: 'Hello!' },
        { role: 'user', content: 'What plans do you have?' },
        { role: 'agent', content: 'We have three plan options available.' },
        { role: 'user', content: 'Tell me about them' },
      ];

      const stage = detectCallStage(messages);
      expect(stage).toBe('pitch');
    });
  });

  describe('Objections stage', () => {
    it('should detect objections with "but" keyword', () => {
      const messages = [
        { role: 'agent', content: 'Our plan costs $99/month' },
        { role: 'user', content: 'But that seems expensive' },
        { role: 'agent', content: 'Let me explain the value' },
      ];

      const stage = detectCallStage(messages);
      expect(stage).toBe('objections');
    });

    it('should detect objections with "however" keyword', () => {
      const messages = [
        { role: 'agent', content: 'This is our best offer' },
        { role: 'user', content: 'However, I am not sure this is right for me' },
        { role: 'agent', content: 'I understand' },
      ];

      const stage = detectCallStage(messages);
      expect(stage).toBe('objections');
    });

    it('should detect objections with "concern" keyword', () => {
      const messages = [
        { role: 'agent', content: 'Would you like to proceed?' },
        { role: 'user', content: 'I have some concerns about this' },
        { role: 'agent', content: 'What are your concerns?' },
      ];

      const stage = detectCallStage(messages);
      expect(stage).toBe('objections');
    });

    it('should detect objections with "worried" keyword', () => {
      const messages = [
        { role: 'agent', content: 'Shall we get started?' },
        { role: 'user', content: 'I am worried it might not work for me' },
        { role: 'agent', content: 'Let me address that' },
      ];

      const stage = detectCallStage(messages);
      expect(stage).toBe('objections');
    });

    it('should detect objections with "not sure" phrase', () => {
      const messages = [
        { role: 'agent', content: 'Ready to sign up?' },
        { role: 'user', content: 'I am not sure yet' },
        { role: 'agent', content: 'What would help you decide?' },
      ];

      const stage = detectCallStage(messages);
      expect(stage).toBe('objections');
    });
  });

  describe('Close stage', () => {
    it('should detect close with booking keywords', () => {
      const messages = [
        { role: 'agent', content: 'Would you like to move forward?' },
        { role: 'user', content: 'Yes, let me book an appointment' },
        { role: 'agent', content: 'Great! When works for you?' },
      ];

      const stage = detectCallStage(messages);
      expect(stage).toBe('close');
    });

    it('should detect close with schedule keywords', () => {
      const messages = [
        { role: 'agent', content: 'Shall we proceed?' },
        { role: 'user', content: 'Yes, can we schedule a time?' },
        { role: 'agent', content: 'Absolutely!' },
      ];

      const stage = detectCallStage(messages);
      expect(stage).toBe('close');
    });

    it('should detect close with confirm keywords', () => {
      const messages = [
        { role: 'agent', content: 'Are you ready?' },
        { role: 'user', content: 'Yes, I confirm' },
        { role: 'agent', content: 'Perfect!' },
      ];

      const stage = detectCallStage(messages);
      expect(stage).toBe('close');
    });

    it('should detect close with "next steps" phrase', () => {
      const messages = [
        { role: 'agent', content: 'Does this work for you?' },
        { role: 'user', content: 'Yes, what are the next steps?' },
        { role: 'agent', content: 'Let me walk you through it' },
      ];

      const stage = detectCallStage(messages);
      expect(stage).toBe('close');
    });

    it('should detect close with "sign up" phrase', () => {
      const messages = [
        { role: 'agent', content: 'Interested in our service?' },
        { role: 'user', content: 'Yes, I would like to sign up' },
        { role: 'agent', content: 'Excellent!' },
      ];

      const stage = detectCallStage(messages);
      expect(stage).toBe('close');
    });

    it('should detect close with "agree" keyword', () => {
      const messages = [
        { role: 'agent', content: 'Does that sound good?' },
        { role: 'user', content: 'I agree, let us do it' },
        { role: 'agent', content: 'Wonderful!' },
      ];

      const stage = detectCallStage(messages);
      expect(stage).toBe('close');
    });
  });

  describe('Empty or minimal conversations', () => {
    it('should default to greeting for empty messages', () => {
      const messages: { role: string; content: string }[] = [];

      const stage = detectCallStage(messages);
      expect(stage).toBe('greeting');
    });

    it('should default to discovery when no clear stage detected', () => {
      const messages = [
        { role: 'agent', content: 'Hello!' },
        { role: 'user', content: 'Hi' },
        { role: 'agent', content: 'Nice weather today' },
        { role: 'user', content: 'Indeed' },
      ];

      const stage = detectCallStage(messages);
      expect(stage).toBe('discovery');
    });
  });

  describe('Stage priority', () => {
    it('should prioritize close over pitch when both keywords present', () => {
      const messages = [
        { role: 'agent', content: 'We can help you with our special offer' },
        { role: 'user', content: 'Great, let me book an appointment' },
      ];

      const stage = detectCallStage(messages);
      expect(stage).toBe('close');
    });

    it('should prioritize objections over pitch when both keywords present', () => {
      const messages = [
        { role: 'agent', content: 'Our pricing plan is $99 per month' },
        { role: 'user', content: 'But I am worried that is too expensive' },
      ];

      const stage = detectCallStage(messages);
      expect(stage).toBe('objections');
    });

    it('should prioritize pitch over discovery when both keywords present', () => {
      const messages = [
        { role: 'agent', content: 'What are you looking for? We have a great offer today' },
        { role: 'user', content: 'Tell me more' },
      ];

      const stage = detectCallStage(messages);
      expect(stage).toBe('pitch');
    });
  });
});
