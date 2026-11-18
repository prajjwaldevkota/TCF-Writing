import {
  createLogRequestId,
  getClientDiagnostics,
  reportReviewError,
} from "./errorLogging";
import { safeParseGeminiJson } from "./aiJson";
import { queueEvaluation } from "./evaluationJobs";
export { safeParseGeminiJson } from "./aiJson";
import {
  buildEvaluationInstructions,
  instructionFingerprint,
} from "./evaluationInstructions";
import { validatePedagogicalAssessment } from "./pedagogicalAssessment";
import { ExamResult, TaskKey } from "../types/exam";
import { AIEvaluation, TaskEvaluation, CefrLevel } from "../types/aiEvaluation";
import { countFrenchWords } from "../utils/wordCount";

import { getGeminiModel, getGeminiModelChain } from "../utils/geminiSettings";
import {
  getRateLimitDeadline,
  recordRateLimit,
  rateLimitMessage,
} from "./providerRateLimit";

/**
 * Determine which tasks were actively practiced / attempted
 */
export function getActiveEvaluatedTasks(result: ExamResult): TaskKey[] {
  if (result.isPracticeMode) {
    if (result.practiceTasks && result.practiceTasks.length > 0) {
      return result.practiceTasks as TaskKey[];
    }
    if (result.practiceTask) {
      const keys =
        typeof result.practiceTask === "string"
          ? (result.practiceTask.split(",").map((s) => s.trim()) as TaskKey[])
          : [result.practiceTask as TaskKey];
      if (keys.length > 0) return keys;
    }
    // Fallback: check which tasks have non-empty text
    const filled = (["task1", "task2", "task3"] as TaskKey[]).filter((k) =>
      Boolean(result.answers[k]?.trim()),
    );
    return filled.length > 0 ? filled : ["task1"];
  }

  // Full Exam: evaluate all tasks
  return ["task1", "task2", "task3"];
}

/**
 * Official TCF Canada EE (Expression Écrite / Writing) Score Conversion
 * Source: France Éducation international & IRCC
 */
export function mapScoreToTcfCanadaLevels(score: number): {
  cefr: CefrLevel;
  clb: string;
} {
  const rounded = Math.round(Math.max(0, Math.min(20, score)));
  if (rounded >= 18) return { cefr: "C2", clb: "CLB 10" };
  if (rounded >= 16) return { cefr: "C1", clb: "CLB 10" };
  if (rounded >= 14) return { cefr: "C1", clb: "CLB 9" };
  if (rounded >= 12) return { cefr: "B2", clb: "CLB 8" };
  if (rounded >= 10) return { cefr: "B2", clb: "CLB 7" }; // Benchmark for Express Entry bonus points
  if (rounded >= 7) return { cefr: "B1", clb: "CLB 6" };
  if (rounded === 6) return { cefr: "B1", clb: "CLB 5" };
  if (rounded >= 4) return { cefr: "A2", clb: "CLB 4" };
  return { cefr: "A1", clb: "< CLB 4" };
}

