import { z } from "zod";
import type { Experimental_CompositionEvaluator } from "./experimental-compose";

export interface Experimental_EvoLinkEvaluatorOptions {
  /** Server-only EvoLink key. Never expose this in browser code. */
  apiKey: string;
  /** Exact documented Decisions model ID. */
  model?: "gpt-6-luna-decisions" | "gpt-6-luna";
  /** Official primary or fallback origin; no automatic fallback/retry. */
  baseUrl?: "https://direct.evolink.ai" | "https://api.evolink.ai";
  timeoutMs?: number;
  fetch?: typeof globalThis.fetch;
}

const probability = z.number().finite().min(0).max(1);
const responseSchema = z.object({
  answers: z.array(
    z.object({
      name: z.string(),
      type: z.literal("choice"),
      choice: z.string(),
      confidence: probability,
      probabilities: z.array(z.object({ value: z.string(), probability })),
    }),
  ),
  usage: z.object({ input_tokens: z.number().int().nonnegative() }).optional(),
});

/** EvoLink POST /v1/decisions adapter for the existing bounded composer. */
export function experimental_createEvoLinkEvaluator(
  options: Experimental_EvoLinkEvaluatorOptions,
): Experimental_CompositionEvaluator {
  const apiKey = options.apiKey?.trim();
  if (!apiKey) throw new Error("An EvoLink API key is required.");
  const model = options.model ?? "gpt-6-luna-decisions";
  const baseUrl = options.baseUrl ?? "https://direct.evolink.ai";
  if (
    !["gpt-6-luna-decisions", "gpt-6-luna"].includes(model) ||
    !["https://direct.evolink.ai", "https://api.evolink.ai"].includes(baseUrl)
  )
    throw new Error("Use a documented EvoLink Decisions model and origin.");
  const timeoutMs = options.timeoutMs ?? 10000;
  if (
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs < 1 ||
    timeoutMs > 2147483647
  )
    throw new Error("timeoutMs must be an integer between 1 and 2147483647.");
  const fetch = options.fetch ?? globalThis.fetch;
  return async ({ state, questions, signal }) => {
    signal.throwIfAborted();
    const entries = Object.entries(questions);
    if (
      !entries.length ||
      entries.some(([, q]) => !Object.keys(q.criteria).length)
    )
      throw new Error(
        "At least one question with offered choices is required.",
      );
    const controller = new AbortController();
    const abort = () => controller.abort(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(
      () =>
        controller.abort(
          new DOMException("Evaluation request timed out.", "TimeoutError"),
        ),
      timeoutMs,
    );
    try {
      let response: Response;
      try {
        response = await fetch(`${baseUrl}/v1/decisions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            input: JSON.stringify(state),
            questions: entries.map(([name, question]) => ({
              type: "choice",
              name,
              instructions: question.instructions,
              choices: Object.entries(question.criteria).map(
                ([value, description]) => ({ value, description }),
              ),
            })),
          }),
          signal: controller.signal,
          cache: "no-store",
        });
      } catch {
        controller.signal.throwIfAborted();
        throw new Error("EvoLink connection failed.");
      }
      if (!response.ok)
        throw new Error(`EvoLink evaluation failed (HTTP ${response.status}).`);
      const parsed = responseSchema.safeParse(
        await response.json().catch(() => null),
      );
      if (!parsed.success || parsed.data.answers.length !== entries.length)
        throw new Error("Invalid EvoLink decision response or refusal.");
      const answers: Record<string, { choice: string; confidence: number }> =
        {};
      for (const answer of parsed.data.answers) {
        const question = Object.hasOwn(questions, answer.name)
          ? questions[answer.name]
          : undefined;
        const values = answer.probabilities.map((row) => row.value);
        const selected = answer.probabilities.find(
          (row) => row.value === answer.choice,
        );
        if (
          !question ||
          Object.hasOwn(answers, answer.name) ||
          !Object.hasOwn(question.criteria, answer.choice) ||
          values.length !== Object.keys(question.criteria).length ||
          new Set(values).size !== values.length ||
          values.some((value) => !Object.hasOwn(question.criteria, value)) ||
          Math.abs(
            answer.probabilities.reduce((n, row) => n + row.probability, 0) - 1,
          ) >= 0.02 ||
          !selected ||
          answer.probabilities.some(
            (row) => row.probability > selected.probability + 1e-6,
          )
        )
          throw new Error("EvoLink returned invalid or unoffered choices.");
        Object.defineProperty(answers, answer.name, {
          value: { choice: answer.choice, confidence: answer.confidence },
          enumerable: true,
        });
      }
      return {
        answers,
        usage: parsed.data.usage
          ? { inputTokens: parsed.data.usage.input_tokens }
          : undefined,
      };
    } finally {
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
    }
  };
}
