# English Auction Constitution

## Core Principles

### I. Code Quality (NON-NEGOTIABLE)

- All code MUST be clear, small, and focused; every function MUST have a single,
  well-named responsibility.
- All public and external functions MUST carry complete NatSpec documentation
  (`@notice`, `@param`, `@return`, `@dev` where behavior is non-obvious).
- Magic numbers MUST NOT exist; named constants or immutable configuration required.
- Dead code MUST NOT be merged; unused imports, variables, and branches are removed
  in the same change that makes them obsolete.
- Code MUST pass the project's formatter and linter with zero warnings before it is
  considered complete.

Rationale: readable, documented, lint-clean code is the foundation that makes every
other principle (testing, maintainability) achievable and cheap.

### II. Test-First Development (NON-NEGOTIABLE)

- Tests MUST be written and approved before implementation for every new behavior.
- The red-green-refactor cycle MUST be followed: test fails → minimal implementation
  makes it pass → refactor with tests green.
- Every bug fix MUST ship with a regression test that fails without the fix.
- Tests MUST NOT be deleted, skipped, or weakened to make a change pass; if a test is
  wrong, fixing the test is its own reviewed change.

Rationale: in smart contracts, undetected defects are permanent and expensive;
test-first discipline is the cheapest line of defense.

### III. Testing & Coverage Standards

- Every feature MUST have unit tests covering its happy path, edge cases, and revert
  conditions (error paths MUST be asserted, not just success paths).
- Business-critical logic (bidding, settlement, refunds, withdrawal, access control)
  MUST additionally have fuzz tests and invariant tests where feasible.
- Test code MUST be deterministic: no flaky tests, no undeclared dependence on
  block timestamps, ordering, or ambient state beyond explicitly arranged fixtures.
- Line coverage for `src/` MUST be ≥ 95% and branch coverage ≥ 90% before a change
  is considered mergeable; coverage gates apply to the whole suite, not deltas.

Rationale: coverage targets give the "tests exist" claim an objective, checkable
meaning instead of a subjective one.

### IV. Maintainability & Simplicity

- Start simple: YAGNI applies — no abstraction, extension point, or configuration
  option MAY be introduced without a concrete, current need.
- Duplication of non-trivial logic MUST be eliminated; shared logic lives in exactly
  one place with its own tests.
- State layout MUST be minimal and explicit; every state transition MUST emit an
  event so off-chain observers can reconstruct history.
- Changes MUST leave the codebase easier to understand than before: if a change
  makes the design harder to reason about, it MUST be redesigned before merge.

Rationale: auction logic has a long lifecycle; every unnecessary moving part is a
future maintenance cost and a future attack surface.

### V. Documentation & Technical Debt

- Every change MUST update the documentation that describes it (README, NatSpec,
  spec artifacts) in the same change — docs lag is treated as an incomplete change.
- Technical debt MUST be made visible: known shortcuts MUST be recorded as explicit
  TODOs with context, never left as silent tribal knowledge.
- Refactoring MUST be continuous and safe: because tests are first-class (Principle
  II), structural improvement happens in small reviewed steps, never in big-bang
  rewrites.
- "Fix it later" debt MUST NOT accumulate across releases; each release MUST either
  clear its recorded debt or explicitly re-prioritize it.

Rationale: maintainability is a habit, not a phase — documentation and debt hygiene
keep the system honest over time.

## Tooling & Quality Gates

- Toolchain: Foundry (`forge`) is the canonical build, test, and lint tooling; ad-hoc
  or alternative toolchains MUST NOT diverge from it without a recorded decision.
- `forge fmt --check`, `forge build`, and `forge test` MUST all pass with zero
  failures (and zero compiler warnings) before any change is considered done.
- Solidity source MUST target a single pinned compiler version per contract and use
  pragma `^0.8.x` or stricter; floating or unbounded pragmas MUST NOT be introduced.
- Configuration (parameters, addresses, durations) MUST live in configuration
  constants or deployment scripts — never inline literals scattered through logic.

## Development Workflow

- All work follows the spec-driven flow: specification → plan → tasks → implementation,
  with tests landing before or alongside the code they cover.
- Every change MUST be small and reviewable; large diffs MUST be split into
  sequential, independently passing steps.
- Review checklist for every change: principles I–V compliance, tests added/passing,
  coverage gate met, docs updated, no new untracked debt.
- CI (or its local equivalent) MUST run fmt, build, full test suite, and coverage
  before merge; a red pipeline blocks merge with no exceptions.
- Breaking changes to external interfaces MUST be called out explicitly in the change
  description with a migration note.

## Governance

- This constitution supersedes ad-hoc practices; where a document conflicts with it,
  the constitution wins until amended.
- Amendments MUST be proposed in writing, reviewed for impact on existing code and
  tests, and approved by the project owner before adoption.
- Versioning policy (semver over this document): MAJOR for removals or incompatible
  redefinitions of principles; MINOR for new principles or materially expanded
  guidance; PATCH for wording, clarifications, and typo fixes.
- Compliance MUST be verified at review time against Principles I–V and the quality
  gates; a change that violates a NON-NEGOTIABLE principle MUST be rejected regardless
  of urgency.
- Runtime development guidance belongs in the spec-kit artifacts (`specs/`, `plan.md`);
  this constitution governs *how* to work, not *what* to build.

**Version**: 1.0.0 | **Ratified**: 2026-09-26 | **Last Amended**: 2026-09-26
