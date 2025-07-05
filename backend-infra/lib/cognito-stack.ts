import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';

export interface CognitoStackProps extends cdk.StackProps {
  /**
   * Cognitoドメインのプレフィックス（グローバルで一意である必要があります）
   */
  cognitoDomainPrefix: string;
}

export class CognitoStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly userPoolDomain: cognito.UserPoolDomain;

  constructor(scope: Construct, id: string, props: CognitoStackProps) {
    super(scope, id, props);

    // Cognitoユーザープール
    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: 'cognito-auth-user-pool',
      // サインアップ設定
      signInAliases: {
        email: true,
      },
      autoVerify: {
        email: true,
      },
      // セルフサインアップを有効化
      selfSignUpEnabled: true,
      // パスワードポリシー
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
      },
      // メール設定
      userVerification: {
        emailSubject: 'メールアドレスの確認',
        emailBody: '認証コードは {####} です。',
        emailStyle: cognito.VerificationEmailStyle.CODE,
      },
      // アカウント復旧設定
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      // スキーマ設定
      standardAttributes: {
        email: {
          required: true,
          mutable: true,
        },
      },
      // MFA設定
      mfa: cognito.Mfa.OFF,
      // ユーザープール削除時の動作
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // ユーザープールクライアント
    this.userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
      userPool: this.userPool,
      userPoolClientName: 'cognito-auth-client',
      // Client Secretを生成
      generateSecret: true,
      // 認証フロー
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      // OAuth設定
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
        },
        scopes: [
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.PROFILE,
        ],
        callbackUrls: ['http://localhost:3000/callback'],
        logoutUrls: ['http://localhost:3000/'],
      },
      // トークンの有効期限
      refreshTokenValidity: cdk.Duration.days(30),
      accessTokenValidity: cdk.Duration.minutes(60),
      idTokenValidity: cdk.Duration.minutes(60),
      // セキュリティ設定
      preventUserExistenceErrors: true,
      // 読み取り・書き込み属性
      readAttributes: new cognito.ClientAttributes()
        .withStandardAttributes({ email: true, emailVerified: true }),
      writeAttributes: new cognito.ClientAttributes()
        .withStandardAttributes({ email: true }),
    });

    // ユーザープールドメイン
    this.userPoolDomain = new cognito.UserPoolDomain(this, 'UserPoolDomain', {
      userPool: this.userPool,
      cognitoDomain: {
        domainPrefix: props.cognitoDomainPrefix,
      },
    });

    // 出力
    new cdk.CfnOutput(this, 'UserPoolId', {
      description: 'Cognito User Pool ID',
      value: this.userPool.userPoolId,
      exportName: `${this.stackName}-UserPoolId`,
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      description: 'Cognito User Pool Client ID',
      value: this.userPoolClient.userPoolClientId,
      exportName: `${this.stackName}-UserPoolClientId`,
    });

    new cdk.CfnOutput(this, 'UserPoolDomainUrl', {
      description: 'Cognito User Pool Domain',
      value: `https://${this.userPoolDomain.domainName}.auth.${this.region}.amazoncognito.com`,
      exportName: `${this.stackName}-UserPoolDomain`,
    });

    new cdk.CfnOutput(this, 'Region', {
      description: 'AWS Region',
      value: this.region,
      exportName: `${this.stackName}-Region`,
    });
  }
}