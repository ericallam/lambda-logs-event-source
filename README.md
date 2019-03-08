# lambda-logs-event-source Serverless App

An [AWS SAM](https://github.com/awslabs/serverless-application-model) app that processes JSON logs from Lambda & API Gateway CloudWatch logs and invokes a given function.

## Architecture

![lambda-logs-event-source Architecture](https://github.com/solve-hq/lambda-logs-event-source/raw/master/assets/lambda-logs-event-processor-arch-diagram.png)

- Newly created Lambda CloudWatch LogGroups trigger the `set-log-group-retention-policy` and `subscribe-to-logs` functions.
- `set-log-group-retention-policy` updates the LogGroup retention period to a default of 7 days.
- `subscribe-to-logs` will set a subscription filter on the LogGroup that will trigger the `process-logs` function whenever new data is written to the LogGroup
- Newly created API Gateway CloudWatch Execution logs trigger the `set-log-group-retention-policy` and `subscribe-to-logs` functions.
- `set-log-group-retention-policy` updates the LogGroup retention period to a default of 7 days.
- `subscribe-to-logs` will set a subscription filter on the LogGroup that will trigger the `structure-api-gateway-logs` function whenever new data is written to the LogGroup
- `structure-api-gateway-logs` will parse the logs produced by API Gateway and write structured JSON to its own LogGroup
- The `structure-api-gateway-logs` has a subscription filter on it that triggers the `process-logs`.
- `process-logs` parses the structured JSON logs into individual events and invokes your Processor Function with an array of events using an `"Event"` invocation type

## Installation

This app is meant to be used as part of a larger application, so the recommended way to use it is to embed it as a nested app in your serverless application. To do this, paste the following into your SAM template:

```yaml
LogSource:
  Type: AWS::Serverless::Application
  Properties:
    Location:
      ApplicationId: arn:aws:serverlessrepo:us-east-1:077246666028:applications/lambda-logs-event-source
      SemanticVersion: 1.0.0
    Parameters:
      EventProcessorFunctionName: !Ref ShipLogsToThirdParty
      # Retention Period in Days of LogGroups
      #RetentionDays: 60 # Uncomment to override default value
      # Enable debug logging in the lambda-logs-event-source lambda functions
      #DebugEnabled: "yes" # Uncomment to override default value
```
