# Vapi Coverage Summary
**Assistant ID:** `e7a5dd0c-6426-4001-a02b-f01c9811bedf`
**Phone:** `+1 (321) 986-6241` (ID: `2b8ea3fe-ef7b-4653-b6af-5af20f3054c2`)
**Org:** `71fb0289-33ea-478d-b241-c4223b6de4d9`
**Last audited:** 2026-04-04

---

## Dashboard Fields (editable in UI)

| Tab | Field | Current Value |
|-----|-------|---------------|
| Model | `model.provider` | OpenAI |
| Model | `model.model` | gpt-4.1 |
| Model | `model.messages[0].content` | "chill friend" |
| Model | `model.temperature` | 0.5 |
| Model | `model.maxTokens` | 250 |
| Model | `firstMessage` | "Hey whats up" |
| Model | `firstMessageMode` | Assistant speaks first |
| Voice | `voice.provider` | vapi |
| Voice | `voice.voiceId` | Elliot |
| Voice | `voice.speed` | 1.00 |
| Transcriber | `transcriber.provider` | deepgram |
| Transcriber | `transcriber.model` | nova-3 |
| Transcriber | `transcriber.language` | en |
| Transcriber | `transcriber.endpointing` | 150ms |
| Transcriber | `transcriber.confidenceThreshold` | 0.4 |
| Advanced | `endCallMessage` | "Thanks" |
| Advanced | `endCallPhrases` | ["goodbye", "talk to you soon"] |
| Advanced | `voicemailMessage` | "hey whats up" |
| Advanced | `artifactPlan.recordingEnabled` | true |
| Advanced | `artifactPlan.videoRecordingEnabled` | false |

---

## API-Only Fields (applied, not in dashboard)

| Field | Status | Value |
|-------|--------|-------|
| `monitorPlan.listenEnabled` | ✅ Applied | true |
| `monitorPlan.controlEnabled` | ✅ Applied | true |
| `firstMessageInterruptionsEnabled` | ✅ Applied | true |
| `startSpeakingPlan.transcriptionEndpointingPlan` | ✅ Applied | onPunctuation:0.1s, onNoPunctuation:1.5s, onNumber:0.5s |
| `stopSpeakingPlan.backoffSeconds` | ✅ Applied | 1.0 |
| `stopSpeakingPlan.acknowledgementPhrases` | ✅ Applied | 10 phrases |
| `artifactPlan.transcriptPlan` | ✅ Applied | enabled, named |
| `clientMessages` (expanded) | ✅ Applied | +voice-input |
| `serverMessages` (expanded) | ✅ Applied | +transcript, +speech-update |
| `hooks` | ❌ Rejected by API | Schema mismatch |
| `emotionRecognitionEnabled` | ❌ Rejected by API | Field not yet live |
| `backgroundSpeechDenoisingEnabled` | ❌ Rejected | Use `backgroundDenoisingEnabled` |
| `stopSpeakingPlan.numStopWordsRequired` | ❌ Rejected | Field not live |
| `observabilityPlan` | ⚠️ Not tested | Requires Langfuse credentials |

---

## Tools Configured (not yet attached to assistant)

| ID | Type | Endpoint |
|----|------|----------|
| `4bb8b6dd-0aa4-4dea-8207-0d87df07aff1` | `function` / n8n_webhook | `https://isaiahdupree.app.n8n.cloud/webhook-test/54cb1794-17d0-4583-9eae-1c91ddcd4121` |
| `d97803eb-2548-488d-8b08-f8be888df97c` | `mcp` (SSE) | not configured |

---

## Past Calls (have recordings + control URLs)

Calls found with:
- `recordingUrl` — mono WAV recordings in Vapi storage
- `stereoRecordingUrl` — stereo WAV
- `listenUrl` — WSS for real-time listen
- `controlUrl` — HTTPS for mid-call control injection

---

## Key Limitations

| Limitation | Notes |
|-----------|-------|
| Mid-call assistant switch | NOT supported via REST. Use Squads or TransferCallTool pre-configured |
| `PATCH /call/{id}` | Only accepts `name` field |
| Workflow CRUD | No REST endpoints — dashboard or CLI only |
| Video recording | Web calls only |
| SMS routing | US only |
| HIPAA / ZDR | Requires paid add-on |
| Voicemail detection | Twilio/Vapi providers only |

---

## API-Only Resources (no dashboard equivalent)

| Resource | Endpoint | Purpose |
|----------|----------|---------|
| Campaigns | `POST /campaign` | Batch outbound calling |
| Squads | `POST /squad` | Multi-assistant routing |
| Analytics | `POST /analytics` | Custom call data queries |
| Structured Outputs | `POST /structured-output` | Auto schema extraction from calls |
| Scorecards | `POST /observability/scorecard` | QA grading post-call |
| Evals | `POST /eval` | Regression testing |
| Sessions | `POST /session` | Multi-turn persistent sessions |
| Chat | `POST /chat` | Text-only assistant interactions |
