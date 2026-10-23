# Changelog

## v0.8.0 (unreleased)

Needs office-cockpit plane 0.6.0 and occ 0.8.0; tag after both are deployed and nodes upgraded.

### Schema v0.8.0: workflows

- **`outputs`** (at most 16, by id, ids as form keys): what a node action returns beside its message, for a
  workflow's next step. A script sets one with `ctx.output(id, value)`: JSON values, at most 256 KiB in all; an
  undeclared id is an error. The message is unchanged (at most 2000 characters).
- **`runsOn`**: 1-8 node selectors `<label>:<agent>[:<model>]` in preference order, or a label alone for an action
  that uses no agent. A workflow job's `runs-on` wins over it; labels never grant trust or permissions.
- **`appliesTo: { "none": true }`**: an item-less action (`ctx.item` null, never in an item menu,
  `requires.checkout: none`).
- The permission **`event.emit`** (`ctx.emit(name, payload)`): an event for the plane's event triggers.
- `ctx` stays version 1; a manifest using these keys requires `occ >=0.8.0`. Earlier manifests stay valid.

### Ask an LLM

- New node action **`llm`** ("Ask an LLM", group `agent`): `claude -p` on the node with the form's `prompt` and, as
  `context`, nothing, the item's body (a GitHub issue's or pull request's, read from GitHub; a Jira ticket's is
  refused until the plane sends bodies) or the pull request's diff (built from its changed files' patches, cut at
  100 KiB and within agent.run's 100 KiB prompt). `model` (optional) picks a model the node lists for Claude. The
  answer is the output `text`; its first 200 characters are the message. Applies to pull requests and tickets;
  `runsOn: ["generic:claude"]`; permissions `github.read`, `agent.run`; `requires: { occ: ">=0.8.0", ctx: 1,
  checkout: none }`; 600 s.
