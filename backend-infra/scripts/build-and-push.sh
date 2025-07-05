#!/bin/bash

# Dockerイメージビルド＆プッシュスクリプト
set -e

# 設定
REGION="ap-northeast-1"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

echo "=== Dockerイメージビルド開始 ==="

# ECRリポジトリURIを取得
ECR_REPOSITORY_URI='017522386375.dkr.ecr.ap-northeast-1.amazonaws.com/django-backend'

if [ -z "$ECR_REPOSITORY_URI" ]; then
  echo "エラー: ECRリポジトリURIが見つかりません。先にCDKをデプロイしてください。"
  exit 1
fi

echo "ECR Repository URI: $ECR_REPOSITORY_URI"

# バックエンドディレクトリに移動
cd "$(dirname "$0")/../../backend"

echo "1. ECRにログイン..."
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ECR_REPOSITORY_URI

echo "2. Dockerイメージをビルド（AMD64プラットフォーム指定）..."
docker build --platform linux/amd64 -t django-backend .

echo "3. イメージにタグ付け..."
docker tag django-backend:latest $ECR_REPOSITORY_URI:latest

echo "4. ECRにプッシュ..."
docker push $ECR_REPOSITORY_URI:latest

echo "=== ビルド完了 ==="
echo ""
echo "次のステップ:"
echo "ECSサービスを更新してください:"
echo "  ./scripts/update-service.sh"