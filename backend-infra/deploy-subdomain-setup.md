# サブドメイン構成でのデプロイ手順

## ドメイン構成

- **フロントエンド**: `xxxxxxxx.tech`, `www.xxxxxxxx.tech`
- **バックエンドAPI**: `api.xxxxxxxx.tech`

## デプロイ手順

### 1. Route 53ホストゾーンの作成（未作成の場合）

```bash
cd cdk
npx cdk deploy Route53Stack -c domainName=xxxxxxxx.tech
```

出力されるネームサーバーをムームードメインに設定してください。

### 2. 証明書の確認

#### バックエンド用（東京リージョン）
```bash
aws acm list-certificates --region ap-northeast-1
```

#### フロントエンド用（us-east-1）
```bash
# 作成が必要な場合
aws acm request-certificate \
  --domain-name xxxxxxxx.tech \
  --subject-alternative-names "*.xxxxxxxx.tech" \
  --validation-method DNS \
  --region us-east-1
```

### 3. バックエンドのデプロイ（ECSスタック更新）

```bash
cd cdk
npx cdk deploy EcsDjangoStack -c domainName=xxxxxxxx.tech
```

これにより以下が設定されます：
- `api.xxxxxxxx.tech` → ALB
- ALLOWED_HOSTS: `api.xxxxxxxx.tech`
- FRONTEND_URL: `https://xxxxxxxx.tech`

### 4. フロントエンドのデプロイ

```bash
cd ../frontend-infra

# 必要な情報を取得
export CUSTOM_DOMAIN_NAME="xxxxxxxx.tech"
export HOSTED_ZONE_ID=$(aws route53 list-hosted-zones-by-name --query "HostedZones[?Name=='${CUSTOM_DOMAIN_NAME}.'].Id" --output text | cut -d'/' -f3)
export CERTIFICATE_ARN=$(aws acm list-certificates --region us-east-1 --query "CertificateSummaryList[?DomainName=='${CUSTOM_DOMAIN_NAME}'].CertificateArn" --output text)

# デプロイ
npx cdk deploy -c domainName=$CUSTOM_DOMAIN_NAME -c hostedZoneId=$HOSTED_ZONE_ID -c certificateArn=$CERTIFICATE_ARN
```

これにより以下が設定されます：
- `xxxxxxxx.tech` → CloudFront → S3
- `www.xxxxxxxx.tech` → CloudFront → S3

### 5. フロントエンドアプリの設定更新

フロントエンドアプリケーションで、APIのエンドポイントを更新：

```javascript
// .env.production
NEXT_PUBLIC_API_URL=https://api.xxxxxxxx.tech

// または
const API_BASE_URL = 'https://api.xxxxxxxx.tech';
```

### 6. フロントエンドアプリのデプロイ

```bash
# Next.jsアプリのビルド
cd ../
npm run build
npm run export

# S3にアップロード
aws s3 sync ./out s3://[bucket-name] --delete

# CloudFrontキャッシュをクリア
aws cloudfront create-invalidation --distribution-id [distribution-id] --paths '/*'
```

## 動作確認

- フロントエンド: `https://xxxxxxxx.tech`
- バックエンドAPI: `https://api.xxxxxxxx.tech/health/`

## トラブルシューティング

### CORSエラーが発生する場合

Djangoの設定で以下を確認：
```python
CORS_ALLOWED_ORIGINS = [
    "https://xxxxxxxx.tech",
    "https://www.xxxxxxxx.tech",
]
```

### 証明書エラーが発生する場合

- api.xxxxxxxx.tech用の証明書が`*.xxxxxxxx.tech`をカバーしているか確認
- 証明書のステータスが「ISSUED」になっているか確認