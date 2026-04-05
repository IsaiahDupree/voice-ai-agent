# Twilio Capabilities — Console vs API

**Phone:** `+1 (844) 881-4708` (toll-free)
**Account:** Dupree Ops LLC
**Last audited:** 2026-04-04

---

## Credentials Needed

| Env Var | Description | Where to get it |
|---------|-------------|-----------------|
| `TWILIO_ACCOUNT_SID` | Master account ID (starts `AC`) | Console → Account Dashboard |
| `TWILIO_AUTH_TOKEN` | Paired with Account SID | Console → Account Dashboard |
| `TWILIO_API_KEY` | API Key SID (starts `SK`) — preferred for prod | Console → API Keys section |
| `TWILIO_API_KEY_SECRET` | Secret for API Key (shown once) | Same page as above |
| `TWILIO_PHONE_NUMBER` | Your number in E.164 | Console → Phone Numbers |
| `TWILIO_PHONE_SID` | PN… SID of the number | Same page |

**Best practice:** Use `TWILIO_API_KEY` + `TWILIO_API_KEY_SECRET` for production code (revocable per-app). Auth Token = full account access; treat it like a root password.

---

## API Base URLs

| Product | Base URL |
|---------|----------|
| Core (calls, messages, numbers) | `https://api.twilio.com/2010-04-01/Accounts/{AccountSid}/` |
| Messaging Services | `https://messaging.twilio.com/v1/` |
| Toll-Free Verification | `https://messaging.twilio.com/v1/Tollfree/Verifications` |
| Verify (OTP/2FA) | `https://verify.twilio.com/v2/` |
| Trust Hub | `https://trusthub.twilio.com/v1/` |
| Studio Flows | `https://studio.twilio.com/v2/Flows` |
| TaskRouter | `https://taskrouter.twilio.com/v1/` |
| Bulk Export | `https://bulkexport.twilio.com/v1/` |

Auth: HTTP Basic — `AccountSid:AuthToken` or `ApiKey:ApiKeySecret`

---

## Console Fields (configurable in dashboard UI)

| Section | Field | Notes |
|---------|-------|-------|
| Phone Numbers | Buy number | Search by area code, capabilities, country |
| Phone Numbers | Release number | Delete / port-out |
| Phone Numbers | FriendlyName | Label for the number |
| Phone Numbers | VoiceUrl / VoiceMethod | Inbound call webhook |
| Phone Numbers | VoiceFallbackUrl | Fallback if VoiceUrl fails |
| Phone Numbers | StatusCallback | Call status events |
| Phone Numbers | SmsUrl / SmsMethod | Inbound SMS webhook |
| Phone Numbers | SmsFallbackUrl | Fallback if SmsUrl fails |
| Phone Numbers | VoiceCallerIdLookup | Look up caller name (costs extra) |
| Messaging Services | Create service | Sender pool management |
| Messaging Services | FriendlyName | Label |
| Messaging Services | InboundRequestUrl / Method | Inbound message webhook |
| Messaging Services | FallbackUrl | Fallback webhook |
| Messaging Services | StatusCallback | Delivery status webhook |
| Messaging Services | StickySender | Always use same sender per recipient |
| Messaging Services | AreaCodeGeomatch | Pick sender by area code proximity |
| TwiML Apps | Create app | Centralize webhook URLs |
| TwiML Apps | VoiceUrl, SmsUrl | Webhook config |
| Trust Hub | Business Profile | Org identity for compliance |
| Toll-Free Verification | Submit form | Same fields as API but GUI-guided |
| API Keys | Create/revoke keys | Per-app credential management |
| Studio | Visual flow builder | Drag-and-drop IVR (no API equivalent) |
| Billing | Payment methods | Credit card, auto-recharge threshold |
| Billing | Invoice download | PDF invoices |
| Debugger | Error logs | Cross-product error viewer |

### Console-Only (no API equivalent)
- Visual Studio flow canvas/editor
- Account closure (master account)
- Billing payment method management
- 2FA enforcement for Console login
- Auto-delete subaccount data toggle
- Portability Checker interactive tool

---

## API-Only Capabilities

