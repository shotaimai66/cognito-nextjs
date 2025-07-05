#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { VpcStack } from '../lib/vpc-stack';
import { CognitoStack } from '../lib/cognito-stack';
import { EcrStack } from '../lib/ecr-stack';
import { EcsDjangoStack } from '../lib/ecs-django-stack';
import { Route53Stack } from '../lib/route53-stack';

const app = new cdk.App();

// 共通環境設定
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || 'ap-northeast-1',
};

// 環境変数またはContext値からドメインプレフィックスを取得
const cognitoDomainPrefix = app.node.tryGetContext('cognitoDomainPrefix') || process.env.COGNITO_DOMAIN_PREFIX;

// カスタムドメイン名をContextから取得
const domainName = app.node.tryGetContext('domainName') || process.env.CUSTOM_DOMAIN_NAME;

// bootstrap時など、cognitoDomainPrefixが提供されない場合はスタックを作成しない
if (cognitoDomainPrefix) {
  // 1. ECRスタック（コンテナレジストリ）
  const ecrStack = new EcrStack(app, 'EcrStack', {
    env,
    description: 'ECR repository for Django backend Docker images',
  });

  // 2. VPCスタック（基盤）
  const vpcStack = new VpcStack(app, 'VpcStack', {
    env,
    description: 'VPC and networking infrastructure for Django application',
  });

  // 3. Route 53スタック（ドメイン管理） - オプション
  let route53Stack: Route53Stack | undefined;
  if (domainName) {
    route53Stack = new Route53Stack(app, 'Route53Stack', {
      domainName,
      env,
      description: 'Route 53 Hosted Zone and SSL Certificates for custom domain',
    });
  }

  // 4. Cognitoスタック（認証）
  const cognitoStack = new CognitoStack(app, 'CognitoAuthStack', {
    cognitoDomainPrefix,
    env,
    description: 'Cognito User Pool for Authentication App (CDK)',
  });

  // 5. ECS Djangoスタック（アプリケーション）
  const ecsStack = new EcsDjangoStack(app, 'EcsDjangoStack', {
    vpc: vpcStack.vpc,
    ecsSecurityGroup: vpcStack.ecsSecurityGroup,
    albSecurityGroup: vpcStack.albSecurityGroup,
    userPool: cognitoStack.userPool,
    userPoolClient: cognitoStack.userPoolClient,
    repository: ecrStack.repository,
    hostedZone: route53Stack?.hostedZone,
    certificate: route53Stack?.certificate,
    domainName: domainName,
    env,
    description: 'ECS Fargate service for Django backend application',
  });

  // スタック間の依存関係を明示的に設定
  ecsStack.addDependency(vpcStack);
  ecsStack.addDependency(cognitoStack);
  ecsStack.addDependency(ecrStack);
  if (route53Stack) {
    ecsStack.addDependency(route53Stack);
  }
} else {
  console.log('Note: Stacks not created. Provide cognitoDomainPrefix via context (-c cognitoDomainPrefix=your-prefix) or environment variable COGNITO_DOMAIN_PREFIX to create the stacks.');
}