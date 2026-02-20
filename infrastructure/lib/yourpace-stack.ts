import * as cdk from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import { Construct } from 'constructs';
import { Network, Storage, Auth, Dns, Frontend, AmplifyApp } from './constructs';

export interface YourPaceStackProps extends cdk.StackProps {
  readonly environment: string;
  readonly domainName?: string;
  readonly hostedZoneId?: string;
  readonly cloudfrontCertificateArn?: string; // us-east-1 certificate ARN for CloudFront
}

/**
 * YourPace Main Stack — orchestrates all infrastructure constructs.
 *
 * Deploy order:
 *   1. Network    (VPC, subnets, security groups)
 *   2. Storage    (S3, DynamoDB)
 *   3. Auth       (Cognito with Managed Login)
 *   4. Frontend   (S3 + CloudFront)
 *   5. Dns        (Route53 + records) — only if domainName provided
 *
 * NOTE: API is deployed separately to avoid circular dependency with Auth.
 *       See infrastructure/lib/api-stack.ts for API deployment.
 *
 * ⚠️  BEFORE DEPLOYING: Run `cdk diff` and check for destructive changes.
 */
export class YourPaceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: YourPaceStackProps) {
    super(scope, id, props);

    const { environment, domainName, hostedZoneId, cloudfrontCertificateArn } = props;

    // Deletion protection tag for prod
    if (environment === 'prod') {
      cdk.Tags.of(this).add('TerminationProtection', 'enabled');
    }

    // ============================================
    // 0. Certificates (if domain provided)
    // ============================================
    let cloudfrontCertificate: acm.ICertificate | undefined;
    let cognitoCertificate: acm.ICertificate | undefined;

    if (domainName && hostedZoneId) {
      // Import hosted zone for DNS validation
      const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
        hostedZoneId,
        zoneName: domainName,
      });
      const validation = acm.CertificateValidation.fromDns(hostedZone);

      // Cognito certificate (eu-west-1 - same region as stack)
      cognitoCertificate = new acm.Certificate(this, 'CognitoCertificate', {
        domainName,
        subjectAlternativeNames: [`*.${domainName}`],
        validation,
      });

      // CloudFront certificate (us-east-1 - imported from CloudFrontCertificateStack)
      if (cloudfrontCertificateArn) {
        cloudfrontCertificate = acm.Certificate.fromCertificateArn(
          this,
          'CloudFrontCertificate',
          cloudfrontCertificateArn
        );
        console.log(`✅ CloudFront certificate imported from us-east-1`);
      } else {
        console.log(`⚠️  CloudFront certificate ARN not provided`);
        console.log(`    CloudFront custom domains will not be configured`);
      }
    }

    // ============================================
    // 1. Network
    // ============================================
    const network = new Network(this, 'Network', { environment });

    // ============================================
    // 2. Storage
    // ============================================
    const storage = new Storage(this, 'Storage', { environment });

    // ============================================
    // 3. Auth (Cognito with Managed Login)
    // ============================================
    const auth = new Auth(this, 'Auth', { 
      environment, 
      domainName, 
      cognitoCertificate,
    });

    // ============================================
    // 4. Amplify (Frontend deployment with webhook-based builds)
    // ============================================
    const amplify = new AmplifyApp(this, 'Amplify', {
      region: cdk.Stack.of(this).region,
      account: cdk.Stack.of(this).account,
    });

    // ============================================
    // 5. Frontend (S3 + CloudFront)
    // ============================================
    const frontend = new Frontend(this, 'Frontend', {
      environment,
      domainName,
      certificate: cloudfrontCertificate,
    });

    // ============================================
    // 6. DNS (only when domain is provided)
    // ============================================
    if (domainName && hostedZoneId) {
      new Dns(this, 'Dns', {
        environment,
        domainName,
        hostedZoneId,
        certificate: cloudfrontCertificate,
        cloudfrontDistribution: frontend.wwwDistribution,
        stagingDistribution: frontend.stagingDistribution,
        devDistribution: frontend.devDistribution,
        cognitoDomainName: auth.cognitoDomainName,
      });
    }

    // ============================================
    // Stack Outputs
    // ============================================
    new cdk.CfnOutput(this, 'Environment', {
      value: environment,
      description: 'Deployment environment',
    });

    new cdk.CfnOutput(this, 'Region', {
      value: cdk.Stack.of(this).region,
      description: 'AWS Region',
    });

    new cdk.CfnOutput(this, 'AccountId', {
      value: cdk.Stack.of(this).account,
      description: 'AWS Account ID',
    });
  }
}
