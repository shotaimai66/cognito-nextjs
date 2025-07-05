import * as cdk from 'aws-cdk-lib';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import { Construct } from 'constructs';

export interface Route53StackProps extends cdk.StackProps {
  domainName: string;
}

export class Route53Stack extends cdk.Stack {
  public readonly hostedZone: route53.IHostedZone;
  public readonly certificate: acm.ICertificate;

  constructor(scope: Construct, id: string, props: Route53StackProps) {
    super(scope, id, props);

    // ホストゾーンの作成
    this.hostedZone = new route53.HostedZone(this, 'HostedZone', {
      zoneName: props.domainName,
      comment: `Hosted zone for ${props.domainName}`,
    });

    // SSL証明書の作成（リージョン：us-east-1 for CloudFront）
    // CloudFront用の証明書は別途us-east-1リージョンで作成する必要があります
    // 今回はALB用の証明書のみ作成します

    // SSL証明書の作成（ALB用、現在のリージョン）
    this.certificate = new acm.Certificate(this, 'Certificate', {
      domainName: props.domainName,
      subjectAlternativeNames: [`*.${props.domainName}`],
      validation: acm.CertificateValidation.fromDns(this.hostedZone),
    });

    // ネームサーバーの出力
    new cdk.CfnOutput(this, 'NameServers', {
      value: cdk.Fn.join(', ', this.hostedZone.hostedZoneNameServers!),
      description: 'Name servers for the hosted zone. Set these in your domain registrar.',
    });

    // ドメイン名の出力
    new cdk.CfnOutput(this, 'DomainName', {
      value: props.domainName,
      description: 'The custom domain name',
    });

    // ホストゾーンIDの出力
    new cdk.CfnOutput(this, 'HostedZoneId', {
      value: this.hostedZone.hostedZoneId,
      description: 'The hosted zone ID',
    });

    // 証明書ARNの出力
    new cdk.CfnOutput(this, 'CertificateArn', {
      value: this.certificate.certificateArn,
      description: 'The certificate ARN for ALB',
    });

  }
}