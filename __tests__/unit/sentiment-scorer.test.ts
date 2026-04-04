/**
 * Unit test: Sentiment Scorer
 * Feature 122: Verify sentiment classification logic
 *
 * This test verifies the sentiment scorer correctly classifies text as:
 * 1. Positive (contains positive keywords)
 * 2. Negative (contains negative keywords)
 * 3. Neutral (no clear sentiment or balanced)
 */

import { classifySentiment } from '@/lib/sentiment-detection';

describe('Sentiment Scorer', () => {
  describe('Positive sentiment', () => {
    it('should detect positive with single positive word', () => {
      const result = classifySentiment('This is great!');
      expect(result).toBe('positive');
    });

    it('should detect positive with "love" keyword', () => {
      const result = classifySentiment('I love this service');
      expect(result).toBe('positive');
    });

    it('should detect positive with "excellent" keyword', () => {
      const result = classifySentiment('Excellent work!');
      expect(result).toBe('positive');
    });

    it('should detect positive with "amazing" keyword', () => {
      const result = classifySentiment('This is amazing');
      expect(result).toBe('positive');
    });

    it('should detect positive with "wonderful" keyword', () => {
      const result = classifySentiment('What a wonderful experience');
      expect(result).toBe('positive');
    });

    it('should detect positive with "thank" keyword', () => {
      const result = classifySentiment('Thank you so much');
      expect(result).toBe('positive');
    });

    it('should detect positive with "appreciate" keyword', () => {
      const result = classifySentiment('I really appreciate your help');
      expect(result).toBe('positive');
    });

    it('should detect positive with "helpful" keyword', () => {
      const result = classifySentiment('This was very helpful');
      expect(result).toBe('positive');
    });

    it('should detect positive with "recommend" keyword', () => {
      const result = classifySentiment('I would recommend this to others');
      expect(result).toBe('positive');
    });

    it('should detect positive with "happy" keyword', () => {
      const result = classifySentiment('I am happy with the service');
      expect(result).toBe('positive');
    });

    it('should detect positive with "satisfied" keyword', () => {
      const result = classifySentiment('Very satisfied customer here');
      expect(result).toBe('positive');
    });

    it('should detect positive with multiple positive words', () => {
      const result = classifySentiment('This is great and I love it!');
      expect(result).toBe('positive');
    });

    it('should detect positive with "awesome" keyword', () => {
      const result = classifySentiment('Awesome job!');
      expect(result).toBe('positive');
    });

    it('should be case insensitive for positive words', () => {
      const result = classifySentiment('GREAT SERVICE');
      expect(result).toBe('positive');
    });
  });

  describe('Negative sentiment', () => {
    it('should detect negative with single negative word', () => {
      const result = classifySentiment('This is terrible');
      expect(result).toBe('negative');
    });

    it('should detect negative with "hate" keyword', () => {
      const result = classifySentiment('I hate this service');
      expect(result).toBe('negative');
    });

    it('should detect negative with "horrible" keyword', () => {
      const result = classifySentiment('Horrible experience');
      expect(result).toBe('negative');
    });

    it('should detect negative with "worst" keyword', () => {
      const result = classifySentiment('Worst service ever');
      expect(result).toBe('negative');
    });

    it('should detect negative with "awful" keyword', () => {
      const result = classifySentiment('This is awful');
      expect(result).toBe('negative');
    });

    it('should detect negative with "bad" keyword', () => {
      const result = classifySentiment('Bad customer service');
      expect(result).toBe('negative');
    });

    it('should detect negative with "disappointed" keyword', () => {
      const result = classifySentiment('I am disappointed');
      expect(result).toBe('negative');
    });

    it('should detect negative with "frustrated" keyword', () => {
      const result = classifySentiment('This is so frustrating');
      expect(result).toBe('negative');
    });

    it('should detect negative with "angry" keyword', () => {
      const result = classifySentiment('I am very angry about this');
      expect(result).toBe('negative');
    });

    it('should detect negative with "upset" keyword', () => {
      const result = classifySentiment('I am upset with the service');
      expect(result).toBe('negative');
    });

    it('should detect negative with "useless" keyword', () => {
      const result = classifySentiment('This is completely useless');
      expect(result).toBe('negative');
    });

    it('should detect negative with "waste" keyword', () => {
      const result = classifySentiment('Waste of time and money');
      expect(result).toBe('negative');
    });

    it('should detect negative with "poor" keyword', () => {
      const result = classifySentiment('Poor quality service');
      expect(result).toBe('negative');
    });

    it('should detect negative with multiple negative words', () => {
      const result = classifySentiment('This is terrible and I hate it');
      expect(result).toBe('negative');
    });

    it('should be case insensitive for negative words', () => {
      const result = classifySentiment('TERRIBLE SERVICE');
      expect(result).toBe('negative');
    });
  });

  describe('Neutral sentiment', () => {
    it('should detect neutral with no sentiment words', () => {
      const result = classifySentiment('The service is available');
      expect(result).toBe('neutral');
    });

    it('should detect neutral with empty string', () => {
      const result = classifySentiment('');
      expect(result).toBe('neutral');
    });

    it('should detect neutral with whitespace only', () => {
      const result = classifySentiment('   ');
      expect(result).toBe('neutral');
    });

    it('should detect neutral with factual statement', () => {
      const result = classifySentiment('The call started at 2pm');
      expect(result).toBe('neutral');
    });

    it('should detect neutral with question', () => {
      const result = classifySentiment('What time does it close?');
      expect(result).toBe('neutral');
    });

    it('should detect neutral with technical information', () => {
      const result = classifySentiment('The API endpoint is /api/calls');
      expect(result).toBe('neutral');
    });

    it('should detect neutral when positive and negative words are balanced', () => {
      const result = classifySentiment('The service is great but the price is terrible');
      expect(result).toBe('neutral');
    });

    it('should detect neutral with multiple balanced words', () => {
      const result = classifySentiment('I love the features but hate the interface');
      expect(result).toBe('neutral');
    });
  });

  describe('Edge cases', () => {
    it('should handle undefined gracefully', () => {
      const result = classifySentiment(undefined as any);
      expect(result).toBe('neutral');
    });

    it('should handle null gracefully', () => {
      const result = classifySentiment(null as any);
      expect(result).toBe('neutral');
    });

    it('should handle very long text with positive sentiment', () => {
      const longText = 'This is a very long text. '.repeat(100) + 'And it is great!';
      const result = classifySentiment(longText);
      expect(result).toBe('positive');
    });

    it('should handle very long text with negative sentiment', () => {
      const longText = 'This is a very long text. '.repeat(100) + 'And it is terrible!';
      const result = classifySentiment(longText);
      expect(result).toBe('negative');
    });

    it('should handle text with special characters', () => {
      const result = classifySentiment('Great!!! @#$%^&*()');
      expect(result).toBe('positive');
    });

    it('should handle mixed case text', () => {
      const result = classifySentiment('GrEaT sErViCe');
      expect(result).toBe('positive');
    });

    it('should handle text with numbers', () => {
      const result = classifySentiment('Great service 123');
      expect(result).toBe('positive');
    });
  });

  describe('Score accumulation', () => {
    it('should accumulate multiple positive words', () => {
      const result = classifySentiment('This is great, excellent, and amazing!');
      expect(result).toBe('positive');
    });

    it('should accumulate multiple negative words', () => {
      const result = classifySentiment('This is terrible, horrible, and awful!');
      expect(result).toBe('negative');
    });

    it('should favor positive when more positive words', () => {
      const result = classifySentiment('Great and excellent service, but one bad thing');
      expect(result).toBe('positive');
    });

    it('should favor negative when more negative words', () => {
      const result = classifySentiment('One good thing but terrible, horrible service');
      expect(result).toBe('negative');
    });
  });

  describe('Real-world examples', () => {
    it('should detect positive in customer satisfaction', () => {
      const result = classifySentiment('Thank you so much for your help! This was excellent.');
      expect(result).toBe('positive');
    });

    it('should detect negative in customer complaint', () => {
      const result = classifySentiment('This is the worst experience I have ever had. Completely disappointed.');
      expect(result).toBe('negative');
    });

    it('should detect neutral in information request', () => {
      const result = classifySentiment('Can you tell me what time you open on Monday?');
      expect(result).toBe('neutral');
    });

    it('should detect positive in recommendation', () => {
      const result = classifySentiment('I would definitely recommend this service to my friends!');
      expect(result).toBe('positive');
    });

    it('should detect negative in frustration', () => {
      const result = classifySentiment('I am so frustrated and angry with this situation');
      expect(result).toBe('negative');
    });

    it('should detect neutral in mixed feedback', () => {
      const result = classifySentiment('The product is great but the shipping was terrible');
      expect(result).toBe('neutral');
    });
  });
});
