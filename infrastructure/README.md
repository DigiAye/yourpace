# YourPace Infrastructure

AWS CDK (TypeScript) infrastructure for [yourpace.fit](https://yourpace.fit).

## Architecture

```
YourPaceCertificateStack-{env}   (us-east-1)
└── ACM Certificate (wildcard *.yourpace.fit)

YourPaceStack-{env}              (eu-west-1)
├── Network     → VPC, public/private subnets, security groups
├── Storage     → S3 (assets), DynamoDB (users, workouts, exercises, goals)
├── Auth        → Cognito User Pool + magic link Lambda trigger
├── Api         → Lambda + API Gateway HTTP v2
└── Dns         → Route53 hosted zone + DNS records (when domainName provided)
```

## AWS Account

| Account | ID |
|---------|-----|
| yourpace | `230984464810` |
| Region | `eu-west-1` |
| SSO Portal | https://d-9367b3d882.awsapps.com/start |

## Prerequisites

```bash
# Install AWS CDK globally
npm install -g aws-cdk

# Install project dependencies
cd infrastructure
npm install
```

## First-Time Setup

### 1. Login via SSO

```bash
aws sso login --profile yourpace-dev
```

### 2. Bootstrap CDK (one-time per account/region)

```bash
# Bootstrap eu-west-1 (main region)
cdk bootstrap aws://230984464810/eu-west-1 --profile yourpace-dev

# Bootstrap us-east-1 (required for ACM certificates used by CloudFront)
cdk bootstrap aws://230984464810/us-east-1 --profile yourpace-dev
```

## Deploy

### Dev environment

```bash
aws sso login --profile yourpace-dev

# Without domain (infrastructure only)
cdk deploy --all -c env=dev --profile yourpace-dev

# With domain
cdk deploy --all -c env=dev -c domainName=yourpace.fit --profile yourpace-dev
```

### Staging environment

```bash
aws sso login --profile yourpace-staging
cdk deploy --all -c env=staging -c domainName=yourpace.fit --profile yourpace-staging
```

### Production environment

```bash
aws sso login --profile yourpace-prod

# Always diff before deploying to prod!
cdk diff --all -c env=prod -c domainName=yourpace.fit --profile yourpace-prod

cdk deploy --all -c env=prod -c domainName=yourpace.fit --profile yourpace-prod
```

## Stack Outputs

After deployment, CDK prints key outputs including:

| Output | Description |
|--------|-------------|
| `ApiEndpoint` | API Gateway URL |
| `UserPoolId` | Cognito User Pool ID |
| `UserPoolClientId` | Cognito App Client ID |
| `HostedZoneId` | Route53 Hosted Zone ID |
| `HostedZoneNameServers` | NS records — update your domain registrar |
| `AssetsBucketName` | S3 bucket for static assets |

## Domain Setup (yourpace.fit)

After first deploy with `-c domainName=yourpace.fit`:

1. Note the `HostedZoneNameServers` output
2. Go to your domain registrar (where yourpace.fit is registered)
3. Update the NS records to point to the Route53 name servers
4. Wait for DNS propagation (~24-48 hours)

> **Note:** If yourpace.fit is registered in Route53, the NS records are set automatically.

## Environment Differences

| Feature | dev | staging | prod |
|---------|-----|---------|------|
| NAT Gateways | 1 | 1 | 2 |
| DynamoDB billing | On-demand | On-demand | On-demand |
| DynamoDB PITR | ❌ | ❌ | ✅ |
| DynamoDB deletion protection | ❌ | ❌ | ✅ |
| S3 versioning | ❌ | ❌ | ✅ |
| S3 auto-delete | ✅ | ✅ | ❌ |
| Cognito removal policy | DESTROY | DESTROY | RETAIN |

## Project Structure

```
infrastructure/
├── bin/
│   └── yourpace.ts              # CDK entry point
├── lib/
│   ├── yourpace-stack.ts        # Main stack orchestrator
│   ├── certificate-stack.ts     # ACM cert (us-east-1)
│   └── constructs/
│       ├── network.ts           # VPC, subnets, security groups
│       ├── storage.ts           # S3 + DynamoDB
│       ├── auth.ts              # Cognito + magic link
│       ├── api.ts               # Lambda + API Gateway
│       ├── dns.ts               # Route53 + records
│       └── index.ts
├── lib/lambdas/
│   └── auth-trigger/
│       └── index.ts             # Magic link Lambda
├── cdk.json
├── package.json
└── tsconfig.json
```

## Useful Commands

```bash
# Build TypeScript
npm run build

# Watch for changes
npm run watch

# Synthesise CloudFormation templates
cdk synth -c env=dev --profile yourpace-dev

# Diff against deployed stack
cdk diff -c env=dev --profile yourpace-dev

# Destroy dev environment (⚠️ destructive)
cdk destroy --all -c env=dev --profile yourpace-dev
```

## Adding API Routes

The API handler in `lib/constructs/api.ts` uses a placeholder inline Lambda.
To add real routes:

1. Create handler files in `lib/lambdas/api/`
2. Replace `lambda.Code.fromInline(...)` with `lambda.Code.fromAsset(...)`
3. Add routes in the `Api` construct

## Magic Link Auth

The Cognito magic link flow:
1. User enters email on the sign-in page
2. Cognito calls the `auth-trigger` Lambda
3. Lambda generates a 6-digit OTP and sends it via SES
4. User enters the OTP (or clicks the magic link)
5. Cognito verifies and issues JWT tokens

> **Note:** SES must be verified for the sender domain before magic links work.
> Run: `aws ses verify-email-identity --email-address noreply@yourpace.fit --profile yourpace-prod`
