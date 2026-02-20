import { CloudFrontClient, CreateInvalidationCommand } from '@aws-sdk/client-cloudfront';

const cloudfront = new CloudFrontClient({ region: 'us-east-1' });

/**
 * Lambda function to invalidate CloudFront cache on Amplify build completion.
 * 
 * Triggered by EventBridge when an Amplify build completes successfully.
 * Invalidates the appropriate CloudFront distribution based on the branch.
 * 
 * Environment Variables:
 * - DISTRIBUTION_ID_MAIN: CloudFront distribution ID for main branch (prod)
 * - DISTRIBUTION_ID_STAGING: CloudFront distribution ID for staging branch
 * - DISTRIBUTION_ID_DEVELOP: CloudFront distribution ID for develop branch
 */

interface AmplifyBuildEvent {
  detail: {
    appId: string;
    branchName: string;
    jobId: string;
    jobStatus: string;
    commitId: string;
    commitMessage: string;
  };
}

export const handler = async (event: AmplifyBuildEvent): Promise<void> => {
  console.log('📨 Received Amplify build event:', JSON.stringify(event, null, 2));

  const { appId, branchName, jobId, jobStatus, commitId, commitMessage } = event.detail;

  // Only process successful builds
  if (jobStatus !== 'SUCCEED') {
    console.log(`⏭️  Skipping cache invalidation for build status: ${jobStatus}`);
    return;
  }

  // Map branch to distribution ID
  let distributionId: string | undefined;
  switch (branchName) {
    case 'main':
      distributionId = process.env.DISTRIBUTION_ID_MAIN;
      break;
    case 'staging':
      distributionId = process.env.DISTRIBUTION_ID_STAGING;
      break;
    case 'develop':
      distributionId = process.env.DISTRIBUTION_ID_DEVELOP;
      break;
    default:
      console.warn(`⚠️  No CloudFront distribution configured for branch: ${branchName}`);
      return;
  }

  if (!distributionId) {
    console.error(`❌ Distribution ID not found for branch: ${branchName}`);
    throw new Error(`Missing DISTRIBUTION_ID_${branchName.toUpperCase()} environment variable`);
  }

  try {
    console.log(`🔄 Invalidating CloudFront cache for ${branchName} (Distribution: ${distributionId})`);
    console.log(`   Amplify App: ${appId}`);
    console.log(`   Build Job: ${jobId}`);
    console.log(`   Commit: ${commitId}`);
    console.log(`   Message: ${commitMessage}`);

    // Create invalidation for all paths
    const command = new CreateInvalidationCommand({
      DistributionId: distributionId,
      InvalidationBatch: {
        Paths: {
          Quantity: 1,
          Items: ['/*'],
        },
        CallerReference: `amplify-${jobId}-${Date.now()}`,
      },
    });

    const response = await cloudfront.send(command);

    console.log(`✅ CloudFront cache invalidation created successfully`);
    console.log(`   Invalidation ID: ${response.Invalidation?.Id}`);
    console.log(`   Status: ${response.Invalidation?.Status}`);
    console.log(`   Created: ${response.Invalidation?.CreateTime}`);

  } catch (error) {
    console.error(`❌ Failed to invalidate CloudFront cache:`, error);
    throw error;
  }
};
