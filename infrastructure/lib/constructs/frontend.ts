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
  readonly buildPath?: string; // path to frontend/.next/standalone or out/
}

/**
 * Frontend Construct — S3 + CloudFront for Next.js static export.
 *
 * DEFENSIVE HYBRID: Imports existing S3 bucket if it exists, creates new one if not.
 * This allows safe re-deployments without conflicts.
 *
 * Serves the Next.js app via CloudFront CDN.
 * For dev: no custom domain, just the CloudFront URL.
 * For prod: custom domain (yourpace.cloud) with ACM cert.
 */
export class Frontend extends Construct {
  public readonly distribution: cloudfront.Distribution;
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
    // CloudFront Distribution
    // ============================================
    // Use custom domain + certificate if provided
    // Certificate can be passed directly or imported by ARN
    const domainNames = props.domainName && props.certificate
      ? [props.domainName, `www.${props.domainName}`]
      : undefined;

    const distributionConfig: cloudfront.DistributionProps = {
      comment: `YourPace frontend - ${props.environment}`,
      defaultBehavior: {
        origin: cloudfrontOrigins.S3BucketOrigin.withOriginAccessControl(this.bucket as s3.Bucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        // SPA routing — serve index.html for all 404s
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
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100, // US + Europe only (cheapest)
      ...(domainNames && props.certificate ? {
        domainNames,
        certificate: props.certificate,
      } : {}),
    };

    this.distribution = new cloudfront.Distribution(this, 'Distribution', distributionConfig);

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

    this.url = props.domainName
      ? `https://${props.domainName}`
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
