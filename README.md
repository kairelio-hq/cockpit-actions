# cockpit-actions

Generic actions for [office-cockpit](https://github.com/kairelio-hq/office-cockpit): an **action library** — a
repository of declarative manifests the cockpit's plane reads at a pinned commit. Nothing here is code: each
manifest names where it applies, an optional form, and steps made of the plane's fixed operations.

| action | does | applies to | letter |
|---|---|---|---|
| `approve` | approves the pull request | open PRs not yours (primary while your review is asked, and once you have reviewed until your latest review is an approval, whatever the checks say) | `a` |
| `force-approve` | approves with "Approved without review." | open PRs not yours | `A` |
| `merge` | merges, after asking GitHub whether it would (a refusal says why before anything is confirmed) | open, non-draft PRs (primary when yours and ready) | `m` |
| `mark-draft` | converts to draft | your open PRs | `d` |
| `mark-ready` | marks ready for review | your draft PRs | `r` |
| `transition` | moves an issue to a state it can reach now: a Jira issue through its workflow (a form of Jira's transitions, with the fields the move asks for, such as Effort), a GitHub issue open or closed (with a reason) | Jira and GitHub issues (primary while not done) | `t` |
| `retry-failed-actions` | re-runs the failed jobs of the GitHub Actions runs that failed on the head commit (the latest run of each workflow); the confirmation lists them; other apps' checks are named as skipped. The connection needs Actions write (a classic token: `repo`) | open PRs whose checks fail (primary when yours, below approve and merge) | `R` |
| `resolve-conflict` | **(agent) Resolve conflict**, a node action: a Claude session on your node merges the base into the branch (or, if you pick it, rebases onto the base and force-pushes with lease) in a worktree of its own, resolves the conflicts keeping both sides' intent, runs the tests it finds, pushes to the PR's branch, removes the worktree, and comments a summary; it stops and asks when a conflict needs a decision or the tests fail | open PRs with a merge conflict, on a node with a checkout of the repository; greyed for a PR from a fork, or when it cannot tell (it fails closed) | `C` |

## Using it

In the cockpit, Settings → Actions → Add library: `kairelio-hq/cockpit-actions`, ref `^0.4` (the newest 0.4.x
release tag), no connection needed (it is public). Turn it on for a space. Or with occ:

```sh
occ actions libraries add kairelio-hq/cockpit-actions --ref='^0.4'
occ actions libraries enable kairelio-hq/cockpit-actions --space=<space>
```

## Writing a library

- `index.json`: `{ "format": "occ-actions/1", "name": "…", "actions": ["<id>", …] }` (at most 100).
- `actions/<id>.json`: one manifest, validated by [`schema/manifest.schema.json`](schema/manifest.schema.json)
  (the index by [`schema/index.schema.json`](schema/index.schema.json)). The plane checks more than the schema can
  (conditions, placeholders, `if`) and lists a manifest it refuses with its errors.
- A manifest: `id`, `title`, `group` (`copy`, `github`, `jira`, `agent`), `appliesTo` (an office-cockpit view
  condition), optional `form` (text, select, multiselect, checkbox; `optionsFrom`: `linked-tickets`,
  `transitions`; `prefill: { bodyField }`), `mnemonic`, `primary: { when, rank }`, and `steps`.
- Operations: `approve`, `merge`, `convert-to-draft`, `mark-ready`, `add-labels`, `remove-labels`, `comment`,
  `transition`, `set-pr-body-fields`. They are provider-neutral: the plane runs the one of the item's connector, and
  an action applies only where the item's connector implements every operation of its steps (`GET
  /api/connectors` lists them per connector). String parameters may use `{form.<key>}`, `{item.<field>}` (`id`,
  `ref`, `key`, `number`, `repository`, `title`, `url`, `branch`) and `{me.email}` / `{me.name}`.
- Every operation writes, so every action is confirmed.

### Node actions (schema v0.2.0)

An action may run on one of the user's nodes instead of the plane: `executor: "node"`, a `script`
(`{ "path": "scripts/<id>.js", "sha256": "<64 hex>" }`, one ES module exporting `handle(ctx)`, at most 256 KiB),
`permissions` (the `ctx` calls it may make: `github.read`, `github.write`, `git.checkout`, `agent.start`,
`agent.run`), `requires` (`occ`, `ctx`, `tools`, `skills`, `mcp`, `checkout`, `github`) and `timeoutSeconds`; no
`steps`. The plane never runs the script; a node fetches it at the pinned commit with its own `gh`, checks the
hash, and runs it only if it trusts the library (`occ actions add <owner/repo>[@<range>]` on that node). Keep the
hash current with `occ actions hash . --write`. A manifest without `executor` is a v0.1.0 plane action, unchanged.

### Connector operations and transition fields (schema v0.3.0)

`transition { to, fields? }` moves the item through its connector: a Jira issue by the workflow transition whose
target status (else name) is `to`; a GitHub issue to `open` or `closed` (pull requests have none). A form field with
`optionsFrom: transitions` lists where the item can move now; each option carries the fields that move asks for
(Jira's transition screen read with `expand=transitions.fields`: Effort, Resolution…; GitHub's close reason,
`state_reason`), and the dialog shows them under the status once one is picked. A run answers them in `form.fields`
(`fields` is therefore not a form key) and the plane sends them with the transition (a step's own `fields` win). A
required field the form cannot show (a sprint, a cascading select) makes that status unavailable, with words saying
to set it in Jira or use an agent transition.

`jira-transition` and `optionsFrom: jira-transitions` are the v0.1.0 names, still valid for one version: v0.1.0
and v0.2.0 manifests keep working unchanged.

**v0.6.1: the move by its id.** Two Jira transitions may lead to the same status ("Done (Deploy to Production)",
"Done (Cancel the Work)"), with different screens and post-functions, so an option of `optionsFrom: transitions` holds
the move's id (a Jira transition id; a GitHub issue's `open` or `closed`), labelled `<status> (<transition>)`, and
`transition` takes it as `transitionId`: the plane posts exactly that transition, after checking Jira still offers it
(else "that transition is no longer available"). `to` still names a status: one transition there is taken, several are
refused as "ambiguous: choose a transition" rather than guessed. `transition` here passes `transitionId: "{form.status}"`;
it needs an office-cockpit plane from 2026-10-21 on (an older one lists the manifest with an error, "unknown parameter
transitionId"). That plane also takes the id as `to`, so v0.6.0's `to: "{form.status}"` picks the right transition on it.

### Retry and greyed actions (schema v0.4.0)

- `rerun-failed-checks` (GitHub pull requests): re-runs the failed jobs (`failure`, `timed_out`, `cancelled`,
  `startup_failure`) of the latest GitHub Actions run of each workflow on the head commit. Preparing it lists the
  runs it will retry (the confirmation's line) and refuses when there is none; checks of other apps are listed as
  skipped, "not a GitHub Actions run". A 403 says the token needs Actions write.
- `unavailableWhen`: 1-5 `{ when, reason }`. An applicable action whose rule holds on the item is listed greyed with
  the reason and refused when prepared or run (`resolve-conflict`: a pull request from a fork).
- View condition fields for `appliesTo`, `primary.when` and `unavailableWhen`: `checks` (`passing`, `failing`,
  `pending`, `none`), `mergeable` (`clean`, `conflicting`, `blocked`, `unknown`), `fork` (true or false). They need
  an office-cockpit plane from 2026-10-20 on; an older plane lists these two manifests with their errors.
- v0.6.2: `reviewStatus` (`requested`, `approved`, `approved-ready`, `chg-req`, `commented`) and `reviewStatus.tone`
  (`mine`, `mine-ready`, `settled`, `theirs`): the viewer's own review of an open pull request they review and did not
  write (null otherwise), computed for the user the actions are listed for, as in their views. Their latest review
  decides it: `approved` (an approval), `chg-req`, `commented` (`approved-ready` when it is a COMMENT whose body opens
  with 🤖 and says `Suggested verdict: APPROVE`: the agent posts as them and cannot approve), `requested` while their
  review is asked or when their latest review was dismissed. GitHub removes a reviewer from the requested reviewers
  once they review, so `requestedReviewers any {me}` no longer holds; `approve` is primary by
  `reviewStatus in [requested, approved-ready, chg-req, commented]`, every value but `approved`. Needs an office-cockpit
  plane from 2026-10-20 on (every plane that reads v0.6.0's `agents` has it); an older one lists `approve` with its
  error.

`resolve-conflict` is this library's first node action. Its prompt is versioned in the script (`PROMPT_VERSION`,
now `resolve-conflict/3`) and takes the strategy: `merge` (a merge commit and a plain push; the default) or `rebase`
(rewrites the PR's history; `git push --force-with-lease` to the PR's branch only, never a bare `--force`). The agent
creates the worktree and removes it (`git worktree remove`, `git worktree prune`, and its temporary branch) once the
push went; when it stops to ask, it keeps the worktree, says where it is, and removes it once done after the answer.

`occ init` (an occ released after 0.5.1) offers to trust this library at `always` for `^0.4`: its releases in range run without
asking, but new permissions still ask, so the first run of `resolve-conflict` on a node asks once for `github.read`,
`git.checkout`, `agent.start` and `github.write`.

Release by tagging `vX.Y.Z`; users on a range (`^0.3`) move with the next Update or daily.

The contract is office-cockpit's `doc/design/contract/actions.md`.
