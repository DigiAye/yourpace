#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import { YourPaceStack } from '../lib/yourpace-stack';
import { CertificateStack } from '../lib/certificate-stack';
import { AmplifyStack } from '../lib/amplify-stack';

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

// OPTIONAL: Amplify configuration (only for Amplify deployment)
const githubOwner = app.node.tryGetContext('githubOwner');
const githubRepo = app.node.tryGetContext('githubRepo');
const githubToken = app.node.tryGetContext('githubToken') || process.env.GITHUB_TOKEN;

// Validate GitHub config if provided
if ((githubOwner || githubRepo || githubToken) && (!githubOwner || !githubRepo || !githubToken)) {
  throw new Error(
    '❌ GitHub configuration incomplete!\n' +
    'If deploying Amplify, provide all three:\n' +
    '  -c githubOwner=<OWNER>\n' +
    '  -c githubRepo=<REPO>\n' +
    '  -c githubToken=<TOKEN> or GITHUB_TOKEN env var'
  );
}

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
// Amplify Stack (NEW - only if GitHub config provided)
// ============================================
let amplifyStack: AmplifyStack | undefined;
if (githubOwner && githubRepo && githubToken) {
  amplifyStack = new AmplifyStack(app, `YourPaceAmplifyStack-${env}`, {
    env: {
      account,
      region,
    },
    githubOwner,
    githubRepo,
    githubToken,
    description: `YourPace Amplify App - ${env} environment`,
    tags: {
      Project: 'yourpace',
      Environment: env,
      ManagedBy: 'cdk',
    },
  });
  console.log('✅ Amplify Stack will be deployed');
} else {
  console.log('⏭️  Skipping Amplify Stack (GitHub config not provided)');
}

// ============================================
// Certificate Stack (us-east-1)
// ============================================
// ACM certificates for CloudFront MUST be in us-east-1
// Only created when a domain name is provided
let certificateStack: CertificateStack | undefined;

if (domainName) {
  certificateStack = new CertificateStack(app, `YourPaceCertificateStack-${env}`, {
    domainName,
    hostedZoneId,
    environment: env,
  } as any);
  console.log('✅ CertificateStack will be deployed');
} else {
  console.log('⏭️  Skipping CertificateStack (domain not provided)');
}

// ============================================
// Main Infrastructure Stack (eu-west-1)
// ============================================
// SAFETY: Stack name matches existing deployment
// Certificate handling: Only use if BOTH domain AND certificate exist
// This prevents CloudFront from failing if certificate isn't ready
let certificate: acm.ICertificate | undefined;
if (domainName && certificateStack) {
  try {
    // Import the certificate from CertificateStack by ARN
    certificate = acm.Certificate.fromCertificateArn(
      app,
      'ImportedCertificate',
      certificateStack.certificate.certificateArn
    );
    console.log(`✅ Certificate imported: ${certificateStack.certificate.certificateArn}`);
  } catch (e) {
    console.log(`⚠️  Could not import certificate, CloudFront will deploy without custom domain`);
    certificate = undefined;
  }
}

const mainStack = new YourPaceStack(app, stackName, {
  environment: env,
  domainName: certificate ? domainName : undefined, // Only use domain if certificate is available
  hostedZoneId: certificate ? hostedZoneId : undefined,
  certificate,
  certificateArn, // Pass us-east-1 certificate ARN for Cognito
} as any);

// Add explicit dependency: YourPaceStack must wait for CertificateStack
if (certificateStack) {
  (mainStack as cdk.Stack).addDependency(certificateStack as unknown as cdk.Stack);
}

console.log('✅ YourPaceStack will be deployed/updated');
if (certificate && domainName) {
  console.log(`   Domain: ${domainName}`);
}

// ============================================
// Global tags applied to all resources
// ============================================
cdk.Tags.of(app).add('Project', 'yourpace');
cdk.Tags.of(app).add('Environment', env);
cdk.Tags.of(app).add('ManagedBy', 'cdk');

app.synth();
