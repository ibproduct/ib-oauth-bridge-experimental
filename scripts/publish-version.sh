#!/bin/bash

# Script to publish Lambda function versions and update the main alias
# Usage: ./scripts/publish-version.sh [function-name]
# If no function name is provided, it will publish all functions

set -e

REGION="us-west-1"
FUNCTIONS=(
  "ib-oauth-authorize"
  "ib-oauth-callback"
  "ib-oauth-token"
  "ib-oauth-userinfo"
  "ib-oauth-proxy"
  "ib-oauth-well-known"
)

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to publish a version and update main alias
publish_function() {
  local FUNCTION_NAME=$1
  
  echo -e "${YELLOW}Publishing new version for ${FUNCTION_NAME}...${NC}"
  
  # Publish a new version from $LATEST
  VERSION_OUTPUT=$(aws lambda publish-version \
    --function-name "$FUNCTION_NAME" \
    --region "$REGION" \
    --output json)
  
  VERSION_NUMBER=$(echo "$VERSION_OUTPUT" | jq -r '.Version')
  
  echo -e "${GREEN}✓ Published version ${VERSION_NUMBER}${NC}"
  
  # Update the main alias to point to the new version
  echo -e "${YELLOW}Updating main alias to version ${VERSION_NUMBER}...${NC}"
  
  # Check if alias exists
  if aws lambda get-alias \
    --function-name "$FUNCTION_NAME" \
    --name main \
    --region "$REGION" \
    >/dev/null 2>&1; then
    
    # Update existing alias
    aws lambda update-alias \
      --function-name "$FUNCTION_NAME" \
      --name main \
      --function-version "$VERSION_NUMBER" \
      --region "$REGION" \
      >/dev/null
    
    echo -e "${GREEN}✓ Updated main alias to version ${VERSION_NUMBER}${NC}"
  else
    # Create new alias
    aws lambda create-alias \
      --function-name "$FUNCTION_NAME" \
      --name main \
      --function-version "$VERSION_NUMBER" \
      --region "$REGION" \
      >/dev/null
    
    echo -e "${GREEN}✓ Created main alias pointing to version ${VERSION_NUMBER}${NC}"
  fi
  
  echo ""
}

# Main execution
if [ -z "$1" ]; then
  # No argument provided, publish all functions
  echo -e "${YELLOW}Publishing all Lambda functions...${NC}"
  echo ""
  
  for FUNCTION in "${FUNCTIONS[@]}"; do
    publish_function "$FUNCTION"
  done
  
  echo -e "${GREEN}✓ All functions published successfully!${NC}"
  echo ""
  echo "Main stage now uses these new versions."
  echo "Dev stage continues to use \$LATEST."
else
  # Specific function provided
  FUNCTION_NAME=$1
  
  # Validate function name
  if [[ ! " ${FUNCTIONS[@]} " =~ " ${FUNCTION_NAME} " ]]; then
    echo -e "${RED}Error: Invalid function name '${FUNCTION_NAME}'${NC}"
    echo "Valid functions are:"
    printf '%s\n' "${FUNCTIONS[@]}"
    exit 1
  fi
  
  publish_function "$FUNCTION_NAME"
  
  echo -e "${GREEN}✓ Function ${FUNCTION_NAME} published successfully!${NC}"
fi