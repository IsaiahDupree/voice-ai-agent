// Sentiment detection utility
// Used in F1210 test and throughout the codebase

const positiveWords = [
  'love',
  'great',
  'excellent',
  'amazing',
  'perfect',
  'wonderful',
  'fantastic',
  'thank',
  'appreciate',
  'helpful',
  'recommend',
  'happy',
  'pleased',
  'satisfied',
  'awesome',
]

const negativeWords = [
  'hate',
  'terrible',
  'horrible',
  'worst',
  'awful',
  'bad',
  'disappointed',
  'frustrated',
  'angry',
  'upset',
  'useless',
  'waste',
  'poor',
  'disgusted',
  'annoyed',
]

export function classifySentiment(text: string): 'positive' | 'negative' | 'neutral' {
  if (!text || text.trim().length === 0) {
    return 'neutral'
  }

  const lowerText = text.toLowerCase()

  let positiveScore = 0
  let negativeScore = 0

  positiveWords.forEach((word) => {
    if (lowerText.includes(word)) positiveScore++
  })

  negativeWords.forEach((word) => {
    if (lowerText.includes(word)) negativeScore++
  })

  if (positiveScore > negativeScore) {
    return 'positive'
  } else if (negativeScore > positiveScore) {
    return 'negative'
  } else {
    return 'neutral'
  }
}
