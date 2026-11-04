# Working on Rocket

- **Keep `README.md` current.** Every change that adds, removes or changes a feature, a page, a
  setting, a script, a workflow or a database table updates the README in the same pull request.
- A change to the database is a new file in `supabase/migrations/` (never edit an applied one), with
  `apps/web/src/lib/supabase/database.types.ts` updated to match. Say in the pull request that it
  must be run before merging.
- Before pushing: `pnpm format:check`, `pnpm -r lint`, `pnpm -r typecheck` and `pnpm -r test`.
- Commit messages follow Conventional Commits (`feat:`, `fix:`, `chore:` …); see `RELEASING.md`.
