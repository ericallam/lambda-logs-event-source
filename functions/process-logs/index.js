const zlib = require("zlib");
const { promisify } = require("util");
const debug = require("debug")("lambda-logs-event-source:process-logs");

const gunzip = promisify(zlib.gunzip);

const processorFunctionName = process.env.PROCESSOR_FUNCTION_NAME;

const tryParseJson = str => {
  try {
    return JSON.parse(str);
  } catch (e) {
    return null;
  }
};

const parseLogData = event => {
  const {
    request_id: requestId,
    event: rawEvent,
    timestamp: log_timestamp
  } = event.extractedFields;

  const data = tryParseJson(rawEvent);

  if (!data) {
    return null;
  }

  return {
    requestId,
    log_timestamp,
    ...data
  };
};

const Lambda = require("aws-sdk/clients/lambda");
const lambda = new Lambda({
  region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION,
  httpOptions: {
    timeout: 3000 // default timeout of 1000ms will almost always trigger a retry on a cold start
  }
});

const processAll = async events => {
  const parsedEvents = events.map(parseLogData).filter(event => event !== null);

  if (!parsedEvents.length) {
    return Promise.resolve();
  }

  return lambda
    .invoke({
      Payload: JSON.stringify(parsedEvents),
      FunctionName: processorFunctionName,
      InvocationType: "Event"
    })
    .promise();
};

const handler = async event => {
  const compressedPayload = new Buffer(event.awslogs.data, "base64");
  const payload = await gunzip(compressedPayload);
  const json = payload.toString("utf8");

  const { logGroup, logStream, logEvents } = JSON.parse(json);

  debug("parsed logEvents for %s - %s: %O", logGroup, logStream, {
    logEvents
  });

  return processAll(logEvents);
};

exports.handler = handler;
