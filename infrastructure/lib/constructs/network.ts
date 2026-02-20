import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export interface NetworkProps {
  readonly environment: string;
}

/**
 * Network Construct — VPC with public subnets only (NO NAT Gateways).
 *
 * COST OPTIMIZATION: Removed NAT Gateways to stay within free tier.
 * - NAT Gateway costs ~$32/month + data transfer
 * - All AWS services (DynamoDB, S3, Cognito, etc.) are reachable via public endpoints
 * - No need for private subnets with egress for our architecture
 *
 * dev:     NO VPC — Lambdas run without a VPC (free tier).
 * staging: VPC with public subnets only (no NAT Gateway)
 * prod:    VPC with public subnets only (no NAT Gateway)
 */
export class Network extends Construct {
  public readonly vpc: ec2.Vpc | undefined;
  public readonly lambdaSecurityGroup: ec2.SecurityGroup | undefined;

  constructor(scope: Construct, id: string, props: NetworkProps) {
    super(scope, id);

    const isProd = props.environment === 'prod';
    const isDev = props.environment === 'dev';

    // Dev: skip VPC entirely — saves ~$32/month NAT Gateway cost
    if (isDev) {
      this.vpc = undefined;
      this.lambdaSecurityGroup = undefined;
      return;
    }

    // ============================================
    // VPC — 2 AZs, public subnets only (NO NAT Gateways)
    // ============================================
    // COST OPTIMIZATION: Removed NAT Gateways (~$32/month each)
    // All AWS services are reachable via public endpoints
    this.vpc = new ec2.Vpc(this, 'Vpc', {
      vpcName: `yourpace-${props.environment}`,
      maxAzs: 2,
      natGateways: 0, // NO NAT Gateways — saves ~$32-64/month
      subnetConfiguration: [
        {
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
      ],
    });

    // ============================================
    // Security Group — Lambda functions
    // ============================================
    this.lambdaSecurityGroup = new ec2.SecurityGroup(this, 'LambdaSecurityGroup', {
      vpc: this.vpc,
      securityGroupName: `yourpace-lambda-${props.environment}`,
      description: 'Security group for YourPace Lambda functions',
      allowAllOutbound: true,
    });

    // ============================================
    // Stack Outputs
    // ============================================
    new cdk.CfnOutput(scope, 'VpcId', {
      value: this.vpc.vpcId,
      description: 'VPC ID',
    });

    new cdk.CfnOutput(scope, 'LambdaSecurityGroupId', {
      value: this.lambdaSecurityGroup.securityGroupId,
      description: 'Lambda Security Group ID',
    });
  }
}
