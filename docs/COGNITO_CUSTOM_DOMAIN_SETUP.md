# Cognito Custom Domain Setup (auth.yourpace.cloud)

## Overview

This document describes the manual setup process for configuring a custom Cognito domain for the YourPace application. This is a **production-only** feature. Dev and staging environments use the default AWS-managed Cognito domains.

## Status

✅ **COMPLETED** - Custom Cognito domain is now configured and provisioning

- Custom Domain: `auth.yourpace.cloud`
- Environment: Production only
- Dev/Staging: Use default AWS-managed domains

## Why Manual Setup?

AWS CDK has limitations with Cognito custom domains:
1. **Certificate Region**: Cognito custom domains require a certificate in **us-east-1**, not the application region (eu-west-1)
2. **DNS Dependency**: The DNS CNAME record must exist before creating the custom domain
3. **Provisioning Time**: Takes 5-10 minutes after creation

Therefore, we perform this setup manually via CLI after the initial CDK deployment.

## Prerequisites

- AWS CLI configured with appropriate AWS profile
- Cognito certificate in us-east-1 (created by CDK)
- Route53 hosted zone for your domain
- User Pool ID (from CDK outputs)
- Hosted Zone ID (from CDK outputs)

## Manual Setup Steps

### Step 1: Get the Cognito Certificate ARN (us-east-1)

```bash
aws acm list-certificates \
  --region us-east-1 \
  --profile <your-profile> \
  --query 'CertificateSummaryList[?DomainName==`yourpace.cloud`].CertificateArn' \
  --output text
```

**Save this ARN** - you'll need it in the next step.

### Step 2: Create Cognito Custom Domain

```bash
aws cognito-idp create-user-pool-domain \
  --domain auth.yourpace.cloud \
  --user-pool-id <USER_POOL_ID> \
  --custom-domain-config CertificateArn=<CERTIFICATE_ARN> \
  --region eu-west-1 \
  --profile <your-profile>
```

**Expected Output:**
```json
{
    "ManagedLoginVersion": 1,
    "CloudFrontDomain": "d1ztvpf3w1laey.cloudfront.net"
}
```

**Save the CloudFrontDomain value** - you'll need it in the next step.

### Step 3: Create Route53 CNAME Record

```bash
aws route53 change-resource-record-sets \
  --hosted-zone-id <HOSTED_ZONE_ID> \
  --change-batch '{
    "Changes": [{
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "auth.yourpace.cloud",
        "Type": "CNAME",
        "TTL": 300,
        "ResourceRecords": [{"Value": "<CLOUDFRONT_DOMAIN>"}]
      }
    }]
  }' \
  --region eu-west-1 \
  --profile <your-profile>
```

Replace:
- `<HOSTED_ZONE_ID>` - Your Route53 hosted zone ID
- `<CLOUDFRONT_DOMAIN>` - The CloudFront domain from Step 2

**Expected Output:**
```json
{
    "ChangeInfo": {
        "Id": "/change/...",
        "Status": "PENDING",
        "SubmittedAt": "..."
    }
}
```

### Step 4: Wait for Provisioning

The Cognito domain takes 5-10 minutes to fully provision. Check the status:

```bash
aws cognito-idp describe-user-pool-domain \
  --domain auth.yourpace.cloud \
  --region eu-west-1 \
  --profile <your-profile> \
  --query 'DomainDescription.Status' \
  --output text
```

**Status Progression:**
- `CREATING` - Domain is being set up (5-10 minutes)
- `ACTIVE` - Domain is ready to use ✅

### Step 5: Verify the Domain

Once status is `ACTIVE`, test the domain:

```bash
curl -I https://auth.yourpace.cloud/login
```

**Expected Output:**
```
HTTP/2 200
```

## Environment Variables & Secrets

The following GitHub secrets have been configured for CI/CD:

```
COGNITO_CUSTOM_DOMAIN_ARN          # us-east-1 certificate ARN
COGNITO_CUSTOM_DOMAIN_NAME         # auth.yourpace.cloud
COGNITO_CLOUDFRONT_DOMAIN          # CloudFront domain from Step 2
```

These are used by CI/CD pipelines to automate future deployments.

## Dev & Staging Environments

Dev and staging environments use the default AWS-managed Cognito domains:

- **Dev**: `yourpace-dev.auth.eu-west-1.amazoncognito.com`
- **Staging**: `yourpace-staging.auth.eu-west-1.amazoncognito.com`

These work perfectly fine for non-production environments and don't require custom domain setup.

## Troubleshooting

### Domain Creation Fails with "Invalid request provided"

**Cause**: Certificate is in the wrong region (must be us-east-1)

**Solution**: Verify you're using the us-east-1 certificate ARN, not eu-west-1

### CNAME Record Creation Fails with "CNAME loop"

**Cause**: Trying to create a CNAME record pointing to itself

**Solution**: Ensure the CNAME value is the CloudFront domain from Step 2, not `auth.yourpace.cloud`

### Domain Status Stuck on "CREATING"

**Cause**: DNS propagation delay or certificate validation issue

**Solution**: Wait 10-15 minutes and check again. If still stuck, verify:
1. Certificate is valid and not expired
2. DNS CNAME record is correctly configured
3. CloudFront domain is accessible

### Cannot Access auth.yourpace.cloud

**Cause**: DNS not yet propagated or domain still provisioning

**Solution**:
1. Check domain status: `aws cognito-idp describe-user-pool-domain --domain auth.yourpace.cloud --region eu-west-1 --profile <your-profile>`
2. Verify DNS resolution: `nslookup auth.yourpace.cloud`
3. Wait for status to change to `ACTIVE`

## Related Documentation

- [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) - Full deployment instructions
- [GITHUB_SECRETS.md](./GITHUB_SECRETS.md) - All GitHub secrets reference
- [COGNITO_MANAGED_LOGIN_GUIDE.md](./COGNITO_MANAGED_LOGIN_GUIDE.md) - Cognito setup overview

## References

- [AWS Cognito Custom Domains](https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-custom-domain.html)
- [AWS CDK Cognito Documentation](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cognito-readme.html)
