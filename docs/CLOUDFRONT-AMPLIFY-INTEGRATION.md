# CloudFront + Amplify Integration Documentation

Complete guide to the CloudFront and Amplify integration for YourPace frontend deployment.

## Overview

YourPace uses a **CloudFront + Amplify** architecture for optimal frontend delivery:

- **Amplify** handles frontend builds and deployments (webhook-based)
- **CloudFront** serves content globally with caching
- **Lambda + EventBridge** automatically invalidates CloudFront cache on successful Amplify builds
- **Three environments** (dev, staging, prod) with separate distributions

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Git Repository                            │
│                    (DigiAye/yourpace)                            │
└────────────────────────────┬────────────────────────────────────┘
                             │
                    ┌────────▼────────┐
                    │  GitHub Actions │
                    │ (amplify-deploy)│
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  Amplify Webhook│
                    │   (HTTP POST)   │
                    └────────┬────────┘
                             │
                    ┌────────▼────────────────┐
                    │  AWS Amplify            │
                    │  - Build (npm run build)│
                    │  - Deploy to S3         │
                    │  - Emit build event     │
                    └────────┬────────────────┘
                             │
                    ┌────────▼────────────────┐
                    │  EventBridge Rule       │
                    │  (Amplify build success)│
                    └────────┬────────────────┘
                             │
                    ┌────────▼────────────────┐
                    │  Lambda Function        │
                    │  (cloudfront-invalidator)
                    └────────┬────────────────┘
                             │
                    ┌────────▼────────────────┐
                    │  CloudFront            │
                    │  - Invalidate cache    │
                    │  - Serve fresh content │
                    └────────┬────────────────┘
                             │
                    ┌────────▼────────────────┐
                    │  Users                 │
                    │  (yourpace.cloud)      │
                    └────────────────────────┘
```

---

## Components

### 1. Amplify Application

**Purpose:** Build and deploy frontend code

**Configuration:**
- App ID: `d32w5qjq8u9hab`
- Repository: `https://github.com/DigiAye/yourpace`
- Branches: main (prod), staging, develop
- Build command: `npm ci && npm run build`
- Output directory: `out/` (Next.js static export)

**Domains:**
- Main: `main.d32w5qjq8u9hab.amplifyapp.com`
- Staging: `staging.d32w5qjq8u9hab.amplifyapp.com`
- Develop: `develop.d32w5qjq8u9hab.amplifyapp.com`

### 2. CloudFront Distributions

**Purpose:** Global content delivery with caching

**Three distributions (one per environment):**

| Environment | Distribution | Origin | Custom Domain |
|-------------|--------------|--------|---------------|
| **Production** | WwwDistribution | main.d32w5qjq8u9hab.amplifyapp.com | www.yourpace.cloud, yourpace.cloud |
| **Staging** | StagingDistribution | staging.d32w5qjq8u9hab.amplifyapp.com | staging.yourpace.cloud |
| **Development** | DevDistribution | develop.d32w5qjq8u9hab.amplifyapp.com | dev.yourpace.cloud |

**Configuration:**
- Origin protocol: HTTPS only
- Viewer protocol: Redirect to HTTPS
- Cache policy: CACHING_OPTIMIZED
- Default root object: index.html
- Error responses: 404/403 → index.html (SPA routing)

### 3. Lambda Function (CloudFront Invalidator)

**Purpose:** Invalidate CloudFront cache on successful Amplify builds

**Location:** `infrastructure/lib/lambdas/cloudfront-invalidator/index.ts`

**Trigger:** EventBridge rule on Amplify build completion

**Behavior:**
- Listens for Amplify build success events
- Extracts branch name from event
- Maps branch to CloudFront distribution ID
- Creates invalidation for `/*` (all paths)
- Logs invalidation ID and status

**Environment Variables:**
```
DISTRIBUTION_ID_MAIN=E1234567890ABC
DISTRIBUTION_ID_STAGING=E2345678901BCD
DISTRIBUTION_ID_DEVELOP=E3456789012CDE
```

**IAM Permissions:**
```json
{
  "Effect": "Allow",
  "Action": [
    "cloudfront:CreateInvalidation",
    "cloudfront:GetInvalidation"
  ],
  "Resource": [
    "arn:aws:cloudfront::ACCOUNT_ID:distribution/E1234567890ABC",
    "arn:aws:cloudfront::ACCOUNT_ID:distribution/E2345678901BCD",
    "arn:aws:cloudfront::ACCOUNT_ID:distribution/E3456789012CDE"
  ]
}
```

