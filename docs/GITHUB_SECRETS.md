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
| Secret Name | Description |
|------------|-------------|
| `COGNITO_USER_POOL_ID` | Cognito User Pool ID |
| `COGNITO_USER_POOL_CLIENT_ID` | Cognito App Client ID |
| `COGNITO_AUTH_DOMAIN_PROD` | Cognito auth domain (production) |
| `COGNITO_AUTH_DOMAIN_STAGING` | Cognito auth domain (staging) |
| `COGNITO_AUTH_DOMAIN_DEV` | Cognito auth domain (dev) |
| `COGNITO_CUSTOM_DOMAIN_ARN` | ACM certificate ARN (us-east-1) for Cognito custom domain |
| `COGNITO_CUSTOM_DOMAIN_NAME` | Custom Cognito domain name (e.g., auth.yourpace.cloud) |
| `COGNITO_CLOUDFRONT_DOMAIN` | CloudFront domain for Cognito custom domain |

### Amplify
| Secret Name | Description |
|------------|-------------|
| `AMPLIFY_APP_ID` | Amplify App ID (single app with multiple branches) |
| `AMPLIFY_WEBHOOK_MAIN` | Amplify webhook for main branch |
| `AMPLIFY_WEBHOOK_STAGING` | Amplify webhook for staging branch |
| `AMPLIFY_WEBHOOK_DEVELOP` | Amplify webhook for develop branch |

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

## Security Notes

- Never commit secrets to the repository
- Rotate webhook URLs periodically
- Use GitHub's secret scanning to prevent accidental commits
- Monitor GitHub Actions logs for secret exposure
- Restrict secret access to necessary workflows only
