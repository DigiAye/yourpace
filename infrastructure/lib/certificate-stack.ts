import * as cdk from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import { Construct } from 'constructs';

export interface CertificateStackProps extends cdk.StackProps {
  readonly domainName: string;
  readonly environment: string;
  readonly hostedZoneId?: string; // existing hosted zone for DNS validation
}

/**
 * Certificate Stack — must be deployed in us-east-1 for CloudFront.
 * Creates a wildcard ACM certificate for the domain and all subdomains.
 *
 * Uses the existing Route53 hosted zone (created by domain registration)
 * for automatic DNS validation — no manual steps required.
 *
 * Deploy order: CertificateStack → YourPaceStack
 */
export class CertificateStack extends cdk.Stack {
  public readonly certificate: acm.Certificate;

  constructor(scope: Construct, id: string, props: CertificateStackProps) {
    super(scope, id, props);

    // ============================================
    // Import existing hosted zone for DNS validation
    // ============================================
    let validation: acm.CertificateValidation;

    if (props.hostedZoneId) {
      // Use existing hosted zone — CDK will automatically add the CNAME validation records
      const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
        hostedZoneId: props.hostedZoneId,
        zoneName: props.domainName,
      });
      validation = acm.CertificateValidation.fromDns(hostedZone);
    } else {
      // Fallback: manual DNS validation (requires manual CNAME record creation)
      validation = acm.CertificateValidation.fromDns();
    }

    // ============================================
    // ACM Certificate (DNS validated)
    // ============================================
    // Covers: yourpace.cloud, *.yourpace.cloud (www, api, dev, staging)
    this.certificate = new acm.Certificate(this, 'Certificate', {
      domainName: props.domainName,
      subjectAlternativeNames: [
        `*.${props.domainName}`,
      ],
      validation,
    });

    // ============================================
    // Stack Outputs
    // ============================================
    new cdk.CfnOutput(this, 'CertificateArn', {
      value: this.certificate.certificateArn,
      description: 'ACM Certificate ARN (us-east-1) for CloudFront',
      exportName: `YourPaceCertificateArn-${props.environment}`,
    });
  }
}
