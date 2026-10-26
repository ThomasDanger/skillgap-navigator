# SkillGap Navigator data package

Copy sdgData.json into public/data/ and dataUtils.js into src/ in your React/Vite project. Load JSON once with fetch('/data/sdgData.json').then(r => r.json()). No runtime dependencies or live API needed.

## Included files
- sdgData.json: complete minified dataset, about 14 MB uncompressed; use static hosting compression.
- dataUtils.js: ES module for filters and exact country comparisons.
- catalog.json: all 96 geographic areas, 36 skill labels, and dimension descriptions.
- validation.json: validation counts.
- build_data.py: reproducible converter; requires openpyxl for reading the workbook only.
- test_data.mjs: run node test_data.mjs.

## Verified scope
Source: uploaded Copia de Goal4.xlsx, data and CodeDescriptions sheets, exported from https://unstats.un.org/sdgs/dataportal.
Indicator 4.4.1, series SE_ADT_ACTS, unit PERCENT, 2020–2025. This package uses that export, not a fresh live retrieval.
60,628 input and output observations; 96 geographic areas; 36 decoded skills. No rejected values, duplicate full observation keys, or missing skill labels. All numeric values within 0–100.
Year counts: 2020: 8,911; 2021: 11,210; 2022: 10,218; 2023: 14,275; 2024: 13,859; 2025: 2,155.
96 is export coverage, not all countries worldwide. Coverage varies by year, skill and demographic group.

## Schema
Top-level keys: schemaVersion, metadata, countries, skills, dimensions, sources, observations.
Countries have code/name; code is a zero-padded UN geographic code, NOT ISO alpha-3. Skills have code/label, decoded directly from CodeDescriptions. dimensions contains all workbook code dictionaries; sources is a deduplicated array of original source strings.
Each observation has countryCode, year, skillCode, age, sex, location, nature, reportingType, value, sourceId, sourceRow. sourceId indexes sources, zero-based. sourceRow is the original Excel row including header. Nonempty timeDetail, timeCoverage, upperBound, lowerBound, basePeriod, geoInfoUrl and footnote are preserved. Empty optional fields are omitted. Numeric values are not rounded. Constant indicator, series and unit are stored in metadata. metadata.sourceSha256 identifies the original workbook.

## Utility usage
Import compareCountries, availableCountries, latestCommonYear from './dataUtils.js'.
Choose an exact skill, e.g. filters = {skillCode:'ARSP', age:'ALLAGE', sex:'BOTHSEX', location:'ALLAREA'}.
availableCountries(data, filters) returns matching country options.
latestCommonYear(data, countryA, countryB, filters) returns the latest shared year or null. Never compare separate latest years silently.
compareCountries(data, countryA, countryB, {...filters, year}) returns a, b, status, differencePercentagePoints, notes, comparabilityWarning. The difference is A minus B. Missing observations and differences remain null.
getObservation requires skillCode/year and defaults to ALLAGE/BOTHSEX/ALLAREA. It throws on ambiguous results. No fallback to other demographics occurs.
skillGaps requires a year and returns each skill separately; shortfall is B minus A, with missing pairs retained as null. This is a comparator difference, not an official UN target gap.
filterObservations supports exact filters. availableYears returns sorted available years. Country codes accept numeric or padded strings.

## Display and comparability
Display country, exact skill label, year, demographic group, source, footnotes and time coverage where available. Render null as No data, never zero. Default total filters select 5,304 observations.
ALLAGE means All age ranges or no breaks by age. It does not guarantee equal survey age universes across countries; do not relabel it as 15+ or 15–74. Matching codes are necessary but do not establish identical survey questions, methods, populations or reference periods. Review source notes.
Do not average all rows into a national skill score, average demographic groups, or add different skill percentages. Individual activities and basic/above-basic competency levels remain separate. No missing observations are invented.
National data does not measure a user's personal skill or job readiness. Label learning recommendations as app-generated suggestions; keep personal quiz scores separate. No five-domain mapping or recommendation model is invented here.

## Rebuild
Run python3 SkillGap-data/build_data.py 'path/to/Copia de Goal4.xlsx' from the parent directory, then node SkillGap-data/test_data.mjs. Tests cover integrity, a known source observation, zero versus missing values, required filters, matching, and signed differences.
