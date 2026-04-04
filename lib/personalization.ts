/**
 * Caller Personalization Library
 * Injects caller memory and context into system prompts for personalized conversations
 */

export interface CallerContext {
  name?: string;
  callCount: number;
  firstCallAt?: string;
  lastCallAt?: string;
  summary?: string;
  preferences?: Record<string, any>;
  relationshipScore?: number;
  lastOfferMade?: string;
  lastOfferOutcome?: string;
  notes?: string;
}

export interface PersonalizationOptions {
  includeHistory?: boolean;
  includePreferences?: boolean;
  includeRelationshipScore?: boolean;
  maxSummaryLength?: number;
}

/**
 * Inject caller context into a system prompt
 * Returns an enhanced prompt with personalization
 */
export function injectCallerContext(
  basePrompt: string,
  callerContext: CallerContext | null,
  options: PersonalizationOptions = {}
): string {
  const {
    includeHistory = true,
    includePreferences = true,
    includeRelationshipScore = false,
    maxSummaryLength = 500,
  } = options;

  // If no caller context, return base prompt
  if (!callerContext) {
    return basePrompt;
  }

  // Build personalization context
  const personalizationSections: string[] = [];

  // Caller identification
  if (callerContext.name) {
    personalizationSections.push(
      `**CALLER INFORMATION**\nYou are speaking with ${callerContext.name}.`
    );
  }

  // Call history
  if (includeHistory && callerContext.callCount > 0) {
    const historyLines: string[] = [];
    historyLines.push(`**CALL HISTORY**`);

    if (callerContext.callCount === 1) {
      historyLines.push(`This is their first call with us.`);
    } else {
      historyLines.push(`This is call #${callerContext.callCount} with this caller.`);

      if (callerContext.firstCallAt) {
        const firstCallDate = new Date(callerContext.firstCallAt).toLocaleDateString();
        historyLines.push(`First contact: ${firstCallDate}`);
      }

      if (callerContext.lastCallAt) {
        const lastCallDate = new Date(callerContext.lastCallAt).toLocaleDateString();
        const daysSince = calculateDaysSince(callerContext.lastCallAt);
        historyLines.push(`Last contact: ${lastCallDate} (${daysSince} days ago)`);
      }
    }

    // Add summary if available
    if (callerContext.summary) {
      const trimmedSummary =
        callerContext.summary.length > maxSummaryLength
          ? callerContext.summary.substring(0, maxSummaryLength) + '...'
          : callerContext.summary;
      historyLines.push(`\nRelationship summary:\n${trimmedSummary}`);
    }

    // Add last offer context
    if (callerContext.lastOfferMade) {
      historyLines.push(
        `\nLast offer: ${callerContext.lastOfferMade} → ${callerContext.lastOfferOutcome || 'pending'}`
      );
    }

    personalizationSections.push(historyLines.join('\n'));
  }

  // Preferences
  if (
    includePreferences &&
    callerContext.preferences &&
    Object.keys(callerContext.preferences).length > 0
  ) {
    const prefLines: string[] = [`**CALLER PREFERENCES**`];

    for (const [key, value] of Object.entries(callerContext.preferences)) {
      prefLines.push(`• ${formatPreferenceKey(key)}: ${value}`);
    }

    personalizationSections.push(prefLines.join('\n'));
  }

  // Relationship score (if requested)
  if (includeRelationshipScore && callerContext.relationshipScore != null) {
    const score = callerContext.relationshipScore;
    let scoreLabel = 'Unknown';

    if (score >= 80) {
      scoreLabel = 'Excellent (warm lead, prioritize closing)';
    } else if (score >= 60) {
      scoreLabel = 'Good (engaged, build trust)';
    } else if (score >= 40) {
      scoreLabel = 'Moderate (needs nurturing)';
    } else if (score >= 20) {
      scoreLabel = 'Low (early stage, discover needs)';
    } else {
      scoreLabel = 'Very Low (qualify interest)';
    }

    personalizationSections.push(
      `**RELATIONSHIP STRENGTH**\nScore: ${score}/100 - ${scoreLabel}`
    );
  }

  // Additional notes
  if (callerContext.notes && callerContext.notes.trim().length > 0) {
    personalizationSections.push(`**IMPORTANT NOTES**\n${callerContext.notes}`);
  }

  // Combine base prompt with personalization
  if (personalizationSections.length === 0) {
    return basePrompt;
  }

  const personalizationBlock = personalizationSections.join('\n\n');

  // Insert personalization after the main system instructions but before constraints
  // Look for common delimiters to inject at the right spot
  const constraintsMarkers = [
    '## Constraints',
    '## Rules',
    '## Important',
    '## Guidelines',
  ];

  let insertionIndex = -1;
  for (const marker of constraintsMarkers) {
    insertionIndex = basePrompt.indexOf(marker);
    if (insertionIndex !== -1) {
      break;
    }
  }

  if (insertionIndex !== -1) {
    // Insert before constraints section
    return (
      basePrompt.substring(0, insertionIndex) +
      `## Caller Context\n\n${personalizationBlock}\n\n` +
      basePrompt.substring(insertionIndex)
    );
  } else {
    // Append to end
    return `${basePrompt}\n\n## Caller Context\n\n${personalizationBlock}`;
  }
}

