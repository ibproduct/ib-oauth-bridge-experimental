import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
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
    const callbackFunction = new lambda.Function(this, 'CallbackFunction', {
      functionName: `ib-oauth-callback-${props.stage}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('dist/callback'),
      environment: {
        STATE_TABLE: stateTable.tableName,
        STAGE: props.stage,
      },
      memorySize: 256,
      timeout: cdk.Duration.seconds(10),
    });

    const authorizeFunction = new lambda.Function(this, 'AuthorizeFunction', {
      functionName: `ib-oauth-authorize-${props.stage}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('dist/authorize'),
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
      code: lambda.Code.fromAsset('dist/token'),
      environment: {
        STATE_TABLE: stateTable.tableName,
        TOKEN_TABLE: tokenTable.tableName,
        STAGE: props.stage,
        // Note: No CODE_TABLE needed - using state table for auth codes
      },
      memorySize: 256,
      timeout: cdk.Duration.seconds(10),
    });

    const userinfoFunction = new lambda.Function(this, 'UserInfoFunction', {
      functionName: `ib-oauth-userinfo-${props.stage}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('dist/userinfo'),
      environment: {
        TOKEN_TABLE: tokenTable.tableName,
        STAGE: props.stage,
      },
      memorySize: 256,
      timeout: cdk.Duration.seconds(10),
    });

    // Grant DynamoDB permissions
    // State table access
    stateTable.grantReadWriteData(authorizeFunction);
    stateTable.grantReadWriteData(callbackFunction);
    stateTable.grantReadWriteData(tokenFunction);  // Token function needs to read state for code exchange

    // Token table access
    tokenTable.grantReadWriteData(tokenFunction);
    tokenTable.grantReadData(userinfoFunction);

    // Test Client Hosting
    const testClientBucket = new s3.Bucket(this, 'TestClientBucket', {
      bucketName: `ib-oauth-client-${props.stage}`,
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: props.stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // CloudFront distribution for test client
    const testClientDistribution = new cloudfront.Distribution(this, 'ClientDistribution', {
      defaultBehavior: {
        origin: new origins.S3Origin(testClientBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        responseHeadersPolicy: new cloudfront.ResponseHeadersPolicy(this, 'ClientHeadersPolicy', {
          responseHeadersPolicyName: `client-headers-${props.stage}`,
          corsBehavior: {
            accessControlAllowOrigins: ['*'],
            accessControlAllowMethods: ['GET', 'POST', 'OPTIONS'],
            accessControlAllowHeaders: ['*'],
            accessControlAllowCredentials: false,
            originOverride: true,
          }
        })
      },
      defaultRootObject: 'api-test-client.html',
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/api-test-client.html'
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/api-test-client.html'
        }
      ]
    });

    // Deploy test client files
    new s3deploy.BucketDeployment(this, 'ClientDeployment', {
      sources: [s3deploy.Source.asset('tests', {
        exclude: ['test-client.html', 'server.js', 'api-test-server.js']
      })],
      destinationBucket: testClientBucket,
      distribution: testClientDistribution,
      distributionPaths: ['/*'],
    });

    // API Gateway
    const api = new apigateway.RestApi(this, 'OAuthAPI', {
      restApiName: `ib-oauth-api-${props.stage}`,
      description: 'OAuth 2.0 bridge service for IntelligenceBank',
      deployOptions: {
        stageName: props.stage,
        tracingEnabled: true,
        dataTraceEnabled: true,
        metricsEnabled: true,
      },
    });

    // API Gateway Resources and Methods
    // API Gateway Resources and Methods with CORS
    const authorize = api.root.addResource('authorize');
    
    // Main authorize endpoint with CORS
    authorize.addMethod('GET', new apigateway.LambdaIntegration(authorizeFunction, {
      proxy: true,
      integrationResponses: [{
        statusCode: '200',
        responseParameters: {
          'method.response.header.Access-Control-Allow-Origin': "'*'",
          'method.response.header.Access-Control-Allow-Methods': "'GET,POST,OPTIONS'",
          'method.response.header.Access-Control-Allow-Headers': "'Content-Type,Authorization'",
          'method.response.header.Content-Type': 'integration.response.header.Content-Type'
        }
      }]
    }), {
      methodResponses: [{
        statusCode: '200',
        responseParameters: {
          'method.response.header.Access-Control-Allow-Origin': true,
          'method.response.header.Access-Control-Allow-Methods': true,
          'method.response.header.Access-Control-Allow-Headers': true,
          'method.response.header.Content-Type': true
        }
      }]
    });

    // POST method for form submission
    authorize.addMethod('POST', new apigateway.LambdaIntegration(authorizeFunction, {
      proxy: true,
      integrationResponses: [{
        statusCode: '200',
        responseParameters: {
          'method.response.header.Access-Control-Allow-Origin': "'*'",
          'method.response.header.Access-Control-Allow-Methods': "'GET,POST,OPTIONS'",
          'method.response.header.Access-Control-Allow-Headers': "'Content-Type,Authorization'",
          'method.response.header.Content-Type': 'integration.response.header.Content-Type'
        }
      }]
    }), {
      methodResponses: [{
        statusCode: '200',
        responseParameters: {
          'method.response.header.Access-Control-Allow-Origin': true,
          'method.response.header.Access-Control-Allow-Methods': true,
          'method.response.header.Access-Control-Allow-Headers': true,
          'method.response.header.Content-Type': true
        }
      }]
    });

    // OPTIONS method for CORS
    authorize.addMethod('OPTIONS', new apigateway.MockIntegration({
      integrationResponses: [{
        statusCode: '200',
        responseParameters: {
          'method.response.header.Access-Control-Allow-Origin': "'*'",
          'method.response.header.Access-Control-Allow-Methods': "'GET,POST,OPTIONS'",
          'method.response.header.Access-Control-Allow-Headers': "'Content-Type,Authorization'",
          'method.response.header.Content-Type': "'application/json'"
        }
      }],
      passthroughBehavior: apigateway.PassthroughBehavior.NEVER,
      requestTemplates: {
        'application/json': '{"statusCode": 200}'
      }
    }), {
      methodResponses: [{
        statusCode: '200',
        responseParameters: {
          'method.response.header.Access-Control-Allow-Origin': true,
          'method.response.header.Access-Control-Allow-Methods': true,
          'method.response.header.Access-Control-Allow-Headers': true,
          'method.response.header.Content-Type': true
        }
      }]
    });

    // Add poll endpoint under authorize
    const poll = authorize.addResource('poll');
    
    // GET method for polling
    poll.addMethod('GET', new apigateway.LambdaIntegration(authorizeFunction, {
      proxy: true,
      integrationResponses: [{
        statusCode: '200',
        responseParameters: {
          'method.response.header.Access-Control-Allow-Origin': "'*'",
          'method.response.header.Access-Control-Allow-Methods': "'GET,OPTIONS'",
          'method.response.header.Access-Control-Allow-Headers': "'Content-Type,Authorization'",
          'method.response.header.Content-Type': 'integration.response.header.Content-Type'
        }
      }]
    }), {
      methodResponses: [{
        statusCode: '200',
        responseParameters: {
          'method.response.header.Access-Control-Allow-Origin': true,
          'method.response.header.Access-Control-Allow-Methods': true,
          'method.response.header.Access-Control-Allow-Headers': true,
          'method.response.header.Content-Type': true
        }
      }]
    });

    // OPTIONS method for poll endpoint CORS
    poll.addMethod('OPTIONS', new apigateway.MockIntegration({
      integrationResponses: [{
        statusCode: '200',
        responseParameters: {
          'method.response.header.Access-Control-Allow-Origin': "'*'",
          'method.response.header.Access-Control-Allow-Methods': "'GET,OPTIONS'",
          'method.response.header.Access-Control-Allow-Headers': "'Content-Type,Authorization'",
          'method.response.header.Content-Type': "'application/json'"
        }
      }],
      passthroughBehavior: apigateway.PassthroughBehavior.NEVER,
      requestTemplates: {
        'application/json': '{"statusCode": 200}'
      }
    }), {
      methodResponses: [{
        statusCode: '200',
        responseParameters: {
          'method.response.header.Access-Control-Allow-Origin': true,
          'method.response.header.Access-Control-Allow-Methods': true,
          'method.response.header.Access-Control-Allow-Headers': true,
          'method.response.header.Content-Type': true
        }
      }]
    });

    // Add callback endpoint
    const callback = api.root.addResource('callback');
    callback.addMethod('GET', new apigateway.LambdaIntegration(callbackFunction, {
      proxy: true,
      integrationResponses: [{
        statusCode: '200',
        responseParameters: {
          'method.response.header.Access-Control-Allow-Origin': "'*'",
          'method.response.header.Access-Control-Allow-Methods': "'GET,OPTIONS'",
          'method.response.header.Access-Control-Allow-Headers': "'Content-Type,Authorization'",
          'method.response.header.Content-Type': 'integration.response.header.Content-Type'
        }
      }]
    }), {
      methodResponses: [{
        statusCode: '200',
        responseParameters: {
          'method.response.header.Access-Control-Allow-Origin': true,
          'method.response.header.Access-Control-Allow-Methods': true,
          'method.response.header.Access-Control-Allow-Headers': true,
          'method.response.header.Content-Type': true
        }
      }]
    });

    // OPTIONS method for callback endpoint CORS
    callback.addMethod('OPTIONS', new apigateway.MockIntegration({
      integrationResponses: [{
        statusCode: '200',
        responseParameters: {
          'method.response.header.Access-Control-Allow-Origin': "'*'",
          'method.response.header.Access-Control-Allow-Methods': "'GET,OPTIONS'",
          'method.response.header.Access-Control-Allow-Headers': "'Content-Type,Authorization'",
          'method.response.header.Content-Type': "'application/json'"
        }
      }],
      passthroughBehavior: apigateway.PassthroughBehavior.NEVER,
      requestTemplates: {
        'application/json': '{"statusCode": 200}'
      }
    }), {
      methodResponses: [{
        statusCode: '200',
        responseParameters: {
          'method.response.header.Access-Control-Allow-Origin': true,
          'method.response.header.Access-Control-Allow-Methods': true,
          'method.response.header.Access-Control-Allow-Headers': true,
          'method.response.header.Content-Type': true
        }
      }]
    });

    const token = api.root.addResource('token');
    token.addMethod('POST', new apigateway.LambdaIntegration(tokenFunction, {
      proxy: true,
      integrationResponses: [{
        statusCode: '200',
        responseParameters: {
          'method.response.header.Access-Control-Allow-Origin': "'*'",
          'method.response.header.Content-Type': 'integration.response.header.Content-Type'
        }
      }]
    }), {
      methodResponses: [{
        statusCode: '200',
        responseParameters: {
          'method.response.header.Access-Control-Allow-Origin': true,
          'method.response.header.Content-Type': true
        }
      }]
    });

    // Add OPTIONS method for token endpoint
    token.addMethod('OPTIONS', new apigateway.MockIntegration({
      integrationResponses: [{
        statusCode: '200',
        responseParameters: {
          'method.response.header.Access-Control-Allow-Origin': "'*'",
          'method.response.header.Access-Control-Allow-Methods': "'POST,OPTIONS'",
          'method.response.header.Access-Control-Allow-Headers': "'Content-Type,Authorization'",
          'method.response.header.Content-Type': "'application/json'"
        }
      }],
      passthroughBehavior: apigateway.PassthroughBehavior.NEVER,
      requestTemplates: {
        'application/json': '{"statusCode": 200}'
      }
    }), {
      methodResponses: [{
        statusCode: '200',
        responseParameters: {
          'method.response.header.Access-Control-Allow-Origin': true,
          'method.response.header.Access-Control-Allow-Methods': true,
          'method.response.header.Access-Control-Allow-Headers': true,
          'method.response.header.Content-Type': true
        }
      }]
    });

    const userinfo = api.root.addResource('userinfo');
    userinfo.addMethod('GET', new apigateway.LambdaIntegration(userinfoFunction, {
      integrationResponses: [{
        statusCode: '200',
        responseParameters: {
          'method.response.header.Access-Control-Allow-Origin': "'*'",
        },
      }],
    }), {
      methodResponses: [{
        statusCode: '200',
        responseParameters: {
          'method.response.header.Access-Control-Allow-Origin': true,
        },
      }],
    });

    // Stack Outputs
    new cdk.CfnOutput(this, 'IBOAuthApiEndpoint', {
      value: api.url,
      description: 'API Gateway endpoint URL',
    });

    new cdk.CfnOutput(this, 'IBOAuthClientUrl', {
      value: `https://${testClientDistribution.distributionDomainName}`,
      description: 'Test Client URL',
    });
  }
}