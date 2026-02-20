import * as cdk from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import { Construct } from 'constructs';

export interface CloudFrontCertificateStackProps extends cdk.StackProps {
  readonly domainName: string;
  readonly hostedZoneId: string;
}

/**
 * CloudFront Certificate Stack — creates ACM certificate in us-east-1.
 *
 * CloudFront REQUIRES certificates to be in us-east-1.
 * This stack creates the certificate in the correct region.
 *
 * Deploy order: CloudFrontCertificateStack (us-east-1) → YourPaceStack (eu-west-1)
 */
export class CloudFrontCertificateStack extends cdk.Stack {
  public readonly certificate: acm.Certificate;
  public readonly certificateArn: string;

  constructor(scope: Construct, id: string, props: CloudFrontCertificateStackProps) {
    super(scope, id, props);

    // Import hosted zone for DNS validation
    // NOTE: Route53 hosted zone is global, so we can reference it from us-east-1
    const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
      hostedZoneId: props.hostedZoneId,
      zoneName: props.domainName,
    });

    const validation = acm.CertificateValidation.fromDns(hostedZone);

    // Create certificate in us-east-1 for CloudFront
    this.certificate = new acm.Certificate(this, 'CloudFrontCertificate', {
      domainName: props.domainName,
      subjectAlternativeNames: [
        `*.${props.domainName}`,
        `www.${props.domainName}`,
        `staging.${props.domainName}`,
        `dev.${props.domainName}`,
        `auth.${props.domainName}`,
      ],
      validation,
    });

    this.certificateArn = this.certificate.certificateArn;

    // ============================================
    // Stack Outputs
    // ============================================
    new cdk.CfnOutput(this, 'CertificateArn', {
      value: this.certificateArn,
      description: 'CloudFront Certificate ARN (us-east-1)',
      exportName: `YourPaceCloudFrontCertificateArn`,
    });
  }
}
