#!/usr/bin/env bash
# =============================================================================
# vapi-full-coverage.sh
# API coverage for everything the Vapi dashboard UI cannot do
# Run: chmod +x scripts/vapi-full-coverage.sh && ./scripts/vapi-full-coverage.sh
# =============================================================================

set -euo pipefail

VAPI_KEY="${VAPI_API_KEY:?'VAPI_API_KEY env var is required'}"
ASSISTANT_ID="${VAPI_ASSISTANT_ID:-e7a5dd0c-6426-4001-a02b-f01c9811bedf}"
PHONE_ID="${VAPI_PHONE_ID:-2b8ea3fe-ef7b-4653-b6af-5af20f3054c2}"
BASE="https://api.vapi.ai"
H_AUTH="Authorization: Bearer $VAPI_KEY"
H_JSON="Content-Type: application/json"

echo "========================================"
echo " VAPI FULL COVERAGE — API-ONLY FEATURES"
echo "========================================"

# ── 1. READ CURRENT STATE ─────────────────────────────────────────────────────
echo -e "\n[1] Current assistant config"
curl -s "$BASE/assistant/$ASSISTANT_ID" -H "$H_AUTH" | python3 -m json.tool

# ── 2. APPLY API-ONLY SETTINGS (hooks, monitorPlan, observability, etc.) ──────
echo -e "\n[2] Patching assistant with API-only capabilities..."
curl -s -X PATCH "$BASE/assistant/$ASSISTANT_ID" \
  -H "$H_AUTH" -H "$H_JSON" \
  -d '{
    "hooks": [
      {
        "on": "call.ending",
        "do": [{"type": "say", "exact": "Thank you for calling. Have a great day!"}]
      },
      {
        "on": "assistant.speech.interrupted",
        "do": [{"type": "say", "exact": "Sorry, go ahead."}]
      }
    ],
    "monitorPlan": {
      "listenEnabled": true,
      "controlEnabled": true
    },
    "observabilityPlan": {
      "provider": "langfuse"
    },
    "emotionRecognitionEnabled": true,
    "firstMessageInterruptionsEnabled": true,
    "modelOutputInMessagesEnabled": false,
    "clientMessages": [
      "transcript",
      "hang",
      "function-call",
      "speech-update",
      "metadata",
      "transfer-update",
      "conversation-update",
      "workflow.node.started",
      "voice-input"
    ],
    "serverMessages": [
      "end-of-call-report",
      "status-update",
      "hang",
      "function-call",
      "transcript",
      "speech-update"
    ],
    "startSpeakingPlan": {
      "waitSeconds": 0.4,
      "smartEndpointingEnabled": "livekit",
      "transcriptionEndpointingPlan": {
        "onPunctuationSeconds": 0.1,
        "onNoPunctuationSeconds": 1.5,
        "onNumberSeconds": 0.5
      }
    },
    "stopSpeakingPlan": {
      "numStopWordsRequired": 1,
      "backoffSeconds": 1.0,
      "acknowledgementPhrases": [
        "i understand", "i see", "i got it", "i hear you",
        "right", "okay", "ok", "sure", "alright", "got it", "understood"
      ]
    },
    "artifactPlan": {
      "recordingEnabled": true,
      "videoRecordingEnabled": false,
      "transcriptPlan": {
        "enabled": true,
        "assistantName": "Assistant",
        "userName": "User"
      }
    },
    "backgroundSpeechDenoisingEnabled": true
  }' | python3 -m json.tool

# ── 3. UPDATE PHONE NUMBER WITH HOOKS + SERVER URL ───────────────────────────
echo -e "\n[3] Patch phone number with server webhook + hooks..."
curl -s -X PATCH "$BASE/phone-number/$PHONE_ID" \
  -H "$H_AUTH" -H "$H_JSON" \
  -d '{
    "name": "Voice AI Agent — Main Line",
    "hooks": [
      {
        "on": "call.ringing",
        "do": [{"type": "say", "exact": "Connecting you now..."}]
      }
    ],
    "fallbackDestination": {
      "type": "number",
      "number": "+12177996721"
    }
  }' | python3 -m json.tool

