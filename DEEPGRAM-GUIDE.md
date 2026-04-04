# Deepgram Configuration Guide

## Overview

Deepgram provides real-time Speech-to-Text (STT) transcription for your voice AI agents. It converts caller speech into text that the LLM can understand and respond to.

## Default Configuration

Vapi uses Deepgram by default with sensible settings:

```json
{
  "transcriber": {
    "provider": "deepgram",
    "model": "nova-2",
    "language": "en"
  }
}
```

**No additional configuration needed** for most use cases.

## Deepgram Models

### Nova-2 (Recommended)

**Best for:** General-purpose, high accuracy, fast

- **Accuracy:** 95-98% (industry-leading)
- **Latency:** 150-250ms
- **Languages:** 30+ languages
- **Cost:** $0.0043/minute

**When to use:**
- Default choice for all English calls
- Multi-language support needed
- Best balance of speed and accuracy

### Nova-2 Phonecall (Optimized)

**Best for:** Phone call audio (recommended for this app)

- **Accuracy:** 96-99% (optimized for phone quality)
- **Latency:** 150-200ms
- **Cost:** $0.0043/minute

**Configuration:**
```json
{
  "transcriber": {
    "provider": "deepgram",
    "model": "nova-2-phonecall",
    "language": "en"
  }
}
```

**When to use:**
- All phone calls (outbound and inbound)
- Handles background noise better
- Optimized for telephony codecs

### Nova-2 General (Legacy)

Older model, replaced by Nova-2. Not recommended.

## Language Configuration

### English (Default)

```json
{
  "transcriber": {
    "provider": "deepgram",
    "model": "nova-2",
    "language": "en"
  }
}
```

Supports these English variants:
- `en-US` - American English
- `en-GB` - British English
- `en-AU` - Australian English
- `en-NZ` - New Zealand English
- `en-IN` - Indian English

**Recommendation:** Use `en` (auto-detects variant) unless you need specific accent handling.

### Other Languages

Deepgram Nova-2 supports 30+ languages:

| Language | Code | Accuracy |
|----------|------|----------|
| Spanish | `es` | 95%+ |
| French | `fr` | 95%+ |
| German | `de` | 95%+ |
| Italian | `it` | 94%+ |
| Portuguese | `pt` | 94%+ |
| Hindi | `hi` | 92%+ |
| Japanese | `ja` | 91%+ |
| Korean | `ko` | 91%+ |
| Mandarin | `zh` | 93%+ |
| Russian | `ru` | 93%+ |

**Example (Spanish):**
```json
{
  "transcriber": {
    "provider": "deepgram",
    "model": "nova-2",
    "language": "es"
  }
}
```

### Multi-language Campaigns

**Option 1: Separate personas per language**

```json
// English persona
{
  "name": "Sales Agent (English)",
  "transcriber": { "language": "en" }
}

// Spanish persona
{
  "name": "Sales Agent (Spanish)",
  "transcriber": { "language": "es" }
}
```

**Option 2: Language detection**

```json
{
  "transcriber": {
    "provider": "deepgram",
    "model": "nova-2",
    "language": "multi"  // Auto-detect language
  }
}
```

*Note: Multi-language detection adds 50-100ms latency.*

## Advanced Settings

### Keywords

Boost recognition of specific words (company names, products, technical terms).

```json
{
  "transcriber": {
    "provider": "deepgram",
    "model": "nova-2",
    "language": "en",
    "keywords": ["Acme:10", "CloudSync:10", "API:5"]
  }
}
```

**Syntax:** `"word:boost_value"`
- Boost value: 0-10 (10 = highest priority)
- Use for:
  - Company names
  - Product names
  - Technical terms
  - Acronyms

**Example:**
```json
{
  "keywords": [
    "Acme:10",
    "API:8",
    "SQL:8",
    "SaaS:7",
    "CRM:7"
  ]
}
```

**Best practices:**
- Don't overuse (max 10-20 keywords)
- Use boost value 7-10 for critical terms
- Test to ensure keywords don't cause false positives

### Punctuation

Auto-add punctuation to transcripts (improves LLM understanding).

```json
{
  "transcriber": {
    "provider": "deepgram",
    "model": "nova-2",
    "language": "en",
    "punctuation": true  // Default: true
  }
}
```

**Enabled (recommended):**
```
"Hi I'm interested in your product. Can you tell me more about pricing?"
```

**Disabled:**
```
"hi i'm interested in your product can you tell me more about pricing"
```

**Recommendation:** Always leave enabled (default).

### Smart Formatting

Automatically format numbers, dates, times, currency.

```json
{
  "transcriber": {
    "provider": "deepgram",
    "model": "nova-2",
    "smart_format": true  // Default: true
  }
}
```

**Enabled:**
```
"I'd like to book for March 28th at 2:00 PM. My budget is $5,000."
```

**Disabled:**
```
"I'd like to book for march twenty eighth at two p m my budget is five thousand dollars"
```

**Recommendation:** Always leave enabled (default).

### Profanity Filter

