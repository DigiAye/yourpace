import * as cdk from 'aws-cdk-lib/core';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as amplify from '@aws-cdk/aws-amplify-alpha';
import { Construct } from 'constructs';

// ============================================
// Amplify Application
// ============================================
// Hosts the Next.js frontend with branch-based deployments
// ⚠️ DO NOT CHANGE appName - will cause recreation

export interface AmplifyAppProps {
  /** AWS region for SSM parameter ARNs */
  readonly region: string;
  /** AWS account ID for SSM parameter ARNs */
  readonly account: string;
}

/**
 * Creates the Amplify application with service role, build configuration,
 * and branch deployments (main, staging, develop).
 * 
 * NOTE: GitHub OAuth is disabled because CDK-created apps have issues with GitHub connection.
 * Builds are triggered via webhook from GitHub Actions CI workflow instead.
 */
export class AmplifyApp extends Construct {
  /** The Amplify App instance */
  public readonly app: amplify.App;
  /** Amplify's default domain (e.g., main.d1234567890.amplifyapp.com) */
  public readonly defaultDomain: string;
  /** Amplify App ID */
  public readonly appId: string;

  constructor(scope: Construct, id: string, props: AmplifyAppProps) {
    super(scope, id);

    // ============================================
    // Amplify Service Role (with SSM read permission)
    // Note: Let CDK generate name to avoid conflicts during refactoring
    // ============================================
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

    // ============================================
    // Amplify App
    // ⚠️ appName: 'yourpace' - DO NOT CHANGE
    // ⚠️ CRITICAL: Preserve logical ID - has GitHub connection
    // ============================================
    this.app = new amplify.App(this, 'App', {
      appName: 'yourpace', // ⚠️ DO NOT CHANGE - will cause recreation
      description: 'YourPace fitness tracking application',
      platform: amplify.Platform.WEB,
      autoBranchDeletion: true,
      role: serviceRole,
      buildSpec: codebuild.BuildSpec.fromObjectToYaml({
        version: '1.0',
        applications: [{
          appRoot: 'frontend',
          frontend: {
            phases: {
              preBuild: {
                commands: [
                  'npm ci',
                ],
              },
              build: { commands: ['npm run build'] },
            },
            artifacts: { baseDirectory: 'out', files: ['**/*'] },
            cache: { paths: ['node_modules/**/*'] },
          },
        }],
      }),
      environmentVariables: { NEXT_PUBLIC_ENVIRONMENT: 'production' },
    });
    // ⚠️ CRITICAL: Preserve original logical ID - has GitHub connection
    (this.app.node.defaultChild as cdk.CfnResource).overrideLogicalId('YourPaceAppB7D301D9');

    // ============================================
    // Branch Configurations
    // ⚠️ CRITICAL: Preserve original logical IDs for branches
    // ============================================
    // NOTE: autoBuild is disabled because GitHub OAuth is broken for CDK-created apps.
    // Builds are triggered via webhook from GitHub Actions CI workflow instead.
    const mainBranch = this.app.addBranch('main', {
      branchName: 'main',
      stage: 'PRODUCTION',
      autoBuild: false,
      environmentVariables: { NEXT_PUBLIC_ENVIRONMENT: 'production' },
    });
    (mainBranch.node.defaultChild as cdk.CfnResource).overrideLogicalId('YourPaceAppmainA894DEC7');

    const stagingBranch = this.app.addBranch('staging', {
      branchName: 'staging',
      stage: 'BETA',
      autoBuild: false,
      environmentVariables: { NEXT_PUBLIC_ENVIRONMENT: 'staging' },
    });
    (stagingBranch.node.defaultChild as cdk.CfnResource).overrideLogicalId('YourPaceAppstagingC0A42FD8');

    const developBranch = this.app.addBranch('develop', {
      branchName: 'develop',
      stage: 'DEVELOPMENT',
      autoBuild: false,
      environmentVariables: { NEXT_PUBLIC_ENVIRONMENT: 'development' },
    });
    (developBranch.node.defaultChild as cdk.CfnResource).overrideLogicalId('YourPaceAppdevelop1517C8C6');

    // Expose useful properties
    this.defaultDomain = this.app.defaultDomain;
    this.appId = this.app.appId;
  }
}
