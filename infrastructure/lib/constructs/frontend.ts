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
  readonly certificate?: acm.ICertificate; // eu-west-1 certificate for CloudFront
  readonly buildPath?: string; // path to frontend/.next/standalone or out/
  readonly amplifyDomainMain?: string; // Amplify domain for main branch (e.g., main.d32w5qjq8u9hab.amplifyapp.com)
  readonly amplifyDomainStaging?: string; // Amplify domain for staging branch
  readonly amplifyDomainDevelop?: string; // Amplify domain for develop branch
}

/**
 * Frontend Construct — Multi-Environment CloudFront Distributions.
 *
 * Creates 3 CloudFront distributions for multi-environment support:
 *   - www.yourpace.cloud (prod)
 *   - staging.yourpace.cloud (staging)
 *   - dev.yourpace.cloud (dev)
 *
 * Each environment has its own S3 bucket and CloudFront distribution.
 * Follows DigiAye pattern: ONE stack with THREE distributions.
 */
export class Frontend extends Construct {
  public readonly distribution: cloudfront.Distribution;
  public readonly wwwDistribution: cloudfront.Distribution;
  public readonly stagingDistribution: cloudfront.Distribution;
  public readonly devDistribution: cloudfront.Distribution;
  public readonly bucket: s3.Bucket | s3.IBucket;
  public readonly url: string;

  constructor(scope: Construct, id: string, props: FrontendProps) {
    super(scope, id);

    const isProd = props.environment === 'prod';
    const removalPolicy = isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY;

    // Certificate is passed directly from YourPaceStack
    const cloudfrontCertificate = props.certificate;

    // ============================================
    // Create Distribution Factory
    // ============================================
    const createDistribution = (
      id: string,
      subdomain: string,
      amplifyDomain: string,
      domainNames?: string[],
      cert?: acm.ICertificate
    ): cloudfront.Distribution => {
      // Create HTTP origin pointing to Amplify domain
      const amplifyOrigin = new cloudfrontOrigins.HttpOrigin(amplifyDomain, {
        protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
      });
      
      const distribution = new cloudfront.Distribution(this, id, {
        comment: `YourPace frontend - ${subdomain}`,
        defaultBehavior: {
          origin: amplifyOrigin,
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

      return distribution;
    };

    // ============================================
    // Create All 3 Distributions
    // ============================================
    // Use Amplify domains if provided, otherwise use placeholder domains
    const amplifyDomainMain = props.amplifyDomainMain || 'main.amplifyapp.com';
    const amplifyDomainStaging = props.amplifyDomainStaging || 'staging.amplifyapp.com';
    const amplifyDomainDevelop = props.amplifyDomainDevelop || 'develop.amplifyapp.com';

    // Prod (www) - include both www and apex domain
    const prodDomainNames = props.domainName && cloudfrontCertificate 
      ? [`www.${props.domainName}`, props.domainName]
      : undefined;
    
    this.wwwDistribution = createDistribution(
      'WwwDistribution',
      'www',
      amplifyDomainMain,
      prodDomainNames,
      cloudfrontCertificate
    );

    // Staging
    this.stagingDistribution = createDistribution(
      'StagingDistribution',
      'staging',
      amplifyDomainStaging,
      props.domainName && cloudfrontCertificate ? [`staging.${props.domainName}`] : undefined,
      cloudfrontCertificate
    );

    // Dev
    this.devDistribution = createDistribution(
      'DevDistribution',
      'dev',
      amplifyDomainDevelop,
      props.domainName && cloudfrontCertificate ? [`dev.${props.domainName}`] : undefined,
      cloudfrontCertificate
    );

    // Set primary distribution based on environment
    if (props.environment === 'prod') {
      this.distribution = this.wwwDistribution;
      this.bucket = s3.Bucket.fromBucketName(this, 'PrimaryBucket', 'yourpace-frontend-prod');
    } else if (props.environment === 'staging') {
      this.distribution = this.stagingDistribution;
      this.bucket = s3.Bucket.fromBucketName(this, 'PrimaryBucket', 'yourpace-frontend-staging');
    } else {
      this.distribution = this.devDistribution;
      this.bucket = s3.Bucket.fromBucketName(this, 'PrimaryBucket', 'yourpace-frontend-dev');
    }

    // ============================================
    // Deploy frontend build to S3 (prod only)
    // ============================================
    // Only deploy frontend for prod environment
    // Dev/staging frontends deployed separately via manual S3 sync
    if (props.environment === 'prod') {
      const buildPath = props.buildPath || '../frontend/out';
      new s3deploy.BucketDeployment(this, 'DeployFrontend', {
        sources: [s3deploy.Source.asset(buildPath)],
        destinationBucket: this.bucket as s3.Bucket,
        distribution: this.distribution,
        distributionPaths: ['/*'],
        memoryLimit: 512,
      });
      console.log(`✅ Frontend deployed to S3 (prod)`);
    } else {
      console.log(`⏭️  Skipping frontend deployment for ${props.environment} (deploy manually via S3 sync)`);
    }

    const subdomain = props.environment === 'prod' ? 'www' : props.environment;
    this.url = props.domainName
      ? `https://${subdomain}.${props.domainName}`
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

    // Output all 3 distribution IDs
    new cdk.CfnOutput(scope, 'WwwDistributionId', {
      value: this.wwwDistribution.distributionId,
      description: 'CloudFront Distribution ID for www (prod)',
    });

    new cdk.CfnOutput(scope, 'StagingDistributionId', {
      value: this.stagingDistribution.distributionId,
      description: 'CloudFront Distribution ID for staging',
    });

    new cdk.CfnOutput(scope, 'DevDistributionId', {
      value: this.devDistribution.distributionId,
      description: 'CloudFront Distribution ID for dev',
    });
  }
}
