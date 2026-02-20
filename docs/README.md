# YourPace Documentation

## Overview

YourPace is a modern fitness tracking application with enterprise-grade infrastructure and CI/CD automation. This documentation covers setup, deployment, and operations.

## Quick Navigation

### Getting Started
- **[SETUP.md](./SETUP.md)** - Complete setup guide (8 phases, ~90 minutes)
- **[GITHUB_SECRETS.md](./GITHUB_SECRETS.md)** - GitHub secrets configuration
- **[DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)** - Infrastructure deployment details

### Infrastructure & Authentication
- **[CERTIFICATE_SETUP.md](./CERTIFICATE_SETUP.md)** - SSL certificate setup
- **[COGNITO_MANAGED_LOGIN_GUIDE.md](./COGNITO_MANAGED_LOGIN_GUIDE.md)** - Cognito authentication
- **[COGNITO_CUSTOM_DOMAIN_SETUP.md](./COGNITO_CUSTOM_DOMAIN_SETUP.md)** - Custom auth domain (production)

### CI/CD & Deployment
- **[CI-CD-PIPELINE.md](./CI-CD-PIPELINE.md)** - CI/CD workflow details
- **[CI-CD-TEST.md](./CI-CD-TEST.md)** - Testing the CI/CD pipeline

### Implementation Details
- **[IMPLEMENTATION_COMPLETE.md](./IMPLEMENTATION_COMPLETE.md)** - Implementation status
- **[OAUTH2_CALLBACK_IMPLEMENTATION.md](./OAUTH2_CALLBACK_IMPLEMENTATION.md)** - OAuth2 callback setup

## Architecture Overview

### Multi-Environment Setup

YourPace uses three environments with automatic deployment:

| Environment | Branch | URL | CloudFront | Cognito Domain |
|-------------|--------|-----|-----------|-----------------|
| **Development** | `develop` | https://dev.yourpace.cloud | Unique ID | yourpace-dev.auth.eu-west-1.amazoncognito.com |
| **Staging** | `staging` | https://staging.yourpace.cloud | Unique ID | yourpace-staging.auth.eu-west-1.amazoncognito.com |
| **Production** | `main` | https://yourpace.cloud<br/>https://www.yourpace.cloud<br/>https://auth.yourpace.cloud | Unique ID | yourpace-prod.auth.eu-west-1.amazoncognito.com<br/>+ Custom: auth.yourpace.cloud |

### Infrastructure Components

**AWS Services:**
- **CloudFront** - CDN for frontend (3 distributions: prod, staging, dev)
- **S3** - Static file hosting (3 buckets: prod, staging, dev)
- **Cognito** - User authentication with managed login
- **DynamoDB** - Database (Users, Workouts, Exercises, Goals)
- **Route53** - DNS management
- **VPC** - Network isolation
- **Lambda** - Serverless functions (optional)

**Frontend:**
- **Next.js** - React framework with App Router
- **Tailwind CSS** - Styling
- **TypeScript** - Type safety

## Deployment Flow

### Automatic Deployments

```
1. Developer pushes to develop branch
   ↓
2. GitHub Actions triggers deploy-infrastructure.yml
   ↓
3. Frontend builds and deploys to dev.yourpace.cloud
   ↓
4. Infrastructure updates (if changed)
   ↓
5. Deployment verified (curl checks)
```

### Promotion Workflow

```
develop (dev environment)
   ↓ [Merge PR]
staging (staging environment)
   ↓ [Merge PR]
main (production environment)
   ↓ [Infrastructure + Frontend Deploy]
Production Live
```

## Key Features

### ✅ Multi-Environment Support
- Separate deployments for dev, staging, and production
- Each environment has unique CloudFront distribution IDs
- Environment-specific Cognito domains
- Automatic environment detection from git branches

### ✅ Security
- **OIDC Authentication** - No long-lived AWS credentials in GitHub
- **Secrets Management** - All sensitive values in GitHub secrets
- **Destructive Change Detection** - Prevents accidental infrastructure deletion
- **Manual Approvals** - Required for production infrastructure changes
- **Branch Protection** - Enforced PR reviews before merging
- **Audit Trail** - All deployments logged in GitHub Actions and AWS CloudTrail

### ✅ Automation
- Automatic frontend builds and deployments
- Infrastructure validation before deployment
- Post-deployment verification (curl checks)
- Helper scripts for manual operations

### ✅ Production Ready
- Custom Cognito domain (auth.yourpace.cloud) for production
- All domains verified and accessible
- Proper error handling and logging
- Comprehensive documentation

## GitHub Secrets

19 secrets are configured for CI/CD automation:

**AWS Credentials:**
- `AWS_ACCOUNT_ID` - AWS account ID
- `AWS_REGION` - Primary region (eu-west-1)
- `AWS_REGION_US_EAST_1` - US East region (for CloudFront certificates)
- `AWS_DEPLOY_ROLE_ARN` - IAM role for GitHub Actions

**CloudFront:**
- `CLOUDFRONT_CERTIFICATE_ARN` - ACM certificate (us-east-1)
- `AWS_CLOUDFRONT_DISTRIBUTION_ID_PROD` - Production distribution ID
- `AWS_CLOUDFRONT_DISTRIBUTION_ID_STAGING` - Staging distribution ID
- `AWS_CLOUDFRONT_DISTRIBUTION_ID_DEV` - Dev distribution ID

