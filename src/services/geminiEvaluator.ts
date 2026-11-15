import { safeParseGeminiJson } from "./aiJson";
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
): Promise<AIEvaluation> {
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

  let payload: any;
  let keySource: "primary" | "backup" = "primary";
  let modelName = requestedModel;
  let lastError: Error | null = null;
  const modelChain = getGeminiModelChain(requestedModel);
  modelAttempts: for (const candidateModel of modelChain) {
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
      const requestBody = {
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.15,
        },
      };
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
              ...(!server ? { "x-goog-api-key": key.value } : {}),
            },
            signal: AbortSignal.timeout(120000),
            body: JSON.stringify(
              server ? { model: modelName, request: requestBody } : requestBody,
            ),
          },
        );
      } catch {
        throw new Error(
          feedbackLanguage === "en"
            ? "Gemini connection interrupted or timed out. Your writing is saved. No automatic retry was made; you can request a new review."
            : "Connexion Gemini interrompue ou délai dépassé. Votre rédaction est sauvegardée. Aucun nouvel appel automatique ; vous pouvez demander un nouveau bilan.",
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
        // A proxy timeout is ambiguous: the upstream job may already be running.
        if (response.headers.get("X-TCF-No-Retry") === "1") {
          throw new Error(
            feedbackLanguage === "en"
              ? "Gemini server connection interrupted. Your writing is saved; no further model was tried."
              : "Connexion au serveur Gemini interrompue. Votre rédaction est sauvegardée ; aucun autre modèle n’a été essayé.",
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
        if ([404, 429, 503].includes(response.status)) modelUnavailable = true;
        if (
          [401, 403, 404, 429, 500, 502, 503, 504].includes(response.status) &&
          index + 1 < keys.length
        )
          continue;
        if (
          [404, 429, 503].includes(response.status) ||
          (modelUnavailable && [401, 403, 409].includes(response.status))
        )
          continue modelAttempts;
        throw lastError;
      }
      if (
        server &&
        !response.headers.get("Content-Type")?.includes("application/json")
      ) {
        throw new Error(
          feedbackLanguage === "en"
            ? "The feedback server returned an unexpected response. The site administrator must check the /api/gemini deployment. Your writing is saved."
            : "Réponse inattendue du serveur de correction. L’administrateur doit vérifier le déploiement /api/gemini. Votre rédaction est sauvegardée.",
        );
      }
      payload = await response.json();
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
  const candidate = payload?.candidates?.[0];
  if (candidate?.finishReason === "MAX_TOKENS")
    throw new Error(
      feedbackLanguage === "en"
        ? "Gemini response was truncated. Request a new review."
        : "Réponse Gemini tronquée. Demandez un nouveau bilan.",
    );
  if (
    payload?.promptFeedback?.blockReason ||
    (candidate?.finishReason && candidate.finishReason !== "STOP")
  ) {
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
  const assessment = validatePedagogicalAssessment(
    safeParseGeminiJson(rawText),
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
  return {
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
}