Filter out profane words in transcripts.

```json
{
  "transcriber": {
    "provider": "deepgram",
    "model": "nova-2",
    "profanity_filter": false  // Default: false
  }
}
```

**Enabled:**
```
"This is ****ing terrible"
```

**Disabled:**
```
"This is [expletive] terrible"
```

**Recommendation:**
- **False** for most business calls (you want accurate transcripts)
- **True** if transcripts are customer-facing or compliance-sensitive

### Diarization (Speaker Detection)

Identify different speakers in transcript (not typically needed for voice AI).

```json
{
  "transcriber": {
    "provider": "deepgram",
    "diarization": false  // Default: false
  }
}
```

**Enabled:**
```
Speaker 1: Hi, how can I help you?
Speaker 2: I'd like to book an appointment.
Speaker 1: Great, let me check availability.
```

**Recommendation:** Leave disabled (Vapi already knows agent vs caller).

## Handling Background Noise

### Noise Reduction

Deepgram Nova-2 has built-in noise reduction. No configuration needed.

**Handles:**
- Background conversations
- Traffic noise
- Wind
- Music
- Echo

### When Noise is Problematic

**Symptoms:**
- Frequent "I didn't catch that" from agent
- Incorrect transcriptions
- Agent misunderstands caller

**Solutions:**

**1. Use Nova-2 Phonecall model** (better noise handling)

**2. Adjust VAD (Voice Activity Detection) in Vapi:**
```json
{
  "vad": {
    "threshold": 0.6,  // Higher = less sensitive to noise
    "silence_duration_ms": 1000  // Wait longer for silence
  }
}
```

**3. Ask caller to move to quieter location:**
```
// In persona system prompt:
If you hear significant background noise, politely ask:
"I'm having trouble hearing you clearly. Could you move to a quieter area?"
```

## Common Transcription Issues

### Issue: "Caller says X but agent hears Y"

**Example:**
- Caller: "I'd like to book for 2 PM"
- Transcribed: "I'd like to book for to PM"

**Solutions:**

**1. Add keyword boost:**
```json
{
  "keywords": ["2PM:10", "two PM:10"]
}
```

**2. Use smart formatting** (should be enabled by default)

**3. Check audio quality:**
```bash
# Test Deepgram API directly
curl -X POST "https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true" \
  -H "Authorization: Token YOUR_DEEPGRAM_API_KEY" \
  -H "Content-Type: audio/wav" \
  --data-binary @test_call.wav
```

### Issue: "Agent keeps saying 'I didn't catch that'"

**Causes:**
- Caller speaking too softly
- Heavy background noise
- Caller has strong accent
- VAD threshold too high

**Solutions:**

**1. Lower VAD threshold:**
```json
{
  "vad": {
    "threshold": 0.4  // More sensitive
  }
}
```

**2. Use Nova-2 (better accent handling)**

**3. Adjust LLM prompt:**
```
If you don't understand the caller, instead of saying "I didn't catch that",
try to infer what they might mean or ask a clarifying question:
"Just to confirm, you'd like to [INFERRED ACTION]?"
```

### Issue: "Transcription has delay"

**Causes:**
- Network latency to Deepgram API
- Model selection (older models are slower)
- Server location mismatch

**Solutions:**

**1. Use Nova-2** (lowest latency)

**2. Check health:**
```bash
curl https://your-app.vercel.app/api/health | jq '.services.deepgram'
```

**3. Verify Deepgram API status:** https://status.deepgram.com

**4. Check Vapi server location** (should be close to your target callers)

### Issue: "Wrong language detected"

**Only happens with multi-language detection.**

**Solution:** Specify language explicitly instead of `"multi"`:
```json
{
  "transcriber": {
    "language": "en"  // Don't use "multi"
  }
}
```

## Testing Transcription Quality

### Test Call Method

1. Make a test call to your persona
2. During call, speak clearly: "This is a test call. My name is John Doe. I'd like to book an appointment for March 28th at 2 PM."
3. After call, check transcript:
   ```bash
   curl https://your-app.vercel.app/api/transcripts?call_id=CALL_ID
   ```
4. Verify:
   - ✅ Name transcribed correctly
   - ✅ Date formatted correctly (March 28th, not march twenty eighth)
   - ✅ Time formatted correctly (2 PM, not to PM)

### Deepgram API Test

Test Deepgram directly with audio file:

```bash
# Record a 10-second audio clip
# (or download sample from test call)

curl -X POST "https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&punctuation=true" \
  -H "Authorization: Token YOUR_DEEPGRAM_API_KEY" \
  -H "Content-Type: audio/wav" \
  --data-binary @audio_sample.wav
```

**Response:**
```json
{
  "metadata": {
    "duration": 10.5,
    "channels": 1,
    "models": ["nova-2"]
  },
  "results": {
    "channels": [
      {
        "alternatives": [
          {
            "transcript": "Hi, this is a test. My name is John Doe.",
            "confidence": 0.98,
            "words": [
              {"word": "Hi", "start": 0.1, "end": 0.3, "confidence": 0.99},
              {"word": "this", "start": 0.4, "end": 0.6, "confidence": 0.98}
            ]
          }
        ]
      }
    ]
  }
}
```