# ── 4. LIST ALL CALLS ─────────────────────────────────────────────────────────
echo -e "\n[4] Recent calls on this assistant..."
curl -s "$BASE/call?assistantId=$ASSISTANT_ID&limit=10" -H "$H_AUTH" | python3 -m json.tool

# ── 5. GET ANALYTICS (API-ONLY — no dashboard equivalent) ────────────────────
echo -e "\n[5] Analytics query — call counts last 30 days..."
curl -s -X POST "$BASE/analytics" \
  -H "$H_AUTH" -H "$H_JSON" \
  -d '{
    "queries": [
      {
        "name": "total_calls",
        "table": "call",
        "timeRange": {
          "start": "2025-03-01T00:00:00Z",
          "end": "2026-04-05T00:00:00Z",
          "step": "day",
          "timezone": "America/New_York"
        },
        "groupBy": ["status"],
        "operations": [{"operation": "count", "column": "id"}]
      }
    ]
  }' | python3 -m json.tool

# ── 6. LIST FILES (knowledge base documents) ──────────────────────────────────
echo -e "\n[6] Files / knowledge base..."
curl -s "$BASE/file" -H "$H_AUTH" | python3 -m json.tool

# ── 7. LIST TOOLS ─────────────────────────────────────────────────────────────
echo -e "\n[7] Tools..."
curl -s "$BASE/tool" -H "$H_AUTH" | python3 -m json.tool

# ── 8. LIST SQUADS ────────────────────────────────────────────────────────────
echo -e "\n[8] Squads (multi-assistant routing)..."
curl -s "$BASE/squad" -H "$H_AUTH" | python3 -m json.tool

# ── 9. MAKE AN OUTBOUND CALL WITH ASSISTANT OVERRIDES (API-ONLY) ──────────────
echo -e "\n[9] Example: outbound call with per-call assistant overrides (DRY RUN — commented out)"
echo "  curl -s -X POST $BASE/call \\"
echo '    -H "Authorization: Bearer $VAPI_KEY" -H "Content-Type: application/json" \'
echo '    -d '"'"'{'
echo '      "phoneNumberId": "'"$PHONE_ID"'",
      "customer": {"number": "+1XXXXXXXXXX", "name": "Test User"},
      "assistantId": "'"$ASSISTANT_ID"'",
      "assistantOverrides": {
        "firstMessage": "Hi, this is your AI assistant calling about your appointment.",
        "model": {"messages": [{"role": "system", "content": "You are calling to confirm an appointment. Be brief and professional."}]},
        "maxDurationSeconds": 120
      }
    }'"'"

# ── 10. MONITOR / CONTROL A LIVE CALL (API-ONLY) ─────────────────────────────
echo -e "\n[10] Monitor plan — example control URL usage (API-ONLY)"
echo "  # When monitorPlan.controlEnabled=true, Vapi returns control URLs in call events"
echo "  # To inject a background message mid-call:"
echo "  # POST {call.monitor.controlUrl}"
echo '  # Body: {"type": "add-message", "message": {"role": "system", "content": "User is VIP — offer 20% discount"}}'

# ── 11. STRUCTURED OUTPUTS (API-ONLY) ─────────────────────────────────────────
echo -e "\n[11] Structured outputs..."
curl -s "$BASE/structured-output" -H "$H_AUTH" | python3 -m json.tool 2>/dev/null || echo "  (none configured)"

# ── 12. SCORECARDS / EVALS (API-ONLY) ────────────────────────────────────────
echo -e "\n[12] Evals..."
curl -s "$BASE/eval" -H "$H_AUTH" | python3 -m json.tool 2>/dev/null || echo "  (none configured)"

echo -e "\n========================================"
echo " DONE — API coverage complete"
echo "========================================"
