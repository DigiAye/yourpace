#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { YourPaceStack } from '../lib/yourpace-stack';
import { AmplifyStack } from '../lib/amplify-stack';
import { CloudFrontCertificateStack } from '../lib/cloudfront-certificate-stack';

const app = new cdk.App();

// ============================================
// Configuration from CDK context
// ============================================
// ============================================
// SAFETY: All configuration from context/env
// NO hardcoded values allowed
// ============================================

// REQUIRED: Account ID (prevents cross-account deployments)
const account = app.node.tryGetContext('account');
if (!account) {
  throw new Error(
    '❌ CRITICAL: AWS account ID is required!\n' +
    'This prevents accidental resource deletion in wrong account.\n\n' +
    'Provide via:\n' +
    '  cdk deploy -c account=<YOUR_ACCOUNT_ID>\n' +
    '  or AWS CLI profile: --profile yourpace-prod'
  );
}

// OPTIONAL: Region (safe default)
const region = app.node.tryGetContext('region') || 'eu-west-1';

// OPTIONAL: Environment (safe default) - used for resource naming, not stack naming
const env = app.node.tryGetContext('env') || 'dev';
if (!['dev', 'staging', 'prod'].includes(env)) {
  throw new Error(`Invalid environment: ${env}. Must be: dev, staging, or prod`);
}

// OPTIONAL: Domain configuration (only for custom domains)
const domainName = app.node.tryGetContext('domainName');
const hostedZoneId = app.node.tryGetContext('hostedZoneId');

// OPTIONAL: Certificate ARN (for CloudFront custom domain)
// Can be provided via: -c certificateArn=<ARN> or CERTIFICATE_ARN env var
const certificateArn = app.node.tryGetContext('certificateArn') || process.env.CERTIFICATE_ARN;

// OPTIONAL: Cognito Certificate ARN (for Cognito custom domain in eu-west-1)
// Can be provided via: -c cognitoCertificateArn=<ARN> or COGNITO_CERTIFICATE_ARN env var
const cognitoCertificateArn = app.node.tryGetContext('cognitoCertificateArn') || process.env.COGNITO_CERTIFICATE_ARN;

// NOTE: Amplify no longer requires GitHub credentials
// Builds are triggered via webhooks from GitHub Actions CI workflow

// ============================================
// Stack Name (Single name, environment via context)
// ============================================
// Following DigiAye pattern: single stack name, environment controlled via -c env parameter
const stackName = 'YourPaceStack';
console.log(`\n📋 Stack Name: ${stackName}`);
console.log(`   Account: ${account}`);
console.log(`   Region: ${region}`);
console.log(`   Environment: ${env}\n`);

// ============================================
// Amplify Stack (Webhook-based builds)
// ============================================
const amplifyStack = new AmplifyStack(app, `YourPaceAmplifyStack-${env}`, {
  env: {
    account,
    region,
  },
  description: `YourPace Amplify App - ${env} environment`,
  tags: {
    Project: 'yourpace',
    Environment: env,
    ManagedBy: 'cdk',
  },
});
console.log('✅ Amplify Stack will be deployed (webhook-based builds)');
console.log('   Branches: main (PRODUCTION), staging (BETA), develop (DEVELOPMENT)');
console.log('   Next: Connect GitHub repo via Amplify Console (one-time setup)');

// ============================================
// CloudFront Certificate Stack (us-east-1) - OPTIONAL
// ============================================
// CloudFront REQUIRES certificates in us-east-1
// Deploy separately if needed: npx cdk deploy YourPaceCloudFrontCertificateStack-prod --profile yourpace-prod
// Then capture the certificate ARN and pass via: -c cloudfrontCertificateArn=<ARN>
const deployCloudFrontCertStack = app.node.tryGetContext('deployCloudFrontCertStack') === 'true';
let cloudfrontCertificateStack: CloudFrontCertificateStack | undefined;

if (deployCloudFrontCertStack && domainName && hostedZoneId) {
  cloudfrontCertificateStack = new CloudFrontCertificateStack(app, `YourPaceCloudFrontCertificateStack-${env}`, {
    env: {
      account,
      region: 'us-east-1',
    },
    domainName,
    hostedZoneId,
  });
  console.log('✅ CloudFrontCertificateStack will be deployed (us-east-1)');
  console.log('   After deployment, capture the certificate ARN and pass via:');
  console.log('   -c cloudfrontCertificateArn=<ARN>');
} else if (domainName && hostedZoneId) {
  console.log('⏭️  Skipping CloudFrontCertificateStack (use -c deployCloudFrontCertStack=true to deploy)');
}

// ============================================
// Main Infrastructure Stack (eu-west-1)
// ============================================
// Get CloudFront certificate ARN from context (passed via -c cloudfrontCertificateArn=<ARN>)
const cloudfrontCertificateArn = app.node.tryGetContext('cloudfrontCertificateArn') || process.env.CLOUDFRONT_CERTIFICATE_ARN;

const mainStack = new YourPaceStack(app, stackName, {
  env: {
    account,
    region,
  },
  environment: env,
  domainName,
  hostedZoneId,
  cloudfrontCertificateArn,
} as any);

console.log('✅ YourPaceStack will be deployed/updated');
if (domainName) {
  console.log(`   Domain: ${domainName}`);
}

// ============================================
// Global tags applied to all resources
// ============================================
cdk.Tags.of(app).add('Project', 'yourpace');
cdk.Tags.of(app).add('Environment', env);
cdk.Tags.of(app).add('ManagedBy', 'cdk');

app.synth();
