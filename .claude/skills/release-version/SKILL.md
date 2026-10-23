---
name: release-version
description: Use when freezing the ibc-go docs for a release, that is archiving docs/ibc-go/latest/ as a vX.Y.x directory, or when running docs/mintlify/scripts/version-manager.js. Covers the ordered pre-freeze checks, the freeze itself, what the script does and does not do to docs.json, and the checks to run afterwards. Not for the unversioned ibc docs.
---

# Freezing a docs version

Read `docs/mintlify/DEPLOYMENT.md` ("First real freeze") alongside this. It records the same known risks; keep the two consistent when either changes.

## How this site versions

- `ibc` (`docs/ibc/`) is unversioned and tracks `main`. It is never frozen.
- `ibc-go` has `docs/ibc-go/latest/` as the working tree and `docs/ibc-go/vX.Y.x/` as frozen snapshots (today `v10.1.x`).
- There is no `next` tier. Unreleased material is written into `latest/` with a version callout. So a freeze is `latest/` to `vX.Y.x/`, and `latest/` is left in place and keeps going as the working tree. It is not a promotion.
- The registry is `docs/mintlify/versions.json`. `latestDisplayVersion` is the label `latest/` currently carries (today `v11.0.x`). The freeze archives `latest/` under that label by default, then sets the label to the new version you give it.

The mental model: `ARCHIVE_VERSION` is what the content in `latest/` is right now; `NEW_DISPLAY_VERSION` is what it becomes the working tree for.

## Know the risks before running it

1. **The script has been smoke-tested but never run for real.** Treat the first real freeze as the test. Do it on a clean branch with nothing else in the working tree, so `git status` afterwards shows only the freeze.
2. **It rewrites `docs/docs.json` with `JSON.stringify`.** The first real run produces roughly 600 lines of reformatting that will bury the actual change (one new archive entry in the IBC-Go dropdown). Either land a formatting-only commit of `docs.json` first, produced by the same `JSON.stringify(x, null, 2)` formatting, or review the diff with whitespace ignored (`git diff -w`).
3. **It writes two non-page files into the archive**: `.version-frozen` and `.version-metadata.json` under `docs/ibc-go/<version>/`. Both are listed in `docs/.mintignore` so Mintlify does not publish them. Confirm that is still true before the freeze; a missing entry makes them live URLs.
4. **It overwrites.** `rm -rf` on the target archive directory runs before the copy. Do not reuse a label that already exists, and do not run it with uncommitted edits to the archive you want to keep.

## Procedure

Complete these in order. All paths are from the repository root.

### 1. Update version-pinned content in `latest/`, before freezing

Whatever is in `latest/` at the moment of the freeze becomes the snapshot. Anything still wrong is frozen into the archive and then, by the rule that frozen directories are not edited, stays wrong. Fixing it first also means one pass instead of two.

**Changelog.** `docs/ibc-go/latest/changelog/release-notes.mdx` is maintained by hand; the changelog generator from cosmos/docs was not ported. Check that it covers the version about to be archived, including the version named in its intro callout.

**GitHub links pinned to a release branch.** Pages link into `cosmos/ibc-go` at `release/vN.N.x`. Those refs do not follow a freeze. Run the checker rather than a find-and-replace. It reads the shipping ref from `latestDisplayVersion`, which at this point is still the outgoing version, so this run validates that the snapshot is accurate against its own release:

```bash
node docs/mintlify/scripts/check-github-refs.js --product ibc-go --targets latest --json /tmp/flags.json
```

Review the report. Hand the `--json` output to the `update-stale-refs` skill, which decides whether a flagged link means the page's prose needs a correction. Only use `--fix` after reading that skill's caveat about `migrations/` pages, since the checker's version-specific list does not yet cover them. Set `GITHUB_TOKEN` to avoid API rate limits.

A stale ref is often a symptom. A link that 404s at its current ref usually means the prose describes something upstream deleted, so check what the page claims before repointing the URL.

**Do not start the next version's content yet.** New pages for the incoming version (a `v11-to-v12` migration guide, new feature docs) belong after the freeze. Added before it, they are copied into the archive.

### 2. Freeze

```bash
cd docs/mintlify/scripts
NON_INTERACTIVE=1 SUBDIR=ibc-go ARCHIVE_VERSION=v11.0.x NEW_DISPLAY_VERSION=v12.0.x npm run freeze
```

