# Staging Environment Setup

**Feature:** F1328 - Separate staging Vercel deployment

## Overview

This project uses Vercel's Git-based deployment system with automatic staging environments:

- **Production**: Deploys from `main` branch → `voice-ai-agent.vercel.app`
- **Staging**: Deploys from `develop` branch or PRs → `staging.voice-ai-agent.vercel.app`
- **Preview**: Every PR gets a unique preview URL → `voice-ai-agent-git-{branch}.vercel.app`

## Deployment Strategy

### Production Deployment
```bash
git checkout main
git merge develop
git push origin main
```

Vercel automatically deploys `main` branch to production.

### Staging Deployment
```bash
git checkout develop
git push origin develop
```

Vercel automatically deploys `develop` branch to staging environment.

### Preview Deployments
Every pull request automatically gets a preview deployment:
- Unique URL per PR
- Automatically updated on new commits
- Deleted when PR is closed

## Environment Variables

### Production Environment
Set in Vercel dashboard under **Settings → Environment Variables → Production**:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VAPI_API_KEY`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_PHONE_NUMBER`
- `CALCOM_API_KEY`
- `ADMIN_API_KEY`
- `NODE_ENV=production`

### Staging Environment
Set in Vercel dashboard under **Settings → Environment Variables → Preview**:
- Same as production, but with staging/test values
- Use separate Twilio number for staging
- Use test mode for payment processors
- `NODE_ENV=staging`

## Vercel Configuration

The `.vercelrc` file defines environment-specific settings:

```json
{
  "environments": {
    "production": {
      "alias": ["voice-ai-agent.vercel.app"],
      "env": {
        "NEXT_PUBLIC_APP_URL": "https://voice-ai-agent.vercel.app",
        "NODE_ENV": "production"
      }
    },
    "preview": {
      "alias": ["staging.voice-ai-agent.vercel.app"],
      "env": {
        "NEXT_PUBLIC_APP_URL": "https://staging.voice-ai-agent.vercel.app",
        "NODE_ENV": "staging"
      }
    }
  }
}
```

## Database Strategy

### Production Database
- Full Supabase production project
- Regular backups enabled
- Point-in-time recovery enabled

### Staging Database
Option 1: Separate Supabase project
- Create a separate Supabase project for staging
- Use different connection URL
- Safe for testing destructive operations

Option 2: Same database, different schema
- Use schema namespacing: `staging_*` tables
- More cost-effective
- Requires careful query isolation

## Testing in Staging

Before deploying to production:

1. **Smoke test**: Verify `/api/health` returns 200
2. **Auth test**: Create test user, login
3. **Campaign test**: Create small test campaign (5 contacts)
4. **Call test**: Initiate test outbound call
5. **Webhook test**: Verify Vapi webhook handling
6. **Transfer test**: Test call handoff flow

## Monitoring

Staging environment includes same monitoring as production:
- Error rate tracking
- Performance metrics
- Uptime checks
- Webhook delivery monitoring

Access staging logs:
```bash
vercel logs voice-ai-agent --environment preview
```

## Rollback Strategy

If production deployment has issues:

1. **Instant rollback**: In Vercel dashboard → Deployments → Click "Rollback"
2. **Git revert**:
   ```bash
   git revert HEAD
   git push origin main
   ```

## Cost Management

Staging uses Vercel's preview deployment limits:
- 100 GB bandwidth/month (shared across all previews)
- 100 GB-hours serverless execution
- Unlimited preview deployments

To reduce costs:
- Delete old preview branches
- Use staging only for integration testing
- Run unit tests locally first

## CI/CD Integration

GitHub Actions automatically:
1. Runs tests on all PRs
2. Creates preview deployment if tests pass
3. Blocks merge if tests fail
4. Auto-deploys to staging when merged to `develop`
5. Auto-deploys to production when merged to `main`

## Security

Staging environment security:
- Same authentication as production
- Separate API keys from production
- Webhook signature verification enabled
- Rate limiting enabled
- CORS configured for staging domain

## Access Control

Staging access via Vercel:
1. Invite team members in Vercel dashboard
2. Set role: Developer (can view staging) or Owner (can deploy)
3. Team members can access staging deployments

## Support

Issues with staging deployment:
1. Check Vercel dashboard logs
2. Verify environment variables are set
3. Check GitHub Actions workflow status
4. Review deployment build logs

---

**Last Updated**: March 28, 2026
**Feature ID**: F1328
