/**
 * Ask an LLM: `claude -p` on your node with a prompt and, if picked, the item's body or the pull
 * request's diff as context. The answer is the action's `text` output (schema v0.8.0, what a
 * workflow's next step reads) and its first 200 characters the run's message.
 *
 * Runs on an office-cockpit node (executor: node) in QuickJS with ctx v1 (occ >=0.8.0: ctx.output,
 * and agent.run's model). The script writes nothing: it reads GitHub (github.read) only for the
 * context and runs one headless turn (agent.run) in the home directory, with no checkout.
 *
 * - `body`: the item's description. ctx.item carries no body today, so a GitHub issue's or pull
 *   request's is read from GitHub (`repos/<repo>/issues/<n>`); a ticket elsewhere (Jira) is refused
 *   until the plane sends one (`ctx.item.body`, used as is when present).
 * - `diff`: the pull request's diff, built from its changed files' patches
 *   (`repos/<repo>/pulls/<n>/files`, 100 a page; GitHub lists at most 3000 files and leaves the
 *   patch out of a file too large or binary). ctx.github.get answers JSON only, so the raw
 *   `application/vnd.github.diff` media type is not available. Cut at 100 KiB, and so that the whole
 *   prompt stays within agent.run's 100 KiB.
 */

/** occ's agent.run takes a prompt of at most this many UTF-8 bytes. */
const PROMPT_MAX = 100 * 1024;
/** The diff given as context, at most (UTF-8 bytes; it is cut there). */
const DIFF_MAX = 100 * 1024;
const MESSAGE_MAX = 200;
const FILES_PER_PAGE = 100;
/** GitHub lists at most 3000 files of a pull request. */
const FILES_PAGES_MAX = 30;
const CONTEXTS = ["none", "body", "diff"];
const CUT = "\n[… cut: the context was too long]";

const refused = (why) => new Error(`refused: ${why}`);

/** UTF-8 bytes of one code point. */
const bytesOf = (cp) => (cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4);

export const utf8Length = (s) => {
  let n = 0;
  for (const ch of s) n += bytesOf(ch.codePointAt(0));
  return n;
};

/** `s` cut to at most `max` UTF-8 bytes, on a character boundary. */
export function cutToBytes(s, max) {
  let n = 0;
  let end = 0;
  for (const ch of s) {
    const b = bytesOf(ch.codePointAt(0));
    if (n + b > max) return s.slice(0, end);
    n += b;
    end += ch.length;
  }
  return s;
}

/** The item's GitHub repository and number, or null when it is not on GitHub. */
function onGithub(item) {
  if (!item || item.provider !== "github") return null;
  const repo = item.repo ?? item.repository;
  const number = Number(item.number);
  if (typeof repo !== "string" || !/^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/.test(repo)) return null;
  if (!Number.isInteger(number) || number < 1) return null;
  return { repo, number };
}

async function bodyOf(ctx) {
  if (typeof ctx.item.body === "string") return ctx.item.body;
  const gh = onGithub(ctx.item);
  if (!gh) throw refused("this item's body is not available on the node (only a GitHub issue's or pull request's is read)");
  const issue = await ctx.github.get(`repos/${gh.repo}/issues/${gh.number}`);
  return typeof issue?.body === "string" ? issue.body : "";
}

/** The pull request's diff from its changed files, stopping once it is past `max` bytes. */
async function diffOf(ctx, max) {
  const gh = ctx.item.kind === "pr" ? onGithub(ctx.item) : null;
  if (!gh) throw refused("only a GitHub pull request has a diff");
  let diff = "";
  for (let page = 1; page <= FILES_PAGES_MAX && utf8Length(diff) <= max; page++) {
    const files = await ctx.github.get(`repos/${gh.repo}/pulls/${gh.number}/files?per_page=${FILES_PER_PAGE}&page=${page}`);
    if (!Array.isArray(files)) throw new Error("GitHub did not list the pull request's files");
    for (const f of files) {
      const from = f.previous_filename ?? f.filename;
      const patch = typeof f.patch === "string" ? f.patch : `(no patch: ${f.status ?? "changed"}, binary or too large)`;
      diff += `diff --git a/${from} b/${f.filename}\n${patch}\n`;
    }
    if (files.length < FILES_PER_PAGE) break;
  }
  return diff;
}

/** The prompt with `extra` as context, within agent.run's limit. */
export function promptWith(prompt, kind, extra) {
  if (!extra) return prompt;
  const open = `${prompt}\n\n<context kind="${kind}">\n`;
  const close = "\n</context>";
  const room = Math.min(DIFF_MAX, PROMPT_MAX - utf8Length(open) - utf8Length(close));
  if (room <= utf8Length(CUT)) throw refused("the prompt leaves no room for the context");
  const fits = utf8Length(extra) <= room ? extra : cutToBytes(extra, room - utf8Length(CUT)) + CUT;
  return `${open}${fits}${close}`;
}

export async function handle(ctx) {
  const { prompt, context = "none", model } = ctx.form;
  if (typeof prompt !== "string" || prompt.trim() === "") throw refused("a prompt is required");
  if (!CONTEXTS.includes(context)) throw refused(`context is one of ${CONTEXTS.join(", ")}`);
  if (utf8Length(prompt) > PROMPT_MAX) throw refused("the prompt is at most 100 KiB");
  const extra = context === "body" ? await bodyOf(ctx) : context === "diff" ? await diffOf(ctx, DIFF_MAX) : "";
  const full = promptWith(prompt, context, extra);
  const answer = String(await ctx.agent.run(full, model ? { model } : {}));
  ctx.output("text", answer);
  return answer.slice(0, MESSAGE_MAX);
}
