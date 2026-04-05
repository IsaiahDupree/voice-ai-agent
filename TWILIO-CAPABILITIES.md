# Twilio Capabilities — Console vs API

**Phone:** `+1 (844) 881-4708` (toll-free, Dupree Ops LLC)
**Last audited:** 2026-04-04

---

## Credentials

| Env Var | Format | Where to get it |
|---------|--------|-----------------|
| `TWILIO_ACCOUNT_SID` | `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` | Console home page |
| `TWILIO_AUTH_TOKEN` | 32-char hex | Console home page — rotate if exposed |
| `TWILIO_API_KEY` | `SKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` | Console → Account → API Keys |
| `TWILIO_API_KEY_SECRET` | 32-char string | Shown ONCE at key creation |
| `TWILIO_PHONE_NUMBER` | `+18448814708` | Console → Phone Numbers |
| `TWILIO_PHONE_SID` | `PNxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` | Same page |

**Auth:** HTTP Basic — `AccountSid:AuthToken` or `ApiKey:ApiKeySecret`

**Best practice:** Use API Key + Secret in production code (revocable per-app). Auth Token = root password.

### API Key Types
| Type | Access |
|------|--------|
| Main | Full access including Accounts and Keys endpoints |
| Standard | Full access EXCEPT cannot manage Accounts or Keys |
| Restricted | Fine-grained scoped (v1 API only, not v2010) |

---

## Base URLs

| Product | Base URL |
|---------|----------|
| Core REST API | `https://api.twilio.com/2010-04-01/Accounts/{AccountSid}/` |
| Messaging Services | `https://messaging.twilio.com/v1/` |
| Toll-Free Verification | `https://messaging.twilio.com/v1/Tollfree/Verifications` |
| Verify (OTP/2FA) | `https://verify.twilio.com/v2/` |
| Trust Hub | `https://trusthub.twilio.com/v1/` |
| Regulatory Compliance | `https://numbers.twilio.com/v2/RegulatoryCompliance/` |
| Studio Flows | `https://studio.twilio.com/v2/Flows` |
| TaskRouter | `https://taskrouter.twilio.com/v1/` |
| Bulk Export | `https://bulkexport.twilio.com/v1/` |
| Pricing | `https://pricing.twilio.com/v1/` |

---

## Console Fields — Phone Numbers

Every field maps to the IncomingPhoneNumbers API resource:

| Console Field | API Property | Type |
|--------------|--------------|------|
| Friendly Name | `friendly_name` | String ≤64 chars |
| Voice URL | `voice_url` | URI |
| Voice Method | `voice_method` | `GET` or `POST` |
| Voice Fallback URL | `voice_fallback_url` | URI |
| Voice Fallback Method | `voice_fallback_method` | `GET` or `POST` |
| Voice Application | `voice_application_sid` | AP… SID |
| Caller ID Lookup | `voice_caller_id_lookup` | Boolean |
| Voice Receive Mode | `voice_receive_mode` | `voice` or `fax` |
| SIP Trunk | `trunk_sid` | TK… SID |
| SMS URL | `sms_url` | URI |
| SMS Method | `sms_method` | `GET` or `POST` |
| SMS Fallback URL | `sms_fallback_url` | URI |
| SMS Fallback Method | `sms_fallback_method` | `GET` or `POST` |
| SMS Application | `sms_application_sid` | AP… SID |
| Status Callback URL | `status_callback` | URI |
| Status Callback Method | `status_callback_method` | `GET` or `POST` |
| Emergency Status | `emergency_status` | `Active` or `Inactive` |
| Emergency Address | `emergency_address_sid` | AD… SID |
| Address | `address_sid` | AD… SID |
| Regulatory Bundle | `bundle_sid` | BU… SID |
| Identity | `identity_sid` | RI… SID |

Capabilities (read-only): `voice`, `sms`, `mms`, `fax` booleans.

---

## Console Fields — Messaging Services

| Console Field | API Property | Notes |
|--------------|--------------|-------|
| Friendly Name | `friendly_name` | ≤64 chars |
| Inbound Request URL | `inbound_request_url` | Inbound message webhook |
| Inbound Method | `inbound_method` | GET or POST |
| Fallback URL | `fallback_url` | Error fallback |
| Fallback Method | `fallback_method` | GET or POST |
| Status Callback URL | `status_callback` | Delivery status webhook |
| Use Per-Number Webhook | `use_inbound_webhook_on_number` | Boolean — number webhook overrides service |
| Sticky Sender | `sticky_sender` | Boolean |
| Smart Encoding | `smart_encoding` | Boolean |
| MMS Converter | `mms_converter` | Boolean |
| Area Code Geomatch | `area_code_geomatch` | Boolean |
| Validity Period | `validity_period` | Seconds (1–36,000) |
| Scan Message Content | `scan_message_content` | `inherit` / `enable` / `disable` |
| Use Case | `usecase` | `notifications` / `marketing` / `verification` / `discussion` / `poll` / `undeclared` |

---

## Console Fields — TwiML Applications

