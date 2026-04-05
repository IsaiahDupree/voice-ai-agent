# Vapi API Capabilities Analysis

> Generated from: `https://api.vapi.ai/api-json` (OpenAPI 3.0.0)
> Spec stats: 36 paths, 887 schemas
> Secondary source: `https://docs.vapi.ai/llms.txt` (293 lines)

---

## 1. All API Endpoints (Grouped by Resource)

### Assistants
| Method | Path | Summary |
|--------|------|---------|
| POST | `/assistant` | Create Assistant |
| GET | `/assistant` | List Assistants |
| GET | `/assistant/{id}` | Get Assistant |
| PATCH | `/assistant/{id}` | Update Assistant |
| DELETE | `/assistant/{id}` | Delete Assistant |

### Calls
| Method | Path | Summary |
|--------|------|---------|
| POST | `/call` | Create Call |
| GET | `/call` | List Calls |
| GET | `/call/{id}` | Get Call |
| PATCH | `/call/{id}` | Update Call (only `name` field patchable) |
| DELETE | `/call/{id}` | Delete Call |

### Phone Numbers
| Method | Path | Summary |
|--------|------|---------|
| POST | `/phone-number` | Create Phone Number |
| GET | `/phone-number` | List Phone Numbers |
| GET | `/phone-number/{id}` | Get Phone Number |
| PATCH | `/phone-number/{id}` | Update Phone Number |
| DELETE | `/phone-number/{id}` | Delete Phone Number |
| GET | `/v2/phone-number` | List Phone Numbers (v2) |

### Tools
| Method | Path | Summary |
|--------|------|---------|
| POST | `/tool` | Create Tool |
| GET | `/tool` | List Tools |
| GET | `/tool/{id}` | Get Tool |
| PATCH | `/tool/{id}` | Update Tool |
| DELETE | `/tool/{id}` | Delete Tool |

### Squads (Multi-Assistant)
| Method | Path | Summary |
|--------|------|---------|
| POST | `/squad` | Create Squad |
| GET | `/squad` | List Squads |
| GET | `/squad/{id}` | Get Squad |
| PATCH | `/squad/{id}` | Update Squad |
| DELETE | `/squad/{id}` | Delete Squad |

### Campaigns (Outbound Batch Calling)
| Method | Path | Summary |
|--------|------|---------|
| POST | `/campaign` | Create Campaign |
| GET | `/campaign` | List Campaigns |
| GET | `/campaign/{id}` | Get Campaign |
| PATCH | `/campaign/{id}` | Update Campaign |
| DELETE | `/campaign/{id}` | Delete Campaign |

### Chat (Text-Mode)
| Method | Path | Summary |
|--------|------|---------|
| POST | `/chat` | Create Chat |
| GET | `/chat` | List Chats |
| GET | `/chat/{id}` | Get Chat |
| DELETE | `/chat/{id}` | Delete Chat |
| POST | `/chat/responses` | Create Chat (OpenAI Compatible) |

### Sessions
| Method | Path | Summary |
|--------|------|---------|
| POST | `/session` | Create Session |
| GET | `/session` | List Sessions |
| GET | `/session/{id}` | Get Session |
| PATCH | `/session/{id}` | Update Session |
| DELETE | `/session/{id}` | Delete Session |

### Evals (Testing & Evaluation)
| Method | Path | Summary |
|--------|------|---------|
| POST | `/eval` | Create Eval |
| GET | `/eval` | List Evals |
| GET | `/eval/{id}` | Get Eval |
| PATCH | `/eval/{id}` | Update Eval |
| DELETE | `/eval/{id}` | Delete Eval |
| POST | `/eval/run` | Create Eval Run |
| GET | `/eval/run` | List Eval Runs |
| GET | `/eval/run/{id}` | Get Eval Run |
| DELETE | `/eval/run/{id}` | Delete Eval Run |

### Files (Knowledge Base Documents)
| Method | Path | Summary |
|--------|------|---------|
| POST | `/file` | Upload File |
| GET | `/file` | List Files |
| GET | `/file/{id}` | Get File |
| PATCH | `/file/{id}` | Update File |
| DELETE | `/file/{id}` | Delete File |

### Analytics
| Method | Path | Summary |
|--------|------|---------|
| POST | `/analytics` | Create Analytics Queries |