### 4. EventBridge Rule

**Purpose:** Trigger Lambda on Amplify build completion

**Event Pattern:**
```json
{
  "source": ["aws.amplify"],
  "detailType": ["Amplify Deployment State Change"],
  "detail": {
    "appId": ["d32w5qjq8u9hab"],
    "jobStatus": ["SUCCEED"]
  }
}
```

**Target:** CloudFront Invalidator Lambda function

---

## Deployment Flow

### Step 1: Developer Pushes Code

```bash
git push origin main
```

### Step 2: GitHub Actions Triggers

Workflow: `.github/workflows/amplify-deploy.yml`

```yaml
on:
  push:
    branches: [main, staging, develop]
    paths:
      - 'frontend/**'
      - 'amplify.yml'
      - '.github/workflows/amplify-deploy.yml'
```

### Step 3: Detect Branch & Select Webhook

```bash
BRANCH="${GITHUB_REF#refs/heads/}"
case "$BRANCH" in
  main) WEBHOOK_URL="${{ secrets.AMPLIFY_WEBHOOK_MAIN }}" ;;
  staging) WEBHOOK_URL="${{ secrets.AMPLIFY_WEBHOOK_STAGING }}" ;;
  develop) WEBHOOK_URL="${{ secrets.AMPLIFY_WEBHOOK_DEVELOP }}" ;;
esac
```

### Step 4: Trigger Amplify Webhook

```bash
curl -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Response:** HTTP 202 (Accepted)

### Step 5: Amplify Builds Frontend

1. Fetch source code from GitHub
2. Run `npm ci` (clean install)
3. Run `npm run build` (Next.js build)
4. Output to `out/` directory
5. Deploy to Amplify S3 bucket
6. Emit build completion event

### Step 6: EventBridge Detects Build Success

EventBridge rule matches:
- Source: `aws.amplify`
- Detail type: `Amplify Deployment State Change`
- App ID: `d32w5qjq8u9hab`
- Job status: `SUCCEED`

### Step 7: Lambda Invalidates CloudFront

Lambda function executes:

```typescript
// Extract branch from event
const branchName = event.detail.branchName; // "main", "staging", or "develop"

// Map to distribution ID
const distributionId = process.env[`DISTRIBUTION_ID_${branchName.toUpperCase()}`];

// Create invalidation
const command = new CreateInvalidationCommand({
  DistributionId: distributionId,
  InvalidationBatch: {
    Paths: {
      Quantity: 1,
      Items: ['/*'],
    },
    CallerReference: `amplify-${jobId}-${Date.now()}`,
  },
});

const response = await cloudfront.send(command);
```

### Step 8: CloudFront Serves Fresh Content

- Cache invalidation propagates globally
- Next request fetches fresh content from Amplify
- Users see latest version

---

## Configuration

### Environment Variables

Set these in `infrastructure/.env.local`:

```bash
# Amplify domains (from Amplify console)
AMPLIFY_DOMAIN_MAIN=main.d32w5qjq8u9hab.amplifyapp.com
AMPLIFY_DOMAIN_STAGING=staging.d32w5qjq8u9hab.amplifyapp.com
AMPLIFY_DOMAIN_DEVELOP=develop.d32w5qjq8u9hab.amplifyapp.com

# Amplify app ID (from Amplify console)
AMPLIFY_APP_ID=d32w5qjq8u9hab

# Amplify webhook URLs (from Amplify console)
AMPLIFY_WEBHOOK_MAIN=https://webhooks.amplifyapp.com/prod/...
AMPLIFY_WEBHOOK_STAGING=https://webhooks.amplifyapp.com/staging/...
AMPLIFY_WEBHOOK_DEVELOP=https://webhooks.amplifyapp.com/develop/...
```

### GitHub Secrets

Configure these in GitHub repository settings:

```
AMPLIFY_APP_ID=d32w5qjq8u9hab
AMPLIFY_WEBHOOK_MAIN=https://webhooks.amplifyapp.com/prod/...
AMPLIFY_WEBHOOK_STAGING=https://webhooks.amplifyapp.com/staging/...
AMPLIFY_WEBHOOK_DEVELOP=https://webhooks.amplifyapp.com/develop/...
```

### CDK Context

When deploying infrastructure:

```bash
cdk deploy \
  -c env=prod \
  -c domainName=yourpace.cloud \
  -c cloudfrontCertificateArn=arn:aws:acm:us-east-1:...
```

---

## Monitoring & Troubleshooting

### Check Amplify Build Status

```bash
# List recent builds
aws amplify list-jobs \
  --app-id d32w5qjq8u9hab \
  --branch-name main \
  --region eu-west-1

# Get specific build details
aws amplify get-job \
  --app-id d32w5qjq8u9hab \
  --branch-name main \
  --job-id <JOB_ID> \
  --region eu-west-1
```

### Check EventBridge Rule

```bash
# List rules
aws events list-rules \
  --name-prefix "AmplifyBuildCompletion" \
  --region eu-west-1

# Get rule details
aws events describe-rule \
  --name "YourPaceStack-CloudFrontInvalidatorAmplifyBuildCompletionRule..." \
  --region eu-west-1

# List targets
aws events list-targets-by-rule \
  --rule "YourPaceStack-CloudFrontInvalidatorAmplifyBuildCompletionRule..." \
  --region eu-west-1
```

### Check Lambda Execution

```bash
# View recent invocations
aws logs tail /aws/lambda/YourPaceStack-CloudFrontInvalidatorInvalidatorFunction... \
  --follow \
  --region eu-west-1

# Get specific log stream
aws logs describe-log-streams \
  --log-group-name /aws/lambda/YourPaceStack-CloudFrontInvalidatorInvalidatorFunction... \
  --region eu-west-1
```

### Check CloudFront Invalidation

```bash
# List invalidations
aws cloudfront list-invalidations \
  --distribution-id E1234567890ABC

# Get specific invalidation
aws cloudfront get-invalidation \
  --distribution-id E1234567890ABC \
  --id I1234567890ABC

# Check invalidation status
aws cloudfront get-invalidation \
  --distribution-id E1234567890ABC \
  --id I1234567890ABC \
  --query 'Invalidation.Status'
```

### Common Issues

| Symptom | Cause | Solution |
|---------|-------|----------|
| Lambda not triggered | EventBridge rule not matching | Check event pattern, app ID, job status |
| Lambda fails with permission error | IAM role missing CloudFront permissions | Update Lambda execution role policy |
| CloudFront cache not invalidated | Lambda not receiving event | Check EventBridge rule targets |
| Amplify domain not resolving | DNS not configured | Verify Amplify domain in console |
| CloudFront returns 502 | Origin unreachable | Check Amplify domain is accessible |

---

## Performance Metrics

| Phase | Typical Duration |
|-------|------------------|
| Amplify build | 2-3 minutes |
| EventBridge detection | < 1 second |
| Lambda execution | 1-2 seconds |
| CloudFront invalidation | < 1 second |
| Cache propagation | 1-5 minutes |
| **Total** | **2-8 minutes** |

---

## Security Considerations

1. **Webhook URLs** - Stored in GitHub Secrets only, never in code
2. **Lambda Permissions** - Scoped to specific CloudFront distributions
3. **EventBridge Filtering** - Only processes successful builds
4. **HTTPS Only** - All origins use HTTPS
5. **Origin Access** - CloudFront can only access Amplify domains

---

## Future Improvements

- [ ] Add DLQ (Dead Letter Queue) for failed Lambda invocations
- [ ] Add CloudWatch alarms for Lambda failures
- [ ] Add SNS notifications on cache invalidation
- [ ] Implement selective invalidation (only changed paths)
- [ ] Add metrics dashboard for build/invalidation times
- [ ] Implement rollback on failed builds
- [ ] Add smoke tests after invalidation

---

## References

- [AWS Amplify Documentation](https://docs.aws.amazon.com/amplify/)
- [AWS CloudFront Documentation](https://docs.aws.amazon.com/cloudfront/)
- [AWS Lambda Documentation](https://docs.aws.amazon.com/lambda/)
- [AWS EventBridge Documentation](https://docs.aws.amazon.com/eventbridge/)
- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [Next.js Static Export](https://nextjs.org/docs/app/building-your-application/deploying/static-exports)
