import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export class VpcStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;
  public readonly ecsSecurityGroup: ec2.SecurityGroup;
  public readonly albSecurityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // VPC
    this.vpc = new ec2.Vpc(this, 'DjangoVpc', {
      vpcName: 'django-app-vpc',
      cidr: '10.0.0.0/16',
      maxAzs: 2, // マルチAZ構成
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
      ],
      // NAT Gatewayを各AZに配置
      natGateways: 2,
      // VPCエンドポイントを有効化（コスト削減とセキュリティ向上）
      enableDnsHostnames: true,
      enableDnsSupport: true,
    });

    // ALB用セキュリティグループ
    this.albSecurityGroup = new ec2.SecurityGroup(this, 'AlbSecurityGroup', {
      vpc: this.vpc,
      description: 'Security group for Application Load Balancer',
      allowAllOutbound: true,
    });

    // HTTP/HTTPSトラフィックを許可
    this.albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      'Allow HTTP traffic'
    );
    this.albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      'Allow HTTPS traffic'
    );

    // ECS用セキュリティグループ
    this.ecsSecurityGroup = new ec2.SecurityGroup(this, 'EcsSecurityGroup', {
      vpc: this.vpc,
      description: 'Security group for ECS tasks',
      allowAllOutbound: true,
    });

    // ALBからのトラフィックのみ許可
    this.ecsSecurityGroup.addIngressRule(
      this.albSecurityGroup,
      ec2.Port.tcp(8000), // Djangoのデフォルトポート
      'Allow traffic from ALB'
    );

    // VPCエンドポイント（コスト最適化）
    this.vpc.addGatewayEndpoint('S3Endpoint', {
      service: ec2.GatewayVpcEndpointAwsService.S3,
    });

    this.vpc.addGatewayEndpoint('DynamoDbEndpoint', {
      service: ec2.GatewayVpcEndpointAwsService.DYNAMODB,
    });

    // 出力
    new cdk.CfnOutput(this, 'VpcId', {
      description: 'VPC ID',
      value: this.vpc.vpcId,
      exportName: `${this.stackName}-VpcId`,
    });

    new cdk.CfnOutput(this, 'PrivateSubnetIds', {
      description: 'Private Subnet IDs',
      value: this.vpc.privateSubnets.map(subnet => subnet.subnetId).join(','),
      exportName: `${this.stackName}-PrivateSubnetIds`,
    });

    new cdk.CfnOutput(this, 'PublicSubnetIds', {
      description: 'Public Subnet IDs',
      value: this.vpc.publicSubnets.map(subnet => subnet.subnetId).join(','),
      exportName: `${this.stackName}-PublicSubnetIds`,
    });

    new cdk.CfnOutput(this, 'EcsSecurityGroupId', {
      description: 'ECS Security Group ID',
      value: this.ecsSecurityGroup.securityGroupId,
      exportName: `${this.stackName}-EcsSecurityGroupId`,
    });

    new cdk.CfnOutput(this, 'AlbSecurityGroupId', {
      description: 'ALB Security Group ID',
      value: this.albSecurityGroup.securityGroupId,
      exportName: `${this.stackName}-AlbSecurityGroupId`,
    });
  }
}