# Fork documentation review actions

Review date: 2026-10-22. Scope: publish the existing Luna adaptation as a source fork and clarify the main README; not a full audit of all upstream packages.

## P0 — complete

- [x] Explain target developers, practical benefits and when a fixed React page is simpler. Why: readers need a concrete reason to adopt the framework. Expected result: the README's opening answers who and why.
- [x] Document source installation, dependency builds, playground startup and the selected model. Why: the fork-only evaluator is not installed from upstream npm. Expected result: readers can reproduce the source demo.
- [x] List credentials by mode and keep real keys ignored. Why: Luna, default and Jev have separate server-side authentication. Expected result: Luna-only users configure only `EVOLINK_API_KEY`.

## P1 — complete

- [x] Preserve upstream README and license, identify fork provenance and retain original functionality. Why: the derivative should be attributable and maintainable. Expected result: upstream API/reference material remains accessible.
- [x] Replace stale zero-real-call statements and publish a synthetic-data recording with bounded claims. Why: offline and live evidence establish different outcomes. Expected result: readers can inspect exactly what was exercised.
- [x] Restrict the inherited npm-release workflow to the upstream repository. Why: the fork is distributed as source. Expected result: fork pushes do not trigger upstream package publication.

## P2 — follow-up suggestions

- [ ] Investigate the existing React PDF TS2740 type mismatch independently. Why: full monorepo type checking currently fails. Expected result: a separately validated repository-wide type check.
- [ ] Give responsive preview controls unique label associations. Why: automation observed duplicate accessible labels. Expected result: unambiguous labels for assistive technology and test locators.

## Review boundary

No package version, dependency upgrade, production deployment or upstream PR is part of this publication. A broader community/SEO/engineering audit is outside this request. README links are descriptive; the fork is presented as an experimental integration, not an upstream npm release.
