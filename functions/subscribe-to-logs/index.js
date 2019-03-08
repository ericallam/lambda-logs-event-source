const CloudWatchLogs = require("aws-sdk/clients/cloudwatchlogs");
const Lambda = require("aws-sdk/clients/lambda");

const cloudWatchLogs = new CloudWatchLogs();
const lambda = new Lambda();

const destinationArn = process.env.DESTINATION_ARN;
const filterPattern = process.env.FILTER_PATTERN;
const processorFunction = process.env.PROCESSOR_FUNCTION_NAME;

const debug = require("debug")("lambda-logs-event-source:subscribe-to-logs");

const getDestinationName = () => destinationArn.split(":").reverse()[0];

const subscribe = async (logGroupName, accountId) => {
  if (logGroupName.match(getDestinationName())) {
    debug(
      "Skipping log group %s because it is the log group of the destination function %s",
      logGroupName,
      destinationArn
    );
    return;
  }

  if (processorFunction && logGroupName.match(processorFunction)) {
    debug(
      "Skipping log group %s because it is the log group of the processor function %s",
      logGroupName,
      processorFunction
    );
    return;
  }

  const { subscriptionFilters } = await cloudWatchLogs
    .describeSubscriptionFilters({
      logGroupName
    })
    .promise();

  if (subscriptionFilters && subscriptionFilters.length > 0) {
    debug(
      "Skipping log group %s because it already has subscription fitlers",
      logGroupName
    );

    return;
  }

  const permission = {
    FunctionName: destinationArn,
    StatementId: `${logGroupName.split("/")[3]}_${parseInt(
      Math.random() * 10000
    )}`,
    Action: "lambda:InvokeFunction",
    Principal: `logs.${process.env.AWS_REGION}.amazonaws.com`,
    SourceArn: `arn:aws:logs:${
      process.env.AWS_REGION
    }:${accountId}:log-group:${logGroupName}:*`,
    SourceAccount: accountId
  };

  debug(`Adding permission for cloudwatch to invoke lambda: %o`, permission);

  await lambda.addPermission(permission).promise();

  const options = {
    destinationArn,
    logGroupName,
    filterName: "ship-logs",
    filterPattern
  };

  debug(`Subscribing logGroup to destination lambda: %o`, {
    destinationArn,
    logGroupName,
    filterName: "ship-logs",
    filterPattern
  });

  return cloudWatchLogs.putSubscriptionFilter(options).promise();
};

const handler = async (event, { invokedFunctionArn }) => {
  const { logGroupName } = event.detail.requestParameters;

  const destinationName = getDestinationName();

  if (
    logGroupName === `/aws/lambda/${destinationName}` ||
    logGroupName === `/aws/lambda/${processorFunction}`
  ) {
    debug("ignoring log group to avoid an invocation loop: %o", {
      logGroupName,
      destinationArn,
      processorFunction,
      destinationName
    });

    return;
  }

  if (process.env.PREFIX && !logGroupName.startsWith(process.env.PREFIX)) {
    debug("ignoring log group because it does not match prefix: %o", {
      logGroupName,
      destinationArn,
      destinationName,
      prefix: process.env.PREFIX
    });

    return;
  }

  const accountId = invokedFunctionArn.split(":")[4];

  debug("subscribing to logs for log group: %o", {
    logGroupName,
    destinationArn,
    destinationName,
    accountId
  });

  return subscribe(logGroupName, accountId);
};

exports.handler = handler;