### Reporting / Insights
| Method | Path | Summary |
|--------|------|---------|
| POST | `/reporting/insight` | Create Insight |
| GET | `/reporting/insight` | Get Insights |
| POST | `/reporting/insight/preview` | Preview Insight |
| PATCH | `/reporting/insight/{id}` | Update Insight |
| GET | `/reporting/insight/{id}` | Get Insight |
| DELETE | `/reporting/insight/{id}` | Delete Insight |
| POST | `/reporting/insight/{id}/run` | Run Insight |

### Observability / Scorecards
| Method | Path | Summary |
|--------|------|---------|
| POST | `/observability/scorecard` | Create Scorecard |
| GET | `/observability/scorecard` | List Scorecards |
| GET | `/observability/scorecard/{id}` | Get Scorecard |
| PATCH | `/observability/scorecard/{id}` | Update Scorecard |
| DELETE | `/observability/scorecard/{id}` | Delete Scorecard |

### Structured Outputs
| Method | Path | Summary |
|--------|------|---------|
| POST | `/structured-output` | Create Structured Output |
| GET | `/structured-output` | List Structured Outputs |
| GET | `/structured-output/{id}` | Get Structured Output |
| PATCH | `/structured-output/{id}` | Update Structured Output |
| DELETE | `/structured-output/{id}` | Delete Structured Output |
| POST | `/structured-output/run` | Run Structured Output |

### Provider Resources (Generic)
| Method | Path | Summary |
|--------|------|---------|
| POST | `/provider/{provider}/{resourceName}` | Create Provider Resource |
| GET | `/provider/{provider}/{resourceName}` | List Provider Resources |
| GET | `/provider/{provider}/{resourceName}/{id}` | Get Provider Resource |
| PATCH | `/provider/{provider}/{resourceName}/{id}` | Update Provider Resource |
| DELETE | `/provider/{provider}/{resourceName}/{id}` | Delete Provider Resource |

> Note: Workflows do NOT have their own REST endpoints. They are managed inline via Call/Campaign objects using `workflowId` or transient `workflow` fields.

---

## 2. Assistant Object — All Fields (CreateAssistantDTO / UpdateAssistantDTO)

