# cockpit-actions

Generic actions for [office-cockpit](https://github.com/kairelio-hq/office-cockpit): an **action library** — a
repository of declarative manifests the cockpit's plane reads at a pinned commit. Nothing here is code: each
manifest names where it applies, an optional form, and steps made of the plane's fixed operations.

| action | does | applies to | letter |
|---|---|---|---|
| `approve` | approves the pull request | open PRs not yours (primary while your review is asked) | `a` |
| `force-approve` | approves with "Approved without review." | open PRs not yours | `A` |
| `merge` | merges, after asking GitHub whether it would (a refusal says why before anything is confirmed) | open, non-draft PRs (primary when yours and ready) | `m` |
| `mark-draft` | converts to draft | your open PRs | `d` |
| `mark-ready` | marks ready for review | your draft PRs | `r` |
| `transition` | moves an issue to a state it can reach now: a Jira issue through its workflow (a form of Jira's transitions, with the fields the move asks for, such as Effort), a GitHub issue open or closed (with a reason) | Jira and GitHub issues (primary while not done) | `t` |

## Using it

In the cockpit, Settings → Actions → Add library: `kairelio-hq/cockpit-actions`, ref `^0.3` (the newest 0.3.x
release tag), no connection needed (it is public). Turn it on for a space. Or with occ:

```sh
occ actions libraries add kairelio-hq/cockpit-actions --ref='^0.3'
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

This library has no node actions; `occ init` offers to trust it at `always` for `^0.3`.

Release by tagging `vX.Y.Z`; users on a range (`^0.3`) move with the next Update or daily.

The contract is office-cockpit's `doc/design/contract/actions.md`.
