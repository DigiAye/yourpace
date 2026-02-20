import * as cdk from 'aws-cdk-lib';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as route53Targets from 'aws-cdk-lib/aws-route53-targets';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import { Construct } from 'constructs';

export interface DnsProps {
  readonly environment: string;
  readonly domainName: string;
  readonly hostedZoneId: string;  // existing hosted zone ID (created by Route53 domain registration)
  readonly certificate?: acm.ICertificate;
  readonly cloudfrontDistribution?: cloudfront.Distribution;
  readonly cognitoDomainName?: string;  // Cognito domain name (e.g., yourpace-dev.auth.eu-west-1.amazoncognito.com)
}

/**
 * DNS Construct — Route53 records pointing to CloudFront and Cognito.
 *
 * Imports the existing hosted zone (created by Route53 domain registration)
 * rather than creating a new one, to avoid conflicts.
 *
 * Creates:
 *   - A record: yourpace.cloud → CloudFront (frontend)
 *   - A record: www.yourpace.cloud → CloudFront (frontend)
 *   - CNAME record: auth-dev.yourpace.cloud → Cognito domain (auth)
 *
 * NOTE: API Gateway records are managed separately in api-stack.ts
 */
export class Dns extends Construct {
  public readonly hostedZone: route53.IHostedZone;

  constructor(scope: Construct, id: string, props: DnsProps) {
    super(scope, id);

    // ============================================
    // Import existing Route53 Hosted Zone
    // (created automatically when domain was registered)
    // ============================================
    this.hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
      hostedZoneId: props.hostedZoneId,
      zoneName: props.domainName,
    });

    // ============================================
    // CloudFront A records (apex + www)
    // ============================================
    if (props.cloudfrontDistribution) {
      const cfTarget = route53.RecordTarget.fromAlias(
        new route53Targets.CloudFrontTarget(props.cloudfrontDistribution)
      );

      // Apex: yourpace.cloud → CloudFront
      new route53.ARecord(this, 'ApexRecord', {
        zone: this.hostedZone,
        target: cfTarget,
        ttl: cdk.Duration.minutes(5),
        comment: 'Frontend (CloudFront)',
      });

      // www: www.yourpace.cloud → CloudFront
      new route53.ARecord(this, 'WwwRecord', {
        zone: this.hostedZone,
        recordName: 'www',
        target: cfTarget,
        ttl: cdk.Duration.minutes(5),
        comment: 'Frontend www (CloudFront)',
      });
    }

    // ============================================
    // Cognito Domain CNAME record (only for prod with custom domain)
    // ============================================
    // Only create Cognito DNS record for prod environment
    // Dev/staging use AWS-managed Cognito domains (no custom domain needed)
    if (props.environment === 'prod' && props.cognitoDomainName && !props.cognitoDomainName.includes(props.domainName)) {
      new route53.CnameRecord(this, 'CognitoDomainRecord', {
        zone: this.hostedZone,
        recordName: 'auth',
        domainName: props.cognitoDomainName,
        ttl: cdk.Duration.minutes(5),
        comment: 'Cognito Managed Login domain (prod)',
      });
    }

    // ============================================
    // Stack Outputs
    // ============================================
    new cdk.CfnOutput(scope, 'HostedZoneId', {
      value: this.hostedZone.hostedZoneId,
      description: 'Route53 Hosted Zone ID',
    });
  }
}
