# YourPace Deployment Guide

## Overview
Complete guide to deploy and maintain the YourPace fitness app across dev, staging, and production environments.

## Prerequisites

### AWS Setup
- AWS Account: `230984464810`
- Region: `eu-west-1` (main), `us-east-1` (for ACM certificates)
- SSO Portal: https://d-9367b3d882.awsapps.com/start

### Local Setup
```bash
# Install Node.js 18+
node --version

# Install AWS CLI
aws --version

# Install CDK
npm install -g aws-cdk

# Clone and install dependencies
cd /Users/joemorrison/workspace/yourpace
npm install --prefix infrastructure
npm install --prefix frontend
```

## Environment Configuration

### AWS Profiles
```bash
# Configure AWS SSO profiles (already set up)
aws sso login --profile yourpace-dev
aws sso login --profile yourpace-staging
aws sso login --profile yourpace-prod
```

### Frontend Environment Variables
Create `frontend/.env.local`:
```env
# Cognito OAuth2/OIDC Configuration
NEXT_PUBLIC_COGNITO_DOMAIN=auth-dev.yourpace.cloud
NEXT_PUBLIC_COGNITO_CLIENT_ID=<from CDK output>
NEXT_PUBLIC_COGNITO_REGION=eu-west-1

# API Configuration (for future use)
NEXT_PUBLIC_API_URL=https://api-dev.yourpace.cloud
```

Get `NEXT_PUBLIC_COGNITO_CLIENT_ID` from CDK stack outputs after deployment.

## Deployment Commands

### 1. Build Frontend
```bash
cd frontend
npm run build
# Output: frontend/out/ (static files)
```

### 2. Deploy Infrastructure (Dev)
```bash
cd infrastructure

# First time: Bootstrap CDK
cdk bootstrap aws://230984464810/eu-west-1 --profile yourpace-dev
cdk bootstrap aws://230984464810/us-east-1 --profile yourpace-dev

# Deploy with domain
npx cdk deploy --all \
  -c env=dev \
  -c domainName=yourpace.cloud \
  -c hostedZoneId=Z02794812UW0G2U4GTHPL \
  --profile yourpace-dev \
  --require-approval never
```

### 3. Deploy Infrastructure (Staging)
```bash
npx cdk deploy --all \
  -c env=staging \
  -c domainName=yourpace.cloud \
  -c hostedZoneId=Z02794812UW0G2U4GTHPL \
  --profile yourpace-staging \
  --require-approval never
```

### 4. Deploy Infrastructure (Production)
```bash
# Always diff first!
npx cdk diff --all \
  -c env=prod \
  -c domainName=yourpace.cloud \
  -c hostedZoneId=Z02794812UW0G2U4GTHPL \
  --profile yourpace-prod

# Then deploy
npx cdk deploy --all \
  -c env=prod \
  -c domainName=yourpace.cloud \
  -c hostedZoneId=Z02794812UW0G2U4GTHPL \
  --profile yourpace-prod \
  --require-approval never
```

## Key AWS Resources

### Cognito
- **User Pool**: Created per environment (e.g., `yourpace-dev`)
- **Managed Login Domain**: `auth-{env}.yourpace.cloud`
- **Auth Flow**: OAuth2/OIDC (standard, no custom Lambda triggers)
- **Email**: Cognito built-in email service (no SES Lambda trigger needed)

### API Gateway
- **Endpoint**: `https://api-{env}.yourpace.cloud` (via Route53 CNAME)
- **Type**: HTTP API v2
- **Auth**: Cognito JWT tokens
- **Deployment**: Separate stack (no circular dependency with Auth)

### Frontend Hosting
- **S3 Bucket**: `yourpace-frontend-{env}`
- **CloudFront Distribution**: `EZE1346GAL6B1` (dev)
- **Domain**: `yourpace.cloud` (via Route53)
- **Certificate**: ACM wildcard cert in us-east-1

### Database
- **DynamoDB Tables**:
  - `yourpace-users-{env}`
  - `yourpace-workouts-{env}`
  - `yourpace-exercises-{env}`
  - `yourpace-goals-{env}`

### Email
- **SES Domain**: `yourpace.cloud`
- **Verified Sender**: `noreply@yourpace.cloud`
- **DKIM Records**: Configured in Route53

## Important Configuration Parameters

### CDK Context Variables
These MUST be passed to every deployment:

```bash
-c env=dev|staging|prod              # Environment
-c domainName=yourpace.cloud          # Domain name
-c hostedZoneId=Z02794812UW0G2U4GTHPL # Route53 hosted zone
```

### Environment Differences

| Feature | Dev | Staging | Prod |
|---------|-----|---------|------|
| NAT Gateways | 1 | 1 | 2 |
| DynamoDB Billing | On-demand | On-demand | On-demand |
| DynamoDB PITR | ❌ | ❌ | ✅ |
| S3 Versioning | ❌ | ❌ | ✅ |
| Auto-delete on destroy | ✅ | ✅ | ❌ |

## Troubleshooting

### DNS Records Missing
If `yourpace.cloud` doesn't resolve:
1. Check Route53 hosted zone: `Z02794812UW0G2U4GTHPL`
2. Verify A record points to CloudFront distribution
3. Verify CNAME for www subdomain
4. Redeploy with domain parameters (see above)

