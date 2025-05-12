import express from 'express';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { handler as authorizeHandler } from './handlers/authorize';
import { handler as callbackHandler } from './handlers/callback';
import { handler as tokenHandler } from './handlers/token';

const app = express();
app.use(express.json());

// CORS for development
const corsMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction): void => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
        return;
    }
    next();
};

// Debug middleware - log all requests
const loggerMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction): void => {
    console.log('Incoming request:', {
        method: req.method,
        path: req.path,
        query: req.query,
        body: req.body
    });
    next();
};

app.use(corsMiddleware);
app.use(loggerMiddleware);

// Convert Express request to Lambda event
function createLambdaEvent(req: express.Request): APIGatewayProxyEvent {
    return {
        httpMethod: req.method,
        path: req.path,
        queryStringParameters: req.query as { [key: string]: string | undefined },
        headers: req.headers as { [key: string]: string },
        body: JSON.stringify(req.body),
        // Required APIGatewayProxyEvent properties
        resource: req.path,
        pathParameters: null,
        stageVariables: null,
        requestContext: {
            accountId: 'local',
            apiId: 'local',
            authorizer: null,
            protocol: 'HTTP/1.1',
            httpMethod: req.method,
            identity: {
                accessKey: null,
                accountId: null,
                apiKey: null,
                apiKeyId: null,
                caller: null,
                clientCert: null,
                cognitoAuthenticationProvider: null,
                cognitoAuthenticationType: null,
                cognitoIdentityId: null,
                cognitoIdentityPoolId: null,
                principalOrgId: null,
                sourceIp: req.ip || '127.0.0.1',
                user: null,
                userAgent: req.headers['user-agent'] || null,
                userArn: null
            },
            path: req.path,
            stage: 'local',
            requestId: 'local',
            requestTimeEpoch: Date.now(),
            resourceId: 'local',
            resourcePath: req.path
        },
        multiValueHeaders: {},
        multiValueQueryStringParameters: null,
        isBase64Encoded: false
    };
}

// Convert Lambda response to Express response
function sendLambdaResponse(lambdaResponse: APIGatewayProxyResult, res: express.Response): void {
    console.log('Lambda response:', lambdaResponse);
    
    const { statusCode, headers, body } = lambdaResponse;
    
    // Set headers
    if (headers) {
        Object.entries(headers).forEach(([key, value]) => {
            if (typeof value === 'string') {
                res.header(key, value);
            }
        });
    }

    // Handle redirects
    if (statusCode === 302 && headers?.Location) {
        const location = headers.Location as string;
        res.redirect(location);
        return;
    }

    // Send response
    res.status(statusCode);
    
    // Check if response is HTML
    const contentType = headers?.['Content-Type'];
    if (typeof contentType === 'string' && contentType.includes('text/html')) {
        res.send(body);
    } else {
        try {
            res.json(JSON.parse(body));
        } catch {
            res.send(body);
        }
    }
}

// OAuth endpoints
const authorizeRoute = async (req: express.Request, res: express.Response): Promise<void> => {
    console.log('Authorize endpoint hit');
    try {
        const event = createLambdaEvent(req);
        console.log('Created Lambda event:', event);
        const response = await authorizeHandler(event);
        console.log('Authorize handler response:', response);
        sendLambdaResponse(response, res);
    } catch (error) {
        console.error('Authorize error:', error);
        const err = error as Error;
        res.status(500).json({ error: 'Internal server error', details: err.message });
    }
};

const tokenRoute = async (req: express.Request, res: express.Response): Promise<void> => {
    try {
        const event = createLambdaEvent(req);
        const response = await tokenHandler(event);
        sendLambdaResponse(response, res);
    } catch (error) {
        console.error('Token error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Authorize endpoints
app.get('/authorize', authorizeRoute);
app.post('/authorize/start', authorizeRoute);
app.get('/authorize/poll', authorizeRoute);

// Callback endpoint
app.get('/callback', async (req: express.Request, res: express.Response) => {
    try {
        const event = createLambdaEvent(req);
        const response = await callbackHandler(event);
        sendLambdaResponse(response, res);
    } catch (error) {
        console.error('Callback error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Other endpoints
app.post('/token', tokenRoute);

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`OAuth server running at http://localhost:${PORT}`);
    console.log('Available endpoints:');
    console.log('  GET  /authorize         - Main authorize endpoint');
    console.log('  POST /authorize/start   - Start login process');
    console.log('  GET  /authorize/poll    - Poll login status');
    console.log('  GET  /callback         - Handle IB login callback');
    console.log('  POST /token            - Exchange code for tokens');
});