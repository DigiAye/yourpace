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
 * Creates the Amplify application with custom buildSpec that fetches
 * secrets from GitHub Secrets via environment variables passed from GitHub Actions.
 * 
 * The buildSpec is defined in code (not amplify.yml) to have full control
 * over the build process and environment variable injection.
 */
export class AmplifyApp extends Construct {
  /** The Amplify App instance */
  public readonly app: amplify.App;
  /** Amplify's default domain */
  public readonly defaultDomain: string;
  /** Amplify App ID */
  public readonly appId: string;

  constructor(scope: Construct, id: string, props: AmplifyAppProps) {
    super(scope, id);

    // Get App ID from environment variable
    const appId = process.env.AMPLIFY_APP_ID;
    if (!appId) {
      throw new Error('AMPLIFY_APP_ID environment variable is required');
    }

    // ============================================
    // Amplify Service Role
    // ============================================
    const serviceRole = new iam.Role(this, 'ServiceRole', {
      assumedBy: new iam.ServicePrincipal('amplify.amazonaws.com'),
      description: 'Service role for Amplify with environment variable access',
    });

    // ============================================
    // Reference Existing Amplify App
    // ============================================
    // This app was created manually via AWS Console with GitHub OAuth connection
    // The app already has branches and webhooks configured
    this.app = amplify.App.fromAppId(this, 'App', appId) as amplify.App;
    this.appId = appId;
    this.defaultDomain = this.app.defaultDomain;

    // ============================================
    // Custom BuildSpec with Environment Variables
    // ============================================
    // Define the build process in code to have full control over
    // environment variable injection from GitHub Secrets
    // 
    // NOTE: Since we're using fromAppId() to reference an existing app,
    // we cannot directly set the buildSpec via CDK. The buildSpec must be
    // configured via the Amplify console or AWS CLI.
    //
    // The expected buildSpec configuration is:
    const buildSpec = codebuild.BuildSpec.fromObjectToYaml({
      version: '1.0',
      applications: [{
        appRoot: 'frontend',
        frontend: {
          phases: {
            preBuild: {
              commands: [
                'npm ci',
                // Export environment variables from GitHub Secrets
                // These are passed via the webhook trigger from GitHub Actions
                'echo "Setting up environment variables..."',
                'export NEXT_PUBLIC_COGNITO_REGION="${COGNITO_REGION}"',
                'export NEXT_PUBLIC_COGNITO_CLIENT_ID="${COGNITO_USER_POOL_CLIENT_ID}"',
                'export NEXT_PUBLIC_COGNITO_DOMAIN="${COGNITO_AUTH_DOMAIN}"',
                'export NEXT_PUBLIC_APP_URL="${APP_URL}"',
                'export NEXT_PUBLIC_AWS_REGION="${AWS_REGION}"',
                'export NEXT_PUBLIC_AWS_ACCOUNT_ID="${AWS_ACCOUNT_ID}"',
                'export NEXT_PUBLIC_USERS_TABLE="${DYNAMODB_USERS_TABLE}"',
                'export NEXT_PUBLIC_WORKOUTS_TABLE="${DYNAMODB_WORKOUTS_TABLE}"',
                'export NEXT_PUBLIC_EXERCISES_TABLE="${DYNAMODB_EXERCISES_TABLE}"',
                'export NEXT_PUBLIC_GOALS_TABLE="${DYNAMODB_GOALS_TABLE}"',
                'export NEXT_PUBLIC_ASSETS_BUCKET="${S3_ASSETS_BUCKET}"',
                'export NEXT_PUBLIC_FRONTEND_BUCKET="${S3_FRONTEND_BUCKET}"',
                'export NEXT_PUBLIC_VPC_ID="${VPC_ID}"',
                'export NEXT_PUBLIC_LAMBDA_SECURITY_GROUP_ID="${LAMBDA_SECURITY_GROUP_ID}"',
                'export NEXT_PUBLIC_HOSTED_ZONE_ID="${HOSTED_ZONE_ID}"',
                'export NEXT_PUBLIC_CLOUDFRONT_DISTRIBUTION_ID="${AWS_CLOUDFRONT_DISTRIBUTION_ID}"',
                'export NEXT_PUBLIC_CLOUDFRONT_DOMAIN="${NEXT_PUBLIC_CLOUDFRONT_DOMAIN}"',
                'echo "✅ Environment variables configured"',
              ],
            },
            build: { commands: ['npm run build'] },
          },
          artifacts: { baseDirectory: 'out', files: ['**/*'] },
          cache: { paths: ['node_modules/**/*'] },
        },
      }],
    });
  }
}
