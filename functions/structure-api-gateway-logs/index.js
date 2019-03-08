const zlib = require("zlib");
const { promisify } = require("util");
const { parseLogs } = require("aws-api-gateway-log-parser");
const debug = require("debug")(
  "lambda-logs-event-source:structure-api-gateway-logs"
);

const gunzip = promisify(zlib.gunzip);

let parserConfig = {
  TRUNCATED_RESPONSE_KEYS: [
    { key: "code", type: "String" },
    { key: "error", type: "Boolean" },
    { key: "message", type: "String" }
  ]
};

const generateEvent = event => {
  debug(
    "Generating an event for request %s - %s",
    event.api_stage,
    event.request_id
  );

  if (!event.endpoint_response_headers || !event.method_request_headers) {
    if (event.key_throttle) {
      return {
        service_name: "APIGateway",
        request_id: event.request_id,
        api_stage: event.api_stage,
        level: "ERROR",
        errorMessage:
          "Request throttled because the API Gateway stage is over capacity. Increase the ThrottlingBurstLimit and ThrottlingRateLimit in your Stage method settings",
        errorName: "APIGateway-KeyThrottle",
        name: `KeyThrottle`,
        duration_ms: event["request-execution-duration"],
        timestamp: event["@timestamp"],
        status_code: event.method_status,
        ...event.key_throttle
      };
    }

    debug(
      "Unable to generate an event because either endpoint_response_headers or method_request_headers are missing"
    );

    return;
  }

  const {
    endpoint_response_headers,
    method_request_headers,
    method_response_headers,
    http_method,
    http_resource_path,
    method_status,
    integration_latency,
    api_stage,
    customer_function_error
  } = event;

  const debugLogEnabledFromHeaders =
    method_response_headers["Debug-Log-Enabled"] === "true";

  const debugLogEnabledFromMethodStatus = method_status >= 400;

  // If debug logging is not enabled, then don't log this event
  // Also, make sure to log any non-successful responses
  if (!debugLogEnabledFromHeaders && !debugLogEnabledFromMethodStatus) {
    debug(
      "Not generating an event because DEBUG level logging isn't enabled by the request headers Debug-Log-Enabled flag"
    );
    return;
  }

  const mappedHeaders = {};

  mappedHeaders.requestId = endpoint_response_headers["x-amzn-RequestId"];
  mappedHeaders.remote_ip = method_request_headers["X-Forwarded-For"];
  mappedHeaders.country = method_request_headers["CloudFront-Viewer-Country"];
  mappedHeaders.user_agent = method_request_headers["User-Agent"];
  mappedHeaders.host = method_request_headers["Host"];
  mappedHeaders.accept = method_request_headers["Accept"];

  mappedHeaders.content_type = endpoint_response_headers["Content-Type"];
  mappedHeaders.content_length = endpoint_response_headers["Content-Length"];
  mappedHeaders.version = endpoint_response_headers["X-Amz-Executed-Version"];

  if (customer_function_error) {
    mappedHeaders.errorMessage = customer_function_error;
    mappedHeaders.errorName = "LambdaInvocationError";
  }

  const request_correlation_ids = {};

  for (const header in method_request_headers) {
    if (header.toLowerCase().startsWith("x-correlation-")) {
      request_correlation_ids[header.toLowerCase()] =
        method_request_headers[header];
    }
  }

  const result = {
    service_name: "APIGateway",
    level: "TRACE",
    api_stage,
    duration_ms: event["request-execution-duration"],
    timestamp: event["@timestamp"],
    status_code: method_status,
    http_method,
    http_resource_path,
    integration_latency: integration_latency,
    execution_failure: event.execution_failure,
    request_correlation_ids,
    ...mappedHeaders
  };

  return result;
};

const processAll = logData => {
  const events = parseLogs(parserConfig, logData);

  debug("Parsed logs into events: %j", { events });

  if (!events) {
    return;
  }

  events.forEach(event => {
    try {
      const structuredEvent = generateEvent(event);

      if (structuredEvent) {
        debug("Sending API Gateway trace event: %j", {
          structuredEvent,
          rawEvent: event
        });

        console.log(JSON.stringify(structuredEvent));
      }
    } catch (error) {
      debug("Error generating event %s", error.message);
    }
  });
};

const handler = async event => {
  const compressedPayload = new Buffer(event.awslogs.data, "base64");
  const payload = await gunzip(compressedPayload);
  const json = payload.toString("utf8");

  const logData = JSON.parse(json);

  processAll(logData);
};

exports.handler = handler;
