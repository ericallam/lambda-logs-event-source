## Publishing a new version

First, update the `SemanticVersion` in the `AWS::ServerlessRepo::Application` metadata in the `template.yml` CloudFormation template:

```yaml
Metadata:
  AWS::ServerlessRepo::Application:
    Name: lambda-logs-event-source
    Description: A serverless app that processes JSON logs from Lambda & API Gateway CloudWatch logs and invokes a given function
    Author: Eric Allam
    SpdxLicenseId: MIT
    LicenseUrl: LICENSE.txt
    ReadmeUrl: README.md
    Labels: ["logging", "observability", "lambda"]
    HomePageUrl: https://github.com/solve-hq/lambda-logs-event-source
    SemanticVersion: 1.0.1
    SourceCodeUrl: https://github.com/solve-hq/lambda-logs-event-source
```

Then, build, package, and publish the application like so:

```bash
$ yarn build
$ sam package --template-file ./.aws-sam/build/template.yaml --s3-bucket solve-eric-source-code-us-east-1 --output-template-file ./.aws-sam/build/packaged.yml --region us-east-1 --profile eric-dev
$ sam publish --template ./.aws-sam/build/packaged.yml --region us-east-1 --profile eric-dev --semantic-version NEW_VERSION
```
