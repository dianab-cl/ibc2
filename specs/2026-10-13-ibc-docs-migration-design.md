# IBC docs site migration — design

Date: 2026-10-13
Linear: [FOU-1874](https://linear.app/cosmoslabs/issue/FOU-1874/ibc-docs-site-migration)
Status: approved for planning

## Goal

Stand up a Mintlify documentation site inside `cosmos/ibc` that serves both this
monorepo's own docs and the ibc-go docs migrated out of `cosmos/docs`.

Success for this phase is local and CI-verifiable: `npx mint dev` renders the
complete site, `mint broken-links` passes, and existing repo CI stays green.

## Non-goals

- No hosted deployment. Creating the Mintlify project and pointing a domain at
  it requires dashboard access and is handed off separately.
- No changes to `cosmos/docs`. It keeps serving `/ibc/*` until a later cutover
  PR deletes that tree and installs redirects.
- No versioning of the monorepo docs. They track `main` until this repo cuts
  releases that people pin to.

## End-state layout

```
docs/                              # Mintlify site root (Git Settings path: /docs)
├── AGENTS.md                      # map of the tree, rules, how to run it
├── docs.json                      # pinned here: this file defines the site root
├── package.json                   # mint ^4.2.7
├── ibc/                           # monorepo docs — unversioned, tracks main
│   ├── introduction/
│   ├── how-ibc-works/
│   ├── applications/
│   ├── light-clients/
│   ├── ibc-solidity-contracts/
│   └── ibc-cli/
├── ibc-go/
│   ├── latest/                    # living
│   └── v10.1.x/                   # frozen: noindex + canonical → latest
├── scripts/                       # refgen.py, its tests, probe fixtures, AGENTS.md
└── mintlify/
    ├── versions.json              # version registry read by the freeze scripts
    ├── style.css
    ├── snippets/
    ├── images/
    ├── assets/brand/
    └── scripts/                   # version-manager, tag-archived,
                                   #   check-github-refs, verify-links-live
```

`docs.json` cannot move. Mintlify resolves every page path relative to the
directory containing it, and nothing can sit above that directory — nav entries
are relative and never use `../` (verified: zero occurrences across 192k
characters of `cosmos/docs` navigation). Mintlify's monorepo support is a single
Git Settings path that sets both the config location and the content root.

Directory nesting does not affect URLs. `docs/ibc-go/latest/intro.mdx` serves at
`/ibc-go/latest/intro`.

## Products and versioning

Two top-level products with independent release cadences and separate navbar
dropdowns:

- `ibc/` — this monorepo (protocol, Solidity contracts, CLI, light clients).
  Unversioned.
- `ibc-go/` — the Go implementation. `latest` plus frozen tagged snapshots.

### No `next` tier

The old site carried `next/` and `latest/` tiers kept in sync by
`sync-next-to-latest.js`. Measurement shows the tier earns nothing: of 162 files
present in both `ibc/next/` and `ibc/latest/`, **159 differ only in
`noindex`/`canonical` frontmatter and `/ibc/next/` vs `/ibc/latest/` link
paths**. Three have real content differences (`intro.mdx`, `adr.template.mdx`,
`middleware/rate-limit-middleware/migration.mdx`). Nothing exists in `latest/`
that is absent from `next/`.

The model is therefore `latest` plus tagged snapshots. Unreleased features are
documented in `latest` with a version callout.

### Freeze procedure

Cutting `vX.Y.x` copies `ibc-go/latest/` to `ibc-go/vX.Y.x/`, stamps the copy
with `noindex: true` and `canonical:` pointing at the `latest` equivalent, and
updates `docs.json` nav and `versions.json`. This is `version-manager.js` with
its `next/` → `latest/` step removed.

A stable `latest/` URL is what preserves search ranking across version bumps;
archived versions point search engines back at it.

## Content sources

| Destination | Source | Transformation |
|---|---|---|
| `docs/ibc/**` | this repo's `docs/*.md` (36 files) | `.md` → `.mdx`; frontmatter added; number prefixes dropped |
| `docs/ibc-go/latest/**` | `cosmos/docs` `ibc/next/` | minus dropped trees; Solidity stripped; version and image paths rewritten |
| `docs/ibc-go/v10.1.x/**` | `cosmos/docs` `ibc/v10.1.x/` (189 files) | copied; stamped `noindex` + `canonical` |
| `docs/ibc-go/latest/apps/gmp.mdx` | `ibc/next/apps/gmp/gmp.mdx` | rewritten Go-only |
| `docs/ibc-go/latest/light-clients/attestation/` | `ibc/next/light-clients/attestation/` | rewritten Go-only |
| `docs/mintlify/images/` | `cosmos/docs` `ibc/images/` (49 files, 7MB) | pruned to referenced files; deduped across `latest` and `v10.1.x` |
| `docs/mintlify/snippets/` | `cosmos/docs` `snippets/` (14 files) | pruned to components IBC pages reference |

Approximately 450 files total.

### File naming

No number prefixes. Mintlify takes nav order from `docs.json`, not filenames, and
serves the literal path as the URL — so a prefix buys no ordering and costs URL
noise plus rename churn on every insertion. This matches the existing site:
25 of 2936 `.mdx` files in `cosmos/docs` carry a number prefix (0.85%), and those
25 are a single imported tree.

`docs/README.md` remains the ordered index for browsing the repo on GitHub.

### Dropped content

Four trees exist only in `ibc/next/` and are not ibc-go material. This repo's own
docs already cover the same subjects:

- `infra/` (attestor, relayer)
- `learn/`
- `apps/ift/`
- `cosmos-evm/` (10 files, including the numbered walkthrough)

### Go-only rewrites

Two pages come across but are rewritten rather than adapted, because their
substance is Solidity:

- `gmp.mdx` — 382 lines, 27 Solidity references against 8 Go. The protocol
  narrative and structure are reusable; data structures and examples are
  rewritten from `ibc-go/modules/apps/27-gmp`.
- `attestation-light-client.mdx` — 9 Solidity references, same treatment.

**Invariant: no Solidity in `docs/ibc-go/**`.** Cross-references point at
`docs/ibc/ibc-solidity-contracts/` instead. Verified by grep before merge.

This is the only genuine authoring work in the migration and the most likely
thing to hold up review. Everything else is mechanical.

## Tooling

Ported to `docs/mintlify/scripts/`:

- `version-manager.js` — freeze, adapted to drop the `next/` step
- `tag-archived.js` — stamps `noindex` + `canonical` on frozen trees
- `check-github-refs.js` and its test suite — catches rotted GitHub permalinks
- `verify-links-live.js`
- link validation

Not ported — `cosmos/docs`-wide concerns with no counterpart here:
`sheets-manager.js`, `sync-security-docs.js`, `manage-changelogs.js`,
`restructure-navigation.js`.

### Navigation

`docs.json` is hand-written. Mintlify has no folder-based sidebar generation;
the only automatic navigation is for OpenAPI specs and SDK artifacts.

CI verifies the two drift conditions that actually bite: every `.mdx` appears in
nav, and every nav entry resolves to a file. Generating nav from frontmatter or
per-directory metadata is deferred until hand-maintenance becomes a burden.

### refgen relocation

`refgen.py` (171KB) generates CLI reference tables from `cli/`, `proto/` and
`gen/`, writing them into three reference pages between `GEN:` markers. It moves
from `docs/6-ibc-cli/tools/` to `docs/scripts/`. Three things must change
together:

1. **`refgen.py:89-90` computes the repo root with four nested `dirname()` calls
   from `__file__`.** At `docs/scripts/refgen.py` the correct count is three.
   Getting this wrong fails silently — the script resolves a wrong root and stops
   finding `cli/`, `proto/` and `gen/` rather than erroring.
2. `PROBE_FIXTURES` resolves from `dirname(__file__)`, so `probe-config.yml` and
   `probe-config-otel.yml` must move with the script.
3. Roughly 17 hardcoded `docs/6-ibc-cli/...` strings across `refgen.py`,
   `AGENTS.md` and `REFERENCE.md` need updating, including the guidance string at
   `refgen.py:3229`.

The script already accepts page paths as arguments and its docstring already
shows `.mdx` targets, so pointing it at the new pages needs no code change.

`docs/scripts/` sits inside the site root, so `AGENTS.md`, `AUDIT.md` and
`REFERENCE.md` (~25KB) will appear in the site tree unlisted in nav and Mintlify
will warn on each build. This is an accepted cost, recorded here so it is not
later mistaken for a defect.

## CI changes

**`.licenserc.yaml` must gain `docs/**` ignores.** It currently ignores
`docs/**/*.md` but not `.mdx`, `.css`, `.js` or `.png`. Without this,
`license-headers.yml` fails on every converted file. This belongs in the first
commit, before any conversion.

`docs/scripts/*.py` currently carries SPDX headers under the catch-all `**` rule.
Moving those files must preserve the headers.

New workflow: `npx mint broken-links` plus the nav drift check, on PRs touching
`docs/`.

Existing references to update: `.github/PULL_REQUEST_TEMPLATE.md:28`,
`.github/ISSUE_TEMPLATE/release-tracker.md:49`, and `.gitignore:19` (which names
`docs/6-ibc-cli/tools`).

## Discoverability

Two `AGENTS.md` files, cross-linked:

- `docs/AGENTS.md` — what each directory holds, that `docs.json` is pinned,
  where both script sets live and what each reads, how to run the site locally,
  the `latest` vs. frozen rules, and the no-Solidity invariant.
- `docs/scripts/AGENTS.md` — the existing 11KB refgen procedure, repathed.

This follows the existing `cli/AGENTS.md` and `cli/CLAUDE.md` pattern.

## Delivery

One pull request, built as five sequential commits so review and revert can
operate per step:

1. **Scaffold** — `docs.json`, `package.json`, `style.css`, snippets, assets,
   CI workflow, `.licenserc.yaml` fix, refgen move and path fixes, both
   `AGENTS.md` files. `mint dev` runs.
2. **Monorepo docs** — 36 `.md` → `.mdx` under `docs/ibc/`, nav wired.
3. **ibc-go `latest`** — scripted import, Solidity strip, link and image path
   rewrites.
4. **ibc-go `v10.1.x`** — frozen import, `noindex`/`canonical` stamping,
   versioning scripts.
5. **GMP and attestation** — the two Go-only rewrites.

The import is scripted rather than hand-copied so it can be re-run if
`cosmos/docs` changes before merge.

## Acceptance criteria

- `npx mint dev` renders every page in nav, both products, all versions.
- `npx mint broken-links` reports zero broken links.
- `grep -ri solidity docs/ibc-go/` returns only explicit cross-references into
  `docs/ibc/ibc-solidity-contracts/`. No Solidity code blocks, type definitions,
  contract names or `solidity-ibc-eureka` source links.
- Every `.mdx` under `docs/ibc/` and `docs/ibc-go/` appears in `docs.json` nav;
  every nav entry resolves to a file.
- `license-headers.yml`, `pr-lint.yml` and the rest of existing CI pass.
- `python3 docs/scripts/refgen.py all --check` passes from the new location.
- Every page in `docs/ibc-go/v10.1.x/` carries `noindex: true` and a `canonical:`
  pointing at its `latest` equivalent.

## Risks

**Silent refgen breakage.** The `dirname` chain fails by computing a wrong path,
not by raising. Mitigated by running `refgen.py all --check` in commit 1 as a
gate rather than a smoke test.

**Repo weight.** `v10.1.x` adds roughly 20MB and 189 files of material nobody
will edit. Accepted deliberately: people run v10 in production, and carrying it
is what allows the old site to be retired. Image dedup between `latest` and
`v10.1.x` should recover part of this; measure before assuming a number.

**Source drift.** `cosmos/docs` may change between import and merge. Mitigated by
keeping the import scripted and re-runnable.

**Review stall on the rewrites.** The GMP and attestation pages need subject
matter review that the rest of the PR does not. They are last in the commit
order so the mechanical work can be reviewed independently.

## Open items

- **Deployment.** Who creates the Mintlify project, and which domain. Requires
  dashboard access. A handoff checklist is a deliverable of this work.
- **Redirects.** The `/ibc/next/*` and `/ibc/latest/*` → new-URL map belongs to
  the cutover PR that deletes the tree from `cosmos/docs`.
- **Landing page.** `next/intro.mdx` carries a newer card-based design than
  `latest/`. Use the newer one, adjusted for the two-product split.

## Evidence

Measurements taken 2026-10-13 against `cosmos/docs` at its then-current `main`
and `cosmos/ibc` at `c60e3414`.

- `ibc/` in `cosmos/docs`: 68MB, ~940 files across 9 version directories.
- `ibc/next/`: 186 `.mdx`, 25 png, 10 excalidraw, 1 md.
- `next/` vs `latest/`: 162 shared files, 159 differing only in frontmatter and
  version link paths, 3 with real content differences, 0 files present only in
  `latest/`, 6 trees present only in `next/`.
- Number-prefixed paths site-wide: 25 of 2936 `.mdx`.
- `../` in `cosmos/docs` navigation: 0 occurrences in 192,329 characters.
