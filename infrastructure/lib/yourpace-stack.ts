import * as cdk from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import { Construct } from 'constructs';
import { Network, Storage, Auth, Dns, Frontend } from './constructs';

export interface YourPaceStackProps extends cdk.StackProps {
  readonly environment: string;
  readonly domainName?: string;
  readonly hostedZoneId?: string;
  readonly certificate?: acm.ICertificate;
  readonly certificateArn?: string; // us-east-1 certificate ARN for Cognito
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

    const { environment, domainName, hostedZoneId } = props;

    // Deletion protection tag for prod
    if (environment === 'prod') {
      cdk.Tags.of(this).add('TerminationProtection', 'enabled');
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
      certificate: props.certificate,
      certificateArn: props.certificateArn, // us-east-1 certificate for Cognito
    });

    // ============================================
    // 4. Frontend (S3 + CloudFront)
    // ============================================
    const frontend = new Frontend(this, 'Frontend', {
      environment,
      domainName,
      certificate: props.certificate,
      certificateArn: props.certificateArn, // us-east-1 certificate for CloudFront
    });

    // ============================================
    // 5. DNS (only when domain is provided)
    // ============================================
    if (domainName && hostedZoneId) {
      new Dns(this, 'Dns', {
        environment,
        domainName,
        hostedZoneId,
        certificate: props.certificate,
        cloudfrontDistribution: frontend.distribution,
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
