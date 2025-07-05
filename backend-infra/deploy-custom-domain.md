# カスタムドメインのデプロイ手順

このドキュメントでは、ムームードメインで取得した独自ドメインをAWS Route 53で使用し、ECS/ALBアプリケーションに適用する手順を説明します。

## 前提条件

- ムームードメインで独自ドメインを取得済み（例：`xxxxxxxx.tech`）
- AWS CLIが設定済み
- CDKがインストール済み

## デプロイ手順

### 1. Route 53ホストゾーンの作成

まず、Route 53でホストゾーンを作成し、SSL証明書を発行します：

```bash
cd cdk

# ドメイン名を環境変数に設定（または -c オプションで指定）
export CUSTOM_DOMAIN_NAME="xxxxxxxx.tech"

# Route 53スタックをデプロイ
cdk deploy Route53Stack
```

### 2. ネームサーバーの設定

デプロイが完了すると、以下のような出力が表示されます：

```
Outputs:
Route53Stack.NameServers = ns-1234.awsdns-12.org, ns-5678.awsdns-34.com, ns-9012.awsdns-56.net, ns-3456.awsdns-78.co.uk
```

これらのネームサーバーをムームードメインの管理画面で設定します：

1. ムームードメインにログイン
2. ドメイン管理 > ネームサーバ設定変更
3. 「GMOペパボ以外のネームサーバを使用する」を選択
4. 上記の4つのネームサーバーを入力
5. 設定を保存

### 3. SSL証明書の検証

ACM（AWS Certificate Manager）でSSL証明書が自動的に作成されます。DNS検証は自動的に行われますが、ネームサーバーの変更が反映されるまで時間がかかる場合があります（通常15分〜48時間）。

証明書の状態を確認：

```bash
# AWS コンソールで確認するか、以下のコマンドで確認
aws acm list-certificates --region ap-northeast-1
```

### 4. ECSスタックの更新

証明書が「Issued」状態になったら、ECSスタックを更新してカスタムドメインを適用します：

```bash
# すべてのスタックをデプロイ（既存のスタックも更新される）
cdk deploy --all
```

または個別にデプロイ：

```bash
cdk deploy EcsDjangoStack
```

### 5. 動作確認

デプロイが完了したら、以下のURLでアクセスできることを確認：

- `https://xxxxxxxx.tech` - メインドメイン
- `https://www.xxxxxxxx.tech` - wwwサブドメイン

HTTPアクセスは自動的にHTTPSにリダイレクトされます。

## トラブルシューティング

### 証明書が発行されない場合

1. ネームサーバーの設定が正しいか確認
2. DNS伝播を待つ（最大48時間）
3. Route 53のホストゾーンでCNAMEレコードが作成されているか確認

### ドメインにアクセスできない場合

1. 証明書が「Issued」状態か確認
2. ALBのリスナーが正しく設定されているか確認
3. セキュリティグループで443ポートが開いているか確認

### DNSが解決されない場合

```bash
# DNS解決の確認
nslookup xxxxxxxx.tech
dig xxxxxxxx.tech
```

## Context パラメータ

CDKデプロイ時に以下のパラメータを使用できます：

```bash
# ドメイン名を指定してデプロイ
cdk deploy --all -c domainName=xxxxxxxx.tech -c cognitoDomainPrefix=my-auth-domain

# 環境変数で指定
export CUSTOM_DOMAIN_NAME=xxxxxxxx.tech
export COGNITO_DOMAIN_PREFIX=my-auth-domain
cdk deploy --all
```

## 注意事項

- SSL証明書はus-east-1（CloudFront用）とap-northeast-1（ALB用）の両方に作成されます
- DNS伝播には時間がかかるため、すぐにアクセスできない場合があります
- 本番環境では、`ALLOWED_HOSTS`を適切に制限してください