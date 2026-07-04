/**
 * Bhashini (Govt of India language stack) integration for translation, plus
 * ASR/TTS helpers. Bhashini uses a two-step flow: resolve a pipeline (which
 * model/service to use), then call the returned inference endpoint.
 *
 * Everything degrades gracefully: if Bhashini isn't configured (or errors),
 * translation returns the original text so the app keeps working in English.
 * In the browser, voice uses the Web Speech API (see lib/voice), so ASR/TTS
 * work without any keys; these server wrappers are for server-side pipelines.
 */
import type { Locale } from "@/lib/i18n/config";

const PIPELINE_URL =
  "https://meity-auth.ulcacontribute.org/ulca/apis/v0/model/getModelsPipeline";
// Common MeitY translation pipeline id.
const PIPELINE_ID = "64392f96daac500b55c543cd";

export function hasBhashini(): boolean {
  return Boolean(process.env.BHASHINI_API_KEY && process.env.BHASHINI_USER_ID);
}

interface PipelineConfig {
  inferenceEndpoint: string;
  serviceId: string;
  authKey: string;
  authValue: string;
}

let cachedConfig: { key: string; config: PipelineConfig } | null = null;

async function resolveTranslationPipeline(
  source: Locale,
  target: Locale,
): Promise<PipelineConfig | null> {
  const cacheKey = `${source}-${target}`;
  if (cachedConfig?.key === cacheKey) return cachedConfig.config;

  const res = await fetch(PIPELINE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      userID: process.env.BHASHINI_USER_ID!,
      ulcaApiKey: process.env.BHASHINI_API_KEY!,
    },
    body: JSON.stringify({
      pipelineTasks: [
        {
          taskType: "translation",
          config: { language: { sourceLanguage: source, targetLanguage: target } },
        },
      ],
      pipelineRequestConfig: { pipelineId: PIPELINE_ID },
    }),
  });
  if (!res.ok) return null;

  const data = (await res.json()) as {
    pipelineResponseConfig?: { config?: { serviceId?: string }[] }[];
    pipelineInferenceAPIEndPoint?: {
      callbackUrl?: string;
      inferenceApiKey?: { name?: string; value?: string };
    };
  };

  const serviceId = data.pipelineResponseConfig?.[0]?.config?.[0]?.serviceId;
  const endpoint = data.pipelineInferenceAPIEndPoint;
  if (!serviceId || !endpoint?.callbackUrl) return null;

  const config: PipelineConfig = {
    inferenceEndpoint: endpoint.callbackUrl,
    serviceId,
    authKey: endpoint.inferenceApiKey?.name ?? "Authorization",
    authValue: endpoint.inferenceApiKey?.value ?? "",
  };
  cachedConfig = { key: cacheKey, config };
  return config;
}

/**
 * Translate a single string. Returns the original text unchanged if Bhashini
 * isn't configured or the call fails.
 */
export async function translateText(
  text: string,
  target: Locale,
  source: Locale = "en",
): Promise<string> {
  if (!text.trim() || target === source || !hasBhashini()) return text;
  try {
    const pipeline = await resolveTranslationPipeline(source, target);
    if (!pipeline) return text;

    const res = await fetch(pipeline.inferenceEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [pipeline.authKey]: pipeline.authValue,
      },
      body: JSON.stringify({
        pipelineTasks: [
          {
            taskType: "translation",
            config: {
              language: { sourceLanguage: source, targetLanguage: target },
              serviceId: pipeline.serviceId,
            },
          },
        ],
        inputData: { input: [{ source: text }] },
      }),
    });
    if (!res.ok) return text;
    const data = (await res.json()) as {
      pipelineResponse?: { output?: { target?: string }[] }[];
    };
    return data.pipelineResponse?.[0]?.output?.[0]?.target ?? text;
  } catch {
    return text;
  }
}

/** Translate several strings, preserving order. */
export async function translateBatch(
  texts: string[],
  target: Locale,
  source: Locale = "en",
): Promise<string[]> {
  return Promise.all(texts.map((t) => translateText(t, target, source)));
}
