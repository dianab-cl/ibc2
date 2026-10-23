# AGENTS.md — the docs tree

The Mintlify site lives here. `docs/` is the site root: Mintlify resolves every
page path relative to `docs/docs.json`, and nothing above `docs/` is reachable
from the site.

## Layout

| Path | What it is |
|---|---|
| `docs.json` | Navigation and theme. **Cannot move** — this file defines the site root. |

Navigation is five `tabs`, which Mintlify renders as a horizontal bar:
**Learn** (14 — the protocol, its applications and light clients, plus the site's
landing page), **IBC CLI** (7 — get started, run the services, reference),
**IBC-Solidity** (6 — the contracts), **IBC-Go** (`latest` and `v10.1.x`, via a
`versions` block nested inside the tab) and **Specification** (42 generated
pages, grouped by section).

The split is by subject, not by task: each tab answers "what am I reading
about?". The Learn → Build journey is carried by the cards on `index.mdx`, which
is what a landing page is for. Mintlify's own docs only show `versions`
containing `tabs`; the reverse also validates and is what this site uses, so a
version switcher appears on the ibc-go tab alone.

| `ibc/` | This monorepo's docs. Unversioned, tracks `main`. |
| `ibc-go/latest/` | ibc-go docs. Edit here. |
| `ibc-go/v10.1.x/` | Frozen. Do not edit except to fix a critical error. |
| `ibc/spec/` | **Generated** from the repo's `spec/`. Never edit by hand. |
| `scripts/` | Generators that read repo source code. |
| `mintlify/` | Site machinery: stylesheet, images, brand assets, versioning scripts, and `DEPLOYMENT.md`, the deploy runbook. |
| `README.md` | What this directory is, for a human arriving from the repo root. |
| `package.json` | Pins the Mintlify CLI and defines `dev` and `broken-links`. |
| `.mintignore` | Paths Mintlify must not publish. Everything here that is not a page needs an entry, or it becomes a live URL. |

## Rules

- **No Solidity in `ibc-go/`.** It documents the Go implementation. Link to
  `ibc/06-ibc-solidity-contracts/` instead.
- **Never hand-edit `ibc/spec/`.** Edit `spec/` at the repo root and regenerate.
- **Numbered prefixes** order the hand-authored pages under `ibc/`: directories
  `01-introduction/`, `02-how-ibc-works/` …, files `01-`, `02-` within each.
  The numbers are a sort key for reading the repo on GitHub — Mintlify takes
  navigation order from `docs.json`, not from filenames.

  **To insert a page, append a letter to the one before it**: a page between
  `02-` and `03-` is `02a-`; between `02a-` and `03-` is `02b-`; between `02a-`
  and `02b-` is `02aa-`. Nothing else is renamed.

  **Never renumber to tidy up.** Mintlify has no slug field, so the number is
  part of the URL — `/ibc/02-how-ibc-works/05-relayer`. Renumbering changes
  URLs and needs a redirect for each one. A directory reading `01, 02, 02a, 03,
  07` is healthy; the numbers are a sort key, not a count.

  A letter rather than `02.1-` or `02-1-` is deliberate. Both of those sort
  wrongly: `02.10` lands before `02.2`, and a digit after the hyphen sorts
  before the slug's first letter, so `02-1-prereq` jumps ahead of `02-overview`.
  Letters need no zero-padding and keep the URL free of dots.

  `ibc/spec/` is generated and `ibc-go/` is imported, so neither is numbered —
  numbering them would mean changing the canonical `spec/` or diverging from
  the upstream the importer re-runs against.

  After any rename run `node docs/mintlify/scripts/check-nav.js` and
  `npx --yes mint@4 broken-links`.
- There is no `next/` tier. Document unreleased features in `latest/` with a
  version callout.

## Generators

| Script | Reads | Writes |
|---|---|---|
| `scripts/refgen.py` | `cli/`, `proto/`, `gen/` | CLI reference tables in `ibc/05-ibc-cli/` |
| `scripts/specgen.py` | `spec/` | `ibc/spec/` |

Both have a `--check` mode that CI runs. After changing `cli/`, `proto/` or
`gen/`, follow `scripts/AGENTS.md`.

Site tooling — version freezing, link checking — is in `mintlify/scripts/`.

## Running it

```bash
cd docs && npm install && npx mint@4 dev
```
