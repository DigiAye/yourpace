#!/bin/bash

# Setup SSM Parameters for Amplify Build
# This script creates AWS Systems Manager Parameter Store entries for all secrets
# that Amplify needs during the build process.
#
# Usage: Set environment variables, then run this script
#
# Required environment variables:
#   ENVIRONMENT (prod, staging, or dev)
#   COGNITO_REGION
#   COGNITO_USER_POOL_CLIENT_ID
#   COGNITO_AUTH_DOMAIN
#   AWS_CLOUDFRONT_DISTRIBUTION_ID
#   CLOUDFRONT_DOMAIN
#   DYNAMODB_USERS_TABLE
#   DYNAMODB_WORKOUTS_TABLE
#   DYNAMODB_EXERCISES_TABLE
#   DYNAMODB_GOALS_TABLE
#   S3_ASSETS_BUCKET
#   S3_FRONTEND_BUCKET
#   VPC_ID
#   LAMBDA_SECURITY_GROUP_ID
#   HOSTED_ZONE_ID
#   APP_URL
#
# Optional environment variables:
#   AWS_REGION (default: eu-west-1)
#   AWS_ACCOUNT_ID (default: 230984464810)
#
# Examples:
#   # Setup for production
#   export ENVIRONMENT=prod
#   export COGNITO_REGION=eu-west-1
#   export COGNITO_USER_POOL_CLIENT_ID=abc123...
#   export COGNITO_AUTH_DOMAIN=auth-prod.yourpace.cloud
#   ... (set all required variables)
#   ./scripts/setup-ssm-parameters.sh
#
#   # Setup for staging
#   export ENVIRONMENT=staging
#   export COGNITO_REGION=eu-west-1
#   export COGNITO_USER_POOL_CLIENT_ID=xyz789...
#   ... (set all required variables)
#   ./scripts/setup-ssm-parameters.sh

set -e

echo "🔧 Setting up SSM Parameters for YourPace Amplify builds..."
echo ""

# Validate required environment variables
required_vars=(
  "COGNITO_REGION"
  "COGNITO_USER_POOL_CLIENT_ID"
  "COGNITO_AUTH_DOMAIN"
  "AWS_CLOUDFRONT_DISTRIBUTION_ID"
  "CLOUDFRONT_DOMAIN"
  "DYNAMODB_USERS_TABLE"
  "DYNAMODB_WORKOUTS_TABLE"
  "DYNAMODB_EXERCISES_TABLE"
  "DYNAMODB_GOALS_TABLE"
  "S3_ASSETS_BUCKET"
  "S3_FRONTEND_BUCKET"
  "VPC_ID"
  "LAMBDA_SECURITY_GROUP_ID"
  "HOSTED_ZONE_ID"
  "APP_URL"
)

missing_vars=()
for var in "${required_vars[@]}"; do
  if [ -z "${!var}" ]; then
    missing_vars+=("$var")
  fi
done

if [ ${#missing_vars[@]} -gt 0 ]; then
  echo "❌ Missing required environment variables:"
  for var in "${missing_vars[@]}"; do
    echo "   - $var"
  done
  echo ""
  echo "Please set all required variables and try again."
  exit 1
fi

# Get values from environment or use defaults
AWS_REGION="${AWS_REGION:-eu-west-1}"
AWS_ACCOUNT_ID="${AWS_ACCOUNT_ID:-230984464810}"

echo "✅ All required environment variables are set"
echo ""

# Function to create or update SSM parameter
create_parameter() {
  local name=$1
  local value=$2
  local description=$3
  local secure=${4:-false}
  
  if [ -z "$value" ]; then
    echo "⚠️  Skipping $name (value not provided)"
    return
  fi
  
  local param_type="String"
  if [ "$secure" = "true" ]; then
    param_type="SecureString"
  fi
  
  echo "📝 Creating parameter: $name"
  
  aws ssm put-parameter \
    --name "$name" \
    --value "$value" \
    --type "$param_type" \
    --description "$description" \
    --overwrite \
    --region "$AWS_REGION" \
    --tags "Key=Project,Value=yourpace" "Key=ManagedBy,Value=infrastructure" \
    > /dev/null 2>&1 && echo "   ✅ Created" || echo "   ⚠️  Failed or already exists"
}

echo "📦 Creating Cognito parameters..."
create_parameter "/yourpace/cognito-region" "$COGNITO_REGION" "Cognito region"
create_parameter "/yourpace/cognito-client-id" "$COGNITO_USER_POOL_CLIENT_ID" "Cognito User Pool Client ID" "true"
create_parameter "/yourpace/cognito-domain" "$COGNITO_AUTH_DOMAIN" "Cognito custom domain" "true"

echo ""
echo "📦 Creating CloudFront parameters..."
create_parameter "/yourpace/cloudfront-distribution-id" "$AWS_CLOUDFRONT_DISTRIBUTION_ID" "CloudFront Distribution ID"
create_parameter "/yourpace/cloudfront-domain" "$CLOUDFRONT_DOMAIN" "CloudFront domain name"

echo ""
echo "📦 Creating AWS configuration parameters..."
create_parameter "/yourpace/aws-region" "$AWS_REGION" "AWS region"
create_parameter "/yourpace/aws-account-id" "$AWS_ACCOUNT_ID" "AWS account ID"

echo ""
echo "📦 Creating DynamoDB table parameters..."
create_parameter "/yourpace/dynamodb-users-table" "$DYNAMODB_USERS_TABLE" "DynamoDB Users table name"
create_parameter "/yourpace/dynamodb-workouts-table" "$DYNAMODB_WORKOUTS_TABLE" "DynamoDB Workouts table name"
create_parameter "/yourpace/dynamodb-exercises-table" "$DYNAMODB_EXERCISES_TABLE" "DynamoDB Exercises table name"
create_parameter "/yourpace/dynamodb-goals-table" "$DYNAMODB_GOALS_TABLE" "DynamoDB Goals table name"

echo ""
echo "📦 Creating S3 bucket parameters..."
create_parameter "/yourpace/s3-assets-bucket" "$S3_ASSETS_BUCKET" "S3 Assets bucket name"
create_parameter "/yourpace/s3-frontend-bucket" "$S3_FRONTEND_BUCKET" "S3 Frontend bucket name"

echo ""
echo "📦 Creating VPC parameters..."
create_parameter "/yourpace/vpc-id" "$VPC_ID" "VPC ID"
create_parameter "/yourpace/lambda-security-group-id" "$LAMBDA_SECURITY_GROUP_ID" "Lambda Security Group ID"

echo ""
echo "📦 Creating Route53 parameters..."
create_parameter "/yourpace/hosted-zone-id" "$HOSTED_ZONE_ID" "Route53 Hosted Zone ID"

echo ""
echo "📦 Creating App URL parameter..."
create_parameter "/yourpace/app-url" "$APP_URL" "Application URL"

echo ""
echo "✅ SSM Parameters setup complete!"
echo ""
echo "📋 To verify parameters were created:"
echo "   aws ssm get-parameters-by-path --path /yourpace --recursive --region $AWS_REGION"
