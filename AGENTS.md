# Repository Instructions

## Package manager

- Use `pnpm` only.
- Do not use `npm`, `yarn`, or Bun unless explicitly requested.
- Do not regenerate the lockfile unnecessarily.
- Preserve the existing pnpm workspace structure.

## Before changing code

- Inspect the relevant files, types, tests, and existing implementation patterns first.
- Identify the root cause before applying a fix.
- Prefer the smallest change that fully solves the problem.
- Do not rewrite unrelated code.
- Do not add dependencies unless necessary.
- Ask before making significant architectural changes.

## TypeScript and code quality

- Preserve strict TypeScript compatibility.
- Do not add `any`, `@ts-ignore`, or `@ts-nocheck` to hide errors unless explicitly approved.
- Reuse existing utilities, types, components, and conventions.
- Avoid duplicated logic.
- Keep public APIs backward-compatible unless the task explicitly requires a breaking change.
- Add comments only where the reasoning is not obvious from the code.

## Validation

After TypeScript changes, run the repository's existing typecheck command:

```bash
pnpm typecheck
