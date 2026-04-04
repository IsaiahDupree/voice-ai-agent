# Contributing to Voice AI Agent

Thank you for your interest in contributing! This project is built for Upwork clients and is designed to be easily customizable.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Code Standards](#code-standards)
- [Testing](#testing)
- [Pull Request Process](#pull-request-process)
- [Feature Request Process](#feature-request-process)

---

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Supabase account (free tier works for dev)
- Vapi.ai API key ([get one here](https://vapi.ai))
- Twilio account (trial works for SMS testing)
- Cal.com account (optional, for calendar testing)

### Initial Setup

1. **Clone the repo:**
```bash
git clone <repo-url>
cd voice-ai-agent
```

2. **Install dependencies:**
```bash
npm install
```

3. **Configure environment variables:**
```bash
cp .env.local.example .env.local
# Edit .env.local with your API keys
```

Required variables:
- `VAPI_API_KEY` - Vapi.ai API key
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` - Twilio credentials
- `CALCOM_API_KEY` - Cal.com API key (optional)
- `OPENAI_API_KEY` - OpenAI API key

4. **Set up Supabase schema:**
```bash
# Apply migrations (if provided)
npm run supabase:migrate

# Or manually create tables using Supabase dashboard
# Schema is in docs/SUPABASE_SCHEMA.md
```

5. **Run dev server:**
```bash
npm run dev
```

Visit `http://localhost:3000` to see the dashboard.

6. **Verify setup:**
```bash
curl http://localhost:3000/api/health
```

Should return `{"status": "healthy", ...}` if all integrations are configured.

---

## Development Workflow

### Branch Strategy

- `main` - production-ready code
- `dev` - active development
- `feature/<name>` - new features
- `fix/<name>` - bug fixes

### Workflow Steps

1. **Create a feature branch:**
```bash
git checkout -b feature/add-voice-cloning
```

2. **Make your changes:**
- Follow code standards (see below)
- Add tests for new features
- Update documentation if needed

3. **Test locally:**
```bash
npm run lint        # ESLint
npm run test        # Jest unit tests
npm run build       # Verify build succeeds
```

4. **Commit with clear messages:**
```bash
git add .
git commit -m "feat: add ElevenLabs voice cloning support

- Add voice cloning endpoint
- Update persona builder UI
- Add tests for voice preview
"
```

**Commit message format:**
- `feat:` - new feature
- `fix:` - bug fix
- `docs:` - documentation only
- `refactor:` - code refactor (no behavior change)
- `test:` - add/update tests
- `chore:` - maintenance (deps, config)

5. **Push and open PR:**
```bash
git push origin feature/add-voice-cloning
```

Then open a Pull Request on GitHub.

---

## Code Standards

### TypeScript

- **Type everything** - no `any` unless absolutely necessary
- Use interfaces for data structures
- Prefer named exports over default exports

**Example:**
```typescript
// ✅ Good
export interface CallRecord {
  id: string
  phoneNumber: string
  duration: number
  transcript?: string
}

export async function getCall(id: string): Promise<CallRecord> {
  // ...
}

// ❌ Bad
export default async function(id) {
  // ...
}
```

### React Components

- Use functional components with hooks
- Extract reusable logic into custom hooks
- Colocate component files with their tests

**File structure:**
```
app/dashboard/
  components/
    CallList.tsx          # Component
    CallList.test.tsx     # Tests
    CallList.module.css   # Styles (if needed)
```

### API Routes

- Use Next.js App Router conventions (`app/api/...`)
- Return consistent error formats
- Include request validation
- Log errors with context

**Example:**
```typescript
// app/api/calls/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const paramsSchema = z.object({
  id: z.string().uuid(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = paramsSchema.parse(params)
    const call = await getCallById(id)

    if (!call) {
      return NextResponse.json(
        { error: 'Call not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(call)
  } catch (error) {
    console.error('[GET /api/calls/:id] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

### Error Handling

- Use try/catch for all async operations
- Return user-friendly error messages
- Log detailed errors server-side
- Never expose API keys or secrets in error responses

### Naming Conventions

- **Files:** `kebab-case.ts` (e.g., `call-analytics.ts`)
- **Components:** `PascalCase.tsx` (e.g., `CallDetailDrawer.tsx`)
- **Functions:** `camelCase` (e.g., `bookAppointment`)
- **Constants:** `UPPER_SNAKE_CASE` (e.g., `MAX_RETRIES`)
- **Interfaces/Types:** `PascalCase` (e.g., `CallRecord`)

---

## Testing

### Unit Tests (Jest)

Test files live next to their source files:

```bash
lib/
  calcom.ts
  calcom.test.ts
```

**Running tests:**
```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

**Example test:**
```typescript
// lib/calcom.test.ts
import { checkAvailability } from './calcom'

describe('checkAvailability', () => {
  it('returns available slots', async () => {
    const slots = await checkAvailability({
      eventTypeId: '123',
      date: '2024-03-15',
    })

    expect(slots).toHaveLength(3)
    expect(slots[0]).toMatchObject({
      time: expect.any(String),
      available: true,
    })
  })

  it('handles API errors gracefully', async () => {
    // Mock API failure
    await expect(
      checkAvailability({ eventTypeId: 'invalid' })
    ).rejects.toThrow('Cal.com API error')
  })
})
```

### Integration Tests

For API routes, use `node-mocks-http`:

```typescript
// app/api/calls/route.test.ts
import { createMocks } from 'node-mocks-http'
import { GET } from './route'

describe('GET /api/calls', () => {
  it('returns call list', async () => {
    const { req } = createMocks({ method: 'GET' })
    const response = await GET(req)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(Array.isArray(data.calls)).toBe(true)
  })
})
```

### Manual Testing

Before submitting a PR, test:

1. **Happy path** - feature works as expected
2. **Error cases** - handles bad input gracefully
3. **Edge cases** - empty lists, null values, etc.
4. **UI responsiveness** - test on mobile viewport

**Test in dashboard:**
- Create a test persona
- Make a test call using `/api/test/call`
- Verify call appears in dashboard
- Check transcript saves correctly

---

## Pull Request Process

### Before Submitting

- [ ] Code follows style guide
- [ ] Tests added/updated and passing
- [ ] Lint passes (`npm run lint`)
- [ ] Build succeeds (`npm run build`)
- [ ] Documentation updated (if needed)
- [ ] No console.logs or debugger statements left in
- [ ] No hardcoded credentials or API keys

### PR Description Template

```markdown
## Description
Brief description of what this PR does.

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing Done
- Tested feature X manually
- Added unit tests for Y
- Verified build passes

## Screenshots (if applicable)
<img src="...">

## Checklist
- [ ] Code follows project standards
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] No breaking changes (or documented if yes)
```

### Review Process

1. **Automated checks run** (lint, test, build)
2. **Code review** by maintainer
3. **Changes requested** (if needed) - address feedback and push updates
4. **Approval** - maintainer approves PR
5. **Merge** - squash merge to main

**Response time:** We aim to review PRs within 48 hours.

---

## Feature Request Process

### Proposing New Features

Open a GitHub Issue with the "Feature Request" template:

**Title:** `[Feature] Add Zoom integration for video calls`

**Body:**
```markdown
## Problem
Currently the agent can only handle phone calls. Some clients need video call support for consultations.

## Proposed Solution
Integrate Zoom API to create meeting links during booking.

## Alternatives Considered
- Google Meet API
- Cal.com native video

## Additional Context
Zoom is more familiar to enterprise clients.

## Acceptance Criteria
- [ ] Agent can create Zoom meeting when booking appointment
- [ ] Zoom link included in SMS confirmation
- [ ] Meeting logged in call record
```

### Feature Prioritization

Features are prioritized by:
1. **Impact** - how many users benefit?
2. **Effort** - how complex to implement?
3. **Alignment** - fits project vision?

**Priority levels:**
- P0 - Critical (security, blocking bugs)
- P1 - High (core features)
- P2 - Nice-to-have (enhancements)

---

## Project Structure

```
voice-ai-agent/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   ├── dashboard/         # Dashboard pages
│   └── layout.tsx         # Root layout
├── lib/                   # Shared utilities
│   ├── vapi.ts           # Vapi client
│   ├── calcom.ts         # Cal.com client
│   ├── supabase.ts       # Supabase client
│   └── ...
├── docs/                  # Documentation
├── public/               # Static assets
├── tests/                # Test utilities
├── .env.local            # Environment variables (gitignored)
├── next.config.js        # Next.js config
├── package.json          # Dependencies
├── tsconfig.json         # TypeScript config
└── README.md            # Project overview
```

---

## Questions?

- Open a GitHub Discussion for general questions
- Open a GitHub Issue for bugs or feature requests
- For security issues, email [your-email@example.com]

---

## License

By contributing, you agree that your contributions will be licensed under the same license as this project (MIT).

---

Thank you for contributing! 🎉
