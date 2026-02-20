import * as cdk from 'aws-cdk-lib/core';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as amplify from '@aws-cdk/aws-amplify-alpha';
import { Construct } from 'constructs';

// ============================================
// Amplify Application
// ============================================
// Hosts the Next.js frontend with branch-based deployments
// Connected to GitHub repository for auto-builds

export interface AmplifyAppProps {
  /** AWS region for SSM parameter ARNs */
  readonly region: string;
  /** AWS account ID for SSM parameter ARNs */
  readonly account: string;
  /** GitHub owner (e.g., DigiAye) */
  readonly githubOwner: string;
  /** GitHub repository name (e.g., yourpace) */
  readonly githubRepo: string;
  /** GitHub OAuth token for repository connection */
  readonly githubToken: string;
}

/**
 * Creates the Amplify application with GitHub connection, service role, build configuration,
 * and branch deployments (main, staging, develop).
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
    // Amplify Service Role
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
    // Amplify App with GitHub Connection
    // ============================================
    this.app = new amplify.App(this, 'App', {
      appName: 'yourpace',
      description: 'YourPace fitness tracking application',
      platform: amplify.Platform.WEB,
      autoBranchDeletion: true,
      role: serviceRole,
      sourceCodeProvider: new amplify.GitHubSourceCodeProvider({
        owner: props.githubOwner,
        repository: props.githubRepo,
        oauthToken: cdk.SecretValue.unsafePlainText(props.githubToken),
      }),
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

    // ============================================
    // Branch Configurations
    // ============================================
    // Auto-build is enabled since GitHub is now connected
    
    const mainBranch = this.app.addBranch('main', {
      branchName: 'main',
      stage: 'PRODUCTION',
      autoBuild: true,
      environmentVariables: { NEXT_PUBLIC_ENVIRONMENT: 'production' },
    });

    const stagingBranch = this.app.addBranch('staging', {
      branchName: 'staging',
      stage: 'BETA',
      autoBuild: true,
      environmentVariables: { NEXT_PUBLIC_ENVIRONMENT: 'staging' },
    });

    const developBranch = this.app.addBranch('develop', {
      branchName: 'develop',
      stage: 'DEVELOPMENT',
      autoBuild: true,
      environmentVariables: { NEXT_PUBLIC_ENVIRONMENT: 'development' },
    });

    // Expose useful properties
    this.defaultDomain = this.app.defaultDomain;
    this.appId = this.app.appId;
  }
}
