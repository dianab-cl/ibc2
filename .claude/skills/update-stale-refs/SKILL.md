---
name: update-stale-refs
description: Use when adjudicating flagged GitHub links from docs/mintlify/scripts/check-github-refs.js, or when an ibc-go docs page links to upstream code (cosmos/ibc-go or a dependency) that has since changed. Decides whether the page's prose is still accurate after upstream moved, and proposes the smallest edit that makes it correct. Not for bumping refs the checker already auto-fixed.
---

# Adjudicating stale upstream references

`docs/mintlify/scripts/check-github-refs.js` bumps the links it can prove are safe. It flags the rest. This skill decides what to do with a flag.

A flag is not a broken link to repair. It is a signal that a page may describe code that no longer exists or no longer behaves as written. The link is the symptom. Read for the defect.

```bash
node docs/mintlify/scripts/check-github-refs.js --product ibc-go --targets latest --json /tmp/flags.json
```

The checker only audits links into `cosmos/ibc-go`, and only under `docs/ibc-go/<targets>/`. It reads the shipping ref from `latestDisplayVersion` in `docs/mintlify/versions.json`.

## Correct the prose when it is wrong. Change nothing else.

The target is a page that is accurate against the code at the shipping ref. Not a page that explains how it got there.

If a sentence is false, change it. Change the minimum needed to make it true, and stop. Do not introduce information the page did not already carry, do not expand a correction into an explanation, and do not add examples or caveats that were not there.

Never write version-comparative prose. No "as of v11", "previously", "this changed in", "no longer", "has been removed", "in older versions". A reader arrives at this page long after the release and needs to know how the system works, not what it used to do. Version history belongs in `docs/ibc-go/<version>/changelog/` and `docs/ibc-go/<version>/migrations/`, which already have it.

The house rules this skill relies on, stated here so nothing dangles (the layout and the other rules are in `docs/AGENTS.md`):

- Timeless prose, as above.
- Internal links are absolute Mintlify paths with no extension, for example `/ibc-go/latest/apps/transfer/overview`.
- No em dashes, and no callout announcing the change.
- No Solidity content in `docs/ibc-go/`; link to `/ibc/ibc-solidity-contracts/` instead.

So, in order of preference:

1. Sentence still true, link drifted: fix the link. Touch no prose.
2. Sentence false because the thing it describes is gone: delete the sentence, and any list item, heading, table row, diagram label or table-of-contents entry that only existed to support it.
3. Sentence false because the behaviour differs: change the words that are wrong. Keep the sentence's shape, length and level of detail.

Write the corrected page as though the code had always been this way. A good sweep is net negative on prose: a renamed heading, a deleted bullet and a dead link, a couple of edited strings.

## Scope: decide whether a link should be touched at all

Work this out before adjudicating anything. Getting it wrong produces confident, wrong edits.

**Architecture decision records are liveness-only.** The ADRs live in `docs/ibc-go/<version>/architecture/`, as `adr-NNN-<slug>.mdx` plus a `README.mdx` index (16 ADR pages in `latest`). Recognise one by that filename, by a title of the form `ADR NNN: ...`, and by the `Changelog` / `Status` / `Context` / `Decision` sections. There is no RFC directory here. For any such page the only question is whether the link 404s. If it resolves, leave it exactly as it is: do not bump the ref, do not adjust the line range, do not touch the prose. An ADR records a decision as of a moment, so it legitimately cites code that has since changed or been deleted. If it does 404, propose the most recent ref at which the path still exists, and an older release branch or tag is a perfectly good answer.

**Version-specific pages keep their own version's refs.** Anything under `docs/ibc-go/<version>/migrations/` or `docs/ibc-go/<version>/changelog/` is about one release. A `v10-to-v11` migration guide citing the `release/v10.1.x` branch is correct, and bumping it to the newest branch makes the page contradict itself. More generally, if a sentence names a version, its link must match the version the sentence names, not the newest one. This rule matters a great deal here: the migration guides are the largest single group of flags (38 of 240 at the time of the migration), and nearly all of them are correct as written.

Check the checker's own coverage before trusting it on these pages. Its `VERSION_SPECIFIC` list matches `/upgrade/` and `/changelog/` paths. This site names the directory `migrations/`. Until that list includes `/migrations/`, the checker does not know migration guides are version-specific: it can flag them as ordinary drift and `--fix` can bump their refs. So until that is fixed, do not run `--fix` without first confirming that no `migrations/` page is in its fix set, and treat every flag on a migration guide as `no-change` unless the link is dead (see below).

