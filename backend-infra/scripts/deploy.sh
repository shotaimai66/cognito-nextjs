#!/bin/bash

# ECS Django デプロイスクリプト
set -e

# 設定
DOMAIN_PREFIX="shota-66666666666"
REGION="ap-northeast-1"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

echo "=== ECS Django デプロイ開始 ==="
echo "Domain Prefix: $DOMAIN_PREFIX"
echo "Region: $REGION"
echo "Account ID: $ACCOUNT_ID"

# CDKディレクトリに移動
cd "$(dirname "$0")/.."

echo "1. 依存関係を確認..."
npm install

echo "2. スタックをデプロイ..."
npx cdk deploy --all -c cognitoDomainPrefix=$DOMAIN_PREFIX --require-approval never

echo "3. ECRリポジトリURIを取得..."
ECR_REPOSITORY_URI=$(aws cloudformation describe-stacks \
  --stack-name EcsDjangoStack \
  --query 'Stacks[0].Outputs[?OutputKey==`EcrRepositoryUri`].OutputValue' \
  --output text \
  --region $REGION)

echo "ECR Repository URI: $ECR_REPOSITORY_URI"

echo "4. ALB URLを取得..."
ALB_URL=$(aws cloudformation describe-stacks \
  --stack-name EcsDjangoStack \
  --query 'Stacks[0].Outputs[?OutputKey==`LoadBalancerURL`].OutputValue' \
  --output text \
  --region $REGION)

echo "ALB URL: $ALB_URL"

echo "=== デプロイ完了 ==="
echo ""
echo "次のステップ:"
echo "1. Dockerイメージをビルドしてプッシュ:"
echo "   ./scripts/build-and-push.sh"
echo ""
echo "2. サービスを更新:"
echo "   ./scripts/update-service.sh"
echo ""
echo "3. アプリケーションにアクセス:"
echo "   $ALB_URL"