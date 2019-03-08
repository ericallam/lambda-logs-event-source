const retentionDays = process.env.RETENTION_DAYS;

const CloudWatchLogs = require("aws-sdk/clients/cloudwatchlogs");

const cloudWatchLogsClient = new CloudWatchLogs();

const debug = require("debug")(
  "lambda-logs-event-source:set-log-group-retention-policy"
);

const setExpiry = async logGroupName => {
  const params = {
    logGroupName: logGroupName,
    retentionInDays: retentionDays
  };

  return cloudWatchLogsClient.putRetentionPolicy(params).promise();
};

const handler = async event => {
  let logGroupName = event.detail.requestParameters.logGroupName;

  debug(`Updating the retention policy of log group: %o`, {
    logGroupName,
    retentionDays
  });

  return setExpiry(logGroupName);
};

exports.handler = handler;
