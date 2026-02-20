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
 * DEFENSIVE HYBRID: Imports existing resources if they exist, creates new ones if not.
 * This allows safe re-deployments without conflicts.
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
  public readonly assetsBucket: s3.Bucket | s3.IBucket;
  public readonly usersTable: dynamodb.Table | dynamodb.ITable;
  public readonly workoutsTable: dynamodb.Table | dynamodb.ITable;
  public readonly exercisesTable: dynamodb.Table | dynamodb.ITable;
  public readonly goalsTable: dynamodb.Table | dynamodb.ITable;

  constructor(scope: Construct, id: string, props: StorageProps) {
    super(scope, id);

    const isProd = props.environment === 'prod';
    const removalPolicy = isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY;

    // ============================================
    // Helper: Import or create S3 bucket
    // ============================================
    const importOrCreateBucket = (name: string): s3.Bucket | s3.IBucket => {
      try {
        const bucket = s3.Bucket.fromBucketName(this, `${name}Imported`, name);
        console.log(`✅ Imported existing S3 bucket: ${name}`);
        return bucket;
      } catch (e) {
        console.log(`📦 Creating new S3 bucket: ${name}`);
        return new s3.Bucket(this, name, {
          bucketName: name,
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
      }
    };

    // ============================================
    // Helper: Import or create DynamoDB table
    // ============================================
    const importOrCreateTable = (
      name: string,
      pk: { name: string; type: dynamodb.AttributeType },
      sk?: { name: string; type: dynamodb.AttributeType }
    ): dynamodb.Table | dynamodb.ITable => {
      try {
        const table = dynamodb.Table.fromTableName(this, `${name}Imported`, name);
        console.log(`✅ Imported existing DynamoDB table: ${name}`);
        return table;
      } catch (e) {
        console.log(`📦 Creating new DynamoDB table: ${name}`);
        return new dynamodb.Table(this, name, {
          tableName: name,
          partitionKey: pk,
          sortKey: sk,
          billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
          removalPolicy,
          pointInTimeRecoverySpecification: isProd ? { pointInTimeRecoveryEnabled: true } : undefined,
          deletionProtection: isProd,
        });
      }
    };

    // ============================================
    // S3 — Static assets & backups
    // ============================================
    const assetsBucketName = `yourpace-assets-${props.environment}`;
    this.assetsBucket = importOrCreateBucket(assetsBucketName);

    // ============================================
    // DynamoDB — Users
    // ============================================
    const usersTableName = `yourpace-users-${props.environment}`;
    this.usersTable = importOrCreateTable(usersTableName, {
      name: 'userId',
      type: dynamodb.AttributeType.STRING,
    });

    // Add GSI if newly created
    if (this.usersTable instanceof dynamodb.Table) {
      this.usersTable.addGlobalSecondaryIndex({
        indexName: 'email-index',
        partitionKey: { name: 'email', type: dynamodb.AttributeType.STRING },
        projectionType: dynamodb.ProjectionType.ALL,
      });
    }

    // ============================================
    // DynamoDB — Workouts
    // ============================================
    const workoutsTableName = `yourpace-workouts-${props.environment}`;
    this.workoutsTable = importOrCreateTable(
      workoutsTableName,
      { name: 'userId', type: dynamodb.AttributeType.STRING },
      { name: 'workoutId', type: dynamodb.AttributeType.STRING }
    );

    // Add GSI if newly created
    if (this.workoutsTable instanceof dynamodb.Table) {
      this.workoutsTable.addGlobalSecondaryIndex({
        indexName: 'date-index',
        partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
        sortKey: { name: 'date', type: dynamodb.AttributeType.STRING },
        projectionType: dynamodb.ProjectionType.ALL,
      });
    }

    // ============================================
    // DynamoDB — Exercises
    // ============================================
    const exercisesTableName = `yourpace-exercises-${props.environment}`;
    this.exercisesTable = importOrCreateTable(
      exercisesTableName,
      { name: 'workoutId', type: dynamodb.AttributeType.STRING },
      { name: 'exerciseId', type: dynamodb.AttributeType.STRING }
    );

    // ============================================
    // DynamoDB — Goals
    // ============================================
    const goalsTableName = `yourpace-goals-${props.environment}`;
    this.goalsTable = importOrCreateTable(
      goalsTableName,
      { name: 'userId', type: dynamodb.AttributeType.STRING },
      { name: 'goalId', type: dynamodb.AttributeType.STRING }
    );

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
