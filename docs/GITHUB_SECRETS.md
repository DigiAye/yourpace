# GitHub Secrets Configuration

Add these secrets to your GitHub repository: Settings → Secrets and variables → Actions

## Required Secrets

### AWS & Infrastructure
| Secret Name | Description | Example |
|------------|-------------|---------|
| `AWS_ACCOUNT_ID` | Your AWS account ID | `123456789012` |
| `AWS_REGION` | AWS region for deployments | `eu-west-1` |
| `AWS_REGION_US_EAST_1` | US East region (for CloudFront certs) | `us-east-1` |
| `AWS_DEPLOY_ROLE_ARN` | IAM role ARN for GitHub Actions | `arn:aws:iam::123456789012:role/github-actions-yourpace-deploy` |
| `DOMAIN_NAME` | Your domain name | `yourpace.cloud` |
| `HOSTED_ZONE_ID` | Route53 hosted zone ID | `Z1234567890ABC` |
| `ROUTE53_HOSTED_ZONE_ID` | Route53 hosted zone ID (alternative) | `Z1234567890ABC` |

### CloudFront & Certificates
| Secret Name | Description |
|------------|-------------|
| `CLOUDFRONT_CERTIFICATE_ARN` | ACM certificate ARN (us-east-1) for CloudFront |
| `AWS_CLOUDFRONT_DISTRIBUTION_ID_PROD` | CloudFront distribution ID (production) |
| `AWS_CLOUDFRONT_DISTRIBUTION_ID_STAGING` | CloudFront distribution ID (staging) |
| `AWS_CLOUDFRONT_DISTRIBUTION_ID_DEV` | CloudFront distribution ID (dev) |

### Cognito Authentication
| Secret Name | Description | Used By |
|------------|-------------|---------|
| `COGNITO_REGION` | AWS region for Cognito (e.g., eu-west-1) | Amplify build (NEXT_PUBLIC_COGNITO_REGION) |
| `COGNITO_USER_POOL_ID` | Cognito User Pool ID | Infrastructure deployment |
| `COGNITO_USER_POOL_CLIENT_ID` | Cognito App Client ID | **Amplify build (NEXT_PUBLIC_COGNITO_CLIENT_ID)** ⚠️ CRITICAL |
| `COGNITO_AUTH_DOMAIN_PROD` | Cognito auth domain (production) | **Amplify build (NEXT_PUBLIC_COGNITO_DOMAIN)** ⚠️ CRITICAL |
| `COGNITO_AUTH_DOMAIN_STAGING` | Cognito auth domain (staging) | Amplify build (staging branch) |
| `COGNITO_AUTH_DOMAIN_DEV` | Cognito auth domain (dev) | Amplify build (develop branch) |
| `COGNITO_CUSTOM_DOMAIN_ARN` | ACM certificate ARN (us-east-1) for Cognito custom domain | Infrastructure deployment |
| `COGNITO_CUSTOM_DOMAIN_NAME` | Custom Cognito domain name (e.g., auth.yourpace.cloud) | Infrastructure deployment |
| `COGNITO_CLOUDFRONT_DOMAIN` | CloudFront domain for Cognito custom domain | Infrastructure deployment |

### Amplify
| Secret Name | Description | Used By |
|------------|-------------|---------|
| `AMPLIFY_APP_ID` | Amplify App ID (single app with multiple branches) | Infrastructure deployment |
| `AMPLIFY_WEBHOOK_MAIN` | Amplify webhook for main branch | GitHub Actions (amplify-deploy.yml) |
| `AMPLIFY_WEBHOOK_STAGING` | Amplify webhook for staging branch | GitHub Actions (amplify-deploy.yml) |
| `AMPLIFY_WEBHOOK_DEVELOP` | Amplify webhook for develop branch | GitHub Actions (amplify-deploy.yml) |

### Frontend Build Environment Variables
These secrets are used by Amplify during the Next.js build to inject environment variables:

