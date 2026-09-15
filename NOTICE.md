# NOTICE — Provenance and rights of the embedded reference data

The **source code** of `@pedi-growth/core` is licensed under the MIT License
(see [`LICENSE`](LICENSE)), Copyright (c) 2026 Iuri Leão de Almeida.

**The MIT License covers the code only.** It does not, and cannot, re-license the
growth-reference datasets embedded in `src/data/`. Those tables originate from third
parties and carry their own terms, described below. Anyone redistributing this package
or building on it — particularly for commercial use — should evaluate these terms
independently.

Every figure below was verified against the cited source; the verification method is
given so it can be reproduced rather than taken on trust.

---

## 1. WHO Child Growth Standards and WHO Reference 2007

**Files:** `wfa-*`, `hfa-*`, `lhfa-*`, `bfa-*`, `hcfa-*`, `wfl-*`, `wfh-*` (18 tables)

- **0–5 years:** WHO Child Growth Standards (2006)
- **5–19 years:** WHO Reference 2007 for school-age children and adolescents

**Extraction:** `scripts/generate-who-data.mjs`, reading `data-raw/growthstandards/`
from the WHO's own R packages:
[`WorldHealthOrganization/anthro`](https://github.com/WorldHealthOrganization/anthro)
and [`WorldHealthOrganization/anthroplus`](https://github.com/WorldHealthOrganization/anthroplus).

**Rights — unresolved; see the caveat.**
Both repositories are published by the WHO under **GPL-3.0**, with the World Health
Organization named as copyright holder. Separately, the WHO's general publishing policy
applies **CC BY-NC-SA 3.0 IGO** to its publications, under which commercial use requires
explicit permission.

> **Caveat.** It is not settled here which of these instruments governs the LMS tables
> themselves, as distinct from the R code that reads them. A common argument holds that
> tables of measured facts attract thin or no copyright protection (*Feist v. Rural
> Telephone Service*, 499 U.S. 340 (1991); in Brazil, Lei 9.610/98 protects a database's
> selection and arrangement rather than the underlying facts). That is an argument, not
> a legal opinion, and no counsel has reviewed it. **Commercial redistributors should
> obtain their own advice or seek permission from WHO Press directly.**

**Attribution requested when reusing:**
> WHO Child Growth Standards. Geneva: World Health Organization; 2006.
> WHO Reference 2007. Geneva: World Health Organization; 2007.

---

## 2. Cerebral palsy charts — Brooks 2011

**Files:** `cp1-*` through `cp5tf-*` (36 tables)

**Publication:** Brooks J, Day S, Shavelle R, Strauss D. *Low weight, morbidity, and
mortality in children with cerebral palsy: new clinical growth charts.*
Pediatrics. 2011;128(2):e299–e307.

**Extraction:** `scripts/convert-brooks-cp-data.mjs`, from
[`jhchou/peditools`](https://github.com/jhchou/peditools) at pinned commit
`450be0147cfc71a3002c2efe746f98601f2c2396`.

**Rights:**
- *peditools* is MIT-licensed (`DESCRIPTION`: `License: MIT + file LICENSE`),
  Copyright (c) 2025 Joseph H Chou. GitHub's license detector reports "Other" because
  the `LICENSE` file is the R-conventional stub holding only `YEAR` and
  `COPYRIGHT HOLDER`; the full MIT text is distributed alongside it.
- **Dr. Jon Brooks confirmed by email on 2026-02-10 that the data may be used freely for
  both educational and commercial purposes.** This permission was granted to Iuri Leão de
  Almeida for this package.

---

## 3. Down syndrome charts — Zemel 2015

**Files:** `ds-*` (8 tables, 458 LMS points)

**Publication:** Zemel BS, Pipan M, Stallings VA, et al. *Growth Charts for Children
With Down Syndrome in the United States.* Pediatrics. 2015;136(5):e1204–e1211.

**Provenance — verified point by point:**

| Subset | Points | Source |
|---|---|---|
| All tables except boys' head circumference ≥ 2 y | **421** | `jhchou/peditools` @ `450be01`, series `zemel_2015_infant` and `zemel_2015_pedi` — L, M and S identical to 9 decimal places |
| Boys' head circumference, 2–20 y (`ds-hcfa-boys-0-18.json`) | **37** | **Official erratum** to Zemel 2015, Supplemental Table 18, which corrects errors in the published L, M, S parameters. peditools does not carry the erratum values. |

Verification is reproducible via `scripts/verify-zemel-provenance.mjs`.

**Rights:**
- The peditools-sourced portion carries the MIT terms in §2 above.
- The underlying growth charts are the work of Zemel et al., published in *Pediatrics*,
  **Copyright © 2015 American Academy of Pediatrics**.
- **Unlike the Brooks data, no direct authorisation from the authors or from the AAP has
  been obtained for this package.** Parties intending commercial redistribution of the
  Down syndrome tables should seek permission from the AAP.

---

## Summary

| Chart set | Code licence | Data rights | Cleared for commercial reuse? |
|---|---|---|---|
| WHO | MIT | GPL-3.0 repo / CC BY-NC-SA 3.0 IGO policy | **Unresolved** — seek advice |
| Cerebral palsy (Brooks) | MIT | MIT (peditools) + author's written permission | **Yes**, per Dr. Brooks, 2026-02-10 |
| Down syndrome (Zemel) | MIT | © AAP; no direct permission obtained | **No** — seek AAP permission |

Questions about provenance or licensing: open an issue, or contact the maintainer.

_Last reviewed: 2026-09-15._