| Console Field | API Property |
|--------------|--------------|
| Friendly Name | `friendly_name` |
| Voice Request URL | `voice_url` |
| Voice Request Method | `voice_method` |
| Voice Fallback URL | `voice_fallback_url` |
| Voice Fallback Method | `voice_fallback_method` |
| Call Status Callback | `status_callback` |
| Call Status Method | `status_callback_method` |
| SMS Request URL | `sms_url` |
| SMS Request Method | `sms_method` |
| SMS Fallback URL | `sms_fallback_url` |
| SMS Fallback Method | `sms_fallback_method` |
| SMS Status Callback | `sms_status_callback` |
| Caller ID Lookup | `voice_caller_id_lookup` |
| External Dial | `public_application_connect_enabled` |

Limit: 1,000 TwiML apps per account.

---

## Console-Only (no API equivalent)

- Visual Studio flow canvas/editor
- Account closure (master account)
- Billing payment method management (credit card, auto-recharge)
- 2FA enforcement for Console login
- Auto-delete subaccount data toggle
- Portability Checker interactive tool
- Rate limit increase requests (requires Console → Business Profile)

---

## API-Only Capabilities

| Capability | Endpoint |
|------------|----------|
| Send outbound SMS | `POST /Messages.json` |
| Make outbound call | `POST /Calls.json` |
| Redirect/end a live call | `POST /Calls/{Sid}.json` with `Url` or `Status=completed` |
| Scheduled message delivery | `POST /Messages.json` with `ScheduleType=fixed` + `SendAt` |
| Redact / delete message bodies | `POST` or `DELETE /Messages/{Sid}.json` |
| Create usage billing triggers | `POST /Usage/Triggers.json` |
| Create subaccounts programmatically | `POST /Accounts.json` |
| Programmatic number search + purchase | `GET /AvailablePhoneNumbers/…` + `POST /IncomingPhoneNumbers.json` |
| Bulk Export (historical data dumps) | `bulkexport.twilio.com/v1` |
| SHAKEN/STIR trust bundle submission | Trust Hub REST API |
| TaskRouter (workspace/workflow/workers) | `taskrouter.twilio.com/v1` |
| Hosted Number Orders (no porting) | `/HostedNumberOrders` |
| Port-in requests | Port-In API (Beta) |
| Content Templates API | `content.twilio.com/v1/Content` |
| Manage call queues | `POST /Queues.json` |
| List deactivated US numbers | `GET messaging.twilio.com/v1/Deactivations` |
| Manage addresses (regulatory) | `POST /Addresses.json` |
| Regulatory compliance bundles | `numbers.twilio.com/v2/RegulatoryCompliance/Bundles` |
| Start/pause/stop call recordings | `POST /Calls/{Sid}/Recordings.json` |
| Delete recordings | `DELETE /Recordings/{Sid}.json` |
| Restrict API key scope | Keys API (v1 only, no Console equivalent) |

---

## Toll-Free Verification — Your Number

**Number:** +18448814708 (`+1 (844) 881-4708`)
**Business:** Dupree Ops LLC, 3425 Delaney Drive, Melbourne FL 32934
**SMS policy URL:** https://www.dupreeops.com/sms
**Opt-in type:** `WEB_FORM`
**Categories:** `ACCOUNT_NOTIFICATIONS`, `MARKETING`

| Field | Value |
|-------|-------|
| `toll_free_phone_number` | +18448814708 |
| `business_name` | Dupree Ops, LLC |
| `business_website` | https://www.dupreeops.com |
| `notification_email` | isaiahdupree33@gmail.com |
| `opt_in_type` | WEB_FORM |
| `use_case_categories` | ACCOUNT_NOTIFICATION, MARKETING |
| `opt_in_image_urls` | [screenshot of /sms page opt-in] |

Status values: `PENDING_REVIEW` → `IN_REVIEW` → `TWILIO_APPROVED` or `TWILIO_REJECTED`

Check via API:
```bash
curl -u $TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN \
  https://messaging.twilio.com/v1/Tollfree/Verifications
```

---

## Webhook Parameters Reference

### Inbound SMS (POST to your SmsUrl)
| Parameter | Description |
|-----------|-------------|
| `MessageSid` | Unique message ID |
| `AccountSid` | Your account SID |
| `From` | Sender's number |
| `To` | Your Twilio number |
| `Body` | Message text |
| `NumMedia` | Count of media attachments |
| `MediaUrl0`…`MediaUrl9` | MMS attachment URLs |
| `FromCity`, `FromState`, `FromCountry` | Sender geo data |

### Outbound SMS Status Callback
| Parameter | Description |
|-----------|-------------|
| `MessageSid` | Message identifier |
| `MessageStatus` | `queued/sending/sent/delivered/undelivered/failed` |
| `ErrorCode` | Error code if failed |
| `From` / `To` | Numbers |

### Call Status Callback
| Parameter | Description |
|-----------|-------------|
| `CallSid` | Call identifier |
| `CallStatus` | `initiated/ringing/in-progress/completed/busy/failed/no-answer` |
| `Duration` | Call duration in seconds (on completed) |
| `RecordingUrl` | If call was recorded |

