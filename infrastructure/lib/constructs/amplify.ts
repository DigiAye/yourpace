import * as cdk from 'aws-cdk-lib/core';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as amplify from '@aws-cdk/aws-amplify-alpha';
import { Construct } from 'constructs';

// ============================================
// Amplify Application
// ============================================
// Imports the existing Amplify app (d32w5qjq8u9hab) that's connected to GitHub
// The app was created manually to work around CDK GitHub OAuth limitations
// This construct configures the service role with SSM permissions for buildSpec

export interface AmplifyAppProps {
  /** AWS region for SSM parameter ARNs */
  readonly region: string;
  /** AWS account ID for SSM parameter ARNs */
  readonly account: string;
  /** Amplify App ID (from environment variable AMPLIFY_APP_ID) */
  readonly amplifyAppId: string;
}

/**
 * Imports the existing Amplify application and configures it with SSM access.
 * 
 * The buildSpec is configured via amplify.yml in the repository, which fetches
 * secrets from AWS SSM Parameter Store during the build process.
 * 
 * This follows the DigiAye pattern:
 * - BuildSpec defined in amplify.yml (code-first in repo)
 * - Secrets stored in SSM Parameter Store
 * - preBuild phase fetches secrets from SSM
 * - GitHub Actions just triggers webhooks (no env var passing)
 */
export class AmplifyApp extends Construct {
  /** The Amplify App ID */
  public readonly appId: string;

  constructor(scope: Construct, id: string, props: AmplifyAppProps) {
    super(scope, id);

    // ============================================
    // Amplify App Configuration
    // ⚠️ CRITICAL: This app is connected to GitHub
    // It was created manually to work around CDK GitHub OAuth limitations
    // App ID is passed via AMPLIFY_APP_ID environment variable
    // ============================================
    this.appId = props.amplifyAppId;

    // ============================================
    // Amplify Service Role (with SSM read permission)
    // ============================================
    // Create a service role with SSM permissions for the buildSpec to fetch secrets
    const serviceRole = new iam.Role(this, 'ServiceRole', {
      assumedBy: new iam.ServicePrincipal('amplify.amazonaws.com'),
      description: 'Service role for Amplify with SSM read access for build configuration',
    });

    // Grant SSM read access for build-time configuration
    serviceRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['ssm:GetParameter', 'ssm:GetParameters'],
      resources: [`arn:aws:ssm:${props.region}:${props.account}:parameter/yourpace/*`],
    }));

    // Output the service role ARN for manual attachment to the Amplify app
    new cdk.CfnOutput(this, 'AmplifyServiceRoleArn', {
      description: `Amplify Service Role ARN - attach to app via: aws amplify update-app --app-id ${this.appId} --iam-service-role-arn <arn>`,
      value: serviceRole.roleArn,
      exportName: 'AmplifyServiceRoleArn',
    });

    // Output the app ID for reference
    new cdk.CfnOutput(this, 'AmplifyAppId', {
      description: 'Amplify App ID',
      value: this.appId,
      exportName: 'AmplifyAppId',
    });
  }
}
