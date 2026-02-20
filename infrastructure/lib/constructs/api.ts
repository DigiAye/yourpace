import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigatewayv2Integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as apigatewayv2Authorizers from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export interface ApiProps {
  readonly environment: string;
  readonly domainName?: string;
  readonly vpc?: ec2.Vpc;
  readonly lambdaSecurityGroup?: ec2.SecurityGroup;
  readonly usersTable: dynamodb.Table;
  readonly workoutsTable: dynamodb.Table;
  readonly exercisesTable: dynamodb.Table;
  readonly goalsTable: dynamodb.Table;
  readonly assetsBucket: s3.Bucket;
  readonly userPoolId: string;
  readonly userPoolClientId: string;
}

/**
 * API Construct — Lambda functions + API Gateway HTTP v2.
 *
 * Routes:
 *   GET    /health
 *   GET    /workouts
 *   POST   /workouts
 *   GET    /workouts/{workoutId}
 *   PUT    /workouts/{workoutId}
 *   DELETE /workouts/{workoutId}
 *   GET    /exercises
 *   POST   /exercises
 *   GET    /goals
 *   POST   /goals
 *   GET    /users/me
 *   PUT    /users/me
 */
export class Api extends Construct {
  public readonly httpApi: apigatewayv2.HttpApi;
  public readonly apiEndpoint: string;

  constructor(scope: Construct, id: string, props: ApiProps) {
    super(scope, id);

    const corsOrigins = props.domainName
      ? [
          `https://${props.domainName}`,
          `https://www.${props.domainName}`,
          'http://localhost:3000',
        ]
      : ['http://localhost:3000'];

    // ============================================
    // Shared Lambda environment variables
    // ============================================
    const sharedEnv: Record<string, string> = {
      ENVIRONMENT: props.environment,
      USERS_TABLE: props.usersTable.tableName,
      WORKOUTS_TABLE: props.workoutsTable.tableName,
      EXERCISES_TABLE: props.exercisesTable.tableName,
      GOALS_TABLE: props.goalsTable.tableName,
      ASSETS_BUCKET: props.assetsBucket.bucketName,
    };

    // ============================================
    // Shared Lambda execution role
    // ============================================
    const lambdaManagedPolicies = [
      iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
    ];
    // Only add VPC execution policy when a VPC is configured
    if (props.vpc) {
      lambdaManagedPolicies.push(
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole')
      );
    }

    const lambdaRole = new iam.Role(this, 'LambdaRole', {
      roleName: `yourpace-lambda-${props.environment}`,
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: lambdaManagedPolicies,
    });

    // Grant DynamoDB access
    props.usersTable.grantReadWriteData(lambdaRole);
    props.workoutsTable.grantReadWriteData(lambdaRole);
    props.exercisesTable.grantReadWriteData(lambdaRole);
    props.goalsTable.grantReadWriteData(lambdaRole);

    // Grant S3 access
    props.assetsBucket.grantReadWrite(lambdaRole);

    // ============================================
    // API Handler Lambda (single function, router pattern)
    // ============================================
    const apiHandler = new lambda.Function(this, 'ApiHandler', {
      functionName: `yourpace-api-${props.environment}`,
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        exports.handler = async (event) => {
          // Placeholder — replace with your actual API handler
          // Recommended: use a router like hono or aws-lambda-router
          const path = event.rawPath || '/';
          const method = event.requestContext?.http?.method || 'GET';
          console.log(\`\${method} \${path}\`);
          return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: 'YourPace API is running',
              environment: process.env.ENVIRONMENT,
              path,
              method,
            }),
          };
        };
      `),
      role: lambdaRole,
      // VPC is optional — dev runs without VPC to avoid NAT Gateway costs
      ...(props.vpc && props.lambdaSecurityGroup
        ? {
            vpc: props.vpc,
            securityGroups: [props.lambdaSecurityGroup],
            vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
          }
        : {}),
      environment: sharedEnv,
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      description: `YourPace API handler - ${props.environment}`,
    });

    // ============================================
    // API Gateway HTTP v2
    // ============================================
    this.httpApi = new apigatewayv2.HttpApi(this, 'HttpApi', {
      apiName: `yourpace-api-${props.environment}`,
      description: `YourPace HTTP API - ${props.environment}`,
      corsPreflight: {
        allowOrigins: corsOrigins,
        allowMethods: [
          apigatewayv2.CorsHttpMethod.GET,
          apigatewayv2.CorsHttpMethod.POST,
          apigatewayv2.CorsHttpMethod.PUT,
          apigatewayv2.CorsHttpMethod.DELETE,
          apigatewayv2.CorsHttpMethod.OPTIONS,
        ],
        allowHeaders: ['Content-Type', 'Authorization', 'X-Amz-Date', 'X-Api-Key'],
        allowCredentials: true,
        maxAge: cdk.Duration.days(1),
      },
    });

    // ============================================
    // Cognito JWT Authorizer
    // ============================================
    // Create authorizer WITHOUT attaching to API yet (breaks circular dependency)
    const authorizer = new apigatewayv2Authorizers.HttpJwtAuthorizer(
      'CognitoAuthorizer',
      `https://cognito-idp.eu-west-1.amazonaws.com/${props.userPoolId}`,
      {
        jwtAudience: [props.userPoolClientId],
        authorizerName: `yourpace-cognito-${props.environment}`,
      }
    );

    const integration = new apigatewayv2Integrations.HttpLambdaIntegration(
      'ApiIntegration',
      apiHandler
    );

    // ============================================
    // Routes
    // ============================================

    // Health check (public)
    this.httpApi.addRoutes({
      path: '/health',
      methods: [apigatewayv2.HttpMethod.GET],
      integration,
    });

    // Workouts (protected)
    this.httpApi.addRoutes({
      path: '/workouts',
      methods: [apigatewayv2.HttpMethod.GET, apigatewayv2.HttpMethod.POST],
      integration,
      authorizer,
    });

    this.httpApi.addRoutes({
      path: '/workouts/{workoutId}',
      methods: [
        apigatewayv2.HttpMethod.GET,
        apigatewayv2.HttpMethod.PUT,
        apigatewayv2.HttpMethod.DELETE,
      ],
      integration,
      authorizer,
    });

    // Exercises (protected)
    this.httpApi.addRoutes({
      path: '/exercises',
      methods: [apigatewayv2.HttpMethod.GET, apigatewayv2.HttpMethod.POST],
      integration,
      authorizer,
    });

    // Goals (protected)
    this.httpApi.addRoutes({
      path: '/goals',
      methods: [apigatewayv2.HttpMethod.GET, apigatewayv2.HttpMethod.POST],
      integration,
      authorizer,
    });

    // User profile (protected)
    this.httpApi.addRoutes({
      path: '/users/me',
      methods: [apigatewayv2.HttpMethod.GET, apigatewayv2.HttpMethod.PUT],
      integration,
      authorizer,
    });

    this.apiEndpoint = this.httpApi.apiEndpoint;

    // ============================================
    // Stack Outputs
    // ============================================
    new cdk.CfnOutput(scope, 'ApiEndpoint', {
      value: this.httpApi.apiEndpoint,
      description: 'API Gateway HTTP API endpoint',
    });

    new cdk.CfnOutput(scope, 'ApiHandlerArn', {
      value: apiHandler.functionArn,
      description: 'API Lambda function ARN',
    });
  }
}
