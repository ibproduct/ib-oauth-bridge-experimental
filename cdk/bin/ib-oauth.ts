#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { IBOAuthStack } from '../lib/ib-oauth-stack';

const app = new cdk.App();

// Development stack
new IBOAuthStack(app, 'ib-oauth-stack-dev', {
  env: {
    region: 'us-west-1'
  },
  stage: 'dev',
  tags: {
    Project: 'ib-oauth',
    Environment: 'dev',
    ManagedBy: 'cdk'
  }
});

// Production stack
new IBOAuthStack(app, 'ib-oauth-stack-prod', {
  env: {
    region: 'us-west-1'
  },
  stage: 'prod',
  tags: {
    Project: 'ib-oauth',
    Environment: 'prod',
    ManagedBy: 'cdk'
  }
});