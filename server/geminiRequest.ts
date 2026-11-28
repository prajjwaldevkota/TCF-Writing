// Apply model-specific settings at dispatch so queued fallbacks use their own defaults.
export function prepareGeminiRequest(model: string, request: Record<string, unknown>) {
  if (model !== "gemini-4-hydrogen") return request;
  const config = request.generationConfig;
  return {
    ...request,
    generationConfig: {
      ...(config && typeof config === "object" ? config : {}),
      thinkingConfig: { thinkingLevel: "HIGH" },
    },
  };
}
