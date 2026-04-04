// F1210: Unit test: sentiment detection - Test sentiment classification function
import { classifySentiment } from '@/lib/sentiment-detection'

describe('Sentiment Detection', () => {
  test('should detect positive sentiment', () => {
    const positive = [
      'Thank you so much! This is amazing!',
      'I love this service, very helpful',
      'Great experience, highly recommend',
      'Perfect! Exactly what I needed',
    ]

    positive.forEach((text) => {
      const sentiment = classifySentiment(text)
      expect(sentiment).toBe('positive')
    })
  })

  test('should detect negative sentiment', () => {
    const negative = [
      'This is terrible, I hate it',
      'Worst experience ever, completely useless',
      'I am very disappointed and frustrated',
      'Horrible service, never coming back',
    ]

    negative.forEach((text) => {
      const sentiment = classifySentiment(text)
      expect(sentiment).toBe('negative')
    })
  })

  test('should detect neutral sentiment', () => {
    const neutral = [
      'I need to check my calendar',
      'What time is the meeting?',
      'Can you send me the details?',
      'I will think about it',
    ]

    neutral.forEach((text) => {
      const sentiment = classifySentiment(text)
      expect(sentiment).toBe('neutral')
    })
  })

  test('should handle empty or invalid input', () => {
    expect(classifySentiment('')).toBe('neutral')
    expect(classifySentiment('   ')).toBe('neutral')
  })

  test('should detect sentiment in mixed case', () => {
    expect(classifySentiment('THANK YOU!')).toBe('positive')
    expect(classifySentiment('this is TERRIBLE')).toBe('negative')
  })
})
