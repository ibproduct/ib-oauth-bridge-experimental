#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { IBOAuthStack } from '../lib/ib-oauth-stack';

const app = new cdk.App();

// Single stack with Lambda aliases for dev/main
new IBOAuthStack(app, 'ib-oauth-stack', {
  env: {
    region: 'us-west-1'
  },
  tags: {
    Project: 'ib-oauth',
    ManagedBy: 'cdk'
  }
});