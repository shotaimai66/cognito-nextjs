# ECS Django デプロイガイド

Django バックエンドを AWS ECS Fargate にデプロイするための CDK スタック構成です。

## アーキテクチャ概要

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   VpcStack      │    │  CognitoStack   │    │ EcsDjangoStack  │
│                 │    │                 │    │                 │
│ • VPC           │    │ • User Pool     │    │ • ECS Cluster   │
│ • Subnets       │    │ • Client        │    │ • Fargate Tasks │
│ • Security      │    │ • Domain        │    │ • Load Balancer │
│   Groups        │    │                 │    │ • Auto Scaling  │
│ • NAT Gateway   │    │                 │    │ • ECR Repository│
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                        ┌─────────────────┐
                        │   Dependencies  │
                        │                 │
                        │ VPC ← ECS       │
                        │ Cognito ← ECS   │
                        └─────────────────┘
```

## スタック構成

### 1. VpcStack
- **VPC**: 10.0.0.0/16 CIDR
- **サブネット**: パブリック × 2、プライベート × 2（マルチAZ）
- **NAT Gateway**: 各AZに配置
- **セキュリティグループ**: ALB用、ECS用
- **VPCエンドポイント**: S3、DynamoDB

### 2. CognitoStack（既存）
- **User Pool**: 認証基盤
- **Client**: アプリケーションクライアント（Client Secret有効）
- **Domain**: 認証ドメイン

### 3. EcsDjangoStack
- **ECS Cluster**: Fargate クラスター
- **ALB**: インターネット向けロードバランサー
- **Fargate Service**: Django アプリケーション（最小2タスク）
- **ECR Repository**: Docker イメージ保存
- **Auto Scaling**: CPU/メモリ使用率ベース
- **CloudWatch Logs**: ログ集約

## デプロイ手順

### 前提条件

1. AWS CLI 設定済み
2. Docker インストール済み
3. CDK ブートストラップ済み

### 1. 全スタックデプロイ

```bash
# CDKディレクトリに移動
cd cdk

# 依存関係インストール
npm install

# 全スタックを一括デプロイ
./scripts/deploy.sh
```

または手動で：

```bash
npx cdk deploy --all -c cognitoDomainPrefix=shota-66666666666 --require-approval never
```

### 2. Dockerイメージ準備

まず、Django アプリケーション用の Dockerfile を作成：

```bash
# backend/Dockerfile
FROM python:3.11-slim

WORKDIR /app

# システム依存関係
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Python依存関係
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# アプリケーションコード
COPY . .

# ヘルスチェック用エンドポイント
EXPOSE 8000

# Django開発サーバー起動（本番では Gunicorn 推奨）
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]
```

### 3. イメージビルド＆プッシュ

```bash
# ECRにログイン、ビルド、プッシュ
./scripts/build-and-push.sh
```

### 4. サービス更新

```bash
# ECSサービスに新しいイメージをデプロイ
./scripts/update-service.sh
```

## 個別スタック操作

```bash
# 特定のスタックのみデプロイ
npx cdk deploy VpcStack -c cognitoDomainPrefix=shota-66666666666
npx cdk deploy CognitoAuthStack -c cognitoDomainPrefix=shota-66666666666
npx cdk deploy EcsDjangoStack -c cognitoDomainPrefix=shota-66666666666

# 変更差分確認
npx cdk diff --all -c cognitoDomainPrefix=shota-66666666666

# スタック削除
npx cdk destroy --all -c cognitoDomainPrefix=shota-66666666666
```

## 設定カスタマイズ

### 環境変数

ECS タスクに設定される主な環境変数：

```bash
DJANGO_SETTINGS_MODULE=config.settings.production
PORT=8000
COGNITO_REGION=ap-northeast-1
COGNITO_USER_POOL_ID=<自動取得>
COGNITO_CLIENT_ID=<自動取得>
FRONTEND_URL=https://your-frontend-domain.com
ALLOWED_HOSTS=*
```

### 機密情報

Secrets Manager から取得する情報（実装時に設定）：

- `DJANGO_SECRET_KEY`
- `DATABASE_URL`
- `COGNITO_CLIENT_SECRET`

### スケーリング設定

- **最小タスク数**: 2
- **最大タスク数**: 10
- **CPU閾値**: 70%
- **メモリ閾値**: 80%

## 監視とログ

### CloudWatch Logs

```bash
# ログストリーム確認
aws logs describe-log-streams \
  --log-group-name "/ecs/django-backend" \
  --order-by LastEventTime \
  --descending

# ログ表示
aws logs tail "/ecs/django-backend" --follow
```

### ヘルスチェック

```bash
# ALB URL取得
ALB_URL=$(aws cloudformation describe-stacks \
  --stack-name EcsDjangoStack \
  --query 'Stacks[0].Outputs[?OutputKey==`LoadBalancerURL`].OutputValue' \
  --output text)

# ヘルスチェック
curl $ALB_URL/health/
```

## トラブルシューティング

### ECS タスクが起動しない

```bash
# タスク定義確認
aws ecs describe-task-definition \
  --task-definition django-backend \
  --query 'taskDefinition.{Family:family,Revision:revision,Status:status}'

# サービス状況確認
aws ecs describe-services \
  --cluster django-cluster \
  --services django-backend-service
```

### ログ確認

```bash
# 最新のタスクID取得
TASK_ARN=$(aws ecs list-tasks \
  --cluster django-cluster \
  --service-name django-backend-service \
  --query 'taskArns[0]' \
  --output text)

# タスク詳細確認
aws ecs describe-tasks \
  --cluster django-cluster \
  --tasks $TASK_ARN
```

## セキュリティ考慮事項

1. **ネットワーク分離**: ECS タスクはプライベートサブネットで実行
2. **最小権限**: タスクロールは必要最小限の権限のみ
3. **機密情報**: Secrets Manager で管理
4. **通信暗号化**: ALB で HTTPS 終端（証明書設定が必要）
5. **イメージスキャン**: ECR で脆弱性スキャン有効

## コスト最適化

1. **Fargate Spot**: 本番環境では Spot インスタンス検討
2. **VPC エンドポイント**: NAT Gateway コスト削減
3. **Auto Scaling**: 需要に応じた自動スケーリング
4. **ログ保持期間**: CloudWatch Logs の保持期間調整（現在1週間）

## 次のステップ

1. **SSL証明書**: Route 53 + ACM で HTTPS 有効化
2. **データベース**: RDS Aurora Serverless v2 追加
3. **Redis**: ElastiCache for Redis セッション管理
4. **CloudFront**: CDN で静的コンテンツ配信
5. **WAF**: Web Application Firewall でセキュリティ強化