**Cognito:**
- `COGNITO_USER_POOL_ID` - User Pool ID
- `COGNITO_USER_POOL_CLIENT_ID` - App Client ID
- `COGNITO_AUTH_DOMAIN_PROD` - Production auth domain
- `COGNITO_AUTH_DOMAIN_STAGING` - Staging auth domain
- `COGNITO_AUTH_DOMAIN_DEV` - Dev auth domain
- `COGNITO_CUSTOM_DOMAIN_ARN` - Certificate for custom domain (us-east-1)
- `COGNITO_CUSTOM_DOMAIN_NAME` - Custom domain name (auth.yourpace.cloud)
- `COGNITO_CLOUDFRONT_DOMAIN` - CloudFront domain for Cognito

**DNS:**
- `ROUTE53_HOSTED_ZONE_ID` - Route53 hosted zone ID

See [GITHUB_SECRETS.md](./GITHUB_SECRETS.md) for detailed configuration instructions.

## Workflow Files

### `.github/workflows/deploy-infrastructure.yml`
Main infrastructure and frontend deployment workflow:
- Detects environment from branch (develop→dev, staging→staging, main→prod)
- Builds frontend and infrastructure
- Checks for destructive changes
- Deploys CDK stacks with environment-specific context
- Verifies deployment with curl checks

**Triggers:**
- Push to `main`, `staging`, or `develop` branches (infrastructure changes)
- Manual workflow dispatch with environment selection

### `.github/workflows/amplify-deploy.yml`
Frontend deployment via AWS Amplify (if configured):
- Builds Next.js frontend
- Deploys to CloudFront
- Invalidates cache

## Common Tasks

### Deploy to Development
```bash
git checkout develop
git pull origin develop
# Make changes
git push origin feature-branch
# Create PR to develop
# After merge, automatically deploys to dev.yourpace.cloud
```

### Deploy to Staging
```bash
# Merge develop → staging
git checkout staging
git pull origin develop
git push origin staging
# After merge, automatically deploys to staging.yourpace.cloud
```

### Deploy to Production
```bash
# Merge staging → main
git checkout main
git pull origin staging
git push origin main
# After merge, automatically deploys to yourpace.cloud
# If infrastructure changed, requires manual approval
```

### Manual Infrastructure Deployment
```bash
cd infrastructure
npm install
npm run build

# Deploy to specific environment
npx cdk deploy --all \
  -c account=<ACCOUNT_ID> \
  -c env=prod \
  -c region=eu-west-1 \
  -c domainName=yourpace.cloud \
  -c hostedZoneId=<ZONE_ID> \
  -c cloudfrontCertificateArn=<CERT_ARN>
```

### Setup Cognito Custom Domain (Production Only)
```bash
./scripts/setup-cognito-custom-domain.sh
```

See [COGNITO_CUSTOM_DOMAIN_SETUP.md](./COGNITO_CUSTOM_DOMAIN_SETUP.md) for details.

## Troubleshooting

### Deployment Fails
1. Check GitHub Actions logs for error messages
2. Verify all GitHub secrets are configured
3. Check AWS CloudFormation events in AWS console
4. Verify AWS credentials and permissions

### Frontend Build Fails
1. Check Node.js version: `node --version` (should be 20+)
2. Verify frontend builds locally: `cd frontend && npm run build`
3. Check for missing dependencies: `npm ci`

### Domain Not Accessible
1. Verify DNS records in Route53
2. Check CloudFront distribution status
3. Verify S3 bucket has correct content
4. Check CloudFront cache invalidation

### Cognito Custom Domain Not Working
1. Check domain status: `aws cognito-idp describe-user-pool-domain --domain auth.yourpace.cloud --region eu-west-1`
2. Verify DNS CNAME record exists
3. Wait for provisioning (5-10 minutes)
4. See [COGNITO_CUSTOM_DOMAIN_SETUP.md](./COGNITO_CUSTOM_DOMAIN_SETUP.md)

## Setup Time Estimate

| Phase | Time |
|-------|------|
| AWS OIDC Setup | 10 min |
| GitHub Secrets | 5 min |
| CloudFront Certificates | 15 min |
| Infrastructure Deployment | 30 min |
| Cognito Custom Domain | 15 min |
| DNS Configuration | 10 min |
| Testing & Verification | 15 min |
| **Total** | **~90 minutes** |

## Support & Resources

### Documentation
- Root README: [`../README.md`](../README.md)
- Setup Guide: [`SETUP.md`](./SETUP.md)
- GitHub Secrets: [`GITHUB_SECRETS.md`](./GITHUB_SECRETS.md)
- Deployment Guide: [`DEPLOYMENT_GUIDE.md`](./DEPLOYMENT_GUIDE.md)

### External Resources
- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Next.js Documentation](https://nextjs.org/docs)
- [AWS Cognito Documentation](https://docs.aws.amazon.com/cognito/)

### Getting Help
1. Check the relevant documentation file
2. Review GitHub Actions logs for error messages
3. Check AWS CloudFormation events
4. Check Amplify build logs
5. Review AWS CloudTrail for API calls

## Last Updated

February 20, 2026

---

**Repository**: https://github.com/DigiAye/yourpace  
**Status**: ✅ Production Ready
