# General Instructions

## AWS Configuration

### Region
All AWS resources must be deployed in `us-west-1` region.

### Resource Naming
All AWS resources must be prefixed with `ib-oauth-`. Examples:
- `ib-oauth-api` (API Gateway)
- `ib-oauth-authorizer` (Lambda function)
- `ib-oauth-token-handler` (Lambda function)
- `ib-oauth-state-table` (DynamoDB table)
- `ib-oauth-tokens-table` (DynamoDB table)

### AWS Profile
- Use the current AWS profile for all resource creation and management
- No explicit profile configuration required in code
- AWS credentials should be configured locally

## Resource Naming Convention

### Lambda Functions
```
ib-oauth-{function-name}
Examples:
- ib-oauth-authorizer
- ib-oauth-token-handler
- ib-oauth-userinfo
```

### DynamoDB Tables
```
ib-oauth-{table-name}
Examples:
- ib-oauth-state-table
- ib-oauth-tokens-table
- ib-oauth-codes-table
```

### API Gateway
```
ib-oauth-{stage}-api
Examples:
- ib-oauth-dev-api
- ib-oauth-prod-api
```

### CloudWatch Log Groups
```
/aws/lambda/ib-oauth-{function-name}
Examples:
- /aws/lambda/ib-oauth-authorizer
- /aws/lambda/ib-oauth-token-handler
```

### IAM Roles
```
ib-oauth-{service}-{purpose}-role
Examples:
- ib-oauth-lambda-execution-role
- ib-oauth-api-gateway-role
```

## AWS CDK Configuration

### Stack Naming
```typescript
// lib/ib-oauth-stack.ts
export class IBOAuthStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, {
      ...props,
      env: {
        region: 'us-west-1'
      }
    });
    
    // Resource definitions...
  }
}
```

### Resource Definitions
```typescript
// Example Lambda function definition
const authorizerFunction = new lambda.Function(this, 'AuthorizerFunction', {
  functionName: 'ib-oauth-authorizer',
  runtime: lambda.Runtime.NODEJS_20_X,
  handler: 'index.handler',
  code: lambda.Code.fromAsset('src/handlers/authorizer'),
});

// Example DynamoDB table definition
const stateTable = new dynamodb.Table(this, 'StateTable', {
  tableName: 'ib-oauth-state-table',
  partitionKey: { name: 'state', type: dynamodb.AttributeType.STRING },
  timeToLiveAttribute: 'expires',
});
```

## Local Development

### Environment Variables
```bash
AWS_REGION=us-west-1
STAGE=dev
```

### AWS CLI Configuration
```bash
# Verify AWS CLI configuration
aws configure list

# Verify region setting
aws configure get region
```

## Deployment

### Development
```bash
# Deploy development stack
cdk deploy IBOAuthDevStack
```

### Production
```bash
# Deploy production stack
cdk deploy IBOAuthProdStack
```

## Resource Management

### Listing Resources
```bash
# List all resources with ib-oauth prefix
aws resourcegroupstaggingapi get-resources \
  --tag-filters Key=Project,Values=ib-oauth \
  --region us-west-1
```

### Cleanup
```bash
# Delete development stack
cdk destroy IBOAuthDevStack

# Delete production stack
cdk destroy IBOAuthProdStack
```

## Monitoring

### CloudWatch Logs
- All logs will be in us-west-1 region
- Use the prefix `/aws/lambda/ib-oauth-` to filter Lambda logs
- Use the prefix `API-Gateway-Execution-Logs_ib-oauth-` to filter API Gateway logs

### Metrics
- All custom metrics should use the namespace `IBOAuth`
- Use the prefix `ib-oauth-` for metric names

## Security

### KMS Keys
```
ib-oauth-{purpose}-key
Examples:
- ib-oauth-token-encryption-key
- ib-oauth-secret-key
```

### Security Groups
```
ib-oauth-{purpose}-sg
Examples:
- ib-oauth-lambda-sg
- ib-oauth-vpc-endpoint-sg
```

## Tags

### Required Tags
All resources must have the following tags:
```json
{
  "Project": "ib-oauth",
  "Environment": "dev|prod",
  "ManagedBy": "cdk"
}
```

## Cost Management

### Resource Optimization
- Use AWS Cost Explorer to track resources with `ib-oauth-` prefix
- Set up cost alerts for the project
- Monitor unused resources

### Cost Allocation
- Use cost allocation tags to track expenses
- Set up monthly budget for the project
- Monitor per-environment costs