### CloudFront Cache Issues
```bash
# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id EZE1346GAL6B1 \
  --paths "/*" \
  --profile yourpace-dev
```

### Frontend Not Updating
1. Rebuild frontend: `npm run build`
2. Redeploy stack (CDK will sync S3 files)
3. Invalidate CloudFront cache

### Cognito Issues
- Check User Pool in Cognito console
- Verify Client ID in App Client settings
- Check Managed Login domain is created
- Verify callback URLs in App Client settings match your domain
- For custom email templates, check Lambda trigger logs in CloudWatch

### OAuth2 Callback Issues
If redirects to `/auth/callback` fail:
1. Verify `NEXT_PUBLIC_COGNITO_DOMAIN` is correct in `.env.local`
2. Check App Client callback URLs include `https://yourpace.cloud/auth/callback`
3. Verify `NEXT_PUBLIC_COGNITO_CLIENT_ID` matches App Client ID
4. Check browser console for OIDC errors

## Monitoring & Logs

### CloudFormation Stack Status
```bash
aws cloudformation describe-stacks \
  --stack-name YourPaceStack-dev \
  --profile yourpace-dev \
  --region eu-west-1
```

### CloudFront Logs
```bash
aws cloudfront get-distribution \
  --id EZE1346GAL6B1 \
  --profile yourpace-dev
```

### Lambda Logs
```bash
aws logs tail /aws/lambda/yourpace-api-dev \
  --follow \
  --profile yourpace-dev
```

## Rollback Procedure

### Rollback Frontend
```bash
# Invalidate CloudFront to force refresh
aws cloudfront create-invalidation \
  --distribution-id EZE1346GAL6B1 \
  --paths "/*" \
  --profile yourpace-dev

# Or redeploy previous build
npm run build
npx cdk deploy YourPaceStack-dev -c env=dev ... --profile yourpace-dev
```

### Rollback Infrastructure
```bash
# View previous stack state
aws cloudformation describe-stack-resources \
  --stack-name YourPaceStack-dev \
  --profile yourpace-dev

# Redeploy with previous configuration
npx cdk deploy --all -c env=dev ... --profile yourpace-dev
```

## Maintenance

### Update Frontend Code
1. Make changes in `frontend/`
2. Run `npm run build`
3. Redeploy: `npx cdk deploy YourPaceStack-dev ...`

### Update Infrastructure
1. Modify CDK constructs in `infrastructure/lib/`
2. Run `cdk diff` to preview changes
3. Run `cdk deploy` to apply changes

### Update Dependencies
```bash
# Frontend
cd frontend && npm update && npm audit fix

# Infrastructure
cd infrastructure && npm update && npm audit fix
```

## Security Checklist

- [ ] Cognito User Pool has strong password policy
- [ ] SES sender verified for `noreply@yourpace.cloud`
- [ ] CloudFront has HTTPS enforced
- [ ] S3 bucket has public access blocked
- [ ] DynamoDB encryption enabled
- [ ] API Gateway has CORS configured
- [ ] Lambda functions have minimal IAM permissions
- [ ] Secrets stored in AWS Secrets Manager (not in code)

## Support & Documentation

- **AWS CDK Docs**: https://docs.aws.amazon.com/cdk/
- **Next.js Docs**: https://nextjs.org/docs
- **Cognito Docs**: https://docs.aws.amazon.com/cognito/
- **Route53 Docs**: https://docs.aws.amazon.com/route53/

## Quick Reference

### Live URLs
- **Dev Frontend**: https://d1in48u09fa255.cloudfront.net
- **Dev API**: https://9z840avogg.execute-api.eu-west-1.amazonaws.com
- **Custom Domain**: https://yourpace.cloud

### Stack Names
- `YourPaceStack-dev`
- `YourPaceStack-staging`
- `YourPaceStack-prod`
- `YourPaceCertificateStack-dev` (us-east-1)
- `YourPaceCertificateStack-staging` (us-east-1)
- `YourPaceCertificateStack-prod` (us-east-1)

### Important IDs
- **AWS Account**: 230984464810
- **Hosted Zone**: Z02794812UW0G2U4GTHPL
- **CloudFront Distribution (dev)**: EZE1346GAL6B1
- **Cognito User Pool**: Created per environment (check CDK outputs)
- **Cognito Client**: Created per environment (check CDK outputs)
- **Cognito Managed Login Domain**: `auth-{env}.yourpace.cloud`

## Architecture Notes

### Cognito Managed Login (New)
- **No custom Lambda triggers** - eliminates circular dependency
- **OAuth2/OIDC standard flow** - industry best practice
- **Hosted UI** - professional, AWS-managed sign-in experience
- **Custom domain** - `auth.yourpace.cloud` (or `auth-dev.yourpace.cloud` for non-prod)
- **Built-in email** - Cognito handles verification codes automatically

### API Deployment (Separate Stack)
- API is deployed in a separate CDK stack to avoid circular dependency
- API references User Pool ID from Auth stack
- JWT tokens from Cognito are used for API authorization
- See `infrastructure/lib/api-stack.ts` for API deployment

### SES Integration (Optional)
- Your SES setup is configured and ready
- Can be integrated with Cognito for custom email templates
- Currently using Cognito's built-in email service (simpler, no Lambda needed)
- To use SES, update Auth construct and add Lambda trigger for custom emails
