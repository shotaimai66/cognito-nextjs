# Cognito CDK Stack

AWS CDKを使用してCognito User Poolをデプロイするプロジェクトです。

## 前提条件

- AWS CLI が設定済み
- Node.js がインストール済み
- CDK がブートストラップ済み（初回のみ）

## セットアップ

```bash
cd cdk
npm install
```

## CDKブートストラップ（初回のみ）

```bash
npx cdk bootstrap aws://ACCOUNT-NUMBER/REGION
# 例: npx cdk bootstrap aws://123456789012/ap-northeast-1
```

## デプロイ

### 新規デプロイ

```bash
# ドメインプレフィックスを指定してデプロイ
npx cdk deploy -c cognitoDomainPrefix=your-unique-domain-prefix

# または環境変数で指定
COGNITO_DOMAIN_PREFIX=your-unique-domain-prefix npx cdk deploy
```

### 既存スタックの更新

既存のCloudFormationスタックがある場合は、まずCDKにインポートする必要があります：

```bash
# 既存スタックの確認
aws cloudformation describe-stacks --stack-name cognito-auth-stack

# CDKでデプロイ（同じスタック名を使用）
npx cdk deploy CognitoAuthStack -c cognitoDomainPrefix=your-existing-domain-prefix
```

## デプロイ後の設定

### 1. 出力値の確認

```bash
# CDKの出力を確認
npx cdk deploy --outputs-file outputs.json
cat outputs.json
```

### 2. Client Secretの取得

```bash
# スタック出力から値を取得
USER_POOL_ID=$(aws cloudformation describe-stacks \
  --stack-name CognitoAuthStack \
  --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' \
  --output text)

CLIENT_ID=$(aws cloudformation describe-stacks \
  --stack-name CognitoAuthStack \
  --query 'Stacks[0].Outputs[?OutputKey==`UserPoolClientId`].OutputValue' \
  --output text)

# Client Secretを取得
aws cognito-idp describe-user-pool-client \
  --user-pool-id $USER_POOL_ID \
  --client-id $CLIENT_ID \
  --query 'UserPoolClient.ClientSecret' \
  --output text
```

### 3. 環境変数の設定

取得した値を `.env` ファイルに設定：

```bash
COGNITO_USER_POOL_ID=<取得したUser Pool ID>
COGNITO_CLIENT_ID=<取得したClient ID>
COGNITO_CLIENT_SECRET=<取得したClient Secret>
COGNITO_REGION=ap-northeast-1
COGNITO_DOMAIN=<取得したDomain URL>
```

## その他のコマンド

```bash
# 変更内容の確認（デプロイ前）
npx cdk diff -c cognitoDomainPrefix=your-domain-prefix

# CloudFormationテンプレートの生成
npx cdk synth -c cognitoDomainPrefix=your-domain-prefix

# スタックの削除
npx cdk destroy -c cognitoDomainPrefix=your-domain-prefix
```

## CDKとCloudFormationの比較

### CDKの利点

1. **TypeScript型チェック**: コンパイル時にエラーを検出
2. **IDE補完**: プロパティ名やメソッドの自動補完
3. **再利用性**: 関数やクラスとして抽象化可能
4. **プログラマブル**: 条件分岐やループが使用可能
5. **高レベル構造**: L2コンストラクトによる簡潔な記述

### CloudFormationテンプレートとの対応

| CloudFormation | CDK |
|----------------|-----|
| `AWS::Cognito::UserPool` | `cognito.UserPool` |
| `AWS::Cognito::UserPoolClient` | `cognito.UserPoolClient` |
| `AWS::Cognito::UserPoolDomain` | `cognito.UserPoolDomain` |
| `!Ref` | `.userPoolId` などのプロパティ |
| `!Sub` | テンプレート文字列 |

## トラブルシューティング

### デプロイエラー

```bash
# CloudFormationスタックの状態を確認
aws cloudformation describe-stack-events \
  --stack-name CognitoAuthStack \
  --query 'StackEvents[?ResourceStatus==`CREATE_FAILED`]'
```

### ドメイン名の競合

Cognitoドメインはグローバルで一意である必要があります。エラーが発生した場合は、別のプレフィックスを使用してください。