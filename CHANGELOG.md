# Changelog

## v0.4.1 (2026-10-20)

- `resolve-conflict` fails closed (security review): it is greyed when the plane cannot tell whether the pull request
  comes from a fork ("Can't tell whether this PR comes from a fork"), and its script refuses unless the snapshot says
  `fork: false` with a head repository equal to the item's, the head branch is neither the base branch nor the
  repository's default branch, and GitHub, asked just before the agent starts (`isCrossRepository`, the head
  repository, the branches), agrees. Any of these unknown, or GitHub not answering, is a refusal. The prompt
  (`resolve-conflict/3`) has the agent check `isCrossRepository` again before it pushes. It now also needs
  `github.read` (a node that trusts it asks once for the new permission).

## v0.4.0 (2026-10-20)

- `retry-failed-actions` (Retry failed actions, `R`): re-runs the failed jobs of the GitHub Actions runs that failed
  on an open pull request's head commit, the latest run of each workflow; the confirmation lists the runs; other
  apps' checks are named as skipped. Primary on your own pull request while its checks fail (rank 25, below approve
  and merge).
- `resolve-conflict` ((agent) Resolve conflict, `C`): the library's first node action. A Claude session on your node
  resolves a pull request's merge conflict in a worktree of its own, with the strategy you pick (merge, the default,
  plain push; or rebase, force-push with lease), runs the tests it finds, pushes, removes the worktree and comments
  a summary; it stops and asks when a conflict needs a decision or the tests fail. Greyed for a pull request from a
  fork; needs a node with a checkout of the repository.
- Schema v0.4.0: the `rerun-failed-checks` operation and `unavailableWhen`; the view condition fields `checks`,
  `mergeable` and `fork`. v0.1.0-v0.3.0 manifests stay valid.

## v0.3.0 (2026-10-19)

- `transition` is provider-neutral (Jira issues through their workflow, GitHub issues open or closed) and carries the
  fields each move asks for; `jira-transition` and `jira-transitions` stay valid as deprecated names.

## v0.2.0 (2026-10-19)

- Schema: node actions (`executor`, `script`, `permissions`, `requires`, `timeoutSeconds`).

## v0.1.0 (2026-10-19)

- approve, force-approve, merge, mark-draft, mark-ready, transition; the manifest and index schemas.
