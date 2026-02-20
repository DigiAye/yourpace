import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export interface NetworkProps {
  readonly environment: string;
}

/**
 * Network Construct — VPC with public and private subnets.
 *
 * dev:     NO VPC — Lambdas run without a VPC (free tier, no NAT Gateway cost ~$32/month).
 *          DynamoDB, SES, S3, API Gateway are all reachable via public AWS endpoints.
 * staging: VPC with 1 NAT Gateway
 * prod:    VPC with 2 NAT Gateways (high availability)
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
    // VPC — 2 AZs, public + private subnets
    // ============================================
    this.vpc = new ec2.Vpc(this, 'Vpc', {
      vpcName: `yourpace-${props.environment}`,
      maxAzs: 2,
      natGateways: isProd ? 2 : 1,
      subnetConfiguration: [
        {
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
        {
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
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
