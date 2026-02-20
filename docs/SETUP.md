# YourPace CI/CD Setup Guide

Complete guide to set up GitHub Actions, AWS OIDC, and Amplify for YourPace.

## Quick Overview

YourPace uses a three-environment setup (dev, staging, production) with automated CI/CD:
- **CI Workflow** - Runs on all branches, builds frontend, triggers Amplify
- **Infrastructure Deployment** - Deploys CDK infrastructure on main branch
- **Promotion Workflow** - Creates promotion PRs between environments

## Prerequisites

- GitHub repository: `DigiAye/yourpace`
- AWS Account with appropriate permissions
- AWS CLI configured with SSO profiles
- Node.js 20+

## Setup Phases

### Phase 1: AWS OIDC Setup (10 minutes)

Create OIDC provider for GitHub Actions:

```bash
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
```

Create IAM role trust policy (`trust-policy.json`):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::AWS_ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:DigiAye/yourpace:*"
        }
      }
    }
  ]
}
```

Replace `AWS_ACCOUNT_ID` with your actual AWS account ID (see `GITHUB_SECRETS.md` for how to retrieve it).

Create the role:

```bash
aws iam create-role \
  --role-name github-actions-yourpace-deploy \
  --assume-role-policy-document file://trust-policy.json
```

Attach permissions:

```bash
aws iam attach-role-policy \
  --role-name github-actions-yourpace-deploy \
  --policy-arn arn:aws:iam::aws:policy/AdministratorAccess
```

Get the role ARN:

```bash
aws iam get-role \
  --role-name github-actions-yourpace-deploy \
  --query 'Role.Arn' \
  --output text
```

### Phase 2: GitHub Secrets (5 minutes)

Add these secrets to GitHub repository settings → Secrets and variables → Actions:

| Secret | Description |
|--------|-------------|
| `AWS_ACCOUNT_ID` | Your AWS account ID |
| `AWS_DEPLOY_ROLE_ARN` | ARN from Phase 1 |
| `AWS_REGION` | AWS region (e.g., eu-west-1) |
| `DOMAIN_NAME` | Your domain (e.g., yourpace.cloud) |
| `HOSTED_ZONE_ID` | Route53 hosted zone ID |
| `AMPLIFY_WEBHOOK_MAIN` | Webhook URL for main branch |
| `AMPLIFY_WEBHOOK_STAGING` | Webhook URL for staging branch |
| `AMPLIFY_WEBHOOK_DEVELOP` | Webhook URL for develop branch |

### Phase 3: Amplify Apps (15 minutes)

Create three separate Amplify apps in AWS Amplify console:

**For each app:**
1. Connect to GitHub repository: `DigiAye/yourpace`
2. Select the appropriate branch (main, staging, or develop)
3. Configure build settings:
   - Build command: `cd frontend && npm ci && npm run build`
   - Output directory: `frontend/out`
4. Add environment variables (see Amplify configuration below)
5. Configure custom domain
6. Create webhook and add URL to GitHub secrets

**Environment Variables for Each App:**

Replace `{COGNITO_CLIENT_ID}` with the actual client ID from CDK outputs.

```
NEXT_PUBLIC_COGNITO_DOMAIN=auth-{env}.yourpace.cloud
NEXT_PUBLIC_COGNITO_CLIENT_ID={COGNITO_CLIENT_ID}
NEXT_PUBLIC_COGNITO_REGION=eu-west-1
NEXT_PUBLIC_API_URL=https://api-{env}.yourpace.cloud
```

### Phase 4: Git Branches (5 minutes)

```bash
cd /Users/joemorrison/workspace/yourpace

# Create and push branches
git checkout -b develop
git push -u origin develop

git checkout -b staging
git push -u origin staging

git checkout main
git push -u origin main
```

### Phase 5: Branch Protection Rules (5 minutes)

Go to GitHub Repository → Settings → Branches

- **main**: Require PR reviews, require status checks, require up-to-date branches
- **staging**: Require PR reviews, require status checks
- **develop**: Require status checks (optional)

### Phase 6: Testing (15 minutes)

**Test CI Workflow:**
```bash
git checkout develop
echo "# Test" >> README.md
git add README.md
git commit -m "test: trigger CI workflow"
git push origin develop
```

Check GitHub Actions tab to verify workflow runs and Amplify build triggers.

**Test Promotion Workflow:**
1. Go to GitHub Actions → Promote workflow
2. Select "develop → staging"
3. Verify PR is created and merge it
4. Verify CI workflow runs and Amplify builds

**Test Infrastructure Deployment:**
1. Make a test change to infrastructure
2. Push to main
3. Verify infrastructure deployment workflow runs

### Phase 7: Infrastructure Multi-Environment Support (30 minutes)

Update CDK to support dev/staging/prod environments. See `infrastructure/README.md` for details.

### Phase 8: Documentation & Handoff (10 minutes)

- Share setup guide with team
- Document any custom configurations
- Set up monitoring and notifications

## Deployment Flow

```
develop → CI → Amplify → dev.yourpace.cloud
   ↓
Promote to staging → CI → Amplify → staging.yourpace.cloud
   ↓
Promote to main → CI → Amplify → yourpace.cloud
                → Infrastructure Deployment (if infra changed)
```

## Environment URLs

| Environment | URL | Branch |
|-------------|-----|--------|
| Development | https://dev.yourpace.cloud | develop |
| Staging | https://staging.yourpace.cloud | staging |
| Production | https://yourpace.cloud | main |

## Troubleshooting

**OIDC provider not found:**
- Verify OIDC provider exists: `aws iam list-open-id-connect-providers`
- Check role trust policy: `aws iam get-role --role-name github-actions-yourpace-deploy`

**Amplify webhook not triggering:**
- Verify webhook URL in GitHub secrets
- Check Amplify app webhook settings
- Test webhook manually: `curl -X POST <WEBHOOK_URL> -H "Content-Type: application/json" -d '{}'`

**Infrastructure deployment fails:**
- Check CloudFormation events in AWS console
- Verify context variables are passed correctly
- Check IAM role has necessary permissions

**Build fails:**
- Check Amplify build logs in AWS Amplify console
- Verify environment variables are set correctly
- Check frontend build locally: `cd frontend && npm run build`

## Security Best Practices

✅ Use OIDC for AWS authentication (no long-lived credentials)  
✅ Store sensitive values in GitHub secrets  
✅ Require approvals for destructive changes  
✅ Use branch protection rules  
✅ Monitor GitHub Actions and AWS CloudTrail logs  
✅ Rotate Amplify webhook URLs regularly  

## Support

For detailed information:
- See `.github/workflows/` for workflow definitions
- See `infrastructure/README.md` for infrastructure details
- Check GitHub Actions logs for error messages
- Check AWS CloudFormation events for infrastructure errors
