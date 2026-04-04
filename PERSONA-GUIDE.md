# Persona Builder Guide

## What is a Persona?

A **persona** is a complete AI agent configuration that defines:
- Voice characteristics (ElevenLabs voice ID)
- Personality and tone (system prompt)
- Available capabilities (function tools)
- Greeting and conversation flow
- LLM model and parameters

Think of a persona as a "character" that your AI agent embodies during calls.

## Quick Start: Create Your First Persona

### Via Dashboard UI

1. Navigate to **Dashboard → Personas**
2. Click **"New Persona"**
3. Fill in the required fields:
   - **Name**: e.g., "Sales SDR Sarah"
   - **Voice**: Select from ElevenLabs voice library
   - **System Prompt**: Define the agent's role and behavior
   - **First Message**: Opening greeting
   - **Tools**: Select function tools (checkCalendar, bookAppointment, etc.)
4. Click **"Test Voice"** to preview
5. Click **"Create Persona"**

### Via API

```bash
curl -X POST https://your-app.vercel.app/api/personas \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Sales SDR Sarah",
    "voice_id": "21m00Tcm4TlvDq8ikWAM",
    "system_prompt": "You are Sarah, a friendly sales development representative...",
    "first_message": "Hi, this is Sarah from Acme Corp. How are you today?",
    "model": "gpt-4o",
    "temperature": 0.7,
    "tools": ["checkCalendar", "bookAppointment", "lookupContact"],
    "transfer_number": "+15551234567"
  }'
```

## Persona Components

### 1. Voice Selection

**ElevenLabs Voice ID**: Determines how your agent sounds.

**Popular voices:**
- `21m00Tcm4TlvDq8ikWAM` - Rachel (Female, professional, warm)
- `AZnzlk1XvdvUeBnXmlld` - Domi (Female, confident, energetic)
- `EXAVITQu4vr4xnSDxMaL` - Bella (Female, soft, friendly)
- `ErXwobaYiN019PkySvjV` - Antoni (Male, smooth, professional)
- `VR6AewLTigWG4xSOukaG` - Arnold (Male, deep, authoritative)

**How to choose:**
- **Outbound sales**: Professional, warm, energetic (Rachel, Domi)
- **Inbound support**: Soft, friendly, patient (Bella)
- **Executive assistant**: Professional, clear, efficient (Antoni)
- **Survey/research**: Neutral, clear, non-threatening (Rachel)

**Test voices:**
```bash
# Play sample in dashboard before committing
# Or use ElevenLabs playground: https://elevenlabs.io/speech-synthesis
```

### 2. System Prompt

The **system prompt** is the most important part of your persona. It defines:
- Role and identity
- Tone and personality
- Task and goals
- Conversation guidelines
- Edge case handling

**Template structure:**
```
# Role
You are [NAME], a [ROLE] at [COMPANY].

# Task
Your job is to [PRIMARY_GOAL].

# Personality
You are [ADJECTIVES: friendly, professional, patient, etc.].
You speak in a [TONE: conversational, formal, casual] tone.

# Guidelines
- Keep responses under 2 sentences
- Ask one question at a time
- Listen actively and acknowledge responses
- Never interrupt the caller
- Be respectful and patient

# Tools
You have access to these functions:
- checkCalendar: Check appointment availability
- bookAppointment: Book a confirmed appointment
- lookupContact: Find caller information
- transferCall: Transfer to a human representative

# Edge Cases
- If caller asks for information you don't have, say: "Let me transfer you to someone who can help."
- If caller is angry, empathize and offer to escalate
- If caller asks to be removed from list, say: "I'll make sure you're removed" and end call politely

# Compliance
- Always identify yourself and your company at the start
- If calling about a product/service, state the purpose clearly
- Honor all opt-out requests immediately
```

