/**
 * OpenTelemetry bootstrap (optional).
 * Enable with OTEL_EXPORTER_OTLP_ENDPOINT.
 */

let tracer = null;
let enabled = false;

/**
 * @returns {boolean}
 */
export function isOtelEnabled() {
  return enabled;
}

/**
 * Initialize OTel when endpoint is configured.
 */
export async function initOtel(serviceName = "mcp-hub") {
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim();
  if (!endpoint) {
    return false;
  }

  try {
    const { NodeSDK } = await import("@opentelemetry/sdk-node");
    const { OTLPTraceExporter } = await import("@opentelemetry/exporter-trace-otlp-http");
    const { getNodeAutoInstrumentations } = await import("@opentelemetry/auto-instrumentations-node");
    const { trace } = await import("@opentelemetry/api");

    const sdk = new NodeSDK({
      serviceName,
      traceExporter: new OTLPTraceExporter({ url: endpoint }),
      instrumentations: [getNodeAutoInstrumentations()],
    });

    await sdk.start();
    tracer = trace.getTracer(serviceName);
    enabled = true;
    console.log(`[otel] Tracing enabled → ${endpoint}`);
    return true;
  } catch (err) {
    console.warn("[otel] Failed to initialize (install @opentelemetry/* packages):", err.message);
    return false;
  }
}

/**
 * Run fn inside a tool-call span when OTel is active.
 * @param {string} toolName
 * @param {Object} attrs
 * @param {() => Promise<unknown>} fn
 */
export async function withToolSpan(toolName, attrs, fn) {
  if (!enabled || !tracer) {
    return fn();
  }

  const { SpanStatusCode } = await import("@opentelemetry/api");
  return tracer.startActiveSpan(`tool.${toolName}`, async (span) => {
    span.setAttributes({ "mcp.tool": toolName, ...attrs });
    try {
      const result = await fn();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (err) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
      throw err;
    } finally {
      span.end();
    }
  });
}
