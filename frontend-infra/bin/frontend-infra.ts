#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { S3CloudFrontStack } from '../lib/s3-cloudfront-stack';

const app = new cdk.App();

// 環境設定
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || 'ap-northeast-1',
};

// Context値から設定を取得
const domainName = app.node.tryGetContext('domainName') || process.env.CUSTOM_DOMAIN_NAME;
const hostedZoneId = app.node.tryGetContext('hostedZoneId') || process.env.HOSTED_ZONE_ID;
const certificateArn = app.node.tryGetContext('certificateArn') || process.env.CERTIFICATE_ARN;

// S3 + CloudFrontスタック
new S3CloudFrontStack(app, 'S3CloudFrontStack', {
  domainName,
  hostedZoneId,
  certificateArn,
  env,
  description: 'S3 and CloudFront infrastructure for frontend hosting',
});

// スタック作成のガイダンス
if (!domainName || !hostedZoneId || !certificateArn) {
  console.log('\n📝 Note: Deploy with custom domain settings:');
  console.log('cdk deploy -c domainName=xxxxxxxx.tech -c hostedZoneId=Z1234567890ABC -c certificateArn=arn:aws:acm:us-east-1:...');
  console.log('\nOr set environment variables:');
  console.log('export CUSTOM_DOMAIN_NAME=xxxxxxxx.tech');
  console.log('export HOSTED_ZONE_ID=Z1234567890ABC');
  console.log('export CERTIFICATE_ARN=arn:aws:acm:us-east-1:...\n');
}