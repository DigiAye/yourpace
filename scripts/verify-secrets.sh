#!/bin/bash

# Verify GitHub Secrets Configuration
# This script checks that all required secrets are set for OIDC authentication to work

set -e

echo "🔍 Verifying GitHub Secrets Configuration..."
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track missing secrets
MISSING_SECRETS=()
FOUND_SECRETS=()

# Critical secrets for OIDC authentication
CRITICAL_SECRETS=(
  "COGNITO_USER_POOL_CLIENT_ID"
  "COGNITO_AUTH_DOMAIN_PROD"
  "COGNITO_REGION"
)

# Other required secrets for frontend build
REQUIRED_SECRETS=(
  "APP_URL"
  "AWS_CLOUDFRONT_DISTRIBUTION_ID_PROD"
  "CLOUDFRONT_DOMAIN_PROD"
  "AWS_REGION"
  "AWS_ACCOUNT_ID"
  "DYNAMODB_USERS_TABLE"
  "DYNAMODB_WORKOUTS_TABLE"
  "DYNAMODB_EXERCISES_TABLE"
  "DYNAMODB_GOALS_TABLE"
  "S3_ASSETS_BUCKET"
  "S3_FRONTEND_BUCKET"
  "VPC_ID"
  "LAMBDA_SECURITY_GROUP_ID"
  "HOSTED_ZONE_ID"
)

# Get list of all secrets
ALL_SECRETS=$(gh secret list --json name -q '.[].name')

echo "📋 Checking CRITICAL secrets (required for OIDC):"
echo ""

for secret in "${CRITICAL_SECRETS[@]}"; do
  if echo "$ALL_SECRETS" | grep -q "^${secret}$"; then
    echo -e "${GREEN}✅${NC} $secret"
    FOUND_SECRETS+=("$secret")
  else
    echo -e "${RED}❌${NC} $secret"
    MISSING_SECRETS+=("$secret")
  fi
done

echo ""
echo "📋 Checking OTHER required secrets:"
echo ""

for secret in "${REQUIRED_SECRETS[@]}"; do
  if echo "$ALL_SECRETS" | grep -q "^${secret}$"; then
    echo -e "${GREEN}✅${NC} $secret"
    FOUND_SECRETS+=("$secret")
  else
    echo -e "${YELLOW}⚠️${NC}  $secret (optional but recommended)"
    MISSING_SECRETS+=("$secret")
  fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if critical secrets are missing
CRITICAL_MISSING=()
for secret in "${CRITICAL_SECRETS[@]}"; do
  if ! echo "$ALL_SECRETS" | grep -q "^${secret}$"; then
    CRITICAL_MISSING+=("$secret")
  fi
done

if [ ${#CRITICAL_MISSING[@]} -eq 0 ]; then
  echo -e "${GREEN}✅ All CRITICAL secrets are configured!${NC}"
  echo ""
  echo "Your OIDC authentication should work correctly."
  echo ""
  echo "Next steps:"
  echo "1. Push changes to main/staging/develop branch"
  echo "2. Amplify will build with these environment variables"
  echo "3. OIDC will initialize with correct authority and client_id"
  echo ""
else
  echo -e "${RED}❌ CRITICAL secrets are MISSING!${NC}"
  echo ""
  echo "The following secrets MUST be set for OIDC to work:"
  for secret in "${CRITICAL_MISSING[@]}"; do
    echo "  - $secret"
  done
  echo ""
  echo "To add these secrets:"
  echo "1. Go to GitHub repository Settings → Secrets and variables → Actions"
  echo "2. Click 'New repository secret'"
  echo "3. Add each missing secret"
  echo ""
  echo "See docs/GITHUB_SECRETS.md for details on getting these values"
  exit 1
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