**A cross-product link takes the dependency's version, not the host page's.** An `ibc-go` page that links into `cosmos/cosmos-sdk` does not go to `release/v11.0.x`, which does not exist in the SDK repo. Read ibc-go's `go.mod` at its shipping ref to find which SDK version it requires, and use the matching `cosmos-sdk` release branch. The checker does not audit these links at all (it only looks at `cosmos/ibc-go`), so this one is by hand. The rule is identical for any other dependency.

**Never run a global find-and-replace across the changed set.** Every ref decision is per-link and depends on the surrounding sentence. A blanket replace is how a version-specific page ends up citing the wrong version.

## Why the rules are what they are (GitHub link refs)

These measurements come from the cosmos/docs SDK and CometBFT freezes the checker was built on, not from ibc-go. The mechanism is the same; the numbers are what to expect, not a count of ibc-go's own links.

Refs fall into three groups and only the first should ever be bumped:

| Ref shape | Treatment |
| --------- | --------- |
| `release/v<N>.x` (ibc-go, SDK) or `v<N>.x` (CometBFT) | Version-tracking. Bump on freeze. |
| `main`, `master` | Always current, never stale in the version sense, but line anchors silently rot as upstream moves. |
| Pinned tag or 40-char SHA | Deliberate historical citation. Leave alone. Bumping changes what the prose is referring to. |

The hazard is line anchors (`#L127`). Bumping the ref while leaving the line number is worse than staying on the old ref, because the link keeps working while pointing at unrelated code. Measured on an SDK v0.54 to v0.55 freeze, of 39 line-anchored links:

- 29 anchors still landed on the same line of code
- 7 had moved, with the original line findable uniquely elsewhere in the file
- 1 anchored line was deleted upstream, 1 file was deleted, 1 was ambiguous

So roughly a quarter would have pointed somewhere wrong. CometBFT, which had drifted two minor versions, was worse: only 4 of 12 anchors survived. This is why the checker refuses to rewrite an anchored link that spans more than one minor version.

**How the checker decides.** Per link: does the path exist at the new ref, then does the line number still mean the same thing.

- Path existence is compared against the full file tree at each ref (`git/trees/<ref>?recursive=1` on the GitHub API), not probed URL by URL. Two traps: URL-decode the path first (`abci%2B%2B_methods.md` is `abci++_methods.md` in the tree), and a `/blob/` URL pointing at a directory is valid (GitHub redirects it to `/tree/`). On the SDK freeze, 93 of 96 paths survived the bump, so disappearance is the rare case.
- Line numbers use git, not content matching. Content equality cannot tell a moved line from a coincidentally identical one. `git diff -U0 old new -- <path>` gives hunk headers: a line outside every hunk moved by the cumulative offset, which is a safe rewrite; a line inside a changed hunk was edited or deleted, which is a human decision. Rename detection uses `git diff --find-renames`. Matching on basename does not work, because a name like `store.go` has dozens of candidates.

**Verdicts.** `bump` and `relocate` are auto-fixable. Everything else is a flag:

| Verdict | Meaning |
| ------- | ------- |
| `dead-now` | Already 404 at its current ref. Highest priority: usually the prose describes something upstream removed. Read the page before repointing the URL. |
| `anchor-changed` | The anchored lines were edited between the refs, so the prose may no longer match |
| `path-gone` | Renamed or deleted at the new ref. No rename is guessed. |
| `drift` | A pinned ref whose anchored code has since changed. The link resolves; the prose may not hold. |
| `unmaintainable` | A line anchor on `main`, which moves continuously. Repoint at a pinned SHA or the release branch. |
| `unassessed` | Could not be checked (network, fetch failure). Not the same as fine. |

The checker's output is not the final word either way. At the time of the migration it reported 240 flags and none were auto-fixable, so the work is adjudication, not bumping.

## Verdicts you assign

Every flag resolves to exactly one. `no-change` is a real answer and often the right one.

| Verdict | When | Action |
| ------- | ---- | ------ |
| `no-change` | Upstream changed in a way the prose does not depend on | Bump the ref or relocate the anchor. Touch nothing else. |
| `minimal-edit` | The page states something false | Smallest edit that makes it true. Delete rather than explain. No new information. |
| `needs-decision` | The correct fix depends on intent only a maintainer knows | Do not edit. Write up the options with evidence. |

