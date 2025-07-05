# CDKデプロイ手順

## 前提条件
- AWS CLIがインストールされ、設定されていること
- Docker Desktopがインストールされ、起動していること
- Node.js と npm がインストールされていること

## デプロイ手順

### 1. ECRスタックのデプロイ
まず最初にECRリポジトリを作成します：

```bash
cd cdk
npm install
npx cdk deploy EcrStack
```

### 2. Dockerイメージのビルドとプッシュ
ECRスタックのデプロイが完了したら、出力されたECRリポジトリURIを使用してDockerイメージをビルドし、プッシュします：

```bash
# ECRにログイン
aws ecr get-login-password --region <your-region> | docker login --username AWS --password-stdin <account-id>.dkr.ecr.<region>.amazonaws.com

# backendディレクトリに移動
cd ../backend

# Dockerイメージをビルド
docker build -t django-backend .

# イメージにタグを付ける
docker tag django-backend:latest <ecr-repository-uri>:latest

# ECRにプッシュ
docker push <ecr-repository-uri>:latest
```

### 3. ネットワークスタックのデプロイ
VPCとセキュリティグループを作成します：

```bash
cd ../cdk
npx cdk deploy NetworkStack
```

### 4. Cognitoスタックのデプロイ
認証用のUser PoolとClientを作成します：

```bash
npx cdk deploy CognitoStack
```

### 5. ECSスタックのデプロイ
最後にECSクラスターとサービスをデプロイします：

```bash
npx cdk deploy EcsDjangoStack
```

## 注意事項

1. **デプロイ順序は重要です**：必ず上記の順序でデプロイしてください。特にECRスタックは他のスタックより前にデプロイし、Dockerイメージをプッシュする必要があります。

2. **環境変数の設定**：本番環境では、ECSタスク定義の環境変数とシークレットを適切に設定してください：
   - `DJANGO_SECRET_KEY`
   - `DATABASE_URL`
   - `COGNITO_CLIENT_SECRET`
   - `FRONTEND_URL`
   - `ALLOWED_HOSTS`

3. **ヘルスチェック**：デプロイ後、ALBのターゲットグループでヘルスチェックが成功していることを確認してください。

4. **トラブルシューティング**：
   - ECSサービスが起動しない場合は、CloudWatch Logsでコンテナログを確認してください
   - ヘルスチェックが失敗する場合は、Djangoアプリケーションが`/health/`エンドポイントを実装していることを確認してください

## スタックの削除

開発環境で不要になった場合は、以下の順序でスタックを削除してください：

```bash
npx cdk destroy EcsDjangoStack
npx cdk destroy CognitoStack
npx cdk destroy NetworkStack
npx cdk destroy EcrStack
```

**注意**: ECRリポジトリに画像が残っている場合は、先に画像を削除する必要があります。