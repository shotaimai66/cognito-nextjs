# フロントエンドインフラ (S3 + CloudFront)

このプロジェクトは、AWS S3とCloudFrontを使用したフロントエンドアプリケーションのホスティングインフラを管理します。

## アーキテクチャ

- **S3バケット**: 静的ファイルのストレージ
- **CloudFront**: グローバルCDN配信
- **Route 53**: カスタムドメインのDNS管理
- **ACM**: SSL/TLS証明書

## 前提条件

1. AWS CLIが設定済み
2. Node.js と npm がインストール済み
3. バックエンドのRoute 53スタックがデプロイ済み
4. us-east-1リージョンにACM証明書が必要（CloudFront用）

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. us-east-1リージョンに証明書を作成

CloudFrontはus-east-1リージョンの証明書のみをサポートするため、別途作成が必要です：

```bash
# us-east-1に証明書を作成
aws acm request-certificate \
  --domain-name xxxxxxxx.tech \
  --subject-alternative-names "*.xxxxxxxx.tech" \
  --validation-method DNS \
  --region us-east-1

# 証明書のARNを確認
aws acm list-certificates --region us-east-1
```

### 3. デプロイ

#### 方法1: デプロイスクリプトを使用（推奨）

```bash
./deploy.sh
```

#### 方法2: 手動でデプロイ

```bash
# 必要な情報を取得
export CUSTOM_DOMAIN_NAME="xxxxxxxx.tech"
export HOSTED_ZONE_ID=$(aws route53 list-hosted-zones-by-name --query "HostedZones[?Name=='${CUSTOM_DOMAIN_NAME}.'].Id" --output text | cut -d'/' -f3)
export CERTIFICATE_ARN=$(aws acm list-certificates --region us-east-1 --query "CertificateSummaryList[?DomainName=='${CUSTOM_DOMAIN_NAME}'].CertificateArn" --output text)

# デプロイ
npx cdk deploy \
  -c domainName=$CUSTOM_DOMAIN_NAME \
  -c hostedZoneId=$HOSTED_ZONE_ID \
  -c certificateArn=$CERTIFICATE_ARN
```

## フロントエンドアプリケーションのデプロイ

### 1. アプリケーションのビルド

```bash
# Next.jsの場合
cd ../
npm run build
npm run export  # 静的エクスポート

# Reactの場合
npm run build
```

### 2. S3へアップロード

```bash
# バケット名を取得
BUCKET_NAME=$(aws cloudformation describe-stacks \
  --stack-name S3CloudFrontStack \
  --query 'Stacks[0].Outputs[?OutputKey==`BucketName`].OutputValue' \
  --output text)

# ファイルをアップロード
aws s3 sync ./out s3://$BUCKET_NAME --delete

# CloudFrontのキャッシュを無効化
DISTRIBUTION_ID=$(aws cloudformation describe-stacks \
  --stack-name S3CloudFrontStack \
  --query 'Stacks[0].Outputs[?OutputKey==`DistributionId`].OutputValue' \
  --output text)

aws cloudfront create-invalidation \
  --distribution-id $DISTRIBUTION_ID \
  --paths '/*'
```

## CI/CDパイプライン用のコマンド

GitHubActionsなどで使用する場合：

```yaml
- name: Deploy to S3
  run: |
    aws s3 sync ./out s3://${{ secrets.S3_BUCKET_NAME }} --delete
    aws cloudfront create-invalidation \
      --distribution-id ${{ secrets.CLOUDFRONT_DISTRIBUTION_ID }} \
      --paths '/*'
```

## トラブルシューティング

### 証明書が見つからない

- us-east-1リージョンに証明書が作成されているか確認
- 証明書のステータスが「ISSUED」になっているか確認

### アクセスが拒否される

- S3バケットポリシーが正しく設定されているか確認
- CloudFrontのOAIが正しく設定されているか確認

### カスタムドメインでアクセスできない

- Route 53のAレコードが正しく設定されているか確認
- DNS伝播を待つ（最大48時間）
- 証明書がCloudFrontに正しく関連付けられているか確認

## セキュリティのベストプラクティス

1. **S3バケットの直接アクセスを禁止**
   - CloudFront経由のみアクセス可能

2. **HTTPS強制**
   - HTTPアクセスは自動的にHTTPSにリダイレクト

3. **バージョニング有効**
   - 誤削除からの復旧が可能

4. **ログ記録**
   - CloudFrontアクセスログを別のS3バケットに保存

## 削除

```bash
# スタックの削除（S3バケットは保持される）
npx cdk destroy

# S3バケットを手動で空にして削除
aws s3 rm s3://$BUCKET_NAME --recursive
aws s3 rb s3://$BUCKET_NAME
```
