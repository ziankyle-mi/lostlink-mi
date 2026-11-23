# LostLink Design Tokens & Visual World (`mockup-v1`)

Locked visual system derived from the chosen [`mockup-v1`](mockup-v1/index.html) prototype.

---

## 1. Color Palette

| Role | Token | Value | Usage |
| :--- | :--- | :--- | :--- |
| Primary Canvas | `--p-bg` | `#f6f7f2` | Page background, clean feed surfaces |
| Secondary Surface | `--p-surface` | `#ecefe7` | Subtle panels, filter bars, secondary containers |
| Primary Ink | `--p-ink` | `#0a0a0a` | Headings, body copy, strong labels |
| Muted Ink | `--p-muted` | `#454545` | Subtitles, metadata, timestamps |
| Primary Brand / Action | `--p-accent` / `--p-action` | `#1f6b3a` | Primary CTAs, active tabs, focus rings |
| Action Text | `--p-accent-ink` | `#ffffff` | Text on `#1f6b3a` surfaces |
| Inverse Ground (Dark) | `--p-inv-bg` | `#0a0a0a` | High-contrast dark sections & security pillar |
| Inverse Accent (Lime) | `--p-inv-accent` | `#daef8a` | Highlights and focus accents on dark grounds |
| Selection Highlight | — | `#daef8a` / `#0a0a0a` | Native browser text selection (`::selection`) |

---

## 2. Typography

- **Display & UI Sans (`--font-display` / `--font-text`)**: `"Outfit", system-ui, sans-serif` (weights `400–700`, heading tracking `-0.03em`).
- **Monospace (`--font-mono`)**: `"DM Mono", ui-monospace, monospace` (used exclusively for reference codes `LL-4821`, domain tags `@dlsau.edu.ph`, building labels).

---

## 3. UI & Accessibility Floor

- **Single Border or Shadow Elevation**: Avoid nesting bordered cards inside bordered cards; use crisp `1px` structural lines over blurry shadows.
- **No Decorative Eyebrows**: Headings carry their own weight without tiny uppercase labels above them.
- **Minimum Touch Targets**: `44×44px` minimum height/width on all buttons, inputs, links, and checkbox hit areas.
- **Mobile First**: Zero horizontal overflow (`scrollWidth <= innerWidth`) verified at `390px` and `320px`.
