const AWS = require("aws-sdk");

const cloudWatchLogs = new AWS.CloudWatchLogs({
  region: process.env.AWS_REGION
});

const cf = new AWS.CloudFormation({ region: process.env.AWS_REGION });

const getLogGroups = async nextToken => {
  const params = {
    limit: 50,
    logGroupNamePrefix: "/aws/lambda",
    nextToken: nextToken
  };

  return cloudWatchLogs.describeLogGroups(params).promise();
};

const getAllLogGroups = async nextToken => {
  const response = await getLogGroups(nextToken);

  if (response.nextToken) {
    return response.logGroups.concat(await getAllLogGroups(response.nextToken));
  }

  return response.logGroups;
};

const getActiveStackNames = async () =>
  cf
    .listStacks({
      StackStatusFilter: [
        "CREATE_COMPLETE",
        "UPDATE_COMPLETE",
        "UPDATE_ROLLBACK_COMPLETE",
        "UPDATE_IN_PROGRESS",
        "CREATE_IN_PROGRESS"
      ]
    })
    .promise()
    .then(response => response.StackSummaries.map(stack => stack.StackName));

getActiveStackNames().then(async stackNames => {
  const logGroups = await getAllLogGroups();

  const oldLogGroups = logGroups.filter(logGroup => {
    return !stackNames.some(stackName =>
      logGroup.logGroupName.split("/")[3].startsWith(stackName)
    );
  });

  console.log(`Deleting ${oldLogGroups.length} old log groups`);

  const deleteLogGroupOperations = oldLogGroups.map(({ logGroupName }) => {
    return cloudWatchLogs
      .deleteLogGroup({ logGroupName })
      .promise()
      .catch(error => {
        console.log(`Error deleting ${logGroupName}`);
      });
  });

  return Promise.all(deleteLogGroupOperations);
});
