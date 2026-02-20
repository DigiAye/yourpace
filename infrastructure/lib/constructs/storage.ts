import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

export interface StorageProps {
  readonly environment: string;
}

/**
 * Storage Construct — S3 bucket + DynamoDB tables.
 *
 * Tables:
 *   - users        (PK: userId)
 *   - workouts     (PK: userId, SK: workoutId)
 *   - exercises    (PK: workoutId, SK: exerciseId)
 *   - goals        (PK: userId, SK: goalId)
 *
 * dev/staging: on-demand billing, no PITR
 * prod:        on-demand billing, PITR enabled, deletion protection
 */
export class Storage extends Construct {
  public readonly assetsBucket: s3.Bucket;
  public readonly usersTable: dynamodb.Table;
  public readonly workoutsTable: dynamodb.Table;
  public readonly exercisesTable: dynamodb.Table;
  public readonly goalsTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props: StorageProps) {
    super(scope, id);

    const isProd = props.environment === 'prod';
    const removalPolicy = isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY;

    // ============================================
    // S3 — Static assets & backups
    // ============================================
    this.assetsBucket = new s3.Bucket(this, 'AssetsBucket', {
      bucketName: `yourpace-assets-${props.environment}`,
      removalPolicy,
      autoDeleteObjects: !isProd,
      versioned: isProd,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      lifecycleRules: isProd
        ? [
            {
              id: 'archive-old-versions',
              noncurrentVersionExpiration: cdk.Duration.days(90),
            },
          ]
        : [],
    });

    // ============================================
    // DynamoDB — Users
    // ============================================
    this.usersTable = new dynamodb.Table(this, 'UsersTable', {
      tableName: `yourpace-users-${props.environment}`,
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy,
      pointInTimeRecoverySpecification: isProd ? { pointInTimeRecoveryEnabled: true } : undefined,
      deletionProtection: isProd,
    });

    // GSI: look up user by email
    this.usersTable.addGlobalSecondaryIndex({
      indexName: 'email-index',
      partitionKey: { name: 'email', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // ============================================
    // DynamoDB — Workouts
    // ============================================
    this.workoutsTable = new dynamodb.Table(this, 'WorkoutsTable', {
      tableName: `yourpace-workouts-${props.environment}`,
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'workoutId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy,
      pointInTimeRecoverySpecification: isProd ? { pointInTimeRecoveryEnabled: true } : undefined,
      deletionProtection: isProd,
    });

    // GSI: query workouts by date
    this.workoutsTable.addGlobalSecondaryIndex({
      indexName: 'date-index',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'date', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // ============================================
    // DynamoDB — Exercises
    // ============================================
    this.exercisesTable = new dynamodb.Table(this, 'ExercisesTable', {
      tableName: `yourpace-exercises-${props.environment}`,
      partitionKey: { name: 'workoutId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'exerciseId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy,
      pointInTimeRecoverySpecification: isProd ? { pointInTimeRecoveryEnabled: true } : undefined,
      deletionProtection: isProd,
    });

    // ============================================
    // DynamoDB — Goals
    // ============================================
    this.goalsTable = new dynamodb.Table(this, 'GoalsTable', {
      tableName: `yourpace-goals-${props.environment}`,
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'goalId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy,
      pointInTimeRecoverySpecification: isProd ? { pointInTimeRecoveryEnabled: true } : undefined,
      deletionProtection: isProd,
    });

    // ============================================
    // Stack Outputs
    // ============================================
    new cdk.CfnOutput(scope, 'AssetsBucketName', {
      value: this.assetsBucket.bucketName,
      description: 'S3 Assets Bucket Name',
    });

    new cdk.CfnOutput(scope, 'UsersTableName', {
      value: this.usersTable.tableName,
      description: 'DynamoDB Users Table',
    });

    new cdk.CfnOutput(scope, 'WorkoutsTableName', {
      value: this.workoutsTable.tableName,
      description: 'DynamoDB Workouts Table',
    });

    new cdk.CfnOutput(scope, 'ExercisesTableName', {
      value: this.exercisesTable.tableName,
      description: 'DynamoDB Exercises Table',
    });

    new cdk.CfnOutput(scope, 'GoalsTableName', {
      value: this.goalsTable.tableName,
      description: 'DynamoDB Goals Table',
    });
  }
}
