import * as cdk from "aws-cdk-lib";
import * as ecr from "aws-cdk-lib/aws-ecr";
import { Construct } from "constructs";

export class EcrStack extends cdk.Stack {
  public readonly repository: ecr.Repository;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ECRリポジトリ
    this.repository = new ecr.Repository(this, "DjangoRepository", {
      repositoryName: "django-backend",
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      imageTagMutability: ecr.TagMutability.MUTABLE,
      imageScanOnPush: true,
      // 自動ライフサイクルルール（古いイメージを削除）
      lifecycleRules: [
        {
          description: "Remove old images",
          maxImageCount: 10,
          rulePriority: 1,
        },
      ],
    });

    // 出力
    new cdk.CfnOutput(this, "EcrRepositoryUri", {
      description: "ECR Repository URI",
      value: this.repository.repositoryUri,
      exportName: `${this.stackName}-EcrRepositoryUri`,
    });

    new cdk.CfnOutput(this, "EcrRepositoryName", {
      description: "ECR Repository Name",
      value: this.repository.repositoryName,
      exportName: `${this.stackName}-EcrRepositoryName`,
    });
  }
}