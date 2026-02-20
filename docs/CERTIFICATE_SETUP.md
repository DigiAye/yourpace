# Certificate Setup Guide

## Overview

YourPace uses AWS ACM (Certificate Manager) for SSL/TLS certificates. The certificate ARN is passed to the CDK deployment via GitHub Secrets, allowing CloudFront to use a custom domain.

## Initial Setup (One-Time)

### 1. Get Certificate ARN from AWS

```bash
# List all certificates in us-east-1
aws acm list-certificates --region us-east-1 --profile yourpace-prod

# Get details of a specific certificate
aws acm describe-certificate \
  --certificate-arn arn:aws:acm:us-east-1:ACCOUNT_ID:certificate/CERT_ID \
  --region us-east-1 \
  --profile yourpace-prod
```

Look for the certificate with:
- **Domain**: yourpace.cloud
- **Status**: ISSUED
- **SANs**: *.yourpace.cloud

### 2. Add Certificate ARN to GitHub Secrets

1. Go to GitHub repository settings
2. Navigate to **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Name: `CERTIFICATE_ARN`
5. Value: `arn:aws:acm:us-east-1:ACCOUNT_ID:certificate/CERT_ID`
6. Click **Add secret**

## Deployment Flow

### First Deploy (Without Certificate)
If `CERTIFICATE_ARN` secret is not set:
- CloudFront deploys **without custom domain**
- Site is accessible via CloudFront URL (e.g., `d35w96sqy7xdro.cloudfront.net`)
- No certificate errors

### Second Deploy (With Certificate)
Once `CERTIFICATE_ARN` is added to GitHub Secrets:
- CloudFront updates to use custom domain
- Site is accessible via `yourpace.cloud` and `www.yourpace.cloud`
- Automatic DNS validation via Route53

## How It Works

### Code Flow

**`infrastructure/bin/yourpace.ts`:**
```typescript
// Get certificate ARN from context or environment
const certificateArn = app.node.tryGetContext('certificateArn') || process.env.CERTIFICATE_ARN;

// If provided, import the certificate
let certificate: acm.ICertificate | undefined;
if (domainName && certificateArn) {
  certificate = acm.Certificate.fromCertificateArn(
    app,
    'ImportedCertificate',
    certificateArn
  );
}

// Only use domain if certificate is available
const mainStack = new YourPaceStack(app, expectedStackName, {
  environment: env,
  domainName: certificate ? domainName : undefined,
  hostedZoneId: certificate ? hostedZoneId : undefined,
  certificate,
} as any);
```

**`.github/workflows/deploy-infrastructure.yml`:**
```bash
# Add certificate ARN if available
if [ -n "${{ secrets.CERTIFICATE_ARN }}" ]; then
  CDK_ARGS="$CDK_ARGS -c certificateArn=${{ secrets.CERTIFICATE_ARN }}"
  echo "✅ Certificate ARN provided - CloudFront will use custom domain"
else
  echo "⏭️  Certificate ARN not provided - CloudFront will deploy without custom domain"
fi
```

## Updating Certificate

### When Certificate Expires

1. Create new certificate in AWS ACM (us-east-1)
2. Update GitHub Secret `CERTIFICATE_ARN` with new ARN
3. Push to main branch (or manually trigger workflow)
4. CloudFront automatically updates to use new certificate

### When Changing Domain

1. Create new certificate in AWS ACM for new domain
2. Update GitHub Secrets:
   - `DOMAIN_NAME`: new domain
   - `CERTIFICATE_ARN`: new certificate ARN
3. Push to main branch
4. Infrastructure updates with new domain and certificate

## Troubleshooting

### Certificate Not Found Error
```
"The specified SSL certificate doesn't exist, isn't in us-east-1 region, isn't valid"
```

**Solutions:**
1. Verify certificate ARN is correct: `aws acm describe-certificate --certificate-arn <ARN> --region us-east-1`
2. Ensure certificate is in **us-east-1** (CloudFront requirement)
3. Ensure certificate status is **ISSUED**
4. Check GitHub Secret `CERTIFICATE_ARN` is set correctly

### CloudFront Deploying Without Custom Domain
This is **normal and expected** if `CERTIFICATE_ARN` secret is not set. The site will:
- Deploy successfully
- Be accessible via CloudFront URL
- Update to use custom domain once certificate ARN is added

## Manual Deployment

To deploy locally with certificate ARN:

```bash
cd infrastructure

# Get certificate ARN
CERT_ARN=$(aws acm list-certificates --region us-east-1 --profile yourpace-prod \
  --query 'CertificateSummaryList[?DomainName==`yourpace.cloud`].CertificateArn' \
  --output text)

# Deploy with certificate
npx cdk deploy --all \
  -c account=ACCOUNT_ID \
  -c env=prod \
  -c region=eu-west-1 \
  -c domainName=yourpace.cloud \
  -c hostedZoneId=ZONE_ID \
  -c certificateArn=$CERT_ARN
```

## Security Notes

- Certificate ARN is stored in GitHub Secrets (encrypted)
- Only GitHub Actions workflow can access the secret
- Certificate is never committed to git
- Each environment (dev/staging/prod) can have different certificates
