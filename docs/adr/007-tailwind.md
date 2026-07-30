# ADR 007 — Styling: Tailwind CSS

Status: Accepted · 2026

## Problem

The dashboard needs a consistent, maintainable styling approach that's fast to build with,
produces a small bundle, works well with a component-based React app, and doesn't require
inventing a bespoke design system for a learning project.

## Options Considered

- **Tailwind CSS** — utility-first classes, design tokens via config, JIT + purge.
- **CSS Modules / plain CSS** — scoped styles, no framework.
- **CSS-in-JS (styled-components / Emotion)** — colocated dynamic styles.
- **Component libraries (MUI, Chakra, Ant)** — prebuilt components + theming.

## Decision

Use **Tailwind CSS** (with `clsx` + `tailwind-merge` for conditional/merged classes).

## Pros

- **Fast iteration** — style in markup without context-switching to CSS files; design
  tokens (colors/spacing) centralised in `tailwind.config.js`.
- **Small production CSS** — unused utilities are purged, so the shipped stylesheet stays
  tiny regardless of how many classes exist.
- Consistency by construction — a constrained scale prevents ad-hoc magic values.
- No runtime cost (unlike CSS-in-JS) and no opinionated component API to fight (unlike a
  full component library), which keeps the UI code easy to read/teach.

## Cons

- Markup can get **verbose** with long class lists (mitigated by `clsx`/`tailwind-merge`
  and extracting components).
- A learning curve for the utility vocabulary.
- You build components yourself (no prebuilt Table/Modal like MUI) — more initial work.

## Trade-offs

We trade prebuilt components (MUI/Chakra) and colocated dynamic styles (CSS-in-JS) for
**speed, a tiny bundle, and zero runtime overhead**, plus full control over the look. For a
portfolio/learning dashboard where showing clean, hand-built UI is part of the point,
Tailwind is the better fit; a component library would be a reasonable alternative if
delivery speed of complex widgets dominated.