All fields are optional at creation (no required fields). Type unions shown with `|`.

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Display name; required for squad transfers |
| `firstMessage` | string | Opening message spoken by the assistant; can be URL to audio |
| `firstMessageMode` | string | `assistant-speaks-first` (default), `assistant-waits-for-user`, `assistant-speaks-first-with-model-generated-message` |
| `firstMessageInterruptionsEnabled` | boolean | Whether user can interrupt the first message |
| `model` | AnthropicModel \| AnthropicBedrockModel \| AnyscaleModel \| CerebrasModel \| CustomLLMModel \| DeepInfraModel \| DeepSeekModel \| GoogleModel \| GroqModel \| InflectionAIModel \| MinimaxLLMModel \| OpenAIModel \| OpenRouterModel \| PerplexityAIModel \| TogetherAIModel \| XaiModel | LLM configuration |
| `voice` | AzureVoice \| CartesiaVoice \| CustomVoice \| DeepgramVoice \| ElevenLabsVoice \| HumeVoice \| InworldVoice \| LMNTVoice \| MinimaxVoice \| NeuphonicVoice \| OpenAIVoice \| PlayHTVoice \| RimeAIVoice \| SesameVoice \| SmallestAIVoice \| TavusVoice \| VapiVoice \| WellSaidVoice | TTS configuration |
| `transcriber` | AssemblyAITranscriber \| AzureSpeechTranscriber \| CartesiaTranscriber \| CustomTranscriber \| DeepgramTranscriber \| ElevenLabsTranscriber \| GladiaTranscriber \| GoogleTranscriber \| OpenAITranscriber \| SonioxTranscriber \| SpeechmaticsTranscriber \| TalkscriberTranscriber | STT configuration |
| `analysisPlan` | AnalysisPlan | Post-call analysis: summary, structured data extraction, success evaluation, outcomes |
| `artifactPlan` | ArtifactPlan | Recording, transcript, video recording, PCAP, structured outputs, scorecards |
| `backgroundSound` | `"off"` \| `"office"` | Background ambient sound |
| `backgroundSpeechDenoisingPlan` | BackgroundSpeechDenoisingPlan | Noise/background speech filtering during user speech |
| `clientMessages` | array | Which events to forward to Client SDKs |
| `compliancePlan` | CompliancePlan | HIPAA, PCI, recording consent modes |
| `credentialIds` | array | Specific credential IDs to use (defaults to all) |
| `credentials` | array | Dynamic credentials for the call |
| `endCallMessage` | string | Message spoken before hanging up |
| `endCallPhrases` | array | Phrases that trigger call hang-up |
| `hooks` | array | Event-triggered automation actions (CallEnding, SpeechInterrupted, ModelResponseTimeout, etc.) |
| `keypadInputPlan` | KeypadInputPlan | DTMF keypad input config: enabled, delimiters, timeout |
| `maxDurationSeconds` | number | Hard call time limit |
| `metadata` | object | Arbitrary metadata stored on the assistant |
| `modelOutputInMessagesEnabled` | boolean | Use model output in history instead of transcript |
| `monitorPlan` | MonitorPlan | Real-time listen/control access; auth toggle; monitoring IDs |
| `observabilityPlan` | LangfuseObservabilityPlan | Langfuse tracing integration |
| `server` | Server | Webhook server config: url, headers, timeout, static IPs, encrypted paths |
| `serverMessages` | array | Which server webhook events to send |
| `startSpeakingPlan` | StartSpeakingPlan | Endpointing: waitSeconds, smart endpointing, transcription-based endpointing, custom rules |
| `stopSpeakingPlan` | StopSpeakingPlan | Interruption: numWords, voiceSeconds, backoffSeconds, interruption/acknowledgement phrases |
| `transportConfigurations` | array | Twilio transport overrides |
| `voicemailDetection` | `"disabled"` \| GoogleVoicemailDetectionPlan \| OpenAIVoicemailDetectionPlan \| TwilioVoicemailDetectionPlan \| VapiVoicemailDetectionPlan | Voicemail detection method |
| `voicemailMessage` | string | Message to leave if call goes to voicemail |

### Nested: AnalysisPlan
| Field | Type |
|-------|------|
| `summaryPlan` | SummaryPlan (prompt, enabled, timeoutSeconds) |
| `structuredDataPlan` | StructuredDataPlan (schema, prompt, enabled) |
| `structuredDataMultiPlan` | array of keyed plans |
| `successEvaluationPlan` | SuccessEvaluationPlan (rubric, prompt, enabled) |
| `outcomeIds` | array of outcome UUIDs |
| `minMessagesThreshold` | number |

### Nested: ArtifactPlan
| Field | Type |
|-------|------|
| `recordingEnabled` | boolean |
| `recordingFormat` | string |
| `recordingPath` | string |
| `recordingUseCustomStorageEnabled` | boolean |
| `videoRecordingEnabled` | boolean |
| `transcriptPlan` | TranscriptPlan |
| `pcapEnabled` | boolean |
| `pcapS3PathPrefix` | string |
| `pcapUseCustomStorageEnabled` | boolean |
| `loggingEnabled` | boolean |
| `loggingPath` | string |
| `loggingUseCustomStorageEnabled` | boolean |
| `fullMessageHistoryEnabled` | boolean |
| `scorecardIds` | array |
| `scorecards` | array (transient) |
| `structuredOutputIds` | array |
| `structuredOutputs` | array (transient) |

### Nested: MonitorPlan
| Field | Description |
|-------|-------------|
| `listenEnabled` | Enable real-time audio monitoring by supervisors |
| `listenAuthenticationEnabled` | Require auth for listen URL |
| `controlEnabled` | Enable real-time call control (inject messages) |
| `controlAuthenticationEnabled` | Require auth for control URL |
| `monitorIds` | array |

### Nested: CompliancePlan
| Field | Description |
|-------|-------------|
| `hipaaEnabled` | HIPAA mode — disables logs/recordings |
| `pciEnabled` | PCI mode — redacts card data |
| `recordingConsentPlan` | StayOnLine or Verbal consent modes |
| `securityFilterPlan` | Additional security filters |

