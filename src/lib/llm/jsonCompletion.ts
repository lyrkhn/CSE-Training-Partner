type LlmProvider = "openai" | "oss";
type WireApi = "chat_completions" | "responses";

export type JsonResponseFormat =
  | {
      type: "json_object";
    }
  | {
      type: "json_schema";
      name: string;
      strict: boolean;
      schema: Record<string, unknown>;
    };

type LlmConfig = {
  provider: LlmProvider;
  apiKey: string;
  model: string;
  baseUrl: string;
  wireApi: WireApi;
  reasoningEffort?: string;
};

type JsonCompletionInput = {
  config: LlmConfig;
  systemPrompt: string;
  userPayload: unknown;
  temperature: number;
  responseFormat: JsonResponseFormat;
  errorLabel: string;
};

type Scope = "final_assessment" | "objective_evaluator";

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
};

type ResponsesApiOutputContent = {
  type?: unknown;
  text?: unknown;
};

type ResponsesApiOutputItem = {
  type?: unknown;
  content?: unknown;
};

type ResponsesApiResponse = {
  output_text?: unknown;
  output?: unknown;
};

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function normalizeProvider(value: string): LlmProvider {
  return value.trim().toLowerCase() === "oss" ? "oss" : "openai";
}

function normalizeWireApi(value: string, provider: LlmProvider): WireApi {
  const normalized = value.trim().toLowerCase();
  if (normalized === "responses") {
    return "responses";
  }

  return provider === "oss" ? "responses" : "chat_completions";
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function providerDefaultBaseUrl(provider: LlmProvider, wireApi: WireApi) {
  if (provider === "oss") {
    return "https://v2.vexke.com/openai";
  }

  return wireApi === "responses"
    ? "https://api.openai.com/v1"
    : "https://api.openai.com/v1/chat/completions";
}

function providerDefaultModel(provider: LlmProvider) {
  return provider === "oss" ? "gpt-5.5" : "gpt-5.4-mini";
}

function resolveEndpoint(config: LlmConfig) {
  const baseUrl = trimTrailingSlash(config.baseUrl);

  if (config.wireApi === "responses") {
    return baseUrl.endsWith("/responses") ? baseUrl : `${baseUrl}/responses`;
  }

  return baseUrl.endsWith("/chat/completions") ? baseUrl : `${baseUrl}/chat/completions`;
}

function responseFormatForResponses(format: JsonResponseFormat) {
  if (format.type === "json_object") {
    return { type: "json_object" };
  }

  return {
    type: "json_schema",
    name: format.name,
    strict: format.strict,
    schema: format.schema,
  };
}

function responseFormatForChatCompletions(format: JsonResponseFormat) {
  if (format.type === "json_object") {
    return { type: "json_object" };
  }

  return {
    type: "json_schema",
    json_schema: {
      name: format.name,
      strict: format.strict,
      schema: format.schema,
    },
  };
}

function extractResponsesText(payload: ResponsesApiResponse) {
  const outputText = asString(payload.output_text).trim();
  if (outputText) {
    return outputText;
  }

  if (!Array.isArray(payload.output)) {
    return "";
  }

  return payload.output
    .flatMap((item: ResponsesApiOutputItem) => {
      if (!Array.isArray(item.content)) {
        return [];
      }

      return item.content
        .map((content: ResponsesApiOutputContent) => asString(content.text).trim())
        .filter(Boolean);
    })
    .join("\n")
    .trim();
}

function extractChatCompletionText(payload: ChatCompletionResponse) {
  return asString(payload.choices?.[0]?.message?.content).trim();
}

export function getFinalAssessmentLlmConfig(): LlmConfig {
  const provider = normalizeProvider(
    asString(
      process.env.FINAL_ASSESSMENT_PROVIDER ||
        process.env.OBJECTIVE_EVALUATOR_PROVIDER ||
        (process.env.OSS_API_KEY ? "oss" : "openai"),
    ),
  );
  const wireApi = normalizeWireApi(
    asString(
      process.env.FINAL_ASSESSMENT_WIRE_API ||
        process.env.OBJECTIVE_EVALUATOR_WIRE_API ||
        process.env.OSS_WIRE_API,
    ),
    provider,
  );

  return {
    provider,
    wireApi,
    apiKey:
      provider === "oss"
        ? asString(process.env.OSS_API_KEY).trim()
        : asString(
            process.env.FINAL_ASSESSMENT_API_KEY || process.env.OBJECTIVE_EVALUATOR_API_KEY,
          ).trim(),
    model: asString(
      process.env.FINAL_ASSESSMENT_MODEL ||
        (provider === "oss" ? process.env.OSS_MODEL : undefined) ||
        process.env.OBJECTIVE_EVALUATOR_MODEL ||
        providerDefaultModel(provider),
    ).trim(),
    baseUrl: asString(
      process.env.FINAL_ASSESSMENT_BASE_URL ||
        process.env.OBJECTIVE_EVALUATOR_BASE_URL ||
        process.env.OSS_BASE_URL ||
        providerDefaultBaseUrl(provider, wireApi),
    ).trim(),
    reasoningEffort: asString(
      process.env.FINAL_ASSESSMENT_REASONING_EFFORT ||
        process.env.OBJECTIVE_EVALUATOR_REASONING_EFFORT ||
        process.env.OSS_REASONING_EFFORT ||
        (provider === "oss" ? "high" : ""),
    ).trim(),
  };
}

export function getObjectiveEvaluatorLlmConfig(): LlmConfig {
  const provider = normalizeProvider(
    asString(
      process.env.OBJECTIVE_EVALUATOR_PROVIDER ||
        process.env.FINAL_ASSESSMENT_PROVIDER ||
        (process.env.OSS_API_KEY ? "oss" : "openai"),
    ),
  );
  const wireApi = normalizeWireApi(
    asString(
      process.env.OBJECTIVE_EVALUATOR_WIRE_API ||
        process.env.FINAL_ASSESSMENT_WIRE_API ||
        process.env.OSS_WIRE_API,
    ),
    provider,
  );

  return {
    provider,
    wireApi,
    apiKey:
      provider === "oss"
        ? asString(process.env.OSS_API_KEY).trim()
        : asString(
            process.env.OBJECTIVE_EVALUATOR_API_KEY || process.env.FINAL_ASSESSMENT_API_KEY,
          ).trim(),
    model: asString(
      process.env.OBJECTIVE_EVALUATOR_MODEL ||
        (provider === "oss" ? process.env.OSS_MODEL : undefined) ||
        process.env.FINAL_ASSESSMENT_MODEL ||
        providerDefaultModel(provider),
    ).trim(),
    baseUrl: asString(
      process.env.OBJECTIVE_EVALUATOR_BASE_URL ||
        process.env.FINAL_ASSESSMENT_BASE_URL ||
        process.env.OSS_BASE_URL ||
        providerDefaultBaseUrl(provider, wireApi),
    ).trim(),
    reasoningEffort: asString(
      process.env.OBJECTIVE_EVALUATOR_REASONING_EFFORT ||
        process.env.FINAL_ASSESSMENT_REASONING_EFFORT ||
        process.env.OSS_REASONING_EFFORT ||
        (provider === "oss" ? "high" : ""),
    ).trim(),
  };
}

export function validateLlmConfig(config: LlmConfig, scope: Scope) {
  if (!config.apiKey || !config.model || !config.baseUrl) {
    const prefix = scope === "final_assessment" ? "FINAL_ASSESSMENT" : "OBJECTIVE_EVALUATOR";
    throw new Error(
      `${prefix}_PROVIDER/${prefix}_MODEL and ${config.provider === "oss" ? "OSS_API_KEY" : `${prefix}_API_KEY`} are required.`,
    );
  }
}

export async function generateJsonCompletion({
  config,
  systemPrompt,
  userPayload,
  temperature,
  responseFormat,
  errorLabel,
}: JsonCompletionInput) {
  validateLlmConfig(config, errorLabel === "Objective evaluator" ? "objective_evaluator" : "final_assessment");

  const endpoint = resolveEndpoint(config);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(
      config.wireApi === "responses"
        ? {
            model: config.model,
            input: [
              { role: "system", content: systemPrompt },
              { role: "user", content: JSON.stringify(userPayload) },
            ],
            temperature,
            text: {
              format: responseFormatForResponses(responseFormat),
            },
            ...(config.reasoningEffort
              ? { reasoning: { effort: config.reasoningEffort } }
              : {}),
          }
        : {
            model: config.model,
            temperature,
            response_format: responseFormatForChatCompletions(responseFormat),
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: JSON.stringify(userPayload) },
            ],
          },
    ),
    cache: "no-store",
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(`${errorLabel} failed with HTTP ${response.status}. ${details}`);
  }

  const payload = (await response.json()) as ChatCompletionResponse | ResponsesApiResponse;
  const content =
    config.wireApi === "responses"
      ? extractResponsesText(payload as ResponsesApiResponse)
      : extractChatCompletionText(payload as ChatCompletionResponse);

  if (!content) {
    throw new Error(`${errorLabel} returned an empty response.`);
  }

  return content;
}
