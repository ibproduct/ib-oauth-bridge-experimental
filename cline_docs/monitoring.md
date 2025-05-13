# Monitoring Documentation

## CloudWatch Setup

### Log Groups
```
/aws/lambda/ib-oauth-authorize-dev
/aws/lambda/ib-oauth-token-dev
/aws/lambda/ib-oauth-callback-dev
```

### Log Format
```typescript
{
  timestamp: string,
  requestId: string,
  level: 'INFO' | 'ERROR',
  message: string,
  details: {
    path: string,
    method: string,
    params: object,
    error?: {
      type: string,
      message: string,
      stack?: string
    }
  }
}
```

## Metrics

### Lambda Metrics
1. **Invocations**
   - By function
   - Success/failure rate
   - Duration

2. **Errors**
   - Error count
   - Error rate
   - Error types

3. **Performance**
   - Duration p50/p90/p99
   - Memory usage
   - Throttling

### API Gateway Metrics
1. **Requests**
   - Count by endpoint
   - Success rate
   - Latency

2. **Errors**
   - 4xx errors
   - 5xx errors
   - Integration errors

3. **Integration**
   - Latency
   - Success rate
   - Timeouts

### DynamoDB Metrics

#### State Table (`ib-oauth-state-${stage}`)
1. **Operations**
   - Read/write capacity
   - Throttling
   - Error rate
   - State transitions (poll token → auth code)

2. **TTL**
   - Poll tokens (5m expiry)
   - Auth codes (10m expiry)
   - Deletion rates

#### Token Table (`ib-oauth-tokens-${stage}`)
1. **Operations**
   - Access token lookups
   - Refresh token lookups (GSI)
   - Token refresh rate

2. **TTL**
   - Access token expiry (1h)
   - Deletion rates

## Alerts

### Critical Alerts
1. **Error Rate**
   ```
   Metric: ErrorCount
   Threshold: > 5% of requests
   Period: 5 minutes
   ```

2. **Latency**
   ```
   Metric: Duration p99
   Threshold: > 5 seconds
   Period: 5 minutes
   ```

3. **5xx Errors**
   ```
   Metric: 5xxError
   Threshold: > 1% of requests
   Period: 1 minute
   ```

### Warning Alerts
1. **Memory Usage**
   ```
   Metric: MemoryUtilization
   Threshold: > 80%
   Period: 5 minutes
   ```

2. **Throttling**
   ```
   Metric: ThrottledRequests
   Threshold: > 0
   Period: 5 minutes
   ```

## Dashboards

### Main Dashboard
1. **Request Overview**
   - Total requests
   - Success rate
   - Error rate
   - Latency

2. **Authorization Flow**
   - Authorization starts
   - Login completions
   - Token exchanges
   - Error breakdown

3. **System Health**
   - Lambda health
   - API Gateway health
   - DynamoDB health
   - Error trends

### Error Dashboard
1. **Error Breakdown**
   - By type
   - By endpoint
   - By time
   - Top errors

2. **Client Errors**
   - Invalid requests
   - Missing parameters
   - Auth failures

3. **System Errors**
   - IB API errors
   - Lambda errors
   - Integration errors

## Log Queries

### Error Analysis
```
filter @type = "REPORT"
| stats
    count(*) as total,
    count(@message like /ERROR/) as errors,
    count(@message like /invalid_request/) as invalid_requests,
    count(@message like /server_error/) as server_errors
by bin(5m)
```

### Performance Analysis
```
filter @type = "REPORT"
| stats
    avg(Duration) as avg_duration,
    percentile(Duration, 99) as p99_duration,
    max(Duration) as max_duration
by FunctionName, bin(5m)
```

### State Operations
```
filter @message like "State"
| stats
    count(*) as total,
    count(@message like /store/) as stores,
    count(@message like /retrieve/) as retrieves,
    count(@message like /delete/) as deletes
by bin(5m)
```

## Health Checks

### Endpoint Health
```bash
# Check authorization endpoint
curl -I https://n4h948fv4c.execute-api.us-west-1.amazonaws.com/dev/authorize

# Check token endpoint
curl -I https://n4h948fv4c.execute-api.us-west-1.amazonaws.com/dev/token
```

### Integration Health
```bash
# Test IB API connection
curl -I https://company.intelligencebank.com/api/v3/health

# Test state table
aws dynamodb scan --table-name ib-oauth-state-${stage} --limit 1

# Test token table
aws dynamodb scan --table-name ib-oauth-tokens-${stage} --limit 1
```

## Troubleshooting

### Common Issues
1. **IB API Errors**
   - Check token expiration
   - Verify platform URL
   - Check IB service status

2. **State Table Issues**
   - Check TTL settings (5m/10m)
   - Verify state transitions
   - Monitor capacity
   - Check key usage (poll token/auth code)

3. **Token Table Issues**
   - Check TTL settings (1h)
   - Monitor GSI performance
   - Verify token refresh flow
   - Check capacity

3. **Integration Issues**
   - Check Lambda timeouts
   - Verify IAM permissions
   - Check API Gateway settings

### Debug Commands
```bash
# Tail Lambda logs
aws logs tail /aws/lambda/ib-oauth-authorize-dev --follow

# Check API Gateway deployment
aws apigateway get-deployments --rest-api-id n4h948fv4c

# Test DynamoDB access
aws dynamodb describe-table --table-name ib-oauth-state-dev