**Example: Sales SDR**
```
You are Sarah, a friendly sales development representative at Acme Corp.

Your job is to qualify leads and book discovery calls with our sales team.

You are professional, warm, and respectful. You speak conversationally, like a helpful colleague.

Guidelines:
- Introduce yourself: "Hi, this is Sarah from Acme Corp"
- Ask if it's a good time to talk (if no, offer to call back)
- Qualify: "Are you currently using any [CATEGORY] tools?"
- Offer value: "We help companies like yours [BENEFIT]"
- Propose meeting: "Would you be open to a quick 15-minute call with our team?"
- If yes, use checkCalendar and bookAppointment tools
- If no, ask: "Is there a better time to follow up?"
- Always thank the caller for their time

Edge cases:
- If caller is not decision maker: "Who would be the best person to speak with about this?"
- If caller is busy: "I understand. When would be a better time to call back?"
- If caller asks about pricing: "Our team can walk through pricing options on a call. I have 2pm or 4pm available this week. Which works better?"

Compliance:
- Identify yourself and company at start of every call
- State purpose: "I'm calling to see if you'd be interested in learning about our [PRODUCT]"
- Honor opt-out requests: "I'll make sure we remove you from our list. Have a great day."
```

**Example: Appointment Scheduler**
```
You are Alex, a scheduling assistant for Dr. Johnson's dental practice.

Your job is to book, reschedule, and confirm appointments.

You are friendly, patient, and efficient. You speak clearly and confirm all details.

Guidelines:
- Greet warmly: "Hi, this is Alex from Dr. Johnson's office"
- State purpose: "I'm calling to [schedule/confirm/remind] your appointment"
- Confirm identity: "Am I speaking with [NAME]?"
- For new appointments: Use checkCalendar to offer 2-3 time slots
- Always confirm: "Just to confirm, that's [DATE] at [TIME]. We'll send you a text reminder."
- Provide office address and parking info
- Ask about insurance changes

Tools:
- checkCalendar: Check doctor's availability
- bookAppointment: Schedule the appointment
- lookupContact: Verify patient details

Edge cases:
- If patient needs to reschedule: "No problem. Let me check what's available."
- If patient has questions about procedure: "I'll have the doctor call you back to discuss that."
- If patient wants to cancel: "I've cancelled your appointment. Would you like to reschedule?"

Compliance:
- Verify identity before discussing health information
- Don't share medical details over phone
- Offer callback number for questions
```

### 3. First Message

The **first message** is the opening line your agent speaks when the call connects.

**Best practices:**
- ✅ Identify yourself and company
- ✅ State the purpose (outbound) or offer help (inbound)
- ✅ Ask permission to continue (outbound)
- ✅ Keep it under 15 words
- ❌ Don't launch into a pitch immediately
- ❌ Don't ask "How are you?" unless culturally appropriate

**Examples:**

**Outbound sales:**
```
"Hi, this is Sarah from Acme Corp. Is this a good time for a quick call?"
```

**Outbound appointment reminder:**
```
"Hi, this is Alex from Dr. Johnson's office calling about your appointment tomorrow."
```

**Inbound support:**
```
"Hi, thanks for calling Acme Corp. How can I help you today?"
```

**Inbound sales inquiry:**
```
"Hi, thanks for reaching out! I'm Sarah. What can I help you learn about today?"
```

### 4. Model Selection

Choose between available LLM models:

| Model | Speed | Intelligence | Cost | Best For |
|-------|-------|-------------|------|----------|
| `gpt-4o` | Fast | Very high | Medium | Complex reasoning, tool use |
| `claude-3-5-sonnet` | Medium | Highest | High | Nuanced conversation, empathy |
| `gpt-3.5-turbo` | Fastest | Good | Low | Simple scripted tasks |

**Recommendation**: Start with `gpt-4o` (default). It has the best balance of speed, intelligence, and tool-calling reliability.

**When to use Claude:**
- Calls requiring high emotional intelligence
- Complex multi-step reasoning
- Handling objections gracefully

### 5. Temperature

Controls randomness in responses (0.0 - 1.0).

- **0.3-0.5**: Consistent, predictable, scripted (good for compliance-heavy use cases)
- **0.7**: Balanced (default, recommended for most use cases)
- **0.8-1.0**: Creative, varied, conversational (good for sales, casual tone)

**Examples:**
```json
{
  "temperature": 0.5,  // Appointment scheduler (consistent)
  "temperature": 0.7,  // Sales SDR (balanced)
  "temperature": 0.9   // Survey researcher (natural conversation)
}
```

### 6. Function Tools

**Available tools:**

| Tool | Purpose | When to Enable |
|------|---------|---------------|
| `checkCalendar` | Check Cal.com availability | Appointment booking |
| `bookAppointment` | Create Cal.com booking | Appointment booking |
| `lookupContact` | Find contact in CRM | Personalization |
| `updateContact` | Update contact fields | Data collection |
| `sendSMS` | Send SMS follow-up | Post-call follow-up |
| `transferCall` | Transfer to human | Complex inquiries |

**Enable only the tools your agent needs.** Extra tools slow down response time and increase hallucination risk.

**Example tool combinations:**

**Sales SDR:**
```json
["checkCalendar", "bookAppointment", "lookupContact"]
```

**Support agent:**
```json
["lookupContact", "updateContact", "transferCall"]
```

**Survey researcher:**
```json
["updateContact"]
```

**Appointment scheduler:**
```json
["checkCalendar", "bookAppointment", "lookupContact", "sendSMS"]
```

### 7. Transfer Number

Phone number to transfer calls to when agent needs human assistance.

**Format:** E.164 format (`+15551234567`)

**When transfers happen:**
- Caller explicitly requests human
- Agent detects confusion or frustration
- Caller asks questions outside agent's scope
- High-value lead detected

**Best practices:**
- Use a monitored line (not voicemail)
- Set up call routing to multiple reps if needed
- Include transfer whisper context (caller name, reason)

## Persona Examples by Use Case

### Use Case 1: Outbound Lead Qualification

```json
{
  "name": "SDR Alex",
  "voice_id": "ErXwobaYiN019PkySvjV",
  "system_prompt": "You are Alex, an SDR at CloudSync. Your job is to qualify leads for our sales team. You are professional, concise, and respectful of the prospect's time. Ask if it's a good time, explain the value prop in one sentence, and offer to book a discovery call. Use checkCalendar and bookAppointment if they're interested. If not interested, politely thank them and end the call.",
  "first_message": "Hi, this is Alex from CloudSync. Is this a good time for a quick call?",
  "model": "gpt-4o",
  "temperature": 0.7,
  "tools": ["checkCalendar", "bookAppointment", "lookupContact"]
}
```

### Use Case 2: Inbound Appointment Booking

```json
{
  "name": "Scheduler Emma",
  "voice_id": "EXAVITQu4vr4xnSDxMaL",
  "system_prompt": "You are Emma, a scheduling assistant. Your job is to book appointments for clients. You are friendly, patient, and detail-oriented. Always confirm the date, time, and contact information before finalizing. Send an SMS confirmation after booking.",
  "first_message": "Hi, thanks for calling! I can help you schedule an appointment. What day works best for you?",
  "model": "gpt-4o",
  "temperature": 0.5,
  "tools": ["checkCalendar", "bookAppointment", "sendSMS"]
}
```

### Use Case 3: Customer Support

```json
{
  "name": "Support Agent Maya",
  "voice_id": "EXAVITQu4vr4xnSDxMaL",
  "system_prompt": "You are Maya, a customer support agent. Your job is to help customers with billing, account issues, and technical problems. You are empathetic, patient, and solution-oriented. If you can't solve the issue, transfer to a specialist. Always lookup the contact first to personalize the conversation.",
  "first_message": "Hi, thanks for calling support. How can I help you today?",
  "model": "gpt-4o",
  "temperature": 0.7,
  "tools": ["lookupContact", "updateContact", "transferCall"]
}
```

## Testing Your Persona

### Test Call Flow

1. **Dashboard → Personas → [Your Persona] → "Test Call"**
2. Enter your phone number
3. Click "Start Test Call"
4. Vapi will call you immediately
5. Have a conversation with your persona
6. After call ends, review:
   - Transcript (was the conversation natural?)
   - Duration (did agent talk too much?)
   - Outcome (did agent achieve the goal?)
   - Tool usage (were tools called correctly?)

### What to Test

**✅ Voice quality:**
- Is the voice clear and natural?
- Does the voice match the persona's role?
- Are there pronunciation issues with your company/product names?

**✅ Greeting:**
- Does the first message sound natural?
- Is it clear who's calling and why?

**✅ Conversation flow:**
- Does the agent listen before responding?
- Are responses concise (under 2 sentences)?
- Does the agent ask one question at a time?

**✅ Tool usage:**
- Does the agent call tools at appropriate times?
- Are tool parameters correct (phone numbers, dates, etc.)?
- Does the agent explain what it's doing? ("Let me check availability")

**✅ Edge cases:**
- Say "I'm not interested" → does agent end call politely?
- Ask a question outside scope → does agent transfer or admit it doesn't know?
- Interrupt the agent → does it stop and listen?

### Iteration Tips

**Agent talks too much?**
- Add to system prompt: "Keep responses under 2 sentences. Be concise."

**Agent sounds robotic?**
- Increase temperature to 0.8-0.9
- Add conversational examples to system prompt: "Say things like 'Got it!' or 'That makes sense!'"

**Agent doesn't use tools?**
- Make tool usage explicit in system prompt: "When the caller agrees to a meeting, ALWAYS use checkCalendar to offer times."

**Agent interrupts caller?**
- Add to system prompt: "Wait for the caller to finish speaking. Never interrupt."

**Agent hallucinates?**
- Lower temperature to 0.5-0.6
- Be more specific in system prompt about what agent can/cannot do

## Persona Management

### Update a Persona

**Via API:**
```bash
curl -X PUT https://your-app.vercel.app/api/personas/:id \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "system_prompt": "Updated prompt...",
    "temperature": 0.8
  }'
```

**Best practice:** Create a new version instead of updating the live persona during active campaigns.

### Duplicate a Persona

Useful for A/B testing different approaches:

1. Dashboard → Personas → [Persona] → "Duplicate"
2. Modify the copy (e.g., change greeting or tone)
3. Run A/B test campaign (50% to each persona)
4. Compare booking rates

### Delete a Persona

⚠️ **Warning:** Deleting a persona will not affect past calls, but it cannot be used in new campaigns.

## Advanced: Persona Variants for A/B Testing

Test different approaches by creating persona variants:

**Variant A: Direct approach**
```
First message: "Hi, this is Sarah from Acme. We help companies reduce cloud costs. Do you have 2 minutes?"
```

**Variant B: Question-based approach**
```
First message: "Hi, this is Sarah from Acme. Quick question: are you currently looking for ways to reduce your cloud spending?"
```

**Variant C: Value-first approach**
```
First message: "Hi, this is Sarah. I'm calling because we're offering a free cloud cost audit this month. Would that be useful?"
```

Run 100 calls to each variant, then compare:
- Answer rate
- Average call duration
- Booking conversion rate

## Multilingual Personas & Auto-Detection

Voice AI Agent V2 supports **8 languages** with automatic language detection and switching. When a caller speaks in a non-English language, the system automatically switches to a matching language variant.

### Supported Languages

| Language | Code | Native Name | Auto-Detection | Recommended Voice |
|----------|------|-------------|----------------|-------------------|
| English | en | English | Default | Bella, Rachel, Adam |
| Spanish | es | Español | ✅ Auto | Ana (F), Carlos (M) |
| French | fr | Français | ✅ Auto | Marie (F), Pierre (M) |
| German | de | Deutsch | ✅ Auto | Anna (F), Klaus (M) |
| Portuguese | pt | Português | ✅ Auto | Maria (F), João (M) |
| Chinese | zh | 中文 | ✅ Auto | Li (F) |
| Hindi | hi | हिन्दी | ✅ Auto | Priya (F) |
| Japanese | ja | 日本語 | ✅ Auto | Yuki (F) |

### How Auto-Detection Works

1. **Caller speaks** → First 2-3 seconds transcribed by Deepgram
2. **Language detected** → GPT-4o-mini analyzes transcript
3. **Confidence check** → If confidence > 80% and language ≠ English
4. **Auto-switch** → System switches to language variant:
   - Voice → Native language voice
   - STT model → Language-specific Deepgram model
   - System prompt → Translated prompt
5. **Seamless continuation** → Call proceeds in detected language

**Example flow:**
```
Caller: "¿Hola? ¿Hablas español?"
[Detection: Spanish, 95% confidence]
→ Switch to Spanish variant
Agent (Spanish): "¡Hola! Sí, hablo español. ¿En qué puedo ayudarte?"
```

### Creating Multilingual Persona Variants

#### Step 1: Create Base English Persona

```bash
curl -X POST /api/personas \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Appointment Setter (English)",
    "voice_id": "EXAVITQu4vr4xnSDxMaL",
    "system_prompt": "You are a friendly appointment setter...",
    "first_message": "Hi, this is Sarah. How can I help you today?",
    "model": "gpt-4o"
  }'

# Response includes base_assistant_id (e.g., "asst_abc123")
```

#### Step 2: Configure Language Variants

Navigate to **Dashboard → Language Variants** and add each language:

**Spanish Variant:**
```json
{
  "base_assistant_id": "asst_abc123",
  "language_code": "es",
  "voice_id": "VYWJe7e3ZqYHzHqIkqxR",
  "system_prompt": "Eres una amigable programadora de citas...",
  "first_message": "Hola, soy Sarah. ¿En qué puedo ayudarte hoy?",
  "stt_language": "es",
  "tts_language": "es"
}
```

**French Variant:**
```json
{
  "base_assistant_id": "asst_abc123",
  "language_code": "fr",
  "voice_id": "MF3mGyEYCl7XYWbV9V6O",
  "system_prompt": "Vous êtes une planificatrice de rendez-vous sympathique...",
  "first_message": "Bonjour, je suis Sarah. Comment puis-je vous aider aujourd'hui?",
  "stt_language": "fr",
  "tts_language": "fr"
}
```

#### Step 3: Test Language Detection

Dashboard → Language Variants → **"Test Language Detection"**

```json
{
  "text": "¿Hola, cómo estás?",
  "currentLanguage": "en"
}

// Response:
{
  "language": "es",
  "confidence": 95,
  "languageName": "Spanish",
  "shouldSwitch": true
}
```

### Multilingual Voice Configuration

#### Spanish (Español)

**Ana (Primary - Professional)**
- Voice ID: `VYWJe7e3ZqYHzHqIkqxR`
- Gender: Female
- Tone: Professional, clear
- Best for: Sales, appointments, customer service

**Carlos (Alternative - Warm)**
- Voice ID: `G3YhwqYXKcKqCZDBwSgN`
- Gender: Male
- Tone: Warm, friendly
- Best for: Support, healthcare, education

#### French (Français)

**Marie (Primary - Professional)**
- Voice ID: `MF3mGyEYCl7XYWbV9V6O`
- Gender: Female
- Accent: Parisian
- Best for: Professional communication

**Pierre (Alternative - Authoritative)**
- Voice ID: `CYw3kZ02Hs0563khs1Fj`
- Gender: Male
- Tone: Business-focused
- Best for: B2B sales, financial services

#### German (Deutsch)

**Anna (Primary - Professional)**
- Voice ID: `TxGEqnHWrfWFTfGW9XjX`
- Gender: Female
- Accent: Standard Hochdeutsch
- Best for: General-purpose German

**Klaus (Alternative - Authoritative)**
- Voice ID: `iP95p4xoKVk53GoZ742B`
- Gender: Male
- Tone: Commanding
- Best for: B2B, financial services

#### Portuguese (Português)

**Maria (Primary - Friendly)**
- Voice ID: `EHGtRhaMNdZHrFXdLwrk`
- Gender: Female
- Accent: Brazilian Portuguese
- Best for: Customer service, sales

**João (Alternative - Professional)**
- Voice ID: `onwK4e9ZLuTAKqWW03F9`
- Gender: Male
- Tone: Professional
- Best for: B2B sales

#### Chinese (中文)

**Li (Primary - Professional)**
- Voice ID: `XrExE9yKIg1WjnnlVkGX`
- Gender: Female
- Accent: Standard Mandarin
- Best for: General Mandarin communication
- **Note:** Stability set to 0.6 for tonal accuracy

#### Hindi (हिन्दी)

**Priya (Primary - Friendly)**
- Voice ID: `zIq6HTgd4z9W9T4G3h8L`
- Gender: Female
- Tone: Friendly, clear
- Best for: India market, customer support

#### Japanese (日本語)

**Yuki (Primary - Professional)**
- Voice ID: `VHlPsm8qLq1T9z4J3h8L`
- Gender: Female
- Accent: Standard Tokyo dialect
- Best for: Japan market, professional services
- **Note:** Stability set to 0.6 for pitch accent accuracy

### System Prompt Translation Best Practices

#### ✅ Do's

**1. Culturally adapt, don't just translate:**

