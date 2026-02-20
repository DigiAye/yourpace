#!/bin/bash

# Setup Cognito Custom Domain for YourPace
# This script automates the manual steps to configure auth.yourpace.cloud
# 
# Prerequisites:
#   - AWS CLI installed and configured
#   - User Pool ID from CDK outputs
#   - Hosted Zone ID from CDK outputs
#   - Cognito certificate in us-east-1

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
DOMAIN_NAME="${DOMAIN_NAME:-auth.yourpace.cloud}"
REGION="${REGION:-eu-west-1}"
PROFILE="${PROFILE:-yourpace-prod}"

# Function to print colored output
print_info() {
    echo -e "${GREEN}ℹ${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Validate prerequisites
validate_prerequisites() {
    print_info "Validating prerequisites..."
    
    if ! command_exists aws; then
        print_error "AWS CLI not found. Please install it first."
        exit 1
    fi
    
    if ! command_exists jq; then
        print_warning "jq not found. Some features may not work. Install with: brew install jq"
    fi
    
    print_success "Prerequisites validated"
}

# Get Cognito certificate ARN
get_certificate_arn() {
    print_info "Getting Cognito certificate ARN from us-east-1..."
    
    CERT_ARN=$(aws acm list-certificates \
        --region us-east-1 \
        --profile "$PROFILE" \
        --query "CertificateSummaryList[?DomainName=='yourpace.cloud'].CertificateArn" \
        --output text 2>/dev/null)
    
    if [ -z "$CERT_ARN" ]; then
        print_error "Could not find certificate for yourpace.cloud in us-east-1"
        exit 1
    fi
    
    print_success "Certificate ARN: $CERT_ARN"
}

# Get User Pool ID
get_user_pool_id() {
    print_info "Enter User Pool ID (from CDK outputs):"
    read -r USER_POOL_ID
    
    if [ -z "$USER_POOL_ID" ]; then
        print_error "User Pool ID is required"
        exit 1
    fi
    
    print_success "User Pool ID: $USER_POOL_ID"
}

# Get Hosted Zone ID
get_hosted_zone_id() {
    print_info "Enter Hosted Zone ID (from CDK outputs or Route53 console):"
    read -r HOSTED_ZONE_ID
    
    if [ -z "$HOSTED_ZONE_ID" ]; then
        print_error "Hosted Zone ID is required"
        exit 1
    fi
    
    print_success "Hosted Zone ID: $HOSTED_ZONE_ID"
}

# Create Cognito custom domain
create_cognito_domain() {
    print_info "Creating Cognito custom domain: $DOMAIN_NAME..."
    
    RESPONSE=$(aws cognito-idp create-user-pool-domain \
        --domain "$DOMAIN_NAME" \
        --user-pool-id "$USER_POOL_ID" \
        --custom-domain-config "CertificateArn=$CERT_ARN" \
        --region "$REGION" \
        --profile "$PROFILE" 2>&1)
    
    if echo "$RESPONSE" | grep -q "CloudFrontDomain"; then
        CLOUDFRONT_DOMAIN=$(echo "$RESPONSE" | jq -r '.CloudFrontDomain' 2>/dev/null || echo "$RESPONSE" | grep -oP 'CloudFrontDomain["\s:]*\K[^"]+')
        print_success "Cognito domain created"
        print_info "CloudFront Domain: $CLOUDFRONT_DOMAIN"
    else
        print_error "Failed to create Cognito domain"
        echo "$RESPONSE"
        exit 1
    fi
}

# Create Route53 CNAME record
create_dns_record() {
    print_info "Creating Route53 CNAME record..."
    
    CHANGE_BATCH=$(cat <<EOF
{
  "Changes": [{
    "Action": "CREATE",
    "ResourceRecordSet": {
      "Name": "$DOMAIN_NAME",
      "Type": "CNAME",
      "TTL": 300,
      "ResourceRecords": [{"Value": "$CLOUDFRONT_DOMAIN"}]
    }
  }]
}
EOF
)
    
    RESPONSE=$(aws route53 change-resource-record-sets \
        --hosted-zone-id "$HOSTED_ZONE_ID" \
        --change-batch "$CHANGE_BATCH" \
        --region "$REGION" \
        --profile "$PROFILE" 2>&1)
    
    if echo "$RESPONSE" | grep -q "PENDING\|INSYNC"; then
        print_success "DNS CNAME record created"
    else
        print_error "Failed to create DNS record"
        echo "$RESPONSE"
        exit 1
    fi
}

# Wait for domain to be active
wait_for_domain() {
    print_info "Waiting for domain to be provisioned (this may take 5-10 minutes)..."
    
    MAX_ATTEMPTS=60
    ATTEMPT=0
    
    while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
        STATUS=$(aws cognito-idp describe-user-pool-domain \
            --domain "$DOMAIN_NAME" \
            --region "$REGION" \
            --profile "$PROFILE" \
            --query 'DomainDescription.Status' \
            --output text 2>/dev/null)
        
        if [ "$STATUS" = "ACTIVE" ]; then
            print_success "Domain is now ACTIVE"
            return 0
        elif [ "$STATUS" = "CREATING" ]; then
            echo -ne "\rStatus: CREATING... (attempt $((ATTEMPT + 1))/$MAX_ATTEMPTS)"
            sleep 10
            ATTEMPT=$((ATTEMPT + 1))
        else
            print_warning "Unexpected status: $STATUS"
            sleep 10
            ATTEMPT=$((ATTEMPT + 1))
        fi
    done
    
    print_warning "Domain provisioning timed out. Check status manually:"
    print_info "aws cognito-idp describe-user-pool-domain --domain $DOMAIN_NAME --region $REGION --profile $PROFILE"
}

# Verify domain is accessible
verify_domain() {
    print_info "Verifying domain is accessible..."
    
    if command_exists curl; then
        HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "https://$DOMAIN_NAME/login" 2>/dev/null || echo "000")
        
        if [ "$HTTP_CODE" = "200" ]; then
            print_success "Domain is accessible (HTTP $HTTP_CODE)"
        else
            print_warning "Domain returned HTTP $HTTP_CODE (may still be provisioning)"
        fi
    else
        print_warning "curl not found, skipping accessibility check"
    fi
}

# Main execution
main() {
    echo ""
    print_info "YourPace Cognito Custom Domain Setup"
    echo ""
    
    validate_prerequisites
    get_certificate_arn
    get_user_pool_id
    get_hosted_zone_id
    
    echo ""
    print_info "Summary:"
    echo "  Domain: $DOMAIN_NAME"
    echo "  User Pool ID: $USER_POOL_ID"
    echo "  Hosted Zone ID: $HOSTED_ZONE_ID"
    echo "  Certificate ARN: $CERT_ARN"
    echo ""
    
    read -p "Continue with setup? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "Setup cancelled"
        exit 0
    fi
    
    echo ""
    create_cognito_domain
    create_dns_record
    wait_for_domain
    verify_domain
    
    echo ""
    print_success "Cognito custom domain setup complete!"
    echo ""
    print_info "Next steps:"
    echo "  1. Update GitHub secrets with the CloudFront domain"
    echo "  2. Test the domain: https://$DOMAIN_NAME/login"
    echo "  3. Update your frontend auth configuration if needed"
    echo ""
}

# Run main function
main "$@"
