#!/bin/bash

# Validate Amplify Build Configuration
# This script simulates what Amplify will do during the build process
# It checks that all GitHub Secrets are available and will be correctly substituted

set -e

echo "🔍 Validating Amplify Build Configuration..."
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get the current branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo "📍 Current branch: $CURRENT_BRANCH"
echo ""

# Parse amplify.yml to get all variable references
echo "📋 Parsing amplify.yml..."
echo ""

# Extract all $VARIABLE references from amplify.yml
VARIABLES=$(grep -oE '\$[A-Z][A-Z0-9_]+' amplify.yml | sort -u | sed 's/\$//')

# Get branch-specific variables
BRANCH_VARIABLES=$(grep -A 10 "branches:" amplify.yml | grep -oE '\$[A-Z][A-Z0-9_]+' | sort -u | sed 's/\$//')

# Combine all variables and filter out empty lines
ALL_VARIABLES=$(echo -e "$VARIABLES\n$BRANCH_VARIABLES" | sort -u | grep -v '^$')

echo "🔧 Variables referenced in amplify.yml:"
echo "$ALL_VARIABLES" | while read var; do
  echo "  - $var"
done
echo ""

# Get all GitHub Secrets
echo "🔐 Fetching GitHub Secrets..."
GH_SECRETS=$(gh secret list --json name -q '.[].name')
echo ""

# Check each variable
MISSING_VARS=()
FOUND_VARS=()

echo "✅ Checking variable availability:"
echo ""

for var in $ALL_VARIABLES; do
  if echo "$GH_SECRETS" | grep -q "^${var}$"; then
    echo -e "${GREEN}✅${NC} $var"
    FOUND_VARS+=("$var")
  else
    echo -e "${RED}❌${NC} $var (MISSING)"
    MISSING_VARS+=("$var")
  fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Determine which branch-specific variables should be used
case "$CURRENT_BRANCH" in
  main)
    BRANCH_NAME="main"
    EXPECTED_COGNITO_DOMAIN_VAR="COGNITO_AUTH_DOMAIN_PROD"
    EXPECTED_CLOUDFRONT_DIST_VAR="AWS_CLOUDFRONT_DISTRIBUTION_ID_PROD"
    ;;
  staging)
    BRANCH_NAME="staging"
    EXPECTED_COGNITO_DOMAIN_VAR="COGNITO_AUTH_DOMAIN_STAGING"
    EXPECTED_CLOUDFRONT_DIST_VAR="AWS_CLOUDFRONT_DISTRIBUTION_ID_STAGING"
    ;;
  develop)
    BRANCH_NAME="develop"
    EXPECTED_COGNITO_DOMAIN_VAR="COGNITO_AUTH_DOMAIN_DEV"
    EXPECTED_CLOUDFRONT_DIST_VAR="AWS_CLOUDFRONT_DISTRIBUTION_ID_DEV"
    ;;
  *)
    BRANCH_NAME="unknown"
    EXPECTED_COGNITO_DOMAIN_VAR=""
    EXPECTED_CLOUDFRONT_DIST_VAR=""
    ;;
esac

echo "🌿 Branch-Specific Configuration for '$BRANCH_NAME':"
echo ""

if [ -n "$EXPECTED_COGNITO_DOMAIN_VAR" ]; then
  if echo "$GH_SECRETS" | grep -q "^${EXPECTED_COGNITO_DOMAIN_VAR}$"; then
    echo -e "${GREEN}✅${NC} NEXT_PUBLIC_COGNITO_DOMAIN will use: $EXPECTED_COGNITO_DOMAIN_VAR"
  else
    echo -e "${RED}❌${NC} NEXT_PUBLIC_COGNITO_DOMAIN secret missing: $EXPECTED_COGNITO_DOMAIN_VAR"
  fi
  
  if echo "$GH_SECRETS" | grep -q "^${EXPECTED_CLOUDFRONT_DIST_VAR}$"; then
    echo -e "${GREEN}✅${NC} NEXT_PUBLIC_CLOUDFRONT_DISTRIBUTION_ID will use: $EXPECTED_CLOUDFRONT_DIST_VAR"
  else
    echo -e "${YELLOW}⚠️${NC}  NEXT_PUBLIC_CLOUDFRONT_DISTRIBUTION_ID secret missing: $EXPECTED_CLOUDFRONT_DIST_VAR (optional)"
  fi
else
  echo -e "${YELLOW}⚠️${NC}  Unknown branch: $CURRENT_BRANCH"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check critical OIDC variables
echo "🔐 Critical OIDC Variables:"
echo ""

CRITICAL_VARS=(
  "COGNITO_REGION"
  "COGNITO_USER_POOL_CLIENT_ID"
  "$EXPECTED_COGNITO_DOMAIN_VAR"
)

CRITICAL_MISSING=()
for var in "${CRITICAL_VARS[@]}"; do
  if [ -z "$var" ]; then
    continue
  fi
  
  if echo "$GH_SECRETS" | grep -q "^${var}$"; then
    echo -e "${GREEN}✅${NC} $var"
  else
    echo -e "${RED}❌${NC} $var (MISSING)"
    CRITICAL_MISSING+=("$var")
  fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Summary
if [ ${#MISSING_VARS[@]} -eq 0 ] && [ ${#CRITICAL_MISSING[@]} -eq 0 ]; then
  echo -e "${GREEN}✅ All variables are available!${NC}"
  echo ""
  echo "Amplify build will succeed with the following configuration:"
  echo ""
  echo "  NEXT_PUBLIC_COGNITO_REGION: (from COGNITO_REGION)"
  echo "  NEXT_PUBLIC_COGNITO_CLIENT_ID: (from COGNITO_USER_POOL_CLIENT_ID)"
  echo "  NEXT_PUBLIC_COGNITO_DOMAIN: (from $EXPECTED_COGNITO_DOMAIN_VAR)"
  echo ""
  echo "OIDC will initialize with:"
  echo "  authority: https://<cognito-domain>"
  echo "  client_id: <client-id>"
  echo ""
  exit 0
else
  echo -e "${RED}❌ Some variables are missing!${NC}"
  echo ""
  
  if [ ${#CRITICAL_MISSING[@]} -gt 0 ]; then
    echo "Critical missing variables:"
    for var in "${CRITICAL_MISSING[@]}"; do
      echo "  - $var"
    done
    echo ""
  fi
  
  if [ ${#MISSING_VARS[@]} -gt 0 ]; then
    echo "Optional missing variables:"
    for var in "${MISSING_VARS[@]}"; do
      echo "  - $var"
    done
    echo ""
  fi
  
  echo "To add missing secrets:"
  echo "  gh secret set SECRET_NAME --body 'value'"
  echo ""
  exit 1
fi
