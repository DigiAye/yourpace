#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { YourPaceStack } from '../lib/yourpace-stack';
import { CertificateStack } from '../lib/certificate-stack';

const app = new cdk.App();

// ============================================
// Configuration from CDK context
// ============================================
const account = app.node.tryGetContext('account') || process.env.CDK_DEFAULT_ACCOUNT;
const region = app.node.tryGetContext('region') || process.env.CDK_DEFAULT_REGION || 'eu-west-1';
const env = app.node.tryGetContext('env') || 'dev'; // dev | staging | prod
const domainName = app.node.tryGetContext('domainName'); // e.g. yourpace.cloud
const hostedZoneId = app.node.tryGetContext('hostedZoneId'); // e.g. Z02794812UW0G2U4GTHPL

// ⚠️ CRITICAL: Amplify app name - DO NOT CHANGE without understanding the impact
// Changing this will cause the Amplify app to be recreated, losing all build history
// This should be set via CDK context or environment variable, not hardcoded
const amplifyAppName = app.node.tryGetContext('amplifyAppName') || process.env.AMPLIFY_APP_NAME || 'yourpace';

// Validate required configuration
if (!account) {
  throw new Error(
    'AWS account not specified. Either:\n' +
    '  1. Use --profile to set the account from your AWS CLI config\n' +
    '  2. Pass -c account=230984464810\n' +
    '  3. Set CDK_DEFAULT_ACCOUNT environment variable'
  );
}

if (!['dev', 'staging', 'prod'].includes(env)) {
  throw new Error(`Invalid env "${env}". Must be one of: dev, staging, prod`);
}

// ⚠️ SAFEGUARD: Warn if changing Amplify app name
if (amplifyAppName !== 'yourpace') {
  console.warn('\n⚠️  WARNING: Amplify app name is not "yourpace"');
  console.warn('   Changing this will cause the Amplify app to be RECREATED');
  console.warn('   This will result in loss of build history and domain changes\n');
}

// ============================================
// Certificate Stack (us-east-1)
// ============================================
// ACM certificates for CloudFront MUST be in us-east-1
// Only created when a domain name is provided
let certificateStack: CertificateStack | undefined;

if (domainName) {
  certificateStack = new CertificateStack(app, `YourPaceCertificateStack-${env}`, {
    env: {
      account,
      region: 'us-east-1', // CloudFront requires certificate in us-east-1
    },
    domainName,
    hostedZoneId,
    environment: env,
    crossRegionReferences: true,
    description: `YourPace SSL Certificate for CloudFront (us-east-1) - ${env}`,
    tags: {
      Project: 'yourpace',
      Environment: env,
      ManagedBy: 'cdk',
    },
  });
}

// ============================================
// Main Infrastructure Stack (eu-west-1)
// ============================================
const mainStack = new YourPaceStack(app, `YourPaceStack-${env}`, {
  env: {
    account,
    region,
  },
  environment: env,
  domainName,
  hostedZoneId,
  certificate: certificateStack?.certificate,
  crossRegionReferences: true,
  description: `YourPace infrastructure - ${env} environment`,
  tags: {
    Project: 'yourpace',
    Environment: env,
    ManagedBy: 'cdk',
  },
});

// Certificate must be created before the main stack
if (certificateStack) {
  mainStack.addDependency(certificateStack);
}

// ============================================
// Global tags applied to all resources
// ============================================
cdk.Tags.of(app).add('Project', 'yourpace');
cdk.Tags.of(app).add('Environment', env);
cdk.Tags.of(app).add('ManagedBy', 'cdk');

app.synth();
