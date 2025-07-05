#!/bin/bash

# フロントエンドインフラのデプロイスクリプト

set -e

echo "🚀 フロントエンドインフラのデプロイを開始します..."

# 必要な情報の取得
if [ -z "$CUSTOM_DOMAIN_NAME" ]; then
    read -p "ドメイン名を入力してください (例: xxxxxxxx.tech): " CUSTOM_DOMAIN_NAME
fi

if [ -z "$HOSTED_ZONE_ID" ]; then
    echo "Route 53のホストゾーンIDを取得しています..."
    HOSTED_ZONE_ID=$(aws route53 list-hosted-zones-by-name --query "HostedZones[?Name=='${CUSTOM_DOMAIN_NAME}.'].Id" --output text | cut -d'/' -f3)
    
    if [ -z "$HOSTED_ZONE_ID" ]; then
        echo "❌ ホストゾーンが見つかりません。先にバックエンドのRoute53スタックをデプロイしてください。"
        exit 1
    fi
    echo "✅ ホストゾーンID: $HOSTED_ZONE_ID"
fi

# CloudFront用の証明書（us-east-1）を確認
if [ -z "$CERTIFICATE_ARN" ]; then
    echo "ACM証明書（us-east-1）を確認しています..."
    CERTIFICATE_ARN=$(aws acm list-certificates --region us-east-1 --query "CertificateSummaryList[?DomainName=='${CUSTOM_DOMAIN_NAME}'].CertificateArn" --output text)
    
    if [ -z "$CERTIFICATE_ARN" ]; then
        echo "⚠️  us-east-1リージョンに証明書が見つかりません。新しく作成します..."
        # 証明書作成の手順を案内
        echo "CloudFront用の証明書はus-east-1リージョンに作成する必要があります。"
        echo "手動で作成するか、別途スクリプトを実行してください。"
        exit 1
    fi
    echo "✅ 証明書ARN: $CERTIFICATE_ARN"
fi

# CDKデプロイ
echo "📦 依存関係をインストールしています..."
npm install

echo "🔨 TypeScriptをビルドしています..."
npm run build

echo "🚀 CDKスタックをデプロイしています..."
npx cdk deploy \
    -c domainName=$CUSTOM_DOMAIN_NAME \
    -c hostedZoneId=$HOSTED_ZONE_ID \
    -c certificateArn=$CERTIFICATE_ARN \
    --require-approval never

echo "✅ デプロイが完了しました！"
echo ""
echo "📝 次のステップ:"
echo "1. フロントエンドアプリケーションをビルド"
echo "2. aws s3 sync コマンドでS3バケットにアップロード"
echo "3. CloudFrontのキャッシュを無効化（必要に応じて）"
echo ""
echo "デプロイコマンドの例:"
echo "aws s3 sync ./build s3://\$(aws cloudformation describe-stacks --stack-name S3CloudFrontStack --query 'Stacks[0].Outputs[?OutputKey==\`BucketName\`].OutputValue' --output text)"
echo "aws cloudfront create-invalidation --distribution-id \$(aws cloudformation describe-stacks --stack-name S3CloudFrontStack --query 'Stacks[0].Outputs[?OutputKey==\`DistributionId\`].OutputValue' --output text) --paths '/*'"