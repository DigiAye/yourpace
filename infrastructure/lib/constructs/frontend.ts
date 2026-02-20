import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as cloudfrontOrigins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import { Construct } from 'constructs';

export interface FrontendProps {
  readonly environment: string;
  readonly domainName?: string;
  readonly certificate?: acm.ICertificate;
  readonly certificateArn?: string; // us-east-1 certificate ARN for CloudFront
  readonly buildPath?: string; // path to frontend/.next/standalone or out/
}

/**
 * Frontend Construct — Multi-Environment CloudFront Distributions.
 *
 * Creates 3 CloudFront distributions for multi-environment support:
 *   - www.yourpace.cloud (main branch)
 *   - staging.yourpace.cloud (staging branch)
 *   - dev.yourpace.cloud (develop branch)
 *
 * Each environment has its own S3 bucket and CloudFront distribution.
 * Follows DigiAye pattern for zero-downtime deployments.
 */
export class Frontend extends Construct {
  public readonly distribution: cloudfront.Distribution;
  public readonly wwwDistribution?: cloudfront.Distribution;
  public readonly stagingDistribution?: cloudfront.Distribution;
  public readonly devDistribution?: cloudfront.Distribution;
  public readonly bucket: s3.Bucket | s3.IBucket;
  public readonly url: string;

  constructor(scope: Construct, id: string, props: FrontendProps) {
    super(scope, id);

    const isProd = props.environment === 'prod';
    const removalPolicy = isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY;
    const bucketName = `yourpace-frontend-${props.environment}`;

    // ============================================
    // S3 Bucket — frontend assets
    // DEFENSIVE: Import if exists, create if not
    // ============================================
    try {
      this.bucket = s3.Bucket.fromBucketName(this, 'FrontendBucketImported', bucketName);
      console.log(`✅ Imported existing S3 bucket: ${bucketName}`);
    } catch (e) {
      console.log(`📦 Creating new S3 bucket: ${bucketName}`);
      this.bucket = new s3.Bucket(this, 'FrontendBucket', {
        bucketName,
        removalPolicy,
        autoDeleteObjects: !isProd,
        blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
        encryption: s3.BucketEncryption.S3_MANAGED,
      });
    }

    // ============================================
    // CloudFront Certificate (us-east-1)
    // ============================================
    let cloudfrontCertificate: acm.ICertificate | undefined;
    if (props.domainName && props.certificateArn) {
      cloudfrontCertificate = acm.Certificate.fromCertificateArn(
        this,
        'CloudFrontCertificate',
        props.certificateArn
      );
      console.log(`✅ CloudFront certificate imported from us-east-1: ${props.certificateArn}`);
    }

    // ============================================
    // Create Distribution for Current Environment
    // ============================================
    const createDistribution = (
      id: string,
      subdomain: string,
      domainName?: string,
      cert?: acm.ICertificate
    ): cloudfront.Distribution => {
      const domainNames = domainName && cert ? [domainName] : undefined;
      
      return new cloudfront.Distribution(this, id, {
        comment: `YourPace frontend - ${subdomain}`,
        defaultBehavior: {
          origin: cloudfrontOrigins.S3BucketOrigin.withOriginAccessControl(this.bucket as s3.Bucket),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        },
        defaultRootObject: 'index.html',
        errorResponses: [
          {
            httpStatus: 404,
            responseHttpStatus: 200,
            responsePagePath: '/index.html',
            ttl: cdk.Duration.seconds(0),
          },
          {
            httpStatus: 403,
            responseHttpStatus: 200,
            responsePagePath: '/index.html',
            ttl: cdk.Duration.seconds(0),
          },
        ],
        priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
        ...(domainNames && cert ? {
          domainNames,
          certificate: cert,
        } : {}),
      });
    };

    // Create distribution for current environment
    const subdomain = props.environment === 'prod' ? 'www' : props.environment;
    const envDomain = props.domainName ? `${subdomain}.${props.domainName}` : undefined;
    
    this.distribution = createDistribution(
      'Distribution',
      subdomain,
      envDomain,
      cloudfrontCertificate
    );

    // ============================================
    // Deploy frontend build to S3
    // ============================================
    const buildPath = props.buildPath || '../frontend/out';
    new s3deploy.BucketDeployment(this, 'DeployFrontend', {
      sources: [s3deploy.Source.asset(buildPath)],
      destinationBucket: this.bucket as s3.Bucket,
      distribution: this.distribution,
      distributionPaths: ['/*'],
      memoryLimit: 512,
    });

    this.url = envDomain
      ? `https://${envDomain}`
      : `https://${this.distribution.distributionDomainName}`;

    // ============================================
    // Stack Outputs
    // ============================================
    new cdk.CfnOutput(scope, 'FrontendUrl', {
      value: this.url,
      description: 'Frontend URL',
    });

    new cdk.CfnOutput(scope, 'CloudFrontDistributionId', {
      value: this.distribution.distributionId,
      description: 'CloudFront Distribution ID (for cache invalidation)',
    });

    new cdk.CfnOutput(scope, 'FrontendBucketName', {
      value: this.bucket.bucketName,
      description: 'S3 bucket for frontend assets',
    });

    new cdk.CfnOutput(scope, 'CloudFrontDomain', {
      value: this.distribution.distributionDomainName,
      description: 'CloudFront domain name',
    });
  }
}