| Capability | Endpoint |
|------------|----------|
| Bulk number reconfiguration (update webhooks on 100s of numbers) | `POST /IncomingPhoneNumbers/{Sid}` loop |
| Create Usage Triggers (billing threshold webhooks) | `POST /Usage/Triggers` |
| Create/suspend/close subaccounts programmatically | `POST /Accounts` |
| Publish Studio Flows via CI/CD | `POST studio.twilio.com/v2/Flows` |
| Trigger Studio Flow executions | `POST /Flows/{Sid}/Executions` |
| Bulk Export (download historical data dumps) | `bulkexport.twilio.com/v1` |
| SHAKEN/STIR trust bundle (caller ID verification) | Trust Hub REST API |
| TaskRouter (workspace/workflow/worker/task management) | `taskrouter.twilio.com/v1` |
| Hosted Number Orders (use number without porting) | `/HostedNumberOrders` |
| Modify a live call (redirect TwiML, end call) | `POST /Calls/{Sid}` with `Url` or `Status=completed` |
| Scheduled message delivery | `POST /Messages` with `ScheduleType=fixed` + `SendAt` |
| Content Templates API (pre-approved templates) | `content.twilio.com/v1/Content` |
| Port-in requests programmatically | Port-In API (Beta) |

---

## Toll-Free Verification — Your Number

**Number:** +1 (844) 881-4708
**Proof of consent URL:** https://www.dupreeops.com/sms
**Use case categories:** Account Notifications, Marketing
**Opt-in type:** WEB_FORM

| API Field | Value |
|-----------|-------|
| `BusinessName` | Dupree Ops, LLC |
| `BusinessWebsite` | https://www.dupreeops.com |
| `NotificationEmail` | isaiahdupree33@gmail.com |
| `OptInType` | WEB_FORM |
| `UseCaseCategories` | ACCOUNT_NOTIFICATION, MARKETING |
| `OptInImageUrls` | [screenshot of /sms page opt-in] |

Check status: `GET https://messaging.twilio.com/v1/Tollfree/Verifications/{Sid}`

Status values: `PENDING_REVIEW` → `IN_REVIEW` → `TWILIO_APPROVED` or `TWILIO_REJECTED`

---

## Webhook Fields Reference

### On a Phone Number (inbound)
| Field | Triggers when |
|-------|---------------|
| `VoiceUrl` | Inbound call arrives |
| `VoiceFallbackUrl` | VoiceUrl returns error |
| `StatusCallback` | Call status changes (initiated/ringing/answered/completed) |
| `SmsUrl` | Inbound SMS arrives |
| `SmsFallbackUrl` | SmsUrl errors |

### On a Messaging Service (outbound/inbound)
| Field | Triggers when |
|-------|---------------|
| `InboundRequestUrl` | Any number in pool receives message |
| `FallbackUrl` | InboundRequestUrl errors |
| `StatusCallback` | Outbound delivery status changes |

### Per-request overrides (on POST /Messages or POST /Calls)
| Field | Description |
|-------|-------------|
| `StatusCallback` | Override for this specific message/call |
| `StatusCallbackEvent` | (calls only) Which events: initiated, ringing, answered, completed |

---

## Key Limitations

| Limitation | Notes |
|-----------|-------|
| Auth Tokens | Only 2 per account (primary + secondary). Compromise = full access |
| Toll-free editing window | Can only edit TFV within 7 days of initial submission |
| Messaging Services label | Still "Public Beta" in docs but production-deployed |
| Studio visual editor | No API equivalent — must use Console UI |
| Billing management | Requires Auth Token or Console — API Keys cannot manage billing |
| International numbers | Some countries require regulatory bundles submitted via Console |
| Outbound caller ID | Must be a Twilio number or verified caller ID |
| Free trial restrictions | Cannot send to unverified numbers on trial accounts |

---

## Key API Endpoints Summary

```bash
BASE=https://api.twilio.com/2010-04-01/Accounts/$TWILIO_ACCOUNT_SID

# Phone numbers
GET    $BASE/IncomingPhoneNumbers.json
POST   $BASE/IncomingPhoneNumbers/{Sid}.json    # update config
GET    $BASE/AvailablePhoneNumbers/US/TollFree.json

# Send SMS
POST   $BASE/Messages.json   -d "To=+1xxx&From=+1yyy&Body=hello"

# Make call
POST   $BASE/Calls.json      -d "To=+1xxx&From=+1yyy&Url=https://..."

# Usage
GET    $BASE/Usage/Records/ThisMonth.json
GET    $BASE/Usage/Records/Daily.json

# Call/message history
GET    $BASE/Calls.json
GET    $BASE/Messages.json

# Messaging Services (different base URL)
GET    https://messaging.twilio.com/v1/Services

# Toll-Free Verification status
GET    https://messaging.twilio.com/v1/Tollfree/Verifications
```
