#!/bin/bash

# ECSサービス更新スクリプト
set -e

# 設定
REGION="ap-northeast-1"

echo "=== ECSサービス更新開始 ==="

# クラスター名とサービス名を取得
CLUSTER_NAME=$(aws cloudformation describe-stacks \
  --stack-name EcsDjangoStack \
  --query 'Stacks[0].Outputs[?OutputKey==`ClusterName`].OutputValue' \
  --output text \
  --region $REGION)

SERVICE_NAME=$(aws cloudformation describe-stacks \
  --stack-name EcsDjangoStack \
  --query 'Stacks[0].Outputs[?OutputKey==`ServiceName`].OutputValue' \
  --output text \
  --region $REGION)

echo "Cluster: $CLUSTER_NAME"
echo "Service: $SERVICE_NAME"

echo "1. サービスを強制更新..."
aws ecs update-service \
  --cluster $CLUSTER_NAME \
  --service $SERVICE_NAME \
  --force-new-deployment \
  --region $REGION

echo "2. デプロイ状況を監視..."
aws ecs wait services-stable \
  --cluster $CLUSTER_NAME \
  --services $SERVICE_NAME \
  --region $REGION

echo "=== サービス更新完了 ==="

# ALB URLを表示
ALB_URL=$(aws cloudformation describe-stacks \
  --stack-name EcsDjangoStack \
  --query 'Stacks[0].Outputs[?OutputKey==`LoadBalancerURL`].OutputValue' \
  --output text \
  --region $REGION)

echo ""
echo "アプリケーションURL: $ALB_URL"
echo "ヘルスチェック: $ALB_URL/health/"