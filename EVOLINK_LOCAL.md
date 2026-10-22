# EvoLink Luna Decision integration

This fork adds `experimental_createEvoLinkEvaluator` to `@json-render/core` and **luna decision** to the existing playground. Use the [main README](README.md) for audience, benefits, setup and required keys. [Read the validation results](docs/evolink-validation.md) for acceptance evidence and limits.

## What changes

The evaluator maps the existing composer's state and named criteria to the EvoLink Decisions API. The same application-owned candidates, catalog validation, action bindings, preview, version history and editing flow stay in use. Default and Jev remain available with their separate credentials.

The adapter validates names, offered choices and probability arrays, preserves confidence and input-token usage, and handles refusal, malformed replies, cancellation and timeout. Invalid replies stop composition while the stream retains its last valid preview. It performs no automatic provider fallback or paid retry.

## API contract and credentials

- Endpoint: `POST https://direct.evolink.ai/v1/decisions`.
- Default model: `gpt-6-luna-decisions`.
- Supported explicit alias: `gpt-6-luna`.
- Explicit alternate origin: `https://api.evolink.ai`; set it in the evaluator options if needed. The playground uses the primary origin.
- Default per-evaluation timeout: 10 seconds. The playground composition is bounded to 55 seconds, 14 elements/evaluations and nesting depth four.
- Credential: server-only `EVOLINK_API_KEY` in ignored `apps/web/.env.local` or the server environment. Missing credentials produce HTTP 503 before a model request. Luna needs no Gateway key.

[Read the official Decisions contract](https://evolink.ai/docs/en/api-manual/language-series/gpt/decisions/decisions-reference.json). The integration was based on the contract verified on 2026-10-21, and the real contact-form acceptance run was recorded on 2026-10-22.

## Build the source package for an app

The integration is not a separately published npm release. From this fork's checkout, with Node 24+ and pnpm 11.1.3:

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm --filter @json-render/core build
mkdir -p /tmp/json-render-evolink-pack
pnpm --filter @json-render/core pack --pack-destination /tmp/json-render-evolink-pack
```

Install the resulting `.tgz` in your application and keep the renderer and all other `@json-render/*` packages on the same package version. Record this fork's commit as well: the package version alone does not identify the added API. See the [upstream composition example](apps/web/content/docs/jev.mdx) for catalog and candidate definitions; use the EvoLink evaluator for Luna.

```ts
// Server only
import { experimental_createEvoLinkEvaluator } from "@json-render/core";

const evaluate = experimental_createEvoLinkEvaluator({
  apiKey: process.env.EVOLINK_API_KEY ?? "",
  model: "gpt-6-luna-decisions",
  timeoutMs: 10_000,
});
```

Use `evaluate` with `experimental_composeSpec({ catalog, candidates, prompt, evaluate })`. Optional `fetch` injection supports offline HTTP mocks; `baseUrl` and `model` accept only the documented origins/aliases above. Custom candidates, data, renderers and permitted action handlers belong to the host application.

## Verification and limits

The focused suite covers the API request/response contract, malformed answers, HTTP errors, cancellation/timeouts, composer integration, stream completion, missing credentials and provider isolation. It uses synthetic data and mocked HTTP, requiring no key.

A real contact-form run generated and rendered the expected fields, rejected empty and invalid-email submissions, and displayed the valid-submission demo toast. Its 2.471-second composition and 2 calls describe that run only. Luna's USD estimate remains `null`; actual billing, model calibration and comparative speed/quality have not been established.

Full monorepo type checking has a known TS2740 in unchanged `packages/react-pdf/src/render.tsx:173`; targeted core/Web checks are tracked separately. This fork does not change upstream package versions or publish to upstream npm. The upstream license is preserved and the original source commit is recorded in [EVOLINK_SOURCE.json](EVOLINK_SOURCE.json).
