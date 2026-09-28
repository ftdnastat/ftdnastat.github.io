# ftdnastat — FTDNA haplogroup statistics by country and region

**A visualisation of FamilyTreeDNA's public Y-DNA and mtDNA trees: where testers from every country and region land, with branch ages, signature clades and automatic findings.**

🌐 Language / Язык: **English** | [Русский](README.ru.md)

[![Pages build](https://github.com/ftdnastat/ftdnastat.github.io/actions/workflows/pages/pages-build-deployment/badge.svg)](https://github.com/ftdnastat/ftdnastat.github.io/actions/workflows/pages/pages-build-deployment)
[![Site version](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fftdnastat.github.io%2Fversion.json&query=%24.version&label=build&color=blueviolet)](https://ftdnastat.github.io/)
[![Last commit](https://img.shields.io/github/last-commit/ftdnastat/ftdnastat.github.io?label=updated)](https://github.com/ftdnastat/ftdnastat.github.io/commits)
[![Website](https://img.shields.io/website?url=https%3A%2F%2Fftdnastat.github.io%2F&label=site)](https://ftdnastat.github.io/)
[![License: MIT](https://img.shields.io/github/license/ftdnastat/ftdnastat.github.io)](LICENSE)

### 🔗 Open: **[ftdnastat.github.io](https://ftdnastat.github.io/)**

Static pages rebuilt from FamilyTreeDNA's public tree dumps.

---

## Features

### 🗺 Country and region index
288 countries and regions for Y-DNA and 273 for mtDNA, including the republics of Russia, sub-regions such as Catalonia or Sicily, and reported ethnic groups. Filters by group and sample size, a name search, and a stacked bar of the eight most common world macro-haplogroups per row.

### 🧬 Paternal line: cumulative tree of key clades
For each region, a tree of named clades from a curated dictionary: J1 → Z1842 → CTS1460, R1b → L23 → Z2103, G2a → P303 → L1264. Every row counts all kits below it, with the share of the region and the TMRCA age of the branch from FTDNA Discover.

### 🧬 Maternal line: most frequent branches
The most common mtDNA branches of the region (U5a, H13a, J2b) with counts, shares and, where known, the branch age from FTDNA's Mitotree.

### 🔎 Findings: recomputed on every build
Signature branches whose share in a region is more than three times the world share; countries with the most similar clade composition; regions whose paternal and maternal neighbours differ; young but widespread clades; ancient clades concentrated in one country; single-node clusters that betray surname projects; which countries test the father and which test the mother.

### 🔗 Shareable state, two languages, dark theme
Filters live in the URL hash, every country and each of its trees has a permanent address, each page has a Russian and an English twin. The site follows the system colour scheme and reads without JavaScript.

## Data and limitations

- A census of FamilyTreeDNA customers, not of populations: the country is the self-reported origin of the earliest known ancestor on that line. The US, Britain and Scandinavia are over-represented.
- Kits of unknown origin are excluded: about 61% of Y kits and 74% of mt kits.
- Nested clades are never shown side by side: tree rows are cumulative, and a kit not typed below a node is marked `J-M172*`. Samples under 50 kits are flagged and excluded from findings.
- “Italy (Aosta Valley)” is shown as Orstkhoy, a people closely related to the Chechens and Ingush who report that region because its flag resembles their own; sub-regions such as “Russia (Republic of Dagestan)” are separate from their parent.
- Branch ages are TMRCA midpoints, rounded to a century below 10,000 years and rounded up to a whole thousand above.

## How it works

The public Y-DNA and mtDNA Haplotree dumps supply per-node kit counts by country; FTDNA Discover supplies branch ages. A Node.js generator renders about 1,700 pages in both languages as plain HTML with CSS bars; an acceptance gate checks that a build is complete and no more than 5% smaller than the published one before it is pushed here. `version.json` holds the build manifest, `sitemap.xml` the `hreflang` alternates, `/data/` per-country JSON.

## Sources

- [FamilyTreeDNA Y-DNA Haplotree](https://www.familytreedna.com/public/y-dna-haplotree/) and [mtDNA Haplotree](https://www.familytreedna.com/public/mt-dna-haplotree/).
- [FamilyTreeDNA Discover](https://discover.familytreedna.com/) for TMRCA estimates and the Million Mito Project's Mitotree.

## About this repository

Only the generated site lives here; the generator, the clade dictionary and the acceptance tests are in a separate, private repository, and the next build overwrites the HTML. Corrections of country labels and requests for new findings are welcome in the issues.
