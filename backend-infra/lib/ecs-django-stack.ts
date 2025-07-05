import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as logs from "aws-cdk-lib/aws-logs";
import * as iam from "aws-cdk-lib/aws-iam";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as route53targets from "aws-cdk-lib/aws-route53-targets";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import { Construct } from "constructs";

export interface EcsDjangoStackProps extends cdk.StackProps {
  vpc: ec2.IVpc;
  ecsSecurityGroup: ec2.ISecurityGroup;
  albSecurityGroup: ec2.ISecurityGroup;
  userPool: cognito.IUserPool;
  userPoolClient: cognito.IUserPoolClient;
  repository: ecr.IRepository;
  hostedZone?: route53.IHostedZone;
  certificate?: acm.ICertificate;
  domainName?: string;
}

export class EcsDjangoStack extends cdk.Stack {
  public readonly cluster: ecs.Cluster;
  public readonly service: ecs.FargateService;
  public readonly loadBalancer: elbv2.ApplicationLoadBalancer;

  constructor(scope: Construct, id: string, props: EcsDjangoStackProps) {
    super(scope, id, props);

    // ECSクラスター
    this.cluster = new ecs.Cluster(this, "DjangoCluster", {
      vpc: props.vpc,
      clusterName: "django-cluster",
      containerInsights: true, // CloudWatch Container Insights有効化
    });

    // Application Load Balancer
    this.loadBalancer = new elbv2.ApplicationLoadBalancer(this, "DjangoALB", {
      vpc: props.vpc,
      internetFacing: true,
      securityGroup: props.albSecurityGroup,
      loadBalancerName: "django-alb",
    });

    // ターゲットグループ
    const targetGroup = new elbv2.ApplicationTargetGroup(
      this,
      "DjangoTargetGroup",
      {
        vpc: props.vpc,
        port: 8000,
        protocol: elbv2.ApplicationProtocol.HTTP,
        targetType: elbv2.TargetType.IP,
        healthCheck: {
          enabled: true,
          path: "/health/", // Djangoのヘルスチェックエンドポイント
          healthyHttpCodes: "200",
          interval: cdk.Duration.seconds(30),
          timeout: cdk.Duration.seconds(5),
          healthyThresholdCount: 2,
          unhealthyThresholdCount: 5,
        },
      }
    );

    // ALBリスナー（HTTP）
    const httpListener = this.loadBalancer.addListener("DjangoListener", {
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
    });

    // HTTPSリスナー（証明書がある場合）
    if (props.certificate && props.domainName) {
      const httpsListener = this.loadBalancer.addListener("DjangoListenerHTTPS", {
        port: 443,
        protocol: elbv2.ApplicationProtocol.HTTPS,
        certificates: [props.certificate],
        defaultTargetGroups: [targetGroup],
      });

      // HTTPからHTTPSへのリダイレクト
      httpListener.addAction("RedirectToHTTPS", {
        action: elbv2.ListenerAction.redirect({
          protocol: "HTTPS",
          port: "443",
          permanent: true,
        }),
      });
    } else {
      // 証明書がない場合はHTTPをデフォルトとして使用
      httpListener.addTargetGroups("DefaultHTTP", {
        targetGroups: [targetGroup],
      });
    }

    // CloudWatch Logs
    const logGroup = new logs.LogGroup(this, "DjangoLogGroup", {
      logGroupName: "/ecs/django-backend",
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // タスクロール
    const taskRole = new iam.Role(this, "DjangoTaskRole", {
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
      description: "Role for Django ECS tasks",
    });

    // Cognitoへのアクセス許可
    taskRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "cognito-idp:AdminInitiateAuth",
          "cognito-idp:AdminGetUser",
          "cognito-idp:GetUser",
          "cognito-idp:InitiateAuth",
          "cognito-idp:SignUp",
          "cognito-idp:ConfirmSignUp",
          "cognito-idp:RespondToAuthChallenge",
        ],
        resources: [props.userPool.userPoolArn],
      })
    );

    // 実行ロール
    const executionRole = new iam.Role(this, "DjangoExecutionRole", {
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AmazonECSTaskExecutionRolePolicy"
        ),
      ],
    });

    // ECRへのアクセス許可
    props.repository.grantPull(executionRole);

    // タスク定義
    const taskDefinition = new ecs.FargateTaskDefinition(
      this,
      "DjangoTaskDefinition",
      {
        family: "django-backend",
        cpu: 512, // 0.5 vCPU
        memoryLimitMiB: 1024, // 1GB RAM
        taskRole: taskRole,
        executionRole: executionRole,
      }
    );

    // コンテナ定義
    const container = taskDefinition.addContainer("DjangoContainer", {
      image: ecs.ContainerImage.fromEcrRepository(props.repository, "latest"),
      containerName: "django-backend",
      environment: {
        // 基本環境変数
        DJANGO_SETTINGS_MODULE: "config.settings.production",
        PORT: "8000",
        // Cognito設定
        COGNITO_REGION: props.userPool.stack.region,
        COGNITO_USER_POOL_ID: props.userPool.userPoolId,
        COGNITO_CLIENT_ID: props.userPoolClient.userPoolClientId,
        // CORS設定
        FRONTEND_URL: props.domainName ? `https://${props.domainName}` : "https://your-frontend-domain.com",
        ALLOWED_HOSTS: props.domainName ? `api.${props.domainName}` : "*", // APIサブドメインを許可
      },
      secrets: {
        // Secrets Managerから取得する機密情報
        // DJANGO_SECRET_KEY: ecs.Secret.fromSecretsManager(...),
        // DATABASE_URL: ecs.Secret.fromSecretsManager(...),
        // COGNITO_CLIENT_SECRET: ecs.Secret.fromSecretsManager(...),
      },
      logging: ecs.LogDrivers.awsLogs({
        logGroup: logGroup,
        streamPrefix: "django",
      }),
      portMappings: [
        {
          containerPort: 8000,
          protocol: ecs.Protocol.TCP,
        },
      ],
      healthCheck: {
        command: [
          "CMD-SHELL",
          "curl -f http://localhost:8000/health/ || exit 1",
        ],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
        startPeriod: cdk.Duration.seconds(60),
      },
    });

    // Fargateサービス
    this.service = new ecs.FargateService(this, "DjangoService", {
      cluster: this.cluster,
      taskDefinition: taskDefinition,
      serviceName: "django-backend-service",
      desiredCount: 2, // 最小2つのタスクでHA構成
      securityGroups: [props.ecsSecurityGroup],
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      assignPublicIp: false,
      enableExecuteCommand: true, // ECS Execを有効化（デバッグ用）
      platformVersion: ecs.FargatePlatformVersion.LATEST,
    });

    // ターゲットグループにサービスを登録
    this.service.attachToApplicationTargetGroup(targetGroup);

    // Auto Scaling設定
    const scaling = this.service.autoScaleTaskCount({
      minCapacity: 2,
      maxCapacity: 10,
    });

    // CPU使用率によるスケーリング
    scaling.scaleOnCpuUtilization("DjangoCpuScaling", {
      targetUtilizationPercent: 70,
      scaleInCooldown: cdk.Duration.minutes(5),
      scaleOutCooldown: cdk.Duration.minutes(2),
    });

    // メモリ使用率によるスケーリング
    scaling.scaleOnMemoryUtilization("DjangoMemoryScaling", {
      targetUtilizationPercent: 80,
      scaleInCooldown: cdk.Duration.minutes(5),
      scaleOutCooldown: cdk.Duration.minutes(2),
    });

    // Route 53レコードの作成（ホストゾーンが提供されている場合）
    if (props.hostedZone && props.domainName) {
      // APIサブドメインへのAレコード
      new route53.ARecord(this, "DjangoAPIARecord", {
        zone: props.hostedZone,
        recordName: `api.${props.domainName}`,
        target: route53.RecordTarget.fromAlias(
          new route53targets.LoadBalancerTarget(this.loadBalancer)
        ),
      });
    }

    // 出力
    new cdk.CfnOutput(this, "LoadBalancerDNS", {
      description: "Application Load Balancer DNS name",
      value: this.loadBalancer.loadBalancerDnsName,
      exportName: `${this.stackName}-LoadBalancerDNS`,
    });

    new cdk.CfnOutput(this, "LoadBalancerURL", {
      description: "Application Load Balancer URL",
      value: props.domainName ? `https://api.${props.domainName}` : `http://${this.loadBalancer.loadBalancerDnsName}`,
      exportName: `${this.stackName}-LoadBalancerURL`,
    });

    new cdk.CfnOutput(this, "ClusterName", {
      description: "ECS Cluster Name",
      value: this.cluster.clusterName,
      exportName: `${this.stackName}-ClusterName`,
    });

    new cdk.CfnOutput(this, "ServiceName", {
      description: "ECS Service Name",
      value: this.service.serviceName,
      exportName: `${this.stackName}-ServiceName`,
    });
  }
}