### Nested: Server
| Field | Description |
|-------|-------------|
| `url` | Webhook endpoint URL |
| `headers` | Custom HTTP headers |
| `timeoutSeconds` | Webhook timeout |
| `credentialId` | Credential for authenticated webhooks |
| `staticIpAddressesEnabled` | Use static IPs for webhook calls |
| `encryptedPaths` | Paths to encrypt in webhook payloads |
| `backoffPlan` | Retry policy |

---

## 3. Call Object — All Fields

### Response Fields (Read)
| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique call ID |
| `orgId` | string | Org the call belongs to |
| `type` | string | `inboundPhoneCall`, `outboundPhoneCall`, `webCall` |
| `status` | string | `queued`, `ringing`, `in-progress`, `forwarding`, `ended` |
| `createdAt` | string | ISO 8601 creation timestamp |
| `updatedAt` | string | ISO 8601 last update timestamp |
| `startedAt` | string | ISO 8601 call start timestamp |
| `endedAt` | string | ISO 8601 call end timestamp |
| `endedReason` | string | Explanation of how call ended |
| `endedMessage` | string | Additional context on ended reason |
| `cost` | number | Total cost in USD |
| `costBreakdown` | object | Itemized cost breakdown |
| `costs` | array | Individual component costs |
| `messages` | array | Conversation messages |
| `analysis` | object | Post-call analysis (summary, structuredData, successEvaluation) |
| `artifact` | object | Generated artifacts (recordingUrl, stereoRecordingUrl, videoRecordingUrl, transcript, etc.) |
| `artifactPlan` | object | Copy of the assistant's artifactPlan |
| `monitor` | object | Real-time monitoring URLs (listenUrl, controlUrl) |
| `compliance` | object | Compliance data |
| `transport` | object | Transport details |
| `phoneCallProvider` | string | `twilio`, `vonage`, `vapi` |
| `phoneCallProviderId` | string | Provider's call ID (e.g. Twilio callSid) |
| `phoneCallTransport` | string | `sip` or `pstn` |
| `destination` | TransferDestinationNumber \| TransferDestinationSip | Where call was transferred to |

### Request Fields (Create)
| Field | Type | Description |
|-------|------|-------------|
| `assistantId` | string | Use existing assistant |
| `assistant` | object | Inline transient assistant config |
| `assistantOverrides` | object | Override specific fields of assistantId |
| `squadId` | string | Use existing squad |
| `squad` | object | Inline transient squad |
| `squadOverrides` | object | Override squad member settings |
| `workflowId` | string | Use existing workflow |
| `workflow` | object | Inline transient workflow |
| `workflowOverrides` | object | Override workflow settings |
| `phoneNumberId` | string | Use existing phone number |
| `phoneNumber` | object | Inline transient phone number |
| `customerId` | string | Use existing customer |
| `customer` | object | Inline transient customer (phone, name, etc.) |
| `customers` | array | Batch call to multiple customers |
| `name` | string | Call display name (reference only) |
| `schedulePlan` | SchedulePlan | Schedule: earliestAt, latestAt |
| `transport` | object | Transport overrides |
| `campaignId` | string | Campaign this call belongs to |

### Update Fields (PATCH)
| Field | Type | Notes |
|-------|------|-------|
| `name` | string | **Only field patchable after call creation** |

---

## 4. PhoneNumber Object — All Fields

Common fields across all provider types (Twilio, Vapi, Telnyx, Vonage, BYO):

| Field | Twilio | Vapi | Telnyx | Vonage | BYO | Description |
|-------|--------|------|--------|--------|-----|-------------|
| `id` | ✓ | ✓ | ✓ | ✓ | ✓ | Unique ID |
| `orgId` | ✓ | ✓ | ✓ | ✓ | ✓ | Org owner |
| `provider` | `twilio` | `vapi` | `telnyx` | `vonage` | `byo-phone-number` | Provider type |
| `number` | ✓ | ✓ | ✓ | ✓ | ✓ | E.164 number digits |
| `name` | ✓ | ✓ | ✓ | ✓ | ✓ | Display name |
| `status` | ✓ | ✓ | ✓ | ✓ | ✓ | Active/inactive |
| `createdAt` | ✓ | ✓ | ✓ | ✓ | ✓ | ISO 8601 |
| `updatedAt` | ✓ | ✓ | ✓ | ✓ | ✓ | ISO 8601 |
| `assistantId` | ✓ | ✓ | ✓ | ✓ | ✓ | Default assistant for inbound |
| `squadId` | ✓ | ✓ | ✓ | ✓ | ✓ | Default squad for inbound |
| `workflowId` | ✓ | ✓ | ✓ | ✓ | ✓ | Default workflow for inbound |
| `fallbackDestination` | ✓ | ✓ | ✓ | ✓ | ✓ | Fallback transfer if no assistant set |
| `server` | ✓ | ✓ | ✓ | ✓ | ✓ | Per-number webhook override |
| `hooks` | ✓ | ✓ | ✓ | ✓ | ✓ | Call ringing / ending automation hooks |
| `sipUri` | — | ✓ | — | — | — | SIP URI for Vapi numbers |
| `authentication` | — | ✓ | — | — | — | SIP INVITE auth config |
| `numberDesiredAreaCode` | — | ✓ | — | — | — | Area code requested on purchase |
| `smsEnabled` | ✓ | — | — | — | — | Whether to set SMS webhook on Twilio |
| `twilioAccountSid` | ✓ | — | — | — | — | Twilio account SID |
| `twilioAuthToken` | ✓ | — | — | — | — | Twilio auth token |
| `twilioApiKey` | ✓ | — | — | — | — | Twilio API key |
| `twilioApiSecret` | ✓ | — | — | — | — | Twilio API secret |
| `credentialId` | — | — | ✓ | ✓ | ✓ | Credential ID for provider auth |
| `numberE164CheckEnabled` | — | — | — | — | ✓ | Toggle E164 validation (advanced) |

---

## 5. Tool Types Available via API

All tools support full CRUD via `/tool`:

| Tool Type | Use Case |
|-----------|----------|
| `ApiRequestTool` | HTTP API call during conversation |
| `BashTool` | Execute bash commands (agent/code tool) |
| `CodeTool` | Execute TypeScript code inline |
| `ComputerTool` | Computer use (Anthropic-style) |
| `DtmfTool` | Send DTMF keypad tones |
| `EndCallTool` | Hang up the call |
| `FunctionTool` | Generic function call (webhook-based) |
| `GhlTool` | GoHighLevel integration |
| `GoHighLevelCalendarAvailabilityTool` | GHL calendar availability |
| `GoHighLevelCalendarEventCreateTool` | GHL event creation |
| `GoHighLevelContactCreateTool` | GHL contact creation |
| `GoHighLevelContactGetTool` | GHL contact lookup |
| `GoogleCalendarCheckAvailabilityTool` | Google Calendar availability |
| `GoogleCalendarCreateEventTool` | Google Calendar event creation |
| `GoogleSheetsRowAppendTool` | Google Sheets row append |
| `HandoffTool` | Hand off to another assistant/squad/destination |
| `MakeTool` | Make.com (Integromat) webhook |
| `McpTool` | MCP server tool |
| `OutputTool` | Emit structured output |
| `QueryTool` | Knowledge base query |
| `SipRequestTool` | SIP request |
| `SlackSendMessageTool` | Slack message |
| `SmsTool` | Send SMS |
| `TextEditorTool` | Text editor (agent-style) |
| `TransferCallTool` | Transfer call to number/SIP/assistant |
| `VoicemailTool` | Voicemail detection/handling |

---

## 6. Dashboard UI Fields vs API-Only Fields

### Fields VISIBLE in Vapi Dashboard

Based on known dashboard tabs (Model, Voice, Transcriber, Tools, Analysis, Compliance, Advanced):

**Model tab:**
- `model.provider` — LLM provider selection
- `model.model` — Specific model name
- `model.messages` — System prompt / messages (displayed as "Prompt")
- `model.temperature`
- `model.maxTokens`
- `model.tools` / `model.toolIds` — Tool attachment

**Voice tab:**
- `voice.provider` — TTS provider selection
- `voice.voiceId` — Voice selection
- `voice.speed`
- `voice.stability` (ElevenLabs)
- `voice.similarityBoost` (ElevenLabs)

**Transcriber tab:**
- `transcriber.provider` — STT provider selection
- `transcriber.language` — Language code
- `transcriber.model` — Transcriber model

**First Message:**
- `firstMessage`
- `firstMessageMode`

**Analysis tab:**
- `analysisPlan.summaryPlan`
- `analysisPlan.structuredDataPlan`
- `analysisPlan.successEvaluationPlan`

**Compliance tab:**
- `artifactPlan.recordingEnabled`
- `artifactPlan.videoRecordingEnabled`
- `compliancePlan.hipaaEnabled`
- `compliancePlan.pciEnabled`

**Advanced tab:**
- `endCallMessage`
- `endCallPhrases`
- `voicemailMessage`
- `maxDurationSeconds`
- `backgroundSound`
- `server.url` — Webhook URL
- `startSpeakingPlan` (partial)
- `stopSpeakingPlan` (partial)

---

### Fields ONLY Accessible via API (Not in Dashboard)

These fields exist in the OpenAPI spec but are not exposed through the dashboard UI:

**Assistant-level:**
| Field | What it does |
|-------|-------------|
| `hooks` | Event-triggered automation: on call ending, speech interruption, model timeout, endpointing low-confidence — trigger Say/Transfer/ToolCall/FunctionCall actions |
| `monitorPlan` | Enable/disable listen and control URLs for real-time supervisor monitoring; toggle auth requirements |
| `observabilityPlan` | Langfuse tracing integration (session, project, API key) |
| `backgroundSpeechDenoisingPlan` | Fourier or smart denoising config |
| `keypadInputPlan` | Full DTMF input configuration (delimiters, timeout) |
| `credentialIds` | Pin specific credentials to an assistant |
| `credentials` | Dynamic credential injection per call |
| `transportConfigurations` | Twilio-level transport overrides |
| `modelOutputInMessagesEnabled` | Use model output vs transcript in conversation history |
| `firstMessageInterruptionsEnabled` | Allow user to interrupt opening message |
| `metadata` | Arbitrary JSON attached to the assistant |
| `clientMessages` | Fine-grained control of what events SDK clients receive |
| `serverMessages` | Fine-grained control of which webhook events are sent |

**ArtifactPlan (extended):**
| Field | What it does |
|-------|-------------|
| `recordingPath` | Custom S3 path for recordings |
| `recordingUseCustomStorageEnabled` | Use your own S3 bucket |
| `recordingFormat` | Audio format selection |
| `pcapEnabled` | Capture network packet captures |
| `pcapS3PathPrefix` / `pcapUseCustomStorageEnabled` | PCAP storage config |
| `loggingEnabled` / `loggingPath` / `loggingUseCustomStorageEnabled` | Full conversation logging to custom storage |
| `fullMessageHistoryEnabled` | Include complete message history in artifact |
| `transcriptPlan` | Transcript format configuration |
| `scorecardIds` | Attach scorecards to auto-run post-call |
| `structuredOutputIds` | Attach structured output schemas to auto-extract post-call |

**StartSpeakingPlan (extended):**
| Field | What it does |
|-------|-------------|
| `smartEndpointingEnabled` | Enable smart VAD endpointing |
| `smartEndpointingPlan` | Vapi / Livekit / Custom endpointing model config |
| `transcriptionEndpointingPlan` | Silence threshold + speech threshold timing |
| `customEndpointingRules` | Regex/keyword rules to override endpointing |

**StopSpeakingPlan (extended):**
| Field | What it does |
|-------|-------------|
| `acknowledgementPhrases` | Phrases that indicate user is acknowledging, not interrupting |
| `interruptionPhrases` | Phrases that definitively signal an interruption |
| `backoffSeconds` | Cooldown before resuming speech |

**Model-level (OpenAI example, applies broadly):**
| Field | What it does |
|-------|-------------|
| `fallbackModels` | Automatic fallback to alternative models on failure |
| `numFastTurns` | Use a cheaper model for first N turns |
| `emotionRecognitionEnabled` | Detect and relay user emotion to LLM |
| `promptCacheKey` / `promptCacheRetention` | Extended prompt caching (GPT-4.1+, GPT-5 series) |
| `toolStrictCompatibilityMode` | Azure OpenAI schema compatibility stripping |
| `knowledgeBase` | Attach knowledge base directly to model |

