import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { Construct } from 'constructs';

interface IBOAuthStackProps extends cdk.StackProps {
  stage: string;
}

export class IBOAuthStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: IBOAuthStackProps) {
    super(scope, id, props);

    // DynamoDB Tables
    const stateTable = new dynamodb.Table(this, 'StateTable', {
      tableName: `ib-oauth-state-${props.stage}`,
      partitionKey: { name: 'state', type: dynamodb.AttributeType.STRING },
      timeToLiveAttribute: 'expires',
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For development; change for production
    });

    const codeTable = new dynamodb.Table(this, 'CodeTable', {
      tableName: `ib-oauth-codes-${props.stage}`,
      partitionKey: { name: 'code', type: dynamodb.AttributeType.STRING },
      timeToLiveAttribute: 'expires',
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const tokenTable = new dynamodb.Table(this, 'TokenTable', {
      tableName: `ib-oauth-tokens-${props.stage}`,
      partitionKey: { name: 'accessToken', type: dynamodb.AttributeType.STRING },
      timeToLiveAttribute: 'expires',
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Add GSI for refresh token lookup
    tokenTable.addGlobalSecondaryIndex({
      indexName: 'RefreshTokenIndex',
      partitionKey: { name: 'refreshToken', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Lambda Functions
    const authorizeFunction = new lambda.Function(this, 'AuthorizeFunction', {
      functionName: `ib-oauth-authorizer-${props.stage}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('src/handlers/authorize'),
      environment: {
        STATE_TABLE: stateTable.tableName,
        STAGE: props.stage,
      },
      memorySize: 256,
      timeout: cdk.Duration.seconds(10),
    });

    const tokenFunction = new lambda.Function(this, 'TokenFunction', {
      functionName: `ib-oauth-token-${props.stage}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('src/handlers/token'),
      environment: {
        CODE_TABLE: codeTable.tableName,
        TOKEN_TABLE: tokenTable.tableName,
        STAGE: props.stage,
      },
      memorySize: 256,
      timeout: cdk.Duration.seconds(10),
    });

    const userinfoFunction = new lambda.Function(this, 'UserInfoFunction', {
      functionName: `ib-oauth-userinfo-${props.stage}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('src/handlers/userinfo'),
      environment: {
        TOKEN_TABLE: tokenTable.tableName,
        STAGE: props.stage,
      },
      memorySize: 256,
      timeout: cdk.Duration.seconds(10),
    });

    // Grant DynamoDB permissions
    stateTable.grantReadWriteData(authorizeFunction);
    codeTable.grantReadWriteData(tokenFunction);
    tokenTable.grantReadWriteData(tokenFunction);
    tokenTable.grantReadData(userinfoFunction);

    // API Gateway
    const api = new apigateway.RestApi(this, 'OAuthAPI', {
      restApiName: `ib-oauth-${props.stage}-api`,
      description: 'OAuth 2.0 bridge service for IntelligenceBank',
      deployOptions: {
        stageName: props.stage,
        tracingEnabled: true,
        dataTraceEnabled: true,
        metricsEnabled: true,
      },
    });

    // API Gateway Resources and Methods
    const authorize = api.root.addResource('authorize');
    authorize.addMethod('GET', new apigateway.LambdaIntegration(authorizeFunction));

    const token = api.root.addResource('token');
    token.addMethod('POST', new apigateway.LambdaIntegration(tokenFunction));

    const userinfo = api.root.addResource('userinfo');
    userinfo.addMethod('GET', new apigateway.LambdaIntegration(userinfoFunction));

    // Stack Outputs
    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: api.url,
      description: 'API Gateway endpoint URL',
    });
  }
}