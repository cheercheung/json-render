// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { experimental_createEvoLinkEvaluator } from "./experimental-evolink-evaluator";
import { experimental_composeSpec } from "./experimental-compose";
import { z } from "zod";

const request = {
  state: { user_request: "Build a panel" },
  questions: {
    next: {
      type: "choice" as const,
      instructions: "Choose",
      criteria: { panel: "Panel", finish: "Stop" },
    },
  },
  signal: new AbortController().signal,
};
const payload = {
  model: "gpt-6-luna",
  answers: [
    {
      name: "next",
      type: "choice",
      choice: "panel",
      confidence: 0.9,
      probabilities: [
        { value: "panel", probability: 0.8 },
        { value: "finish", probability: 0.2 },
      ],
    },
  ],
  usage: { input_tokens: 42, output_tokens: 0 },
};

describe("EvoLink Decisions evaluator (offline)", () => {
  it("uses the official endpoint and converts criteria to named choices", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () =>
      Response.json(payload),
    );
    const evaluate = experimental_createEvoLinkEvaluator({
      apiKey: "offline-placeholder",
      fetch,
    });
    expect(await evaluate(request)).toEqual({
      answers: { next: { choice: "panel", confidence: 0.9 } },
      usage: { inputTokens: 42 },
    });
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe("https://direct.evolink.ai/v1/decisions");
    expect(init?.headers).toEqual({
      Authorization: "Bearer offline-placeholder",
      "Content-Type": "application/json",
    });
    expect(JSON.parse(init!.body as string)).toEqual({
      model: "gpt-6-luna-decisions",
      input: JSON.stringify(request.state),
      questions: [
        {
          type: "choice",
          name: "next",
          instructions: "Choose",
          choices: [
            { value: "panel", description: "Panel" },
            { value: "finish", description: "Stop" },
          ],
        },
      ],
    });
  });

  it("does not invent usage and permits only explicit official fallback", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () =>
      Response.json({ answers: payload.answers }),
    );
    const evaluate = experimental_createEvoLinkEvaluator({
      apiKey: "test",
      model: "gpt-6-luna",
      baseUrl: "https://api.evolink.ai",
      fetch,
    });
    expect((await evaluate(request)).usage).toBeUndefined();
    expect(fetch.mock.calls[0]![0]).toBe("https://api.evolink.ai/v1/decisions");
  });

  it.each([
    {},
    { answers: [] },
    { answers: [{ ...payload.answers[0], type: "refusal" }] },
    { answers: [{ ...payload.answers[0], name: "wrong" }] },
    { answers: [{ ...payload.answers[0], choice: "outside" }] },
    { answers: [{ ...payload.answers[0], choice: "finish" }] },
    { answers: [{ ...payload.answers[0], confidence: 9 }] },
    {
      answers: [
        {
          ...payload.answers[0],
          probabilities: [{ value: "panel", probability: 1 }],
        },
      ],
    },
    {
      answers: [
        {
          ...payload.answers[0],
          probabilities: [
            { value: "panel", probability: 0.5 },
            { value: "panel", probability: 0.5 },
          ],
        },
      ],
    },
    { ...payload, usage: { input_tokens: -1 } },
  ])("rejects malformed/refused/unoffered choices", async (body) => {
    const evaluate = experimental_createEvoLinkEvaluator({
      apiKey: "test",
      fetch: async () => Response.json(body),
    });
    await expect(evaluate(request)).rejects.toThrow();
  });

  it("rejects duplicate names even with the right answer count", async () => {
    const evaluate = experimental_createEvoLinkEvaluator({
      apiKey: "test",
      fetch: async () =>
        Response.json({ answers: [payload.answers[0], payload.answers[0]] }),
    });
    await expect(
      evaluate({
        ...request,
        questions: { ...request.questions, second: request.questions.next },
      }),
    ).rejects.toThrow();
  });

  it("stops without keys and redacts HTTP/transport/malformed-body errors", async () => {
    expect(() => experimental_createEvoLinkEvaluator({ apiKey: " " })).toThrow(
      "API key",
    );
    expect(() =>
      experimental_createEvoLinkEvaluator({ apiKey: "test", timeoutMs: 0 }),
    ).toThrow("timeoutMs");
    const http = experimental_createEvoLinkEvaluator({
      apiKey: "test",
      fetch: async () => new Response("secret body", { status: 403 }),
    });
    await expect(http(request)).rejects.toThrow(
      "EvoLink evaluation failed (HTTP 403).",
    );
    const network = experimental_createEvoLinkEvaluator({
      apiKey: "test",
      fetch: async () => {
        throw new Error("secret detail");
      },
    });
    await expect(network(request)).rejects.toThrow(
      "EvoLink connection failed.",
    );
    const malformed = experimental_createEvoLinkEvaluator({
      apiKey: "test",
      fetch: async () => new Response("secret body"),
    });
    await expect(malformed(request)).rejects.toThrow(
      "Invalid EvoLink decision response or refusal.",
    );
  });

  it("propagates abort and times out without a retry", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(
      async (_url, init) =>
        new Promise((_, reject) => {
          init!.signal!.addEventListener(
            "abort",
            () => reject(init!.signal!.reason),
            { once: true },
          );
        }),
    );
    const evaluate = experimental_createEvoLinkEvaluator({
      apiKey: "test",
      timeoutMs: 5,
      fetch,
    });
    await expect(evaluate(request)).rejects.toMatchObject({
      name: "TimeoutError",
    });
    const controller = new AbortController();
    const pending = evaluate({ ...request, signal: controller.signal });
    controller.abort(new Error("cancelled"));
    await expect(pending).rejects.toThrow("cancelled");
    const calls = fetch.mock.calls.length;
    await expect(
      evaluate({ ...request, signal: controller.signal }),
    ).rejects.toThrow("cancelled");
    expect(fetch).toHaveBeenCalledTimes(calls);
  });

  it("composes a validated Spec through the actual adapter and mocked HTTP", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async (_url, init) => {
      const body = JSON.parse(init!.body as string);
      return Response.json({
        model: "gpt-6-luna",
        answers: body.questions.map(
          (q: { name: string; choices: { value: string }[] }) => {
            const choice = q.name === "root" ? "panel" : q.choices[0]!.value;
            return {
              name: q.name,
              type: "choice",
              choice,
              confidence: 1,
              probabilities: q.choices.map((c) => ({
                value: c.value,
                probability: Number(c.value === choice),
              })),
            };
          },
        ),
        usage: { input_tokens: 10 },
      });
    });
    const events = [];
    for await (const event of experimental_composeSpec({
      catalog: {
        data: { components: { Panel: { props: z.object({}) } } },
        validate: () => ({ success: true }),
      },
      candidates: [
        {
          id: "panel",
          description: "A panel",
          element: { type: "Panel", props: {} },
        },
      ],
      prompt: "A panel",
      evaluate: experimental_createEvoLinkEvaluator({ apiKey: "test", fetch }),
    }))
      events.push(event);
    const complete = events.at(-1)!;
    expect(complete.type).toBe("complete");
    expect(complete.spec?.elements.node_0?.type).toBe("Panel");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
