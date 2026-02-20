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
  /** Environment variables to pass to Amplify builds */
  readonly environmentVariables?: Record<string, string>;
}

/**
 * References an existing Amplify application with GitHub connection.
 * The app must be created manually via AWS Console with GitHub OAuth.
 * 
 * App ID is read from AMPLIFY_APP_ID environment variable.
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
    // Reference Existing Amplify App
    // ============================================
    // This app was created manually via AWS Console with GitHub OAuth connection
    // The app already has branches and webhooks configured
    this.app = amplify.App.fromAppId(this, 'App', appId) as amplify.App;
    this.appId = appId;
    this.defaultDomain = this.app.defaultDomain;
  }
}
