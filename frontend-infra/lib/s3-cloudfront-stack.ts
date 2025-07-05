import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53targets from 'aws-cdk-lib/aws-route53-targets';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';

export interface S3CloudFrontStackProps extends cdk.StackProps {
  domainName?: string;
  hostedZoneId?: string;
  certificateArn?: string;
}

export class S3CloudFrontStack extends cdk.Stack {
  public readonly bucket: s3.Bucket;
  public readonly distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props: S3CloudFrontStackProps) {
    super(scope, id, props);

    // S3バケットの作成（ウェブサイトホスティング用）
    this.bucket = new s3.Bucket(this, 'FrontendBucket', {
      bucketName: props.domainName ? `${props.domainName}-frontend` : undefined,
      websiteIndexDocument: 'index.html',
      websiteErrorDocument: 'error.html',
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      autoDeleteObjects: false,
    });

    // Origin Access Identity (OAI) の作成
    const oai = new cloudfront.OriginAccessIdentity(this, 'FrontendOAI', {
      comment: 'OAI for frontend bucket',
    });

    // S3バケットポリシーの設定（OAIからのアクセスを許可）
    this.bucket.grantRead(oai);

    // ログバケットの作成（CloudFront用にACLを有効化）
    const logBucket = new s3.Bucket(this, 'LogBucket', {
      lifecycleRules: [{
        expiration: cdk.Duration.days(90),
      }],
      blockPublicAccess: new s3.BlockPublicAccess({
        blockPublicAcls: false,
        blockPublicPolicy: true,
        ignorePublicAcls: false,
        restrictPublicBuckets: true,
      }),
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_PREFERRED,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // CloudFrontディストリビューションの設定
    let distributionConfig: cloudfront.DistributionProps = {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessIdentity(this.bucket, {
          originAccessIdentity: oai,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        compress: true,
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.minutes(5),
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.minutes(5),
        },
      ],
      priceClass: cloudfront.PriceClass.PRICE_CLASS_200,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      enableLogging: true,
      logBucket: logBucket,
    };

    // カスタムドメインが指定されている場合
    if (props.domainName && props.certificateArn) {
      // 証明書を参照
      const certificate = acm.Certificate.fromCertificateArn(
        this,
        'Certificate',
        props.certificateArn
      );

      // ディストリビューションにドメイン設定を含めて作成
      distributionConfig = {
        ...distributionConfig,
        certificate: certificate,
        domainNames: [props.domainName, `www.${props.domainName}`],
      };
    }

    // CloudFrontディストリビューションの作成
    this.distribution = new cloudfront.Distribution(
      this,
      'FrontendDistribution',
      distributionConfig
    );

    // Route 53レコードの作成（ホストゾーンが指定されている場合）
    if (props.hostedZoneId && props.domainName) {
      const hostedZone = route53.HostedZone.fromHostedZoneAttributes(
        this,
        'HostedZone',
        {
          hostedZoneId: props.hostedZoneId,
          zoneName: props.domainName,
        }
      );

      // Aレコード（メインドメイン）
      new route53.ARecord(this, 'FrontendARecord', {
        zone: hostedZone,
        recordName: props.domainName,
        target: route53.RecordTarget.fromAlias(
          new route53targets.CloudFrontTarget(this.distribution)
        ),
      });

      // Aレコード（wwwサブドメイン）
      new route53.ARecord(this, 'FrontendWWWARecord', {
        zone: hostedZone,
        recordName: `www.${props.domainName}`,
        target: route53.RecordTarget.fromAlias(
          new route53targets.CloudFrontTarget(this.distribution)
        ),
      });
    }

    // サンプルのindex.htmlをデプロイ（オプション）
    new s3deploy.BucketDeployment(this, 'DeployWebsite', {
      sources: [
        s3deploy.Source.data('index.html', `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Frontend App</title>
</head>
<body>
  <h1>Welcome to ${props.domainName || 'Frontend App'}</h1>
  <p>This is a placeholder page. Replace with your actual frontend application.</p>
</body>
</html>
        `),
      ],
      destinationBucket: this.bucket,
      distribution: this.distribution,
      distributionPaths: ['/*'],
    });

    // 出力
    new cdk.CfnOutput(this, 'BucketName', {
      value: this.bucket.bucketName,
      description: 'S3 bucket name for frontend hosting',
    });

    new cdk.CfnOutput(this, 'DistributionId', {
      value: this.distribution.distributionId,
      description: 'CloudFront distribution ID',
    });

    new cdk.CfnOutput(this, 'DistributionDomainName', {
      value: this.distribution.distributionDomainName,
      description: 'CloudFront distribution domain name',
    });

    if (props.domainName) {
      new cdk.CfnOutput(this, 'FrontendURL', {
        value: `https://${props.domainName}`,
        description: 'Frontend application URL',
      });
    }
  }
}