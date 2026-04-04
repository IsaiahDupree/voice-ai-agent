# ElevenLabs Voice Guide

## Overview

ElevenLabs provides the Text-to-Speech (TTS) voices for your AI agents. The voice you choose significantly impacts caller perception and engagement.

## Popular Voices

### Rachel (Female, Professional)
- **Voice ID:** `21m00Tcm4TlvDq8ikWAM`
- **Accent:** American
- **Tone:** Warm, professional, clear
- **Best for:** Sales, customer service, appointment scheduling
- **Age:** Mid-20s to early 30s
- **Energy:** Medium-high

**When to use:**
- Outbound B2B sales calls
- Professional service bookings (medical, legal, financial)
- Customer support for tech products

**Audio sample:** [Preview in ElevenLabs](https://elevenlabs.io/speech-synthesis)

### Bella (Female, Soft)
- **Voice ID:** `EXAVITQu4vr4xnSDxMaL`
- **Accent:** American
- **Tone:** Soft, friendly, patient
- **Best for:** Support, sensitive topics, healthcare
- **Age:** Late 20s to mid-30s
- **Energy:** Medium-low

**When to use:**
- Patient appointment scheduling
- Customer support (handling complaints)
- Survey calls (non-threatening approach)

### Domi (Female, Confident)
- **Voice ID:** `AZnzlk1XvdvUeBnXmlld`
- **Accent:** American
- **Tone:** Confident, energetic, persuasive
- **Best for:** Sales, marketing, event promotion
- **Age:** Mid-20s
- **Energy:** High

**When to use:**
- Aggressive outbound sales
- Event registration calls
- High-energy promotions

### Antoni (Male, Smooth)
- **Voice ID:** `ErXwobaYiN019PkySvjV`
- **Accent:** American
- **Tone:** Smooth, professional, trustworthy
- **Best for:** B2B sales, executive communication, finance
- **Age:** Mid-30s to early 40s
- **Energy:** Medium

**When to use:**
- Executive-level outreach
- Financial services calls
- High-ticket sales

### Arnold (Male, Deep)
- **Voice ID:** `VR6AewLTigWG4xSOukaG`
- **Accent:** American
- **Tone:** Deep, authoritative, commanding
- **Best for:** Leadership communication, emergency alerts, security
- **Age:** 40s-50s
- **Energy:** Medium-low

**When to use:**
- Authority-driven messaging
- Security/compliance notifications
- Crisis communication

## Voice Selection Guide

### By Industry

| Industry | Recommended Voice | Rationale |
|----------|------------------|-----------|
| SaaS / Tech | Rachel, Antoni | Professional, tech-savvy perception |
| Healthcare | Bella, Rachel | Soft, patient, trustworthy |
| Real Estate | Domi, Antoni | Confident, persuasive |
| Finance | Antoni, Arnold | Authoritative, trustworthy |
| E-commerce | Rachel, Bella | Friendly, helpful |
| Education | Bella, Rachel | Patient, clear |
| Legal Services | Antoni, Arnold | Professional, commanding |

### By Call Type

| Call Type | Recommended Voice | Rationale |
|-----------|------------------|-----------|
| Cold Outreach | Rachel, Domi | Energetic, engaging |
| Appointment Reminder | Bella, Rachel | Friendly, non-threatening |
| Payment Collection | Antoni, Arnold | Authoritative but respectful |
| Survey / Research | Bella, Rachel | Neutral, non-biased |
| Support / Help | Bella, Rachel | Patient, empathetic |
| Event Registration | Domi, Rachel | Enthusiastic, persuasive |

### By Target Demographic

| Demographic | Recommended Voice | Rationale |
|------------|------------------|-----------|
| Gen Z (18-25) | Domi, Rachel | Younger, energetic |
| Millennials (26-40) | Rachel, Antoni | Professional, relatable |
| Gen X (41-56) | Antoni, Bella | Mature, trustworthy |
| Boomers (57+) | Arnold, Bella | Authoritative, clear |

## Voice Settings

### Stability

Controls consistency of voice delivery.

| Value | Behavior | Use Case |
|-------|----------|----------|
| 0.0 - 0.3 | Very expressive, varied | Creative content, storytelling |
| 0.4 - 0.6 | Balanced (default: 0.5) | General purpose |
| 0.7 - 1.0 | Consistent, predictable | Compliance-driven, scripted |

**Example:**
```json
{
  "voice_id": "21m00Tcm4TlvDq8ikWAM",
  "voice_settings": {
    "stability": 0.5
  }
}
```

**When to adjust:**
- **Increase (0.7-0.9)** for appointment confirmations (need consistency)
- **Decrease (0.3-0.4)** for sales calls (more natural variation)

### Similarity Boost

Controls how closely the voice matches the original sample.

| Value | Behavior | Use Case |
|-------|----------|----------|
| 0.0 - 0.3 | Loose match, more creative | Diverse content |
| 0.4 - 0.7 | Balanced (default: 0.75) | General purpose |
| 0.8 - 1.0 | Exact match, consistent | Brand-sensitive |

**Example:**
```json
{
  "voice_id": "21m00Tcm4TlvDq8ikWAM",
  "voice_settings": {
    "similarity_boost": 0.75
  }
}
```

**When to adjust:**
- **Increase (0.9)** if voice sounds different from preview
- **Decrease (0.5)** if voice sounds too "stiff"

### Speaking Rate (Speed)

*Note: Vapi handles this, not ElevenLabs directly.*

**Default:** 1.0 (normal speed)

**Adjustment:**
```json
{
  "voice": {
    "provider": "11labs",
    "voiceId": "21m00Tcm4TlvDq8ikWAM",
    "speed": 1.1
  }
}
```

**When to adjust:**
- **1.1-1.2**: Energetic sales calls, time-sensitive
- **0.9-1.0**: Standard (recommended)
- **0.8-0.9**: Complex information, elderly audience

## Turbo Voices

ElevenLabs Turbo voices are optimized for real-time streaming (lower latency).

### Turbo v2 (Recommended)

**All standard voices** now use Turbo v2 by default when accessed via Vapi.

**Latency:**
- Standard: 300-500ms
- Turbo v2: 150-250ms

**Quality:**
- Turbo v2 quality is nearly identical to standard

**No configuration needed** - Vapi automatically uses Turbo v2.

## Custom Voices

### Voice Cloning

ElevenLabs allows cloning your own voice (requires Professional plan).

**Steps:**
1. Record 10-30 minutes of clean audio (no background noise)
2. Upload to ElevenLabs dashboard
3. Train voice clone (takes 30-60 minutes)
4. Use custom voice ID in persona config

**Use cases:**
- Founder calling customers personally
- Brand spokesperson consistency
- Regional accent matching

**Pricing:**
- Professional plan: $99/mo (includes 10 custom voices)

### Voice Design (Beta)

Generate custom voices by describing characteristics.

**Example:**
```
"Generate a female voice, American accent, mid-30s, confident but friendly, medium energy"
```

**Steps:**
1. ElevenLabs dashboard → Voice Lab → Voice Design
2. Enter description
3. Generate samples
4. Select best match
5. Use generated voice ID

## Testing Voices

### Preview in Dashboard

**UI Method:**
1. Dashboard → Personas → New Persona
2. Select ElevenLabs voice
3. Click **"Test Voice"**
4. Enter sample text: "Hi, this is Sarah from Acme Corp. How are you today?"
5. Click **Play**

### API Method

```bash
curl -X POST https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM \
  -H "xi-api-key: YOUR_ELEVENLABS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Hi, this is Sarah from Acme Corp. How can I help you today?",
    "voice_settings": {
      "stability": 0.5,
      "similarity_boost": 0.75
    }
  }' \
  --output test_voice.mp3

# Play audio
afplay test_voice.mp3  # macOS
# or open test_voice.mp3 in browser
```

### A/B Testing Voices

Test two voices with same script to compare:

**Test setup:**
1. Create 2 personas with same prompt, different voices
2. Run 50 calls to each persona
3. Compare:
   - Answer rate
   - Average call duration
   - Booking conversion rate
   - Caller satisfaction (if surveyed)

**Example test:**
```
Persona A: Rachel voice
Persona B: Bella voice

Results after 50 calls each:
- Rachel: 35% answer rate, 22% booking rate
- Bella: 38% answer rate, 19% booking rate

Winner: Rachel (higher booking rate)
```

## Common Issues

### "Voice sounds robotic"

**Solutions:**
1. **Lower stability** (try 0.3-0.4)
2. **Adjust similarity boost** (try 0.6)
3. **Use Turbo v2** (should be default)
4. **Simplify text**: Shorter sentences = more natural
5. **Add punctuation**: Commas create natural pauses

### "Voice interrupts caller"

**This is a Vapi VAD issue, not ElevenLabs.**

**Solution:**
```json
{
  "vad": {
    "threshold": 0.6,  // Higher = less sensitive
    "prefix_padding_ms": 300,
    "silence_duration_ms": 800
  }
}
```

### "Voice mispronounces words"

**Common issues:**
- Company names
- Product names
- Acronyms
- Technical terms

**Solutions:**

**1. Phonetic spelling:**
```
"Acme" → "Ak-mee"
"SQL" → "S-Q-L" or "sequel"
"API" → "A-P-I" or "ay-pee-eye"
```

**2. Use SSML (Speech Synthesis Markup Language):**
```xml
<speak>
  Hi, this is Sarah from <phoneme alphabet="ipa" ph="ˈæk.mi">Acme</phoneme> Corp.
</speak>
```

**3. Train custom pronunciations** (Enterprise plan only)

### "Voice quality varies"

**Possible causes:**
- Network latency to ElevenLabs API
- Vapi server location vs caller location
- Streaming buffer issues

**Solutions:**
1. Check `/api/health` for ElevenLabs connectivity
2. Use Turbo v2 (lower latency)
3. Verify stable internet connection
4. Contact Vapi support if persistent

## Voice Pricing

### ElevenLabs Pricing Tiers

| Plan | Cost | Characters/mo | Use Case |
|------|------|--------------|----------|
| Free | $0 | 10,000 | Testing only |
| Starter | $5/mo | 30,000 | Light usage (300 calls) |
| Creator | $22/mo | 100,000 | Small campaigns (1,000 calls) |
| Pro | $99/mo | 500,000 | Large campaigns (5,000 calls) |
| Scale | $330/mo | 2,000,000 | Enterprise (20,000 calls) |

**Characters per call estimate:**
- Average call: 2-5 minutes = 300-750 words = 1,800-4,500 characters
- Assume **2,000 characters per call** for pricing

**Example:**
- Pro plan ($99/mo) ÷ 500,000 characters = **250 calls/month**
- Scale plan ($330/mo) ÷ 2,000,000 characters = **1,000 calls/month**

*Note: Vapi charges separately for call minutes.*

### Cost Optimization

**Reduce character usage:**
1. **Keep agent responses short** (1-2 sentences)
2. **Use silence instead of filler** ("umm", "let me check")
3. **Avoid repeating information**
4. **Transfer to human** for long explanations

**Example savings:**
```
❌ Long response (200 characters):
"Thank you so much for your interest in our services. We really appreciate your time today. Let me check our calendar to see what time slots we have available for you this week or next week."

✅ Short response (60 characters):
"Great! Let me check our calendar for available times."

Savings: 70% fewer characters, same outcome
```

## Voice Analytics

### Track Voice Performance

**Metrics to monitor:**
- Average call duration by voice
- Answer rate by voice
- Booking conversion rate by voice
- "Transfer to human" rate by voice (higher = voice may be off-putting)

**SQL query:**
```sql
SELECT
  p.name AS persona_name,
  p.voice_id,
  COUNT(*) AS total_calls,
  AVG(vc.duration) AS avg_duration,
  COUNT(*) FILTER (WHERE vc.outcome = 'booking_made') AS bookings,
  ROUND((COUNT(*) FILTER (WHERE vc.outcome = 'booking_made')::DECIMAL / COUNT(*)) * 100, 2) AS conversion_rate
FROM voice_agent_calls vc
JOIN personas p ON vc.persona_id = p.id
WHERE vc.created_at > NOW() - INTERVAL '7 days'
GROUP BY p.name, p.voice_id
ORDER BY conversion_rate DESC;
```

## Best Practices

### ✅ Do's

- Test voice with actual script before going live
- Use natural, conversational language in system prompt
- Keep agent responses under 2 sentences
- Match voice to brand and audience
- A/B test voices with real calls (not just audio previews)
- Monitor caller feedback and adjust if needed

### ❌ Don'ts

- Don't pick voice based only on audio preview (test in real calls)
- Don't use overly dramatic or expressive voices for professional calls
- Don't ignore pronunciation issues (fix with phonetic spelling)
- Don't set stability too low (< 0.3) for business calls
- Don't change voice mid-campaign (creates inconsistency)

## Multilingual Voices

Voice AI Agent V2 supports 8 languages with dedicated native voices for each. Language detection automatically switches voices mid-call when a non-English speaker is detected.

### Supported Languages

| Language | Code | Native Name | Primary Voice | Gender | Tone |
|----------|------|-------------|---------------|--------|------|
| English | en | English | Bella | Female | Professional-Friendly |
| Spanish | es | Español | Ana | Female | Professional |
| French | fr | Français | Marie | Female | Professional |
| German | de | Deutsch | Anna | Female | Professional |
| Portuguese | pt | Português | Maria | Female | Friendly |
| Chinese | zh | 中文 | Li | Female | Professional |
| Hindi | hi | हिन्दी | Priya | Female | Friendly |
| Japanese | ja | 日本語 | Yuki | Female | Professional |

### Spanish (Español)

#### Ana (Primary) - Professional
- **Voice ID:** `VYWJe7e3ZqYHzHqIkqxR`
- **Gender:** Female
- **Accent:** Neutral Spanish (works for both Spain and Latin America)
- **Tone:** Professional, clear, warm
- **Best for:** Sales, appointments, customer support
- **Settings:** Stability: 0.5, Similarity: 0.75

**When to use:**
- General-purpose Spanish communication
- Professional service calls (medical, legal, financial)
- B2B sales to Spanish-speaking markets

#### Carlos (Alternative) - Warm & Friendly
- **Voice ID:** `G3YhwqYXKcKqCZDBwSgN`
- **Gender:** Male
- **Accent:** Neutral Spanish
- **Tone:** Warm, friendly, patient
- **Best for:** Support, healthcare, education

**When to use:**
- Customer support (handling sensitive topics)
- Healthcare appointment scheduling
- Educational/training calls

### French (Français)

#### Marie (Primary) - Professional
- **Voice ID:** `MF3mGyEYCl7XYWbV9V6O`
- **Gender:** Female
- **Accent:** Parisian French
- **Tone:** Professional, polished
- **Best for:** Sales, appointments, customer support
- **Settings:** Stability: 0.5, Similarity: 0.75

**When to use:**
- Professional communication in France/French-speaking regions
- B2B sales
- Service booking calls

#### Pierre (Alternative) - Authoritative
- **Voice ID:** `CYw3kZ02Hs0563khs1Fj`
- **Gender:** Male
- **Accent:** Standard French
- **Tone:** Professional, authoritative
- **Best for:** B2B sales, financial services, legal

**When to use:**
- Executive-level communication
- Financial services outreach
- Legal/compliance calls

### German (Deutsch)

#### Anna (Primary) - Professional
- **Voice ID:** `TxGEqnHWrfWFTfGW9XjX`
- **Gender:** Female
- **Accent:** Standard Hochdeutsch
- **Tone:** Professional, clear
- **Best for:** Sales, appointments, customer support
- **Settings:** Stability: 0.5, Similarity: 0.75

**When to use:**
- General-purpose German communication
- Professional services (medical, legal, tech)
- Customer support

#### Klaus (Alternative) - Authoritative
- **Voice ID:** `iP95p4xoKVk53GoZ742B`
- **Gender:** Male
- **Accent:** Standard German
- **Tone:** Authoritative, commanding
- **Best for:** B2B sales, financial services, legal

**When to use:**
- B2B outreach
- Financial/banking services
- Authority-driven messaging

### Portuguese (Português)

#### Maria (Primary) - Friendly
- **Voice ID:** `EHGtRhaMNdZHrFXdLwrk`
- **Gender:** Female
- **Accent:** Brazilian Portuguese
- **Tone:** Friendly, warm
- **Best for:** Sales, support, appointments
- **Settings:** Stability: 0.5, Similarity: 0.75

**When to use:**
- Brazilian market outreach
- Customer support
- Appointment scheduling

#### João (Alternative) - Professional
- **Voice ID:** `onwK4e9ZLuTAKqWW03F9`
- **Gender:** Male
- **Accent:** Brazilian Portuguese
- **Tone:** Professional
- **Best for:** B2B sales, professional services

**When to use:**
- B2B sales in Brazil
- Professional service calls

### Chinese (中文)

#### Li (Primary) - Professional
- **Voice ID:** `XrExE9yKIg1WjnnlVkGX`
- **Gender:** Female
- **Accent:** Standard Mandarin
- **Tone:** Professional, clear
- **Best for:** Sales, support, appointments
- **Settings:** Stability: 0.6 (higher for tonal accuracy), Similarity: 0.75

**When to use:**
- General Mandarin communication
- China market outreach
- Professional services

**Note:** Stability is set higher (0.6) for better tonal accuracy in Mandarin.

### Hindi (हिन्दी)

#### Priya (Primary) - Friendly
- **Voice ID:** `zIq6HTgd4z9W9T4G3h8L`
- **Gender:** Female
- **Accent:** Standard Hindi
- **Tone:** Friendly, clear
- **Best for:** Sales, support, appointments
- **Settings:** Stability: 0.5, Similarity: 0.75

**When to use:**
- India market outreach
- Customer support
- Appointment scheduling

### Japanese (日本語)

#### Yuki (Primary) - Professional
- **Voice ID:** `VHlPsm8qLq1T9z4J3h8L`
- **Gender:** Female
- **Accent:** Standard Tokyo dialect
- **Tone:** Professional, polite
- **Best for:** Sales, support, appointments
- **Settings:** Stability: 0.6 (higher for pitch accent accuracy), Similarity: 0.75

**When to use:**
- Japan market outreach
- Professional services
- Customer support

**Note:** Stability is set higher (0.6) for better pitch accent accuracy in Japanese.

### How Multilingual Detection Works

1. **First 2-3 seconds:** Caller speaks → Deepgram transcribes
2. **Language detection:** GPT-4o-mini analyzes transcript snippet
3. **Confidence check:** If confidence > 80% and language ≠ English
4. **Auto-switch:** System switches to matching language assistant:
   - ElevenLabs voice → native language voice
   - Deepgram STT → language-specific model (e.g., `nova-2-es` for Spanish)
   - System prompt → translated prompt
5. **Seamless continuation:** Call continues in detected language

### Configuration

**Dashboard:** `/dashboard/language-variants`

**Steps:**
1. Enter base assistant ID (your English assistant)
2. Click "+ Add Language Variant"
3. Select language (es, fr, de, pt, zh, hi, ja)
4. Choose voice from dropdown (pre-populated with recommended voices)
5. Enter translated system prompt
6. Create variant

**Result:** When a caller speaks in the selected language, the assistant automatically switches to the configured variant.

### Testing Multilingual Detection

**Test UI:**
Dashboard → Language Variants → "Test Language Detection" button

**Test via API:**
```bash
curl -X POST http://localhost:3000/api/language/detect \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Hola, ¿cómo estás?",
    "currentLanguage": "en"
  }'

# Response:
{
  "language": "es",
  "confidence": 95,
  "languageName": "Spanish",
  "shouldSwitch": true
}
```

### Multilingual Voice Pricing

**ElevenLabs Model:** `eleven_multilingual_v2` (used for all non-English languages)

**No additional cost** - Multilingual v2 is included in all ElevenLabs plans at the same character rate as English voices.

**Character usage estimate by language:**
- Romance languages (ES, FR, PT): ~1.1x English (slightly longer translations)
- German: ~1.2x English (compound words)
- Chinese: ~0.8x English (more concise)
- Japanese: ~1.0x English
- Hindi: ~1.1x English

### Best Practices

#### ✅ Do's

- Test each language variant with native speakers before production
- Use translated system prompts (don't rely on LLM to auto-translate mid-call)
- Set confidence threshold to 80%+ (avoids false positives)
- Configure STT language models per language (e.g., `nova-2-es` for Spanish)
- Keep prompts culturally appropriate (not just literal translations)

#### ❌ Don'ts

- Don't use English voices for non-English calls (sounds unnatural)
- Don't set confidence threshold below 70% (causes false switches)
- Don't forget to configure STT language (Deepgram needs language-specific models)
- Don't assume one accent fits all (e.g., European vs Latin American Spanish)
- Don't launch without testing pronunciation of key terms (company names, products)

### Troubleshooting

**Issue: Language not detected**

**Causes:**
- Caller spoke too briefly (< 5 words)
- Mixed language (Spanglish, Franglais)
- Heavy accent

**Solution:**
```json
{
  "confidenceThreshold": 70  // Lower threshold (default: 80)
}
```

**Issue: False language detection**

**Cause:** Background noise, caller name in another language

**Solution:**
```json
{
  "confidenceThreshold": 90  // Higher threshold for conservative switching
}
```

**Issue: Voice mispronounces words in target language**

**Solution:** Use phonetic spelling in system prompt:
```
Spanish: "Acme" → "Akme"
French: "Support" → "Soo-port"
German: "Service" → "Zer-vees"
```

## Next Steps

- [Persona Builder Guide](./PERSONA-GUIDE.md) - Create personas with ElevenLabs voices
- [Campaign Setup Guide](./CAMPAIGN-GUIDE.md) - Launch campaigns
- [Troubleshooting](./TROUBLESHOOTING.md) - Fix voice issues
- [Language Variants Dashboard](./app/dashboard/language-variants) - Configure multilingual assistants

## Resources

- **ElevenLabs Dashboard**: https://elevenlabs.io/speech-synthesis
- **Voice Library**: https://elevenlabs.io/voice-library
- **Multilingual Voices**: https://elevenlabs.io/voice-library?language=multilingual
- **API Docs**: https://docs.elevenlabs.io
- **Pricing**: https://elevenlabs.io/pricing
