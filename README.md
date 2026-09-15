# @pedi-growth/core

Pediatric growth calculator — z-scores, percentiles, and nutritional classification for WHO, Down syndrome, and cerebral palsy charts.

Zero dependencies. Works in Node.js, browsers, and edge runtimes.

## Features

- **3 chart sets**: WHO standard, Down syndrome (Zemel 2015), Cerebral palsy (Brooks 2011)
- **6 growth indicators**: weight-for-age, length/height-for-age, BMI-for-age, head circumference-for-age, weight-for-length, weight-for-height
- **Full age range**: 0-19 years (WHO), 0-20 years (Down syndrome), 2-20 years (Cerebral palsy)
- **GMFCS-specific curves**: 36 LMS tables for cerebral palsy (6 GMFCS levels x 3 indicators x 2 sexes)
- **Prematurity correction**: gestational age (weeks + days) adjustment up to 2 years
- **Nutritional classification**: SISVAN/WHO cutpoints + CP-specific percentile-based classification
- **i18n**: pt-BR, en, es
- **LMS data**: 62 official tables embedded, lazy-loaded
- **194 tests** across 7 test suites

## Chart Sets

| Chart Set | Age Range | Indicators | Classification |
|-----------|-----------|------------|----------------|
| WHO Standard | 0-19 years | WFA, LFA/HFA, BFA, HCFA, WFL, WFH | SISVAN/WHO z-score cutpoints |
| Down Syndrome (Zemel 2015) | 0-20 years | WFA (0-18y), LFA (0-18y), BFA (0-18y), HCFA (0-20y) | SISVAN/WHO z-score cutpoints |
| Cerebral Palsy (Brooks 2011) | 2-20 years | WFA, HFA, BFA (per GMFCS level) | Percentile-based, GMFCS-stratified |

### Cerebral Palsy — GMFCS Levels

The CP chart set requires a GMFCS (Gross Motor Function Classification System) level:

| Level | Description |
|-------|-------------|
| `1` | Walks without limitations |
| `2` | Walks with limitations |
| `3` | Walks using hand-held mobility device |
| `4` | Self-mobility with limitations; may use powered mobility |
| `'5-oral'` | Transported in manual wheelchair; fed orally |
| `'5-tube'` | Transported in manual wheelchair; tube-fed |

### Cerebral Palsy — Nutritional Classification

Weight-for-age thresholds differ by motor function:

| GMFCS | Increased risk | Borderline | Adequate |
|-------|---------------|------------|----------|
| I-II | < P5 | P5-P10 | >= P10 |
| III-V | < P10 | P10-P20 | >= P20 |

Height-for-age and BMI-for-age use z-score thresholds:

| Z-score | Classification |
|---------|----------------|
| < -2 | Low |
| -2 to +2 | Adequate |
| > +2 | High |

## Install

```bash
npm install @pedi-growth/core
```

## Usage

```typescript
import { calculateZScore, calculateAll } from '@pedi-growth/core';

// Single indicator (WHO standard)
const result = await calculateZScore({
  indicator: 'weight-for-age',
  sex: 'male',
  ageInDays: 365,
  measurement: 9.5,
});
// -> { indicator: 'weight-for-age', zScore: -0.11, percentile: 45.6 }

// Full assessment (WHO standard)
const assessment = await calculateAll({
  sex: 'female',
  dateOfBirth: new Date('2024-06-15'),
  dateOfMeasurement: new Date('2025-06-15'),
  weight: 9.2,
  lengthHeight: 74.5,
  headCircumference: 45,
  gestationalAgeWeeks: 34, // optional — triggers prematurity correction
  gestationalAgeDays: 3,   // optional — days component (0-6)
});
// -> { age, results, classifications }

// Down syndrome charts
const dsResult = await calculateAll({
  sex: 'male',
  dateOfBirth: new Date('2024-01-01'),
  dateOfMeasurement: new Date('2025-01-01'),
  weight: 8.5,
  lengthHeight: 70,
  chartSet: 'down-syndrome',
});

// Cerebral palsy charts (requires GMFCS level)
const cpResult = await calculateAll({
  sex: 'male',
  dateOfBirth: new Date('2016-01-15'),
  dateOfMeasurement: new Date('2026-02-10'),
  weight: 25,
  lengthHeight: 125,
  chartSet: 'cerebral-palsy',
  gmfcsLevel: 3, // required for CP
});
// -> WFA, HFA, BFA with CP-specific classification
```

## API

### `calculateZScore(input): Promise<ZScoreResult | null>`

Calculate z-score and percentile for a single indicator.

**Options:**
- `chartSet`: `'who-standard'` (default) | `'down-syndrome'` | `'cerebral-palsy'`
- `gmfcsLevel`: `GmfcsLevel` (required when `chartSet` is `'cerebral-palsy'`)

### `calculateAll(input): Promise<AssessmentResult>`

Calculate all applicable indicators for a patient, including age calculation, prematurity correction, and nutritional classification.

### `computeZScore(measurement, lms): number`

Low-level z-score calculation from measurement and LMS parameters. Implements the WHO standard formula with L=0 handling and |Z|>3 extrapolation.

### `classify(result, ageInDays, chartSet?, gmfcsLevel?): Classification`

Classify a z-score result using SISVAN/WHO cutpoints (or CP-specific percentile thresholds when `chartSet` is `'cerebral-palsy'`).

### `CP_AGE_LIMITS`

Age limits in days for each CP indicator. All three indicators (WFA, HFA, BFA) span 731-7305 days (2-20 years).

```typescript
import { CP_AGE_LIMITS } from '@pedi-growth/core';

CP_AGE_LIMITS['weight-for-age']
// -> { minDays: 731, maxDays: 7305 }
```

### `ageInDays(dateOfBirth, dateOfMeasurement): number`

Calculate age in days between two dates.

### `correctedAgeInDays(chronologicalDays, gestationalAgeWeeks?, gestationalAgeDays?): number`

Apply prematurity correction (up to 2 years of age). The `gestationalAgeDays` (0-6) provides sub-week precision.

### `normalCdf(z): number`

Standard normal CDF (Abramowitz & Stegun approximation). Returns probability [0, 1].

### `loadTable(chartSet, indicator, sex, gmfcsLevel?): Promise<LmsRow[]>`

Load a raw LMS table. Useful for chart rendering. Tables are lazy-loaded and cached.

## Types

```typescript
type Sex = 'male' | 'female';

type ChartSet = 'who-standard' | 'down-syndrome' | 'cerebral-palsy';

type GmfcsLevel = 1 | 2 | 3 | 4 | '5-oral' | '5-tube';

type Indicator =
  | 'weight-for-age'
  | 'length-height-for-age'
  | 'bmi-for-age'
  | 'head-circumference-for-age'
  | 'weight-for-length'
  | 'weight-for-height';

type ClassificationSeverity =
  | 'very-low' | 'low' | 'adequate' | 'risk' | 'high' | 'very-high';
```

## Formulas

- **Standard**: `Z = ((measurement/M)^L - 1) / (L * S)`
- **When L=0**: `Z = ln(measurement/M) / S`
- **|Z| > 3**: WHO linear extrapolation method
- **Percentile**: Normal CDF (Abramowitz & Stegun approximation)

## Data Sources

- **WHO**: [WHO Anthro](https://github.com/WorldHealthOrganization/anthro) (0-5y) + [WHO AnthroPlus](https://github.com/WorldHealthOrganization/anthroplus) (5-19y), via `scripts/generate-who-data.mjs`
- **Down Syndrome**: Zemel BS, et al. *Growth Charts for Children With Down Syndrome in the United States.* Pediatrics. 2015;136(5):e1204-e1211. 421 of 458 LMS points come from [peditools](https://github.com/jhchou/peditools) (commit `450be01`); the remaining 37 — boys' head circumference from age 2 — come from the published **erratum** to Supplemental Table 18. Verify with `npm run verify:provenance`.
- **Cerebral Palsy**: Brooks J, et al. *Low weight, morbidity, and mortality in children with cerebral palsy: new clinical growth charts.* Pediatrics. 2011;128(2):e299-e307. LMS data extracted from [peditools](https://github.com/jhchou/peditools) (MIT, Copyright (c) 2025 Joseph H Chou, commit `450be01`). Dr. Brooks authorized educational and commercial use (2026-02-10).

## License

The **source code** is MIT-licensed — see [`LICENSE`](LICENSE).
Copyright (c) 2026 Iuri Leão de Almeida.

**The embedded growth-reference datasets are not covered by the MIT licence.** They come
from third parties and carry their own terms, which differ per chart set:

| Chart set | Data rights | Cleared for commercial reuse? |
|---|---|---|
| WHO | GPL-3.0 source repo / CC BY-NC-SA 3.0 IGO policy | **Unresolved** — seek advice |
| Cerebral palsy (Brooks) | MIT (peditools) + author's written permission | **Yes**, per Dr. Brooks, 2026-02-10 |
| Down syndrome (Zemel) | (c) American Academy of Pediatrics | **No** — seek AAP permission |

Read [`NOTICE.md`](NOTICE.md) before redistributing this package or building a commercial
product on it. Provenance questions are welcome as issues.
