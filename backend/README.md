# Cognito Backend API

TypeScript + Express.jsで構築されたCognito認証バックエンドAPI

## 機能

- Cognito Authorization Code Flowによる認証
- HttpOnlyクッキーによるトークン管理
- ユーザー情報取得
- トークンリフレッシュ
- ログアウト

## API エンドポイント

### 認証関連

- `POST /api/auth/callback` - 認証コードからトークンを取得
- `GET /api/auth/me` - 現在のユーザー情報を取得
- `POST /api/auth/refresh` - トークンをリフレッシュ
- `POST /api/auth/logout` - ログアウト

### ヘルスチェック

- `GET /health` - サーバーの状態確認

## セットアップ

### 1. 依存関係のインストール

```bash
cd backend
npm install
```

### 2. 環境変数の設定

`.env.example`を参考に`.env`ファイルを作成：

```bash
cp .env.example .env
```

必要な設定：
- `COGNITO_USER_POOL_ID` - CognitoユーザープールID
- `COGNITO_CLIENT_ID` - CognitoクライアントID
- `COGNITO_CLIENT_SECRET` - Cognitoクライアントシークレット
- `COGNITO_DOMAIN` - Cognitoドメイン

### 3. 開発サーバーの起動

```bash
npm run dev
```

## Docker での実行

### 1. 単体でのビルド・実行

```bash
# バックエンドディレクトリで実行
docker build -t cognito-backend .
docker run -p 3001:3001 --env-file .env cognito-backend
```

### 2. docker-composeでの実行（推奨）

```bash
# プロジェクトルートで実行
docker-compose up
```

これにより以下が起動します：
- バックエンドAPI: http://localhost:3001
- フロントエンド: http://localhost:3000

## 本番デプロイ

### AWS ECS用のタスク定義例

```json
{
  "family": "cognito-backend",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "arn:aws:iam::ACCOUNT:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "cognito-backend",
      "image": "YOUR_ACCOUNT.dkr.ecr.REGION.amazonaws.com/cognito-backend:latest",
      "portMappings": [
        {
          "containerPort": 3001,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {"name": "NODE_ENV", "value": "production"},
        {"name": "PORT", "value": "3001"}
      ],
      "secrets": [
        {"name": "COGNITO_CLIENT_SECRET", "valueFrom": "arn:aws:secretsmanager:..."}
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/cognito-backend",
          "awslogs-region": "ap-northeast-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

## セキュリティ考慮事項

- HttpOnlyクッキーでXSS攻撃を防止
- CORS設定で不正なドメインからのアクセスを制限
- 本番環境では`COOKIE_SECURE=true`に設定
- AWS Secrets Managerでクライアントシークレットを管理