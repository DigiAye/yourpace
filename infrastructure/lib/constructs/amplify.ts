import * as cdk from 'aws-cdk-lib/core';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as amplify from '@aws-cdk/aws-amplify-alpha';
import { Construct } from 'constructs';

// ============================================
// Amplify Application
// ============================================
// Hosts the Next.js frontend with branch-based deployments
// Uses code-first buildSpec approach (no amplify.yml needed)

export interface AmplifyAppProps {
  /** AWS region for SSM parameter ARNs */
  readonly region: string;
  /** AWS account ID for SSM parameter ARNs */
  readonly account: string;
}

/**
 * Creates the Amplify application with custom buildSpec that fetches
 * secrets from AWS SSM Parameter Store during build.
 * 
 * This follows the DigiAye pattern:
 * - BuildSpec defined in CDK (code-first)
 * - Secrets stored in SSM Parameter Store
 * - preBuild phase fetches secrets from SSM
 * - No amplify.yml file needed
 * - GitHub Actions just triggers webhooks (no env var passing)
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

    // ============================================
    // Amplify Service Role (with SSM read permission)
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
    // Amplify App with Custom BuildSpec
    // ============================================
    this.app = new amplify.App(this, 'App', {
      appName: 'yourpace-frontend',
      description: 'YourPace frontend application',
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
                  // Fetch Cognito configuration from SSM
                  'export NEXT_PUBLIC_COGNITO_REGION=$(aws ssm get-parameter --name /yourpace/cognito-region --query Parameter.Value --output text 2>/dev/null || echo "eu-west-1")',
                  'export NEXT_PUBLIC_COGNITO_CLIENT_ID=$(aws ssm get-parameter --name /yourpace/cognito-client-id --with-decryption --query Parameter.Value --output text 2>/dev/null || echo "")',
                  'export NEXT_PUBLIC_COGNITO_DOMAIN=$(aws ssm get-parameter --name /yourpace/cognito-domain --with-decryption --query Parameter.Value --output text 2>/dev/null || echo "")',
                  // Fetch CloudFront configuration from SSM
                  'export NEXT_PUBLIC_CLOUDFRONT_DISTRIBUTION_ID=$(aws ssm get-parameter --name /yourpace/cloudfront-distribution-id --query Parameter.Value --output text 2>/dev/null || echo "")',
                  'export NEXT_PUBLIC_CLOUDFRONT_DOMAIN=$(aws ssm get-parameter --name /yourpace/cloudfront-domain --query Parameter.Value --output text 2>/dev/null || echo "")',
                  // Fetch AWS configuration from SSM
                  'export NEXT_PUBLIC_AWS_REGION=$(aws ssm get-parameter --name /yourpace/aws-region --query Parameter.Value --output text 2>/dev/null || echo "eu-west-1")',
                  'export NEXT_PUBLIC_AWS_ACCOUNT_ID=$(aws ssm get-parameter --name /yourpace/aws-account-id --query Parameter.Value --output text 2>/dev/null || echo "")',
                  // Fetch DynamoDB tables from SSM
                  'export NEXT_PUBLIC_USERS_TABLE=$(aws ssm get-parameter --name /yourpace/dynamodb-users-table --query Parameter.Value --output text 2>/dev/null || echo "")',
                  'export NEXT_PUBLIC_WORKOUTS_TABLE=$(aws ssm get-parameter --name /yourpace/dynamodb-workouts-table --query Parameter.Value --output text 2>/dev/null || echo "")',
                  'export NEXT_PUBLIC_EXERCISES_TABLE=$(aws ssm get-parameter --name /yourpace/dynamodb-exercises-table --query Parameter.Value --output text 2>/dev/null || echo "")',
                  'export NEXT_PUBLIC_GOALS_TABLE=$(aws ssm get-parameter --name /yourpace/dynamodb-goals-table --query Parameter.Value --output text 2>/dev/null || echo "")',
                  // Fetch S3 buckets from SSM
                  'export NEXT_PUBLIC_ASSETS_BUCKET=$(aws ssm get-parameter --name /yourpace/s3-assets-bucket --query Parameter.Value --output text 2>/dev/null || echo "")',
                  'export NEXT_PUBLIC_FRONTEND_BUCKET=$(aws ssm get-parameter --name /yourpace/s3-frontend-bucket --query Parameter.Value --output text 2>/dev/null || echo "")',
                  // Fetch VPC configuration from SSM
                  'export NEXT_PUBLIC_VPC_ID=$(aws ssm get-parameter --name /yourpace/vpc-id --query Parameter.Value --output text 2>/dev/null || echo "")',
                  'export NEXT_PUBLIC_LAMBDA_SECURITY_GROUP_ID=$(aws ssm get-parameter --name /yourpace/lambda-security-group-id --query Parameter.Value --output text 2>/dev/null || echo "")',
                  // Fetch Route53 configuration from SSM
                  'export NEXT_PUBLIC_HOSTED_ZONE_ID=$(aws ssm get-parameter --name /yourpace/hosted-zone-id --query Parameter.Value --output text 2>/dev/null || echo "")',
                  // Fetch App URL from SSM
                  'export NEXT_PUBLIC_APP_URL=$(aws ssm get-parameter --name /yourpace/app-url --query Parameter.Value --output text 2>/dev/null || echo "")',
                  'echo "✅ Environment variables configured from SSM"',
                ],
              },
              build: { commands: ['npm run build'] },
            },
            artifacts: { baseDirectory: 'out', files: ['**/*'] },
            cache: { paths: ['node_modules/**/*'] },
          },
        }],
      }),
    });

    this.defaultDomain = this.app.defaultDomain;
    this.appId = this.app.appId;

    // ============================================
    // Branch Configurations
    // ============================================
    // NOTE: autoBuild is disabled because we trigger builds via GitHub Actions webhooks
    // This gives us full control over the build process and environment variables
    
    const mainBranch = this.app.addBranch('main', {
      branchName: 'main',
      stage: 'PRODUCTION',
      autoBuild: false,
      environmentVariables: { NEXT_PUBLIC_ENVIRONMENT: 'production' },
    });

    const stagingBranch = this.app.addBranch('staging', {
      branchName: 'staging',
      stage: 'BETA',
      autoBuild: false,
      environmentVariables: { NEXT_PUBLIC_ENVIRONMENT: 'staging' },
    });

    const developBranch = this.app.addBranch('develop', {
      branchName: 'develop',
      stage: 'DEVELOPMENT',
      autoBuild: false,
      environmentVariables: { NEXT_PUBLIC_ENVIRONMENT: 'development' },
    });
  }
}