`ARCHIVE_VERSION` may be omitted; it defaults to `latestDisplayVersion`. Both labels must match `v<major>.<minor>.<patch|x>`, for example `v11.0.x`.

What the script does for you:

- copies `docs/ibc-go/latest/` to `docs/ibc-go/<ARCHIVE_VERSION>/` and rewrites internal `/ibc-go/latest/` links in the copy to `/ibc-go/<ARCHIVE_VERSION>/` (external URLs, including GitHub links, are left alone)
- stamps every archived page with `noindex` and a site-relative canonical, by calling `tag-archived.js`
- **adds the archive entry to the IBC-Go dropdown in `docs/docs.json`**, cloned from the `latest` entry with paths rewritten, keeping `latest` first and archives newest-first
- updates `docs/mintlify/versions.json` (adds the archive, sets `latestDisplayVersion` to `NEW_DISPLAY_VERSION`)
- writes `.version-frozen` and `.version-metadata.json` into the archive

It leaves `docs/ibc-go/latest/` untouched.

### 3. The edits the script does not do

- **Inspect the `docs.json` diff.** Confirm the new archive entry is there, `latest` is still first, the archive carries no `tag` or `hidden`, and no other dropdown changed. The script finds the dropdown by label (`IBC-Go`); if the label in `docs.json` is ever renamed, update `DROPDOWN_LABELS` in `version-manager.js` or the script throws.
- **Navigation for new content.** Any page you add to `latest/` for the new version needs a `docs.json` entry in the `latest` navigation. The script does not add pages.
- **GitHub refs in `latest/` for the new version.** After the freeze, `versions.json` says `NEW_DISPLAY_VERSION`, so the checker now targets the new release branch. Once that branch exists upstream, run the same checker command from step 1 against `latest` and adjudicate. If the branch does not exist yet, the tree fetch fails and the links come back `unassessed`; wait for the branch rather than forcing it. Never point the checker at the archive: its refs correctly name the version it documents.
- **Redirects.** If the freeze changes any published path, or `cosmos/docs` redirects are in flight, check `docs/mintlify/DEPLOYMENT.md` ("Redirect cutover").

### 4. Verify

```bash
node docs/mintlify/scripts/check-canonicals.js
node docs/mintlify/scripts/check-nav.js
node docs/mintlify/scripts/check-github-refs.test.js
cd docs && npx --yes mint@4 validate && npx --yes mint@4 broken-links
```

Run `mint validate` and `broken-links` after the first freeze in particular; they are the gates nothing else substitutes for. Use `mint@4` explicitly: a stale global `mint` lacks `validate` and silently skips it. Note that `broken-links` checks internal page paths only. It does not validate heading anchors and it does not check external URLs, so a dead or misdirected GitHub link passes it.

Then confirm by eye: the version switcher offers `latest` and the new archive, an archived page shows `noindex` and a canonical pointing at the matching `latest` page, and `git status` shows `.version-frozen` and `.version-metadata.json` inside the archive and nowhere else.

## Scripts in `docs/mintlify/scripts/`

Chosen home: this skill, because `version-manager.js` and its helpers are the release workflow. Several scripts were carried over from `cosmos/docs` and are not all wired in.

| Script | Purpose | Status |
|---|---|---|
| `version-manager.js` | The freeze (`npm run freeze`). | Used; see above. |
| `tag-archived.js` | Stamps archived pages with `noindex` and a canonical. | Used, called by `version-manager.js`. Carried from cosmos/docs, not independently adapted. |
| `check-canonicals.js` | Verifies archive canonicals and `noindex`. | Wired into CI (`docs.yml`). |
| `check-nav.js` | Verifies `docs.json` navigation matches the pages on disk. | Wired into CI (`docs.yml`). |
| `check-github-refs.js` and `.test.js` | Finds, adjudicates and bumps GitHub refs in `latest/`. | Run by hand at freeze time. |
| `verify-links-live.js` | Checks links against the live site. | Unwired. Carried over, not adapted. |
| `sync-latest-to-next.js` | Copies `latest/` pages to `next/`. | Unwired and **not adapted to this repo**. |

`sync-latest-to-next.js` is carried for a possible future `next/` tier. This repo has no `next` tier. Its usage text still names `sdk/latest/` and `next/`, and its `REPO_ROOT` resolves to `docs/mintlify`, not `docs/`, so running it now would fail. Fix `REPO_ROOT` and the product list before using it.
