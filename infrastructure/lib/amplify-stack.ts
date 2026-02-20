import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import { AmplifyApp } from './constructs/amplify';

export interface AmplifyStackProps extends cdk.StackProps {
  // No GitHub credentials needed - builds are triggered via webhooks
}

/**
 * Amplify Stack - Deploys the Amplify app with webhook-based builds
 * This is separate from the main YourPaceStack to allow independent management
 * 
 * NOTE: GitHub OAuth is disabled. Builds are triggered via webhooks from GitHub Actions.
 */
export class AmplifyStack extends cdk.Stack {
  public readonly amplifyApp: AmplifyApp;

  constructor(scope: Construct, id: string, props: AmplifyStackProps) {
    super(scope, id, props);

    this.amplifyApp = new AmplifyApp(this, 'AmplifyApp', {
      region: this.region,
      account: this.account,
    });

    // Output the Amplify App ID
    new cdk.CfnOutput(this, 'AmplifyAppId', {
      value: this.amplifyApp.appId,
      description: 'Amplify App ID',
      exportName: 'YourPaceAmplifyAppId',
    });

    new cdk.CfnOutput(this, 'AmplifyDefaultDomain', {
      value: this.amplifyApp.defaultDomain,
      description: 'Amplify Default Domain',
    });

    new cdk.CfnOutput(this, 'AmplifyConsoleUrl', {
      value: `https://eu-west-1.console.aws.amazon.com/amplify/home?region=eu-west-1#/${this.amplifyApp.appId}`,
      description: 'Amplify Console URL',
    });
  }
}
