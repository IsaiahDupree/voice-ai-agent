/**
 * F0140: Auto-tagging by keyword
 * Analyzes call transcripts and automatically applies intent-based tags
 */

export interface KeywordRule {
  keywords: string[];
  tag: string;
  priority: number; // Higher priority tags override lower ones
}

// Intent classification rules based on common keywords
const TAGGING_RULES: KeywordRule[] = [
  // Sales & Purchase Intent
  {
    keywords: ['buy', 'purchase', 'order', 'pricing', 'price', 'cost', 'how much', 'quote'],
    tag: 'purchase_intent',
    priority: 10,
  },
  // Support & Technical
  {
    keywords: ['issue', 'problem', 'broken', 'error', 'help', 'support', 'fix', 'not working'],
    tag: 'support_request',
    priority: 10,
  },
  // Booking & Scheduling
  {
    keywords: ['appointment', 'schedule', 'book', 'meeting', 'calendar', 'available', 'availability'],
    tag: 'booking_intent',
    priority: 10,
  },
  // Billing & Payments
  {
    keywords: ['refund', 'payment', 'charge', 'bill', 'invoice', 'subscription', 'cancel subscription'],
    tag: 'billing_inquiry',
    priority: 9,
  },
  // Information Request
  {
    keywords: ['information', 'details', 'tell me about', 'what is', 'how does', 'explain'],
    tag: 'info_request',
    priority: 7,
  },
  // Complaint
  {
    keywords: ['complaint', 'unhappy', 'dissatisfied', 'terrible', 'awful', 'worst'],
    tag: 'complaint',
    priority: 10,
  },
  // Positive Sentiment
  {
    keywords: ['great', 'excellent', 'amazing', 'love', 'perfect', 'fantastic', 'wonderful'],
    tag: 'positive_feedback',
    priority: 5,
  },
  // Urgent
  {
    keywords: ['urgent', 'asap', 'immediately', 'emergency', 'right now', 'critical'],
    tag: 'urgent',
    priority: 10,
  },
  // Product Interest
  {
    keywords: ['demo', 'trial', 'test', 'try out', 'see how it works'],
    tag: 'product_interest',
    priority: 8,
  },
  // Follow-up
  {
    keywords: ['follow up', 'following up', 'callback', 'call back', 'spoke with'],
    tag: 'follow_up',
    priority: 7,
  },
];

export interface AutoTagResult {
  tags: string[];
  matchedKeywords: Record<string, string[]>; // tag -> keywords found
  confidence: number; // 0-1 score
}

/**
 * Analyzes transcript text and returns suggested tags based on keyword matches
 * Focuses on the first 30 seconds of conversation for intent classification
 */
export function analyzeTranscriptForTags(
  transcriptText: string,
  options?: {
    maxDurationSeconds?: number;
    minConfidence?: number;
  }
): AutoTagResult {
  const { maxDurationSeconds = 30, minConfidence = 0.3 } = options || {};

  const normalizedText = transcriptText.toLowerCase();
  const matchedRules: Array<{ rule: KeywordRule; keywords: string[] }> = [];

  // Find all matching rules
  for (const rule of TAGGING_RULES) {
    const foundKeywords: string[] = [];

    for (const keyword of rule.keywords) {
      if (normalizedText.includes(keyword.toLowerCase())) {
        foundKeywords.push(keyword);
      }
    }

    if (foundKeywords.length > 0) {
      matchedRules.push({ rule, keywords: foundKeywords });
    }
  }

  // Sort by priority (highest first)
  matchedRules.sort((a, b) => b.rule.priority - a.rule.priority);

  // Calculate confidence based on number of keyword matches
  const totalKeywordMatches = matchedRules.reduce((sum, m) => sum + m.keywords.length, 0);
  const confidence = Math.min(totalKeywordMatches / 3, 1); // Cap at 1.0

  // Build result
  const tags: string[] = [];
  const matchedKeywords: Record<string, string[]> = {};

  for (const { rule, keywords } of matchedRules) {
    if (confidence >= minConfidence) {
      tags.push(rule.tag);
      matchedKeywords[rule.tag] = keywords;
    }
  }

  return {
    tags: Array.from(new Set(tags)), // Deduplicate
    matchedKeywords,
    confidence,
  };
}

/**
 * Extracts the first N seconds of conversation from a full transcript array
 */
export function extractEarlyTranscript(
  messages: Array<{ role: string; content: string; timestamp?: string }>,
  durationSeconds: number = 30
): string {
  if (!messages || messages.length === 0) return '';

  // If timestamps are available, filter by time
  if (messages[0]?.timestamp) {
    const startTime = new Date(messages[0].timestamp).getTime();
    const cutoffTime = startTime + durationSeconds * 1000;

    const earlyMessages = messages.filter((m) => {
      if (!m.timestamp) return false;
      return new Date(m.timestamp).getTime() <= cutoffTime;
    });

    return earlyMessages.map((m) => m.content).join(' ');
  }

  // Otherwise, just take first few messages as approximation
  const estimatedMessagesPerMinute = 10;
  const estimatedMessages = Math.ceil((durationSeconds / 60) * estimatedMessagesPerMinute);
  return messages
    .slice(0, estimatedMessages)
    .map((m) => m.content)
    .join(' ');
}