---

## Status Lifecycles

```
SMS outbound:  accepted → queued → sending → sent → delivered
                                                  → undelivered
                                         → failed
SMS scheduled: scheduled → queued → ...
SMS inbound:   receiving → received

Call:  queued → ringing → in-progress → completed
                                      → busy / failed / no-answer / canceled
```

---

## Complete API Endpoint Reference

### Core API (`https://api.twilio.com/2010-04-01/Accounts/{AccountSid}/`)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/Accounts/{Sid}.json` | Fetch account |
| POST | `/Accounts.json` | Create subaccount |
| POST | `/Keys.json` | Create API key |
| GET | `/Keys.json` | List API keys |
| DELETE | `/Keys/{Sid}.json` | Delete API key |
| GET | `/IncomingPhoneNumbers.json` | List owned numbers |
| POST | `/IncomingPhoneNumbers.json` | Purchase number |
| GET | `/IncomingPhoneNumbers/{Sid}.json` | Fetch number config |
| POST | `/IncomingPhoneNumbers/{Sid}.json` | Update number config |
| DELETE | `/IncomingPhoneNumbers/{Sid}.json` | Release number |
| GET | `/AvailablePhoneNumbers/US/TollFree.json` | Search toll-free |
| GET | `/AvailablePhoneNumbers/US/Local.json` | Search local |
| POST | `/Messages.json` | Send SMS/MMS |
| GET | `/Messages.json` | List messages |
| GET | `/Messages/{Sid}.json` | Fetch message |
| POST | `/Messages/{Sid}.json` | Redact body |
| DELETE | `/Messages/{Sid}.json` | Delete message |
| GET | `/Messages/{Sid}/Media.json` | List media |
| DELETE | `/Messages/{MSid}/Media/{Sid}.json` | Delete media |
| POST | `/Calls.json` | Make outbound call |
| GET | `/Calls.json` | List calls |
| GET | `/Calls/{Sid}.json` | Fetch call |
| POST | `/Calls/{Sid}.json` | Update live call |
| DELETE | `/Calls/{Sid}.json` | Delete call record |
| POST | `/Calls/{Sid}/Recordings.json` | Start recording |
| GET | `/Recordings.json` | List all recordings |
| GET | `/Recordings/{Sid}.json` | Fetch recording |
| POST | `/Recordings/{Sid}.json` | Pause/resume/stop |
| DELETE | `/Recordings/{Sid}.json` | Delete recording |
| GET | `/Conferences.json` | List conferences |
| POST | `/Queues.json` | Create call queue |
| GET | `/Queues.json` | List call queues |
| POST | `/Addresses.json` | Create address |
| GET | `/Addresses.json` | List addresses |
| POST | `/Applications.json` | Create TwiML app |
| GET | `/Applications.json` | List TwiML apps |
| GET | `/Usage/Records/ThisMonth.json` | Usage this month |
| GET | `/Usage/Records/Daily.json` | Daily usage |
| POST | `/Usage/Triggers.json` | Create billing alert |
| GET | `/Usage/Triggers.json` | List triggers |

### Messaging API (`https://messaging.twilio.com/v1/`)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/Services` | Create Messaging Service |
| GET | `/Services` | List services |
| GET | `/Services/{Sid}` | Fetch service config |
| POST | `/Services/{Sid}` | Update service config |
| DELETE | `/Services/{Sid}` | Delete service |
| POST | `/Services/{Sid}/PhoneNumbers` | Add number to pool |
| GET | `/Services/{Sid}/PhoneNumbers` | List numbers in pool |
| DELETE | `/Services/{Sid}/PhoneNumbers/{Sid}` | Remove from pool |
| POST | `/Tollfree/Verifications` | Submit TF verification |
| GET | `/Tollfree/Verifications` | List verifications |
| GET | `/Tollfree/Verifications/{Sid}` | Check status |
| POST | `/Tollfree/Verifications/{Sid}` | Update/resubmit |
| DELETE | `/Tollfree/Verifications/{Sid}` | Delete verification |
| GET | `/Deactivations` | Get deactivated US numbers |

---

## Rate Limits

| Resource | Limit |
|----------|-------|
| Calls per second (default) | 1 CPS |
| Calls per second (Business Profile) | 5 CPS |
| TwiML apps per account | 1,000 |
| Usage triggers per account | 1,000 |
| Queue max size | 5,000 |
| Page size (most endpoints) | 1–1,000 (default 50) |
| MMS attachments | 10 files, 5 MB total |
| Friendly name fields | 64 chars |

---

## Key Limitations

| Limitation | Notes |
|-----------|-------|
| Auth Tokens | Only 2 per account (primary + secondary) |
| TFV edit window | 7 days from initial submission |
| Trial accounts | Can only send to verified numbers |
| Billing management | Requires Auth Token or Console — API Keys cannot |
| International numbers | Some require regulatory bundles (Console or API) |
| Studio visual editor | No API equivalent |
| Rate increase requests | Must go through Console Business Profile |
| HIPAA compliance | Requires enforced HTTPS on recording endpoints |