❌ Literal translation:
```
"Hi, I'm calling to discuss your cloud infrastructure needs."
→ "Hola, estoy llamando para discutir sus necesidades de infraestructura en la nube."
```

✅ Cultural adaptation:
```
"Hi, I'm calling to discuss your cloud infrastructure needs."
→ "Buenos días, le llamo para conocer cómo podemos ayudarle con su infraestructura tecnológica."
(More formal in Spanish business context)
```

**2. Adjust formality levels:**

- **Spanish**: Use "usted" (formal) for B2B, "tú" (informal) for consumer
- **German**: Use "Sie" (formal) for professional contexts
- **French**: Use "vous" (formal) for business, "tu" (informal) for casual
- **Japanese**: Use keigo (敬語) for professional politeness

**3. Handle company/product names:**

Add phonetic pronunciation in all variants:

```
English: "I'm calling from Acme Corp about our SaaS platform."
Spanish: "Le llamo de Acme Corp (pronunciado 'Ak-mee') sobre nuestra plataforma SaaS."
French: "J'appelle de Acme Corp (prononcé 'Ak-mee') concernant notre plateforme SaaS."
```

**4. Localize greetings by time of day:**

```javascript
// English
"Good morning" (6am-12pm), "Good afternoon" (12pm-5pm), "Good evening" (5pm-9pm)

// Spanish
"Buenos días" (6am-2pm), "Buenas tardes" (2pm-8pm), "Buenas noches" (8pm-6am)

// French
"Bonjour" (6am-6pm), "Bonsoir" (6pm-6am)
```

#### ❌ Don'ts

- Don't use Google Translate for system prompts (misses cultural nuances)
- Don't assume one accent fits all regions (European vs Latin American Spanish)
- Don't forget to localize numbers, dates, times (MM/DD vs DD/MM)
- Don't use slang unless appropriate for brand voice
- Don't mix languages mid-sentence (except brand names)

### Confidence Threshold Tuning

**Default: 80%** - Balanced false positive vs false negative rate

**Adjust per use case:**

```json
{
  "confidenceThreshold": 90  // Conservative (fewer switches, fewer errors)
}
```

**Use conservative (90%) when:**
- False switches are costly (e.g., emergency services)
- Callers may use mixed language (bilingual markets)
- Brand requires native-only interactions

```json
{
  "confidenceThreshold": 70  // Aggressive (more switches, more coverage)
}
```

**Use aggressive (70%) when:**
- Maximizing multilingual coverage is priority
- Callers clearly prefer their native language
- Quick switch-back is easy if wrong

**Mixed language example:**

```
Caller: "Hi, I need help con mi cuenta."
(English + Spanish: "with my account")

Confidence: ~65% Spanish

Threshold 80%: No switch (stays English)
Threshold 70%: Switch to Spanish
```

### Testing Multilingual Personas

#### Test Script Template

**1. Language detection accuracy:**
```bash
# Test Spanish detection
curl -X POST /api/language/detect \
  -H "Content-Type: application/json" \
  -d '{"text": "¿Hola, cómo estás?", "currentLanguage": "en"}'

# Expected: language=es, confidence>80, shouldSwitch=true
```

**2. Full call flow test:**
```
Test Case: Spanish caller
1. Start call in English
2. Caller speaks: "Hola, ¿hablas español?"
3. Verify: Assistant switches to Spanish variant
4. Verify: Voice changes to Ana/Carlos
5. Verify: Responses are in Spanish
6. Verify: Calendar booking works in Spanish
```

**3. Pronunciation test:**
```
Test words in each language:
- Company name
- Product names
- Key features
- Common questions

Listen for mispronunciations and fix with phonetic spelling
```

#### Common Issues

**Issue: Language not detected**

✅ **Solution:**
- Caller spoke too briefly (< 5 words)
- Lower confidence threshold to 70%
- Test with: `POST /api/language/detect`

**Issue: False detection (wrong language)**

✅ **Solution:**
- Raise confidence threshold to 90%
- Check for background noise contamination
- Verify transcript quality in logs

**Issue: Voice mispronounces words**

✅ **Solution:**
Use phonetic spelling in system prompt:
```
Spanish: "Acme" → "Akme"
French: "Support" → "Soo-port"
German: "Service" → "Zer-vees"
Chinese: Use pinyin for English words
```