**Check:**
- `confidence` should be > 0.90 for good quality
- `words` array shows word-level timing (useful for debugging)

## Cost Optimization

### Deepgram Pricing

**Pay-as-you-go:**
- Nova-2: $0.0043/minute
- Example: 1,000 calls × 3 minutes = $12.90

**Pre-paid plans:**
- Growth: $200/mo = 46,512 minutes (~15,000 calls)
- Scale: Custom pricing

*Note: Vapi may include Deepgram in their pricing. Check Vapi dashboard.*

### Reduce Transcription Costs

Deepgram charges per minute of audio, including silence.

**Tips:**
1. **End calls quickly** when outcome is clear
2. **Don't leave agent waiting** (dead air is charged)
3. **Use transfer** for long explanations (human call is cheaper)
4. **Avoid silence padding** in voice config

**Example savings:**
- Average call: 3 minutes = $0.0129
- With optimization: 2 minutes = $0.0086
- Savings: 33% per call

## Deepgram vs Alternatives

| Provider | Model | Accuracy | Latency | Cost/min |
|----------|-------|----------|---------|----------|
| Deepgram | Nova-2 | 98% | 150ms | $0.0043 |
| OpenAI | Whisper | 95% | 300ms | $0.006 |
| Google | Chirp | 96% | 250ms | $0.012 |
| AssemblyAI | Best | 95% | 200ms | $0.00025 |

**Why Deepgram (recommended):**
- Highest accuracy for phone calls
- Lowest latency (critical for real-time)
- Best noise handling
- Industry standard for voice AI

**When to consider alternatives:**
- Cost-sensitive (AssemblyAI is cheaper but less accurate)
- Already using Google/OpenAI ecosystem

## Monitoring Transcription Quality

### Key Metrics

**1. Transcription confidence:**
```sql
SELECT
  AVG(confidence) AS avg_confidence,
  COUNT(*) FILTER (WHERE confidence < 0.8) AS low_confidence_count
FROM transcripts
WHERE created_at > NOW() - INTERVAL '7 days';
```

**Target:** Avg confidence > 0.90

**2. "I didn't catch that" rate:**
```sql
SELECT
  COUNT(*) FILTER (WHERE transcript LIKE '%didn''t catch%') AS failed_understanding,
  COUNT(*) AS total_calls,
  ROUND((COUNT(*) FILTER (WHERE transcript LIKE '%didn''t catch%')::DECIMAL / COUNT(*)) * 100, 2) AS failure_rate
FROM transcripts
WHERE created_at > NOW() - INTERVAL '7 days';
```

**Target:** Failure rate < 5%

**3. Transfer rate (may indicate transcription issues):**
```sql
SELECT
  COUNT(*) FILTER (WHERE transferred_to IS NOT NULL) AS transfers,
  COUNT(*) AS total_calls,
  ROUND((COUNT(*) FILTER (WHERE transferred_to IS NOT NULL)::DECIMAL / COUNT(*)) * 100, 2) AS transfer_rate
FROM voice_agent_calls
WHERE created_at > NOW() - INTERVAL '7 days';
```

**Target:** Transfer rate < 10% (if high, may be transcription confusion)

## Best Practices

### ✅ Do's

- Use Nova-2 Phonecall model for all phone calls
- Enable smart formatting and punctuation (default)
- Add keywords for company/product names
- Test transcription with various accents
- Monitor confidence scores
- Set VAD threshold based on environment (indoor vs outdoor callers)

### ❌ Don'ts

- Don't use older models (Nova-1, Base)
- Don't disable smart formatting (makes LLM job harder)
- Don't add too many keywords (max 10-20)
- Don't use multi-language detection unless needed (adds latency)
- Don't filter profanity unless required (want accurate transcripts)

## Troubleshooting Checklist

**If transcription quality is poor:**

- [ ] Check Deepgram API status: https://status.deepgram.com
- [ ] Verify model is Nova-2 (not older model)
- [ ] Test with Deepgram API directly (rule out Vapi issue)
- [ ] Check `/api/health` for Deepgram connectivity
- [ ] Review recent transcripts for patterns (specific words always wrong?)
- [ ] Add keywords for problematic words
- [ ] Adjust VAD threshold if noise is an issue
- [ ] Consider switching to Nova-2 Phonecall model

## Next Steps

- [Persona Builder Guide](./PERSONA-GUIDE.md) - Configure personas with Deepgram
- [ElevenLabs Guide](./ELEVENLABS-GUIDE.md) - Voice configuration
- [Troubleshooting](./TROUBLESHOOTING.md) - Fix transcription issues

## Resources

- **Deepgram Dashboard**: https://console.deepgram.com
- **API Docs**: https://developers.deepgram.com
- **Model Comparison**: https://deepgram.com/product/nova
- **Status Page**: https://status.deepgram.com