A `no-change` verdict must mean you read the prose and confirmed it still holds, not that you only looked at the link. If you could not confirm it, say so rather than defaulting to `no-change`.

Never invent a replacement target. If a linked file was deleted with no successor, say so rather than pointing at the closest-looking file.

## Procedure

For each flagged link:

### 1. Read the upstream change

The flag carries the diff hunk in `evidence`. If it is absent or truncated, fetch the file at both refs before deciding. Do not infer from the path alone.

### 2. Read the entire page

Not the flagged line, not the section. The whole file.

This is the step most likely to be skipped. A concept usually appears in more than one place on a page: in its own section, in a list at the top, inside a diagram. Fixing only the flagged section leaves the other mentions stale, and can leave an in-page anchor pointing at a heading that no longer exists.

Before proposing an edit, search the page for every mention of the affected concept, including:

- table-of-contents or "on this page" lists
- headings, and any anchor that targets them
- code blocks, ASCII diagrams, and tables
- "Next steps" and cross-reference links

### 3. Decide whether the prose is actually wrong

Upstream refactors constantly. A function moving between files does not make a conceptual page inaccurate. Ask what the page claims, and whether that claim is still true. Only a false claim justifies an edit.

### 4. Propose the minimal edit

- If a heading changes, update every anchor that targets it. `cd docs && npx --yes mint@4 broken-links` validates page paths only. It does not check anchors, so a stale anchor ships silently.
- Anchor slugs: `.` becomes `-`, `/` is kept and percent-encoded as `%2F`, and smart punctuation rewrites heading text before slugging.
- Do not add a callout to announce the change.

### 5. Check which directory to edit

- Edit `docs/ibc-go/latest/`. It is the working tree and there is no `next` tier to keep in step.
- Never edit a frozen directory such as `docs/ibc-go/v10.1.x/`. It is a snapshot, and its links are correct for the version it documents. `docs/AGENTS.md` allows an edit there only to fix a critical error.

## Output

Propose everything as a batch. Do not apply edits until a maintainer approves the batch.

Per flag:

```
<doc>:<line>  [verdict]
  upstream:  what changed, one or two lines
  claim:     what the page currently asserts
  accurate:  yes | no
  edit:      the diff, or "none"
  also:      other places on the page touched by the same concept, or "none"
```

Then a summary: counts per verdict, and the `needs-decision` items with their options.

After approval, apply the edits, then verify with `cd docs && npx --yes mint@4 validate && npx --yes mint@4 broken-links` plus a manual check of any anchor whose heading changed.

## Review pass, mandatory before handing back

Any sweep that touches more than a handful of pages gets an independent review. Do not review your own work in the same context that produced it: have a separate reviewer read `git diff -- <page>` for each changed page (list them with `git status --porcelain`) and report problems only, without editing.

A bulk sweep fails in ways its author cannot see. Real defects only a review caught:

- A find-and-replace bumped a version-specific guide to the newest version, leaving "breaking changes in v0.54.0, see the Changelog" pointing at the v0.55 changelog.
- An automated line-mapper rewrote an anchor to a line that existed but held unrelated code, so the link still returned 200.

Give reviewers these flags:

1. Version mismatch. If the prose names a version, the link must match that version, not the newest one.
2. Display text carrying a line number that disagrees with the URL's `#L` anchor.
3. A changed line that now contradicts something else on the same page.
4. Prose that no longer parses, or a count that no longer matches the list beneath it.
5. Version-comparative phrasing introduced.
6. An em dash introduced.
7. Mechanical damage: a stray backtick or punctuation inside a URL, a half-replaced string, a broken markdown link, duplicated words.

And tell them what is deliberate, or they will report it:

- An older ref on an ADR page, which cites code as it stood at decision time.
- A dead URL shown as plain text or inline code rather than a link.
- A page under `migrations/` or `changelog/` keeping its own version's refs.

Expect false positives on the last group; an unlinked dead URL looks exactly like corruption. Triage every report against the page before acting, and treat it as a list of questions rather than a list of defects.

## Recording the work

Say what changed and why in the PR description, grouping a page's edits into one line. A flag that resolved to `no-change` or `needs-decision` is worth a line too, so the next person does not re-investigate it.