/**
 * Generate a greeting message based on caller context
 */
export function generatePersonalizedGreeting(
  callerContext: CallerContext | null,
  defaultGreeting: string = 'Hello! How can I help you today?'
): string {
  if (!callerContext || !callerContext.name) {
    return defaultGreeting;
  }

  const { name, callCount, lastCallAt } = callerContext;

  // First-time caller
  if (callCount === 1 || !lastCallAt) {
    return `Hello ${name}! Welcome! How can I help you today?`;
  }

  // Returning caller
  const daysSince = calculateDaysSince(lastCallAt);

  if (daysSince === 0) {
    return `Hi ${name}! Great to hear from you again today. What can I help you with?`;
  } else if (daysSince === 1) {
    return `Hi ${name}! Good to hear from you again. How can I assist you?`;
  } else if (daysSince <= 7) {
    return `Welcome back, ${name}! How can I help you today?`;
  } else if (daysSince <= 30) {
    return `Hello ${name}! It's been a while. What brings you back today?`;
  } else {
    return `Hi ${name}! Great to hear from you again. How can I assist you?`;
  }
}

/**
 * Generate a closing message based on caller context and call outcome
 */
export function generatePersonalizedClosing(
  callerContext: CallerContext | null,
  callOutcome: 'positive' | 'neutral' | 'negative',
  defaultClosing: string = 'Thank you for calling. Have a great day!'
): string {
  if (!callerContext || !callerContext.name) {
    return defaultClosing;
  }

  const { name, relationshipScore } = callerContext;

  if (callOutcome === 'positive') {
    if (relationshipScore && relationshipScore >= 70) {
      return `Thank you, ${name}! I'm excited to work with you. I'll send you a confirmation shortly. Have a wonderful day!`;
    } else {
      return `Thank you, ${name}! I'll follow up with the details we discussed. Have a great day!`;
    }
  } else if (callOutcome === 'neutral') {
    return `Thank you for your time, ${name}. Feel free to reach out if you have any questions. Take care!`;
  } else {
    // negative
    return `I understand, ${name}. If you change your mind or have questions, we're here to help. Have a good day!`;
  }
}

/**
 * Extract caller preferences from conversation insights
 */
export function extractPreferences(conversationText: string): Record<string, any> {
  const preferences: Record<string, any> = {};

  const text = conversationText.toLowerCase();

  // Language preference
  if (text.includes('spanish') || text.includes('español')) {
    preferences.preferredLanguage = 'es';
  } else if (text.includes('french') || text.includes('français')) {
    preferences.preferredLanguage = 'fr';
  }

  // Communication channel
  if (text.includes('text me') || text.includes('sms')) {
    preferences.preferredChannel = 'sms';
  } else if (text.includes('email')) {
    preferences.preferredChannel = 'email';
  }

  // Time preference
  if (text.includes('morning')) {
    preferences.preferredCallTime = 'morning';
  } else if (text.includes('afternoon')) {
    preferences.preferredCallTime = 'afternoon';
  } else if (text.includes('evening')) {
    preferences.preferredCallTime = 'evening';
  }

  // Tone preference
  if (text.includes('formal') || text.includes('professional')) {
    preferences.tonePreference = 'formal';
  } else if (text.includes('casual') || text.includes('friendly')) {
    preferences.tonePreference = 'casual';
  }

  return preferences;
}

/**
 * Calculate relationship score based on interaction history
 */
export function calculateRelationshipScore(interactions: {
  callCount: number;
  successfulOutcomes: number;
  appointmentsBooked: number;
  averageSentiment: number; // 0-1
  daysSinceLastContact: number;
  totalCallDurationMinutes: number;
}): number {
  let score = 0;

  // Call frequency (max 20 points)
  score += Math.min(interactions.callCount * 5, 20);

  // Success rate (max 25 points)
  if (interactions.callCount > 0) {
    const successRate = interactions.successfulOutcomes / interactions.callCount;
    score += successRate * 25;
  }

  // Appointments booked (max 20 points)
  score += Math.min(interactions.appointmentsBooked * 10, 20);

  // Sentiment (max 15 points)
  score += interactions.averageSentiment * 15;

  // Recency (max 10 points, decays over time)
  const recencyScore = Math.max(0, 10 - interactions.daysSinceLastContact / 3);
  score += recencyScore;

  // Engagement depth (max 10 points)
  const engagementScore = Math.min(interactions.totalCallDurationMinutes / 2, 10);
  score += engagementScore;

  return Math.round(Math.min(score, 100));
}

// Helper functions

function calculateDaysSince(dateString: string): number {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function formatPreferenceKey(key: string): string {
  // Convert camelCase to Title Case with spaces
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}