- **A minor release, not a patch**: a plane before 0.6.0 refuses the new keys and lists `llm` with its error, and occ
  before 0.8.0 lacks `ctx.output` and `--model`. Move the plane's ref to `^0.8` once it runs 0.6.0; nodes: `occ actions
  add kairelio-hq/cockpit-actions@^0.8` (they ask once for `agent.run` for `llm`).
- README: how to check a release (`ajv-cli` against the schema, `occ actions hash . --write`).

## v0.7.0 (unreleased)

Needs office-cockpit plane 0.4.0 and occ 0.7.3; tag after it is deployed.

### Action locks

- Schema v0.7.0: **`lock`** (office-cockpit plane 0.4.0, occ 0.7.3; Wei 2026-10-22). An action may declare
  `"lock": "<class>"` (1-32 of `a-z0-9-`): a run holds that class on its item, and office-cockpit lets at most one run
  hold it at once, whoever started it (two users' runs on one pull request too). `pr-branch`: the action commits or
  pushes to the pull request's branch. A run started by hand (the drawer, ⌘K, `occ items run`, a question card's Run)
  while it is held is refused (`409 LOCKED`, saying what holds it); a trigger's run waits and starts once it frees, if
  its condition still holds. `occ lock <item>` takes it from a session of your own. Read-only actions declare none;
  v0.1.0-v0.6.x manifests stay valid.
- `resolve-conflict` declares `lock: "pr-branch"`, and refuses to clobber the branch (prompt `resolve-conflict/4`):
  the script reads the pull request's head commit from GitHub (`headRefOid`, with the fork check) and the prompt has
  the agent work from it only. When origin's branch is anywhere else at the start or right before the push, it pushes
  nothing and ends with "the pull request changed while it was being resolved; run it again". A merge pushes with a
  plain `git push origin HEAD:<head>` once `git merge-base --is-ancestor <that commit> HEAD` holds: the merge builds on
  that commit, so the push is a fast-forward, which git refuses when someone pushed meanwhile (never a force push). A
  rebase, which rewrites the branch, pushes with `git push --force-with-lease=<head>:<that commit> origin HEAD:<head>`,
  once the rebased branch is checked to sit on the base (`git merge-base --is-ancestor origin/<base> HEAD`).
- `resolve-conflict` requires **occ >=0.7.3** (an older occ refuses a manifest with `lock`). This folds in v0.6.3,
  whose only change raised the requirement to >=0.7.1 (sessions start in the background); v0.7.0 raises it again. The
  other actions declare no lock: approve, force-approve, merge, mark-draft, mark-ready, transition and
  retry-failed-actions change no branch.
- **A minor release, not a patch**: an office-cockpit plane before 0.4.0 refuses the `lock` key (it reads manifests
  strictly) and would list `resolve-conflict` with its error, so a plane on `^0.6` must not pick this up by itself.
  Move the plane's ref to `^0.7` once it runs 0.4.0; nodes: `occ actions add kairelio-hq/cockpit-actions@^0.7`.

### GitHub project status

- `transition` **moves a GitHub item's project status** (Wei 2026-10-22): an issue or a pull request in a GitHub
  project moves to another status of that project. `optionsFrom: transitions` groups its options: the issue's own
  move (open or closed) under `Issue`, then each project's statuses under the project's title (an option's `group`:
  `{ key: "issue" | "project:<owner>/<number>", label }`), the current status greyed. A project move's value is
  `project:<project id>:<option id>`, passed as `transitionId`; the plane sets the status field the user picked for
  that project (else `Status`) and needs the connection's `project` scope (Projects write, fine-grained).
- `transition` applies to **pull requests in a project**: `appliesTo` `{ any: [ { kind: ticket }, { all: [ { kind:
  pr }, { field: projects, exists: true } ] } ] }`; a pull request moves between project statuses only (merge and
  close are their own actions), and `transition` is primary on tickets only (`primary.when` adds `kind: ticket`).
- Schema v0.7.0 documents the view condition fields `projects`, `projectStatus` and `projectStatusCategory`, the
  project move, and grouped options. v0.1.0-v0.6.x manifests stay valid.
- An older plane cannot move project status and lists no project options.

## v0.6.3 (folded into v0.7.0)

- `resolve-conflict` requires **occ >=0.7.1** (was >=0.4.0). From occ 0.7.1 every session cockpit starts runs in the
  background (`claude --bg` or the Codex daemon), named `occ-…`, and comes to a herdr/tmux tab or the Claude app only
  when you open it. An older node would still open a herdr tab for this action on its own (2026-10-21).

## v0.6.2 (unreleased)

- `approve` is **primary once you have reviewed the pull request and your latest review is not an approval**, as well as
  while your review is asked: `reviewStatus in [requested, approved-ready, chg-req, commented]`. Any review counts
  (COMMENTED, CHANGES_REQUESTED, a dismissed one), including the COMMENT reviews your agent posts under your account.
  GitHub drops you from the requested reviewers once you review, so `requestedReviewers any {me}` stopped holding
  exactly when approving was the thing left (hardcoretech/fms#20876, 2026-10-21). Never once your latest review is
  an approval (`reviewStatus` `approved`) unless your review is asked again; never on your own pull request
  (`appliesTo`, and `reviewStatus` is null there). Failing checks do not matter: GitHub takes an approval either way.
  `appliesTo` is unchanged (open pull requests not yours). Schema v0.6.2 documents the condition fields
  `reviewStatus` and `reviewStatus.tone`, which office-cockpit has read since 2026-10-20 (every plane that reads
  v0.6.0's `agents` has them). v0.1.0-v0.6.1 manifests stay valid.

## v0.6.1 (unreleased)

- `transition` passes the picked move as **`transitionId`** (`{form.status}`), not `to`. Two Jira transitions may lead
  to the same status ("Done (Deploy to Production)", "Done (Cancel the Work)"); the form's options are keyed by the
  transition id, and `to` alone named only the status, so the plane could post a different transition than the one
  picked (and the dialog could not select the first of two). Schema v0.6.1: `transition`'s `with` takes `transitionId`
  or `to` (at least one). Needs an office-cockpit plane from 2026-10-21 on; tag after that plane is deployed (an older
  plane refuses `transitionId` and lists `transition` with its error). v0.1.0-v0.6.0 manifests stay valid.

## v0.6.0 (unreleased)

- Schema v0.6.0: **agents**. A node action may declare the agents it runs with: `"agents": ["claude", "codex"]`, or per
  agent `{ "claude": { "requires": { "skills", "mcp" }, "prompt"? }, "codex": { … } }`. Absent: Claude only, as before
  (a prompt may rely on Claude's slash commands, skills or `--settings` hooks). office-cockpit (occ 0.7.0) offers each
  node × agent in the action's Run on, each with its reason when it cannot; the script reads `ctx.agent.kind` (and
  `ctx.agent.prompt`). The top-level `requires.skills` and `requires.mcp` stay Claude's. v0.1.0-v0.5.x manifests stay
  valid.
- `resolve-conflict` runs with **Claude or Codex**: its prompt (`resolve-conflict/3`) is plain git and gh work, nothing
  Claude-only; Codex needs no skill. `requires.tools` drops `claude` (each agent's tool is implied by `agent.start`).

## v0.5.0 (unreleased)

- Schema v0.5.0: **library variables**. A manifest's `variables` (1-20 `{ id, label, type: string|email|number|enum|user,
  scope?: space, default?, help?, values? }`) declares values the user keeps per space in office-cockpit (Settings →
  Actions → <library> → Variables); a form field defaults to one with `{{var.<id>}}` (the form offers Remember as
  default), its help links to it with `{{settings:var.<id>}}`, a step uses `{var.<id>}`, a node action's script reads
  `ctx.vars.<id>`. A default may name `{me.email}`, `{me.name}`, `{connection.jira.email}`,
  `{connection.github.login}`. Values are not secrets (no secret type). v0.1.0-v0.4.x manifests stay valid.

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
