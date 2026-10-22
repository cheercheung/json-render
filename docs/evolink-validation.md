# EvoLink integration validation

## Scope

The fork's Luna evaluator and shared playground were validated locally on 2026-10-22. This document records local checks and observed UI behavior, not GitHub CI, a production deployment, billing verification or comparative performance.

## Offline checks

- 87 focused Vitest tests passed for the EvoLink/Gateway evaluators, composer, Web composition/response code and playground stream parser.
- The seven Web dependency packages built successfully, including the source core declaration exports.
- Web type checking and ESLint for changed Web TypeScript files passed.
- `git diff --check` passed, the Apache-2.0 license was unchanged and the existing dependency manifests/lockfile were retained.
- Full `pnpm type-check` has a known unchanged failure in `packages/react-pdf/src/render.tsx:173`: TS2740, a `ReadableStream` type mismatch. It is not reported as a passing check.

The focused tests inject HTTP/evaluator replies and use no real API credentials. They cover official endpoint/model/header/body mapping, named answers and offered options, invalid/refused/duplicate/missing responses, probabilities, cancellation/timeouts, safe errors, composer snapshots, missing credentials and credential isolation.

## Recorded real contact-form test

> Build a "Contact us" form with Full name, Email, Message, and a "Send message" button. Require all fields and validate email.

Model: `gpt-6-luna-decisions`, selected through the **luna decision** button. The page and generation request returned HTTP 200. The composer finished with `stopReason=finish`, 2 evaluator calls, 2,471 ms and 11,840 reported input tokens. No page exceptions or stream errors were observed.

Acceptance checks passed:

1. The generated form contained Full name, Email, Message and Send message.
2. Submitting empty fields displayed all three required-field errors.
3. The synthetic address `alex-at-example.com` displayed an invalid-email error.
4. Correcting it to `alex@example.com` and submitting valid synthetic inputs displayed `Form submitted successfully!`.

[Watch the complete recording](media/luna-contact-form.mp4) (31.76 seconds, 1600 × 1000, 25 fps). Recording began before navigation and includes the English request, generation and all three submission checks. The MP4 is a full-length transcode of the continuous original browser recording, with no cuts or speed changes. Exported frames and the final success toast were inspected, and the MP4 decoded without errors.

Only isolated Chrome for Testing was used through the controlled automation launcher, with a finite task timeout and final cleanup. A renderer briefly appeared during asynchronous shutdown; subsequent inspection confirmed the task's browser processes exited. The user's daily browser was not used for automation.

Two earlier recorded attempts stopped on automation selectors: duplicate label associations prevented exact accessible-name matching, and duplicated accessible/live error text caused strict matching. Their local artifacts remain outside the published repo. The final test used visible form controls by field name and checked error-message presence. The application logic was not modified to make the test pass.

## Practical limits

- This is a single acceptance task, not a benchmark. Input tokens and elapsed time are observations from that final run, not the total for all test attempts.
- Actual billing and model confidence calibration were not verified. The Luna UI cost estimate remains unknown.
- The demo uses synthetic data and local validation/toast action handlers. No external contact message was sent or database record created.
- Duplicate form label associations in the responsive playground were observed during automation. Accessibility cleanup remains separate from the provider integration.
- A second simple profile-card task also rendered successfully; arbitrary requests, production backend actions and production deployment have not been comprehensively tested.