| Secret Name | Maps To | Description |
|------------|---------|-------------|
| `COGNITO_REGION` | `NEXT_PUBLIC_COGNITO_REGION` | Cognito region for OIDC |
| `COGNITO_USER_POOL_CLIENT_ID` | `NEXT_PUBLIC_COGNITO_CLIENT_ID` | **CRITICAL: Required for OIDC sign-in** |
| `COGNITO_AUTH_DOMAIN_PROD` | `NEXT_PUBLIC_COGNITO_DOMAIN` | **CRITICAL: Required for OIDC sign-in** |
| `APP_URL` | `NEXT_PUBLIC_APP_URL` | Frontend application URL |
| `AWS_CLOUDFRONT_DISTRIBUTION_ID_PROD` | `NEXT_PUBLIC_CLOUDFRONT_DISTRIBUTION_ID` | CloudFront distribution ID |
| `CLOUDFRONT_DOMAIN_PROD` | `NEXT_PUBLIC_CLOUDFRONT_DOMAIN` | CloudFront domain |
| `AWS_REGION` | `NEXT_PUBLIC_AWS_REGION` | AWS region |
| `AWS_ACCOUNT_ID` | `NEXT_PUBLIC_AWS_ACCOUNT_ID` | AWS account ID |
| `DYNAMODB_USERS_TABLE` | `NEXT_PUBLIC_USERS_TABLE` | DynamoDB users table name |
| `DYNAMODB_WORKOUTS_TABLE` | `NEXT_PUBLIC_WORKOUTS_TABLE` | DynamoDB workouts table name |
| `DYNAMODB_EXERCISES_TABLE` | `NEXT_PUBLIC_EXERCISES_TABLE` | DynamoDB exercises table name |
| `DYNAMODB_GOALS_TABLE` | `NEXT_PUBLIC_GOALS_TABLE` | DynamoDB goals table name |
| `S3_ASSETS_BUCKET` | `NEXT_PUBLIC_ASSETS_BUCKET` | S3 assets bucket name |
| `S3_FRONTEND_BUCKET` | `NEXT_PUBLIC_FRONTEND_BUCKET` | S3 frontend bucket name |
| `VPC_ID` | `NEXT_PUBLIC_VPC_ID` | VPC ID |
| `LAMBDA_SECURITY_GROUP_ID` | `NEXT_PUBLIC_LAMBDA_SECURITY_GROUP_ID` | Lambda security group ID |
| `HOSTED_ZONE_ID` | `NEXT_PUBLIC_HOSTED_ZONE_ID` | Route53 hosted zone ID |

## How to Add Secrets

1. Go to your GitHub repository
2. Click Settings → Secrets and variables → Actions
3. Click "New repository secret"
4. Enter the secret name and value
5. Click "Add secret"

## Getting Secret Values

### AWS_ACCOUNT_ID
```bash
aws sts get-caller-identity --query Account --output text
```

### AWS_REGION
Use the region where your infrastructure is deployed (e.g., `eu-west-1`)

### AWS_DEPLOY_ROLE_ARN
After creating the IAM role for GitHub Actions:
```bash
aws iam get-role \
  --role-name github-actions-yourpace-deploy \
  --query 'Role.Arn' \
  --output text
```

### DOMAIN_NAME
Your domain name (e.g., `yourpace.cloud`)

### HOSTED_ZONE_ID
Get from Route53 console or:
```bash
aws route53 list-hosted-zones-by-name \
  --dns-name yourpace.cloud \
  --query 'HostedZones[0].Id' \
  --output text | cut -d'/' -f3
```

### AMPLIFY_WEBHOOK_* URLs
1. Go to AWS Amplify console
2. Select your app
3. Go to App settings → Webhooks
4. Create a webhook for the branch
5. Copy the webhook URL

## Verification

To verify secrets are set correctly:

```bash
# List all secrets (names only, not values)
gh secret list
```

## Amplify Build Environment Variables

The `amplify.yml` file includes an `env` section that maps GitHub Secrets to Next.js environment variables during the build process. This is **critical** for OIDC authentication to work on the deployed site.

### How It Works

1. GitHub Secrets are stored securely in your repository settings
2. When Amplify builds the frontend, it reads the `env` section from `amplify.yml`
3. Amplify substitutes `$SECRET_NAME` with the actual secret value
4. Next.js build receives these as `NEXT_PUBLIC_*` environment variables
5. The frontend code can access them via `process.env.NEXT_PUBLIC_*`

### Critical Secrets for OIDC Authentication

These two secrets **MUST** be set for OIDC sign-in to work:

1. **`COGNITO_USER_POOL_CLIENT_ID`** → `NEXT_PUBLIC_COGNITO_CLIENT_ID`
   - Without this: `error: 'client_id'` in browser console
   - Get from: AWS Cognito console → User Pool → App clients

2. **`COGNITO_AUTH_DOMAIN_PROD`** → `NEXT_PUBLIC_COGNITO_DOMAIN`
   - Without this: `authority: 'https://undefined'` in browser console
   - Format: `yourpace-auth-prod.auth.eu-west-1.amazoncognito.com`
   - Get from: AWS Cognito console → User Pool → Domain name

### Troubleshooting OIDC Issues

If you see these errors in the browser console:
- `[OIDC] Initializing with config: {authority: 'https://undefined', client_id: '', ...}`
- `[OIDC Auth State Changed] {..., error: 'client_id'}`

**Solution:**
1. Verify `COGNITO_USER_POOL_CLIENT_ID` and `COGNITO_AUTH_DOMAIN_PROD` are set in GitHub Secrets
2. Check that `amplify.yml` has the `env` section with these mappings
3. Trigger a new Amplify build (push to main/staging/develop branch)
4. Wait for the build to complete and redeploy
5. Clear browser cache and reload the site

## Security Notes

- Never commit secrets to the repository
- Rotate webhook URLs periodically
- Use GitHub's secret scanning to prevent accidental commits
- Monitor GitHub Actions logs for secret exposure
- Restrict secret access to necessary workflows only
- **IMPORTANT:** The `NEXT_PUBLIC_*` variables are embedded in the frontend bundle and visible in the browser. Only use them for non-sensitive configuration (IDs, domains, URLs). Never put actual credentials or API keys in `NEXT_PUBLIC_*` variables.