**Voice-level (ElevenLabs example):**
| Field | What it does |
|-------|-------------|
| `cachingEnabled` | Toggle TTS audio caching |
| `autoMode` | ElevenLabs auto mode |
| `enableSsmlParsing` | ElevenLabs SSML support |
| `pronunciationDictionaryLocators` | Custom pronunciation dictionaries |
| `fallbackPlan` | Fallback to another voice provider on failure |
| `chunkPlan` | Control how LLM output is chunked before TTS |
| `optimizeStreamingLatency` | Latency optimization level (0-4) |

**Transcriber-level (Deepgram example):**
| Field | What it does |
|-------|-------------|
| `confidenceThreshold` | Discard low-confidence transcripts |
| `endpointing` | Silence timeout before transcript is sent |
| `eagerEotThreshold` / `eotThreshold` / `eotTimeoutMs` | Fine-grained end-of-turn detection (Flux models) |
| `keyterm` | Keyterm prompting for improved keyword recall |
| `keywords` | Domain-specific vocabulary hints |
| `numerals` | Convert spoken numbers to digits |
| `profanityFilter` | Replace profanity with asterisks |
| `smartFormat` | Smart formatting (dates, currency, etc.) |
| `mipOptOut` | Opt out of model improvement program |
| `fallbackPlan` | Fallback to another transcriber on failure |

**Phone Number:**
| Field | What it does |
|-------|-------------|
| `hooks` | Per-number automation on call ringing / ending |
| `fallbackDestination` | Transfer target when no assistant is assigned |
| `server` | Per-number webhook URL override |
| `workflowId` | Assign a workflow instead of assistant to handle inbound |
| `smsEnabled` | Toggle SMS webhook registration (Twilio) |
| `authentication` | SIP INVITE auth (Vapi numbers) |

**Call:**
| Field | What it does |
|-------|-------------|
| `assistantOverrides` | Override any assistant field per-call without modifying the stored assistant |
| `workflowId` / `workflow` | Use workflow instead of assistant for call routing |
| `squad` / `squadId` | Multi-assistant squad routing |
| `schedulePlan` | Schedule call with earliest/latest window |
| `customers` (array) | Batch initiation of multiple outbound calls in one request |

---

## 7. Resources NOT Exposed in Dashboard

These API resources have no corresponding dashboard UI section (API-only):

| Resource | Endpoints | Purpose |
|----------|-----------|---------|
| **Campaigns** | `/campaign` CRUD | Batch outbound calling to lists of customers with scheduling |
| **Squads** | `/squad` CRUD | Multi-assistant conversational handoff pipelines |
| **Analytics** | `POST /analytics` | Custom aggregation queries on call data |
| **Reporting/Insights** | `/reporting/insight` CRUD + run | Custom KPI dashboards and insights |
| **Structured Outputs** | `/structured-output` CRUD + run | Define schemas for automatic data extraction from calls |
| **Scorecards** | `/observability/scorecard` CRUD | QA grading rubrics applied post-call |
| **Evals** | `/eval` + `/eval/run` CRUD | Automated regression testing of assistant behavior |
| **Sessions** | `/session` CRUD | Multi-turn persistent conversation sessions |
| **Chat** | `/chat` CRUD | Text-only (non-voice) assistant interactions |
| **Provider Resources** | `/provider/{provider}/{resourceName}` | Direct CRUD on provider-specific resources |
| **Workflows** | (no dedicated endpoint — via call/campaign) | Node-graph conversation flow builder |

---

## 8. Key Limitations and Notes

### Mid-Call Assistant Switching
- **Not supported** via a direct `/call/{id}/assistantId` PATCH. The `UpdateCallDTO` only accepts `name`.
- Mid-call context injection is possible via the `monitorPlan.controlEnabled` mechanism — sending background messages through the control URL.
- To "switch" behavior mid-call, you must use Squads (pre-configured) or TransferCallTool / HandoffTool.

### Workflow API
- Workflows have no dedicated CRUD endpoints in the REST API. They are referenced by `workflowId` in Calls/Campaigns or passed as transient `workflow` objects. Workflow management appears to be dashboard-only or via the Vapi CLI.

### Provider Constraints
- **Voicemail detection** requires Twilio or Vapi phone provider; not available with Vonage/BYO.
- **Video recording** (`videoRecordingEnabled`) is only available for web calls.
- **SMS (`SmsTool`)** is US-only for inbound SMS routing.
- **PCAP capture** requires custom storage configuration.

