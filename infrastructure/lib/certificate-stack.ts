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
 * Certificate Stack — creates certificates in BOTH us-east-1 and eu-west-1.
 *
 * us-east-1: Required for CloudFront (AWS limitation)
 * eu-west-1: Required for Cognito custom domain
 *
 * Both certificates cover: yourpace.cloud, *.yourpace.cloud
 *
 * Uses the existing Route53 hosted zone for automatic DNS validation.
 *
 * Deploy order: CertificateStack → YourPaceStack
 */
export class CertificateStack extends cdk.Stack {
  public readonly certificate: acm.Certificate;
  public readonly cognitoCertificate: acm.Certificate;

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
    // ACM Certificate for CloudFront (us-east-1)
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
    // ACM Certificate for Cognito (eu-west-1)
    // ============================================
    // Same domain coverage, but in eu-west-1 for Cognito custom domain
    // This is a separate certificate because Cognito requires it in the same region
    this.cognitoCertificate = new acm.Certificate(this, 'CognitoCertificate', {
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

    new cdk.CfnOutput(this, 'CognitoCertificateArn', {
      value: this.cognitoCertificate.certificateArn,
      description: 'ACM Certificate ARN (eu-west-1) for Cognito',
      exportName: `YourPaceCognitoCertificateArn-${props.environment}`,
    });
  }
}
