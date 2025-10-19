import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import { Construct } from 'constructs';

interface IBOAuthStackProps extends cdk.StackProps {}

export class IBOAuthStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: IBOAuthStackProps) {
    super(scope, id, props);

    // DynamoDB Tables (no stage suffix - shared across aliases)
    const stateTable = new dynamodb.Table(this, 'StateTable', {
      tableName: 'ib-oauth-state',
      partitionKey: { name: 'state', type: dynamodb.AttributeType.STRING },
      timeToLiveAttribute: 'expires',
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const tokenTable = new dynamodb.Table(this, 'TokenTable', {
      tableName: 'ib-oauth-tokens',
      partitionKey: { name: 'accessToken', type: dynamodb.AttributeType.STRING },
      timeToLiveAttribute: 'expires',
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    tokenTable.addGlobalSecondaryIndex({
      indexName: 'RefreshTokenIndex',
      partitionKey: { name: 'refreshToken', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Lambda Functions (no stage suffix - using aliases instead)
    const callbackFunction = new lambda.Function(this, 'CallbackFunction', {
      functionName: 'ib-oauth-callback',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('dist/callback'),
      environment: {
        STATE_TABLE: stateTable.tableName,
      },
      memorySize: 256,
      timeout: cdk.Duration.seconds(10),
    });

    const callbackDevAlias = new lambda.Alias(this, 'CallbackDevAlias', {
      aliasName: 'dev',
      version: callbackFunction.currentVersion,
    });

    const callbackMainAlias = new lambda.Alias(this, 'CallbackMainAlias', {
      aliasName: 'main',
      version: callbackFunction.currentVersion,
    });

    const authorizeFunction = new lambda.Function(this, 'AuthorizeFunction', {
      functionName: 'ib-oauth-authorize',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('dist/authorize'),
      environment: {
        STATE_TABLE: stateTable.tableName,
      },
      memorySize: 256,
      timeout: cdk.Duration.seconds(10),
    });

    const authorizeDevAlias = new lambda.Alias(this, 'AuthorizeDevAlias', {
      aliasName: 'dev',
      version: authorizeFunction.currentVersion,
    });

    const authorizeMainAlias = new lambda.Alias(this, 'AuthorizeMainAlias', {
      aliasName: 'main',
      version: authorizeFunction.currentVersion,
    });

    const tokenFunction = new lambda.Function(this, 'TokenFunction', {
      functionName: 'ib-oauth-token',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('dist/token'),
      environment: {
        STATE_TABLE: stateTable.tableName,
        TOKEN_TABLE: tokenTable.tableName,
      },
      memorySize: 256,
      timeout: cdk.Duration.seconds(10),
    });

    const tokenDevAlias = new lambda.Alias(this, 'TokenDevAlias', {
      aliasName: 'dev',
      version: tokenFunction.currentVersion,
    });

    const tokenMainAlias = new lambda.Alias(this, 'TokenMainAlias', {
      aliasName: 'main',
      version: tokenFunction.currentVersion,
    });

    const userinfoFunction = new lambda.Function(this, 'UserInfoFunction', {
      functionName: 'ib-oauth-userinfo',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('dist/userinfo'),
      environment: {
        TOKEN_TABLE: tokenTable.tableName,
      },
      memorySize: 256,
      timeout: cdk.Duration.seconds(10),
    });

    const userinfoDevAlias = new lambda.Alias(this, 'UserInfoDevAlias', {
      aliasName: 'dev',
      version: userinfoFunction.currentVersion,
    });

    const userinfoMainAlias = new lambda.Alias(this, 'UserInfoMainAlias', {
      aliasName: 'main',
      version: userinfoFunction.currentVersion,
    });

    const proxyFunction = new lambda.Function(this, 'ProxyFunction', {
      functionName: 'ib-oauth-proxy',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('dist/proxy'),
      environment: {
        TOKEN_TABLE: tokenTable.tableName,
      },
      memorySize: 256,
      timeout: cdk.Duration.seconds(30),
    });

    const proxyDevAlias = new lambda.Alias(this, 'ProxyDevAlias', {
      aliasName: 'dev',
      version: proxyFunction.currentVersion,
    });

    const proxyMainAlias = new lambda.Alias(this, 'ProxyMainAlias', {
      aliasName: 'main',
      version: proxyFunction.currentVersion,
    });

    // Grant DynamoDB permissions to all aliases
    stateTable.grantReadWriteData(authorizeDevAlias);
    stateTable.grantReadWriteData(authorizeMainAlias);
    stateTable.grantReadWriteData(callbackDevAlias);
    stateTable.grantReadWriteData(callbackMainAlias);
    stateTable.grantReadWriteData(tokenDevAlias);
    stateTable.grantReadWriteData(tokenMainAlias);

    tokenTable.grantReadWriteData(tokenDevAlias);
    tokenTable.grantReadWriteData(tokenMainAlias);
    tokenTable.grantReadData(userinfoDevAlias);
    tokenTable.grantReadData(userinfoMainAlias);
    tokenTable.grantReadData(proxyDevAlias);
    tokenTable.grantReadData(proxyMainAlias);

    // Test Client Hosting
    const testClientBucket = new s3.Bucket(this, 'TestClientBucket', {
      bucketName: 'ib-oauth-client',
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const testClientDistribution = new cloudfront.Distribution(this, 'ClientDistribution', {
      defaultBehavior: {
        origin: new origins.S3Origin(testClientBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        responseHeadersPolicy: new cloudfront.ResponseHeadersPolicy(this, 'ClientHeadersPolicy', {
          responseHeadersPolicyName: 'ib-oauth-client-headers',
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

    new s3deploy.BucketDeployment(this, 'ClientDeployment', {
      sources: [s3deploy.Source.asset('tests', {
        exclude: ['server.js', 'api-test-server.js']
      })],
      destinationBucket: testClientBucket,
      distribution: testClientDistribution,
      distributionPaths: ['/*'],
    });

    // API Gateway
    const api = new apigateway.RestApi(this, 'OAuthAPI', {
      restApiName: 'ib-oauth-api',
      description: 'OAuth 2.0 bridge service for IntelligenceBank',
      deployOptions: {
        stageName: 'dev',
        tracingEnabled: true,
        dataTraceEnabled: true,
        metricsEnabled: true,
      },
    });


    // API Gateway Resources and Methods with CORS
    const authorize = api.root.addResource('authorize');
    
    authorize.addMethod('GET', new apigateway.LambdaIntegration(authorizeDevAlias, {
      proxy: true,
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

    authorize.addMethod('POST', new apigateway.LambdaIntegration(authorizeDevAlias, {
      proxy: true,
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

    const poll = authorize.addResource('poll');
    
    poll.addMethod('GET', new apigateway.LambdaIntegration(authorizeDevAlias, {
      proxy: true,
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

    const callback = api.root.addResource('callback');
    callback.addMethod('GET', new apigateway.LambdaIntegration(callbackDevAlias, {
      proxy: true,
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
    token.addMethod('POST', new apigateway.LambdaIntegration(tokenDevAlias, {
      proxy: true,
    }), {
      methodResponses: [{
        statusCode: '200',
        responseParameters: {
          'method.response.header.Access-Control-Allow-Origin': true,
          'method.response.header.Content-Type': true
        }
      }]
    });

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
    userinfo.addMethod('GET', new apigateway.LambdaIntegration(userinfoDevAlias, {
      proxy: true,
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

    userinfo.addMethod('OPTIONS', new apigateway.MockIntegration({
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

    const proxy = api.root.addResource('proxy');
    const proxyPath = proxy.addResource('{proxy+}');

    const proxyIntegration = new apigateway.LambdaIntegration(proxyDevAlias, {
      proxy: true,
    });

    ['GET', 'POST', 'PUT', 'DELETE'].forEach(method => {
      proxyPath.addMethod(method, proxyIntegration, {
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
    });

    proxyPath.addMethod('OPTIONS', new apigateway.MockIntegration({
      integrationResponses: [{
        statusCode: '200',
        responseParameters: {
          'method.response.header.Access-Control-Allow-Origin': "'*'",
          'method.response.header.Access-Control-Allow-Methods': "'GET,POST,PUT,DELETE,OPTIONS'",
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

    // Create main stage manually
    const mainDeployment = new apigateway.Deployment(this, 'MainDeployment', {
      api: api,
      description: 'Main stage deployment pointing to main alias',
    });

    new apigateway.Stage(this, 'MainStage', {
      deployment: mainDeployment,
      stageName: 'main',
      tracingEnabled: true,
      dataTraceEnabled: true,
      metricsEnabled: true,
      variables: {
        lambdaAlias: 'main'
      }
    });

    // Grant invoke permissions for both aliases
    const apiGatewayPrincipal = new cdk.aws_iam.ServicePrincipal('apigateway.amazonaws.com');
    authorizeDevAlias.grantInvoke(apiGatewayPrincipal);
    authorizeMainAlias.grantInvoke(apiGatewayPrincipal);
    callbackDevAlias.grantInvoke(apiGatewayPrincipal);
    callbackMainAlias.grantInvoke(apiGatewayPrincipal);
    tokenDevAlias.grantInvoke(apiGatewayPrincipal);
    tokenMainAlias.grantInvoke(apiGatewayPrincipal);
    userinfoDevAlias.grantInvoke(apiGatewayPrincipal);
    userinfoMainAlias.grantInvoke(apiGatewayPrincipal);
    proxyDevAlias.grantInvoke(apiGatewayPrincipal);
    proxyMainAlias.grantInvoke(apiGatewayPrincipal);

    // Stack Outputs
    new cdk.CfnOutput(this, 'IBOAuthApiDevEndpoint', {
      value: `${api.url}`,
      description: 'API Gateway dev stage endpoint URL',
    });

    new cdk.CfnOutput(this, 'IBOAuthApiMainEndpoint', {
      value: `https://${api.restApiId}.execute-api.us-west-1.amazonaws.com/main/`,
      description: 'API Gateway main stage endpoint URL',
    });

    new cdk.CfnOutput(this, 'IBOAuthClientUrl', {
      value: `https://${testClientDistribution.distributionDomainName}`,
      description: 'Test Client URL',
    });
  }
}