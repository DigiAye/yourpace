import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as path from 'path';
import { Construct } from 'constructs';

export interface CloudFrontInvalidatorProps {
  readonly amplifyAppId: string;
  readonly distributionIdMain: string;
  readonly distributionIdStaging: string;
  readonly distributionIdDevelop: string;
}

/**
 * CloudFront Cache Invalidator Construct
 *
 * Automatically invalidates CloudFront cache when Amplify builds complete successfully.
 * Uses EventBridge to detect Amplify build completion events and triggers a Lambda function
 * to invalidate the appropriate CloudFront distribution based on the branch.
 *
 * Flow:
 * 1. Amplify build completes successfully
 * 2. EventBridge detects build completion event
 * 3. EventBridge triggers Lambda function
 * 4. Lambda invalidates CloudFront cache for the appropriate distribution
 * 5. CloudFront cache is cleared, serving fresh content
 */
export class CloudFrontInvalidator extends Construct {
  public readonly invalidatorFunction: lambda.Function;
  public readonly eventRule: events.Rule;

  constructor(scope: Construct, id: string, props: CloudFrontInvalidatorProps) {
    super(scope, id);

    // ============================================
    // Lambda Function for Cache Invalidation
    // ============================================
    this.invalidatorFunction = new lambda.Function(this, 'InvalidatorFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambdas/cloudfront-invalidator')),
      timeout: cdk.Duration.seconds(60),
      memorySize: 256,
      environment: {
        DISTRIBUTION_ID_MAIN: props.distributionIdMain,
        DISTRIBUTION_ID_STAGING: props.distributionIdStaging,
        DISTRIBUTION_ID_DEVELOP: props.distributionIdDevelop,
      },
      description: 'Invalidates CloudFront cache on Amplify build completion',
    });

    // ============================================
    // IAM Permissions for Lambda
    // ============================================
    // Allow Lambda to create CloudFront invalidations
    this.invalidatorFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'cloudfront:CreateInvalidation',
          'cloudfront:GetInvalidation',
        ],
        resources: [
          `arn:aws:cloudfront::${cdk.Stack.of(this).account}:distribution/${props.distributionIdMain}`,
          `arn:aws:cloudfront::${cdk.Stack.of(this).account}:distribution/${props.distributionIdStaging}`,
          `arn:aws:cloudfront::${cdk.Stack.of(this).account}:distribution/${props.distributionIdDevelop}`,
        ],
      })
    );

    // ============================================
    // EventBridge Rule for Amplify Build Completion
    // ============================================
    this.eventRule = new events.Rule(this, 'AmplifyBuildCompletionRule', {
      description: 'Triggers CloudFront cache invalidation on Amplify build completion',
      eventPattern: {
        source: ['aws.amplify'],
        detailType: ['Amplify Deployment State Change'],
        detail: {
          appId: [props.amplifyAppId],
          jobStatus: ['SUCCEED'],
        },
      },
    });

    // Add Lambda as target for the EventBridge rule
    this.eventRule.addTarget(
      new targets.LambdaFunction(this.invalidatorFunction)
    );

    // ============================================
    // Stack Outputs
    // ============================================
    new cdk.CfnOutput(scope, 'CloudFrontInvalidatorFunctionArn', {
      value: this.invalidatorFunction.functionArn,
      description: 'ARN of the CloudFront cache invalidator Lambda function',
    });

    new cdk.CfnOutput(scope, 'CloudFrontInvalidatorRuleArn', {
      value: this.eventRule.ruleArn,
      description: 'ARN of the EventBridge rule for Amplify build completion',
    });

    console.log(`✅ CloudFront cache invalidator configured`);
    console.log(`   Lambda Function: ${this.invalidatorFunction.functionName}`);
    console.log(`   EventBridge Rule: ${this.eventRule.ruleName}`);
    console.log(`   Amplify App ID: ${props.amplifyAppId}`);
  }
}