### Multi-Language Persona Example

**English Base:**
```json
{
  "name": "Healthcare Appointment Setter",
  "voice_id": "EXAVITQu4vr4xnSDxMaL",
  "system_prompt": "You are a friendly healthcare appointment scheduler. Ask for patient name, date preference, and reason for visit. Be patient and empathetic.",
  "first_message": "Hi, this is Sarah from City Health Clinic. How can I help you today?"
}
```

**Spanish Variant:**
```json
{
  "language_code": "es",
  "voice_id": "VYWJe7e3ZqYHzHqIkqxR",
  "system_prompt": "Eres una amable coordinadora de citas médicas. Pregunta por el nombre del paciente, fecha preferida, y motivo de la visita. Sé paciente y empática. Usa 'usted' (formal).",
  "first_message": "Hola, soy Sarah de la Clínica de Salud City. ¿En qué puedo ayudarle?"
}
```

**French Variant:**
```json
{
  "language_code": "fr",
  "voice_id": "MF3mGyEYCl7XYWbV9V6O",
  "system_prompt": "Vous êtes une coordinatrice de rendez-vous médicaux sympathique. Demandez le nom du patient, la date préférée et la raison de la visite. Soyez patiente et empathique. Utilisez 'vous' (formel).",
  "first_message": "Bonjour, je suis Sarah de la Clinique de Santé City. Comment puis-je vous aider aujourd'hui?"
}
```

### API Reference

**Create language variant:**
```bash
POST /api/assistants/{base_assistant_id}/language-variants
{
  "language_code": "es",
  "vapi_assistant_id": "asst_xyz789",
  "voice_id": "VYWJe7e3ZqYHzHqIkqxR",
  "system_prompt_template": "...",
  "stt_language": "es",
  "tts_language": "es",
  "tenant_id": "default"
}
```

**List language variants:**
```bash
GET /api/assistants/{base_assistant_id}/language-variants?tenant_id=default
```

**Delete language variant:**
```bash
DELETE /api/assistants/{base_assistant_id}/language-variants?language_code=es&tenant_id=default
```

**Test language detection:**
```bash
POST /api/language/detect
{
  "text": "¿Hola, cómo estás?",
  "confidenceThreshold": 80,
  "currentLanguage": "en"
}
```

### Resources

- **ElevenLabs Multilingual Voices**: [ELEVENLABS-GUIDE.md](./ELEVENLABS-GUIDE.md#multilingual-voices)
- **Voice Library**: https://elevenlabs.io/voice-library?language=multilingual
- **Language Variants Dashboard**: `/dashboard/language-variants`
- **Deepgram Language Models**: https://developers.deepgram.com/docs/language

## Compliance Checklist

Before deploying a persona for outbound calls:

- [ ] Agent identifies itself and company in first message
- [ ] Agent states purpose of call clearly
- [ ] Agent honors "not interested" and ends call politely
- [ ] Agent includes opt-out language: "Would you like me to remove you from our list?"
- [ ] System prompt includes TCPA compliance guidelines (see TCPA-COMPLIANCE.md)
- [ ] Transfer number is monitored during calling hours
- [ ] Test calls confirm agent behavior matches guidelines

## Troubleshooting

### "Agent sounds like a robot"
- Increase temperature (0.8-0.9)
- Use a more expressive ElevenLabs voice
- Add filler words to system prompt: "Use natural speech patterns like 'um', 'you know', 'so'"

### "Agent doesn't book appointments"
- Verify `checkCalendar` and `bookAppointment` tools are enabled
- Add explicit tool usage instructions to system prompt
- Test with `/api/health` that Cal.com integration is working

### "Agent talks over the caller"
- This is a Vapi voice activity detection (VAD) issue
- Add to persona config: `"vad": {"threshold": 0.6}` (higher = less interruption)

### "Agent transfers too often"
- Review transfer conditions in system prompt
- Increase confidence threshold for confusion detection
- Add more example Q&A to system prompt to reduce "I don't know" responses

## Next Steps

- [Campaign Setup Guide](./CAMPAIGN-GUIDE.md) - Use your persona in a campaign
- [Cal.com Setup](./CALCOM-SETUP.md) - Configure appointment booking
- [Troubleshooting](./TROUBLESHOOTING.md) - Common issues and solutions
