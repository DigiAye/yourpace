import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';

// ============================================
// Amplify Webhook Proxy
// ============================================
// Stores and manages Amplify webhook URLs for GitHub Actions CI/CD
// Webhooks trigger Amplify builds when code is pushed to branches

export interface WebhookProxyProps {
  /** Webhook URLs for each branch */
  readonly amplifyWebhookUrls: {
    readonly develop: string;
    readonly staging: string;
    readonly main: string;
  };
}

/**
 * Manages Amplify webhook URLs for branch-based deployments.
 * GitHub Actions calls these webhooks to trigger Amplify builds.
 */
export class WebhookProxy extends Construct {
  /** Webhook URL for develop branch */
  public readonly developUrl: string;
  /** Webhook URL for staging branch */
  public readonly stagingUrl: string;
  /** Webhook URL for main/production branch */
  public readonly mainUrl: string;
  /** Default webhook URL (develop) */
  public readonly webhookUrl: string;

  constructor(scope: Construct, id: string, props: WebhookProxyProps) {
    super(scope, id);

    this.developUrl = props.amplifyWebhookUrls.develop;
    this.stagingUrl = props.amplifyWebhookUrls.staging;
    this.mainUrl = props.amplifyWebhookUrls.main;
    this.webhookUrl = this.developUrl; // Default to develop
  }
}