### Call Scheduling
- Calls can be scheduled via `schedulePlan.earliestAt` / `schedulePlan.latestAt` on create.
- No API endpoint to reschedule or cancel a scheduled (queued) call other than DELETE.

### Batch Calling
- Single `POST /call` supports a `customers` array for batch initiation.
- For large-scale campaigns, `/campaign` provides scheduling, progress tracking, and status counters.

### Authentication
- All API calls require `Bearer {VAPI_API_KEY}` in the `Authorization` header.
- Webhook server can optionally require credentials via `server.credentialId`.

### Provider Keys
- You can use Vapi-managed keys (default) or bring your own via `credentialIds` on the assistant.
- Per-call credential injection is supported via `credentials` (dynamic) on the assistant.

### Rate Limits / Quotas
- Not documented in the OpenAPI spec. Consult dashboard billing settings.

### Missing from API Documentation
- `workflow` CRUD endpoints (only referenced by ID)
- `credential` management endpoints (referenced but not in spec paths)
- `customer` CRUD endpoints (only used inline in calls/campaigns)
- Live call injection/override API (only available via WebSocket control URL, not REST)

---

## 9. LLM Providers Supported

| Provider | Schema Name |
|----------|------------|
| OpenAI | `OpenAIModel` — GPT-5.4, GPT-5.4-mini, GPT-5.4-nano, GPT-5.2, etc. |
| Anthropic | `AnthropicModel` — Claude models |
| Anthropic (Bedrock) | `AnthropicBedrockModel` |
| Google | `GoogleModel` — Gemini models |
| Groq | `GroqModel` — Llama, Mixtral (fast inference) |
| DeepSeek | `DeepSeekModel` |
| Cerebras | `CerebrasModel` |
| DeepInfra | `DeepInfraModel` |
| Anyscale | `AnyscaleModel` |
| InflectionAI | `InflectionAIModel` |
| Minimax | `MinimaxLLMModel` |
| OpenRouter | `OpenRouterModel` — Any model via OpenRouter |
| PerplexityAI | `PerplexityAIModel` |
| TogetherAI | `TogetherAIModel` |
| xAI | `XaiModel` — Grok |
| Custom LLM | `CustomLLMModel` — Your own OpenAI-compatible server |

---

## 10. Voice Providers Supported

| Provider | Schema | Notes |
|----------|--------|-------|
| ElevenLabs | `ElevenLabsVoice` | Most features; SSML, caching, pronunciation dicts |
| OpenAI | `OpenAIVoice` | TTS-1, TTS-1-HD |
| Azure | `AzureVoice` | Azure Cognitive Services TTS |
| Cartesia | `CartesiaVoice` | Low-latency |
| Deepgram | `DeepgramVoice` | Aura voices |
| PlayHT | `PlayHTVoice` | Custom voice cloning |
| Rime AI | `RimeAIVoice` | |
| LMNT | `LMNTVoice` | |
| WellSaid | `WellSaidVoice` | |
| Hume | `HumeVoice` | Emotion-aware TTS |
| Neuphonic | `NeuphonicVoice` | |
| Smallest AI | `SmallestAIVoice` | |
| Tavus | `TavusVoice` | Video avatar TTS |
| Sesame | `SesameVoice` | |
| Inworld | `InworldVoice` | |
| Minimax | `MinimaxVoice` | |
| Vapi | `VapiVoice` | Vapi's built-in voice |
| Custom | `CustomVoice` | Your own TTS server |

All voice providers support a `fallbackPlan` to chain to another provider on failure.

---

## 11. Transcriber (STT) Providers Supported

| Provider | Notes |
|----------|-------|
| Deepgram | Most configurable; Flux models support EOT confidence |
| AssemblyAI | |
| Azure Speech | |
| Cartesia | |
| ElevenLabs | |
| Gladia | |
| Google | |
| OpenAI | Whisper |
| Soniox | |
| Speechmatics | |
| Talkscriber | |
| Custom | Your own transcription server |

All transcribers support a `fallbackPlan` to chain to another provider on failure.

---

*Sources: `https://api.vapi.ai/api-json` (OpenAPI 3.0.0, 887 schemas), `https://docs.vapi.ai/llms.txt`*