export async function evaluateTcfSubmissionWithGemini(
  result: ExamResult,
  customApiKey?: string,
  requestedModel = getGeminiModel(),
  force = false,
): Promise<AIEvaluation> {
  const requestId = createLogRequestId();
  try {
    return await evaluateGeminiRequest(
      result,
      customApiKey,
      requestedModel,
      requestId,
      force,
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gemini request failed.";
    throw new Error(
      message.includes(requestId)
        ? message
        : `${message} Reference: ${requestId}`,
    );
  }
}
async function evaluateGeminiRequest(
  result: ExamResult,
  customApiKey: string | undefined,
  requestedModel: string,
  requestId: string,
  force: boolean,
): Promise<AIEvaluation> {
  const started = Date.now();
  let assessmentCode:
    | "invalid_json"
    | "invalid_assessment"
    | "truncated_response"
    | "blocked_response" = "invalid_json";
  // Normal reviews always use the deployment's server credentials. Old browser
  // keys must not override the deployment or be required on a fresh browser.
  const keys = customApiKey?.trim()
    ? [
        {
          value: customApiKey.trim(),
          source: "primary" as const,
          server: false,
        },
      ]
    : [{ value: "server", source: "primary" as const, server: true }];

  const activeTaskKeys = getActiveEvaluatedTasks(result);

  const feedbackLanguage =
    localStorage.getItem("tcf_language") === "en" ? "en" : "fr";

  const { systemPrompt, userPrompt, rubricVersion } =
    buildEvaluationInstructions(result, activeTaskKeys, feedbackLanguage);
  const promptHash = await instructionFingerprint(
    systemPrompt + "\n" + userPrompt,
  );

  const requestBody = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    generationConfig: { responseMimeType: "application/json", temperature: 0.15 },
  };
  const queued = customApiKey?.trim() ? null : await queueEvaluation({
    result, model: requestedModel, request: requestBody, fingerprint: promptHash, language: feedbackLanguage, rubricVersion, force,
  });
  let payload: any = queued?.payload;
  let keySource: "primary" | "backup" = queued?.keySource || "primary";
  let modelName = queued?.model || requestedModel;
  let lastError: Error | null = null;
  const modelChain = getGeminiModelChain(requestedModel);
  modelAttempts: for (const candidateModel of queued ? [] : modelChain) {
    modelName = candidateModel;
    let modelUnavailable = false;
    for (let index = 0; index < keys.length; index++) {
      const key = keys[index];
      const identity = await instructionFingerprint(
        `${modelName}\n${key.value}`,
      );
      const deadline = getRateLimitDeadline(identity);
      if (deadline > Date.now()) {
        modelUnavailable = true;
        lastError = new Error(rateLimitMessage(deadline, feedbackLanguage));
        continue;
      }
      const server = "server" in key && key.server;
      // A timeout or network failure can follow accepted work. Do not replay it.
      let response: Response;
      try {
        response = await fetch(
          server
            ? "/api/gemini"
            : `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:generateContent`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(server
                ? {
                    "X-TCF-Request-ID": requestId,
                    "X-TCF-Client-Context": JSON.stringify(
                      getClientDiagnostics(),
                    ),
                  }
                : {}),
              ...(!server ? { "x-goog-api-key": key.value } : {}),
            },
            // Server transport includes primary + backup attempts (120s each)
            // and logging, within the function's 300s execution budget.
            signal: AbortSignal.timeout(server ? 270000 : 120000),
            body: JSON.stringify(
              server ? { model: modelName, request: requestBody } : requestBody,
            ),
          },
        );
      } catch (error) {
        reportReviewError({
          request_id: requestId,
          stage: "client_network",
          code:
            error instanceof Error &&
            ["TimeoutError", "AbortError"].includes(error.name)
              ? "timeout"
              : "network_error",
          model: modelName,
          duration_ms: Date.now() - started,
        });
        throw new Error(
          feedbackLanguage === "en"
            ? `Gemini connection interrupted or timed out. Your writing is saved. No automatic retry was made; you can request a new review. Reference: ${requestId}`
            : `Connexion Gemini interrompue ou délai dépassé. Votre rédaction est sauvegardée. Aucun nouvel appel automatique ; vous pouvez demander un nouveau bilan. Référence : ${requestId}`,
        );
      }
      if (!response.ok) {
        if (
          server &&
          response.headers.get("X-TCF-Error") === "server_not_configured"
        ) {
          throw new Error(
            feedbackLanguage === "en"
              ? "The feedback service is not configured on the server. The site administrator must configure the deployment’s Gemini key. No personal API key is needed. Your writing is saved."
              : "Le service de correction n’est pas configuré sur le serveur. L’administrateur doit configurer la clé Gemini du déploiement. Aucune clé personnelle n’est nécessaire. Votre rédaction est sauvegardée.",
          );
        }
        // Only a 504 relayed by our handler is a confirmed provider response.
        // A hosting gateway may time out while accepted work is still running.
        const gatewayTimeout =
          server &&
          response.status === 504 &&
          response.headers.get("X-TCF-Error-Source") !== "provider";
        if (gatewayTimeout) {
          reportReviewError({
            request_id: requestId,
            stage: "client_network",
            code: "timeout",
            model: modelName,
            duration_ms: Date.now() - started,
          });
        }
        if (gatewayTimeout || response.headers.get("X-TCF-No-Retry") === "1") {
          throw new Error(
            feedbackLanguage === "en"
              ? "Gemini server connection interrupted or timed out. Your writing is saved; no further model was tried. You can request a new review."
              : "Connexion au serveur Gemini interrompue ou délai dépassé. Votre rédaction est sauvegardée ; aucun autre modèle n’a été essayé. Vous pouvez demander un nouveau bilan.",
          );
        }
        if (response.headers.get("X-TCF-Model-Unavailable") === "1")
          modelUnavailable = true;
        const until =
          response.status === 429
            ? recordRateLimit(identity, response.headers.get("Retry-After"))
            : 0;
        const hint =
          response.status === 429
            ? rateLimitMessage(until, feedbackLanguage)
            : response.status === 401 || response.status === 403
              ? feedbackLanguage === "en"
                ? "The site administrator must check the server’s Gemini credentials and project access."
                : "L’administrateur doit vérifier les clés Gemini du serveur et les accès du projet."
              : response.status === 404
                ? feedbackLanguage === "en"
                  ? "This model is unavailable to your project."
                  : "Ce modèle est indisponible pour votre projet."
                : feedbackLanguage === "en"
                  ? "Your writing is saved. Try again later."
                  : "Votre rédaction est sauvegardée. Réessayez plus tard.";
        lastError = new Error(
          `Gemini ${modelName}: HTTP ${response.status}. ${hint}`,
        );
        if ([404, 429, 503, 504].includes(response.status)) modelUnavailable = true;
        if (
          [401, 403, 404, 429, 500, 502, 503, 504].includes(response.status) &&
          index + 1 < keys.length
        )
          continue;
        if (
          [404, 429, 503, 504].includes(response.status) ||
          (modelUnavailable && [401, 403, 409].includes(response.status))
        )
          continue modelAttempts;
        throw lastError;
      }
      if (
        server &&
        !response.headers.get("Content-Type")?.includes("application/json")
      ) {
        reportReviewError({
          request_id: requestId,
          stage: "assessment",
          code: "invalid_json",
          model: modelName,
          duration_ms: Date.now() - started,
        });
        throw new Error(
          feedbackLanguage === "en"
            ? "The feedback server returned an unexpected response. The site administrator must check the /api/gemini deployment. Your writing is saved."
            : "Réponse inattendue du serveur de correction. L’administrateur doit vérifier le déploiement /api/gemini. Votre rédaction est sauvegardée.",
        );
      }
      try {
        payload = await response.json();
      } catch (error) {
        reportReviewError({
          request_id: requestId,
          stage: "assessment",
          code: "invalid_json",
          model: modelName,
          duration_ms: Date.now() - started,
        });
        throw error;
      }
      keySource =
        server && response.headers.get("X-TCF-Key-Source") === "backup"
          ? "backup"
          : key.source;
      break modelAttempts;
    }
    if (!modelUnavailable)
      throw lastError || new Error("Gemini request failed.");
  }
  if (!payload)
    throw (
      lastError ||
      new Error(
        feedbackLanguage === "en"
          ? "No Gemini model is available. Your writing is saved."
          : "Aucun modèle Gemini disponible. Votre rédaction est sauvegardée.",
      )
    );
  try {
    const candidate = payload?.candidates?.[0];
    if (candidate?.finishReason === "MAX_TOKENS") {
      assessmentCode = "truncated_response";
      throw new Error(
        feedbackLanguage === "en"
          ? "Gemini response was truncated. Request a new review."
          : "Réponse Gemini tronquée. Demandez un nouveau bilan.",
      );
    }
    if (
      payload?.promptFeedback?.blockReason ||
      (candidate?.finishReason && candidate.finishReason !== "STOP")
    ) {
      assessmentCode = "blocked_response";
      throw new Error(
        feedbackLanguage === "en"
          ? "Gemini could not assess this response. Your writing is saved; you can copy it for a tutor."
          : "Gemini n’a pas pu évaluer cette réponse. Votre rédaction est sauvegardée ; vous pouvez la copier pour un tuteur.",
      );
    }
    const rawText = payload?.candidates?.[0]?.content?.parts
      ?.filter((part: any) => typeof part.text === "string" && !part.thought)
      .map((part: any) => part.text)
      .join("");
    const parsed = safeParseGeminiJson(rawText);
    assessmentCode = "invalid_assessment";
    const assessment = validatePedagogicalAssessment(
      parsed,
      activeTaskKeys,
      result,
    );
    if (assessment.feedback_language !== feedbackLanguage)
      throw new Error("AI returned the wrong feedback language.");
    const tasks: AIEvaluation["tasks"] = {};
    for (const key of activeTaskKeys) {
      const task = assessment.tasks[key]!;
      tasks[key] = {
        task_key: key,
        task_name: key,
        score: null,
        estimated_level: null,
        general_feedback: task.feedback,
        mistakes: task.mistakes,
        c1_c2_model_answer: task.model_answer,
      };
    }
    const evaluation: AIEvaluation = {
      id: `eval_${Date.now()}`,
      created_at: new Date().toISOString(),
      evaluated_tasks: activeTaskKeys,
      estimated_cefr_level: null,
      overall_score: null,
      overall_feedback:
        feedbackLanguage === "en"
          ? "This assessment is not official."
          : "Cette évaluation n\u2019est pas officielle.",
      key_source: keySource,
      model: modelName,
      requested_model: requestedModel,
      rubric_version: rubricVersion,
      prompt_hash: promptHash,
      pedagogical: assessment,
      tasks,
    };
    void queued?.acceptCache?.();
    return evaluation;
  } catch (error) {
    queued?.rejectCache?.();
    reportReviewError({
      request_id: requestId,
      stage: "assessment",
      code: assessmentCode,
      model: modelName,
      duration_ms: Date.now() - started,
    });
    throw error;
  }
}
