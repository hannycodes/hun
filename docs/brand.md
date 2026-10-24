# Brand and design system

**Status:** Provisional. Colours and typography are design recommendations, not installed dependencies.

## Wordmark

The logo is the lowercase wordmark **`hun.`** in Ink Black. It has no icon, mascot, utensil, chef hat or other graphic mark, and none should be added. The full stop is part of the mark.

Usage rules:

- Always lowercase, always with the full stop when used as the logo.
- In running prose the product may be written *hun* without the stop.
- Keep clear space around the wordmark at least equal to the height of the letter "u".
- Set it in the heading serif; do not outline, shadow, recolour or place it on busy backgrounds.

## Character

Feminine and elegant. Calm, modern, premium. Minimal rather than decorative. Warm and approachable. Technically credible. Personal and distinctive.

Engineering content stays precise and professional. The identity shows in restraint, whitespace and consistency, not in decorative language.

## Palette

| Token | Name | Hex | Intended use |
| :-- | :-- | :-- | :-- |
| `ink` | Ink Black | `#171417` | Wordmark, primary headings, important text |
| `pink` | Baby Pink | `#F6DCE5` | Restrained accents, dividers, highlights |
| `blush` | Blush | `#FBECEF` | Subtle panels, table headers |
| `paper` | Warm White | `#FFFCFA` | Main background |
| `rose` | Dusty Rose | `#C58DA0` | Occasional secondary accents (non-text) |
| `charcoal` | Soft Charcoal | `#625961` | Supporting text |

### Measured contrast (WCAG 2.x relative luminance)

| Foreground | on Warm White | on Blush | on Baby Pink |
| :-- | :-: | :-: | :-: |
| Ink Black | 17.89 | 15.97 | 14.18 |
| Soft Charcoal | 6.59 | 5.88 | 5.22 |
| Dusty Rose | 2.67 | 2.39 | 2.12 |

Other measured pairs: Warm White on Ink Black 17.89; Ink Black on Dusty Rose 6.69; Warm White on Dusty Rose 2.67.

Consequences:

- Ink Black and Soft Charcoal meet the 4.5:1 minimum for normal text on every light surface in the palette.
- **Dusty Rose must not be used for text**, nor for the sole indicator of state or meaning, on any light surface. At 2.67:1 it fails even the 3:1 threshold for large text and UI components. Use it for decoration (rules, illustrations, hover tints) or as a fill behind Ink Black text (6.69:1).
- Baby Pink and Blush are background and accent colours only, never text colours.
- Colour is never the only carrier of meaning; pair it with text, icon shape or position.

## Typography (recommended)

| Role | Typeface | Fallback stack |
| :-- | :-- | :-- |
| Headings, wordmark | DM Serif Display | `Georgia, serif` |
| Body, interface | Inter | `system-ui, sans-serif` |
| Code, technical examples | JetBrains Mono | `ui-monospace, monospace` |

Use a single serif weight for headings. Keep body text at a comfortable reading size with generous line spacing. Check licences and self-hosting before any typeface ships in a product.

## Layout principles

- Generous whitespace; consistent heading levels; one clear hierarchy per page.
- Tables have Blush header rows, thin Baby Pink rules, no heavy borders.
- Decorative detail is restrained: a pink divider is enough.
- Interfaces for customer, restaurant, kitchen and admin share the same tokens, so the product feels like one thing. The kitchen display additionally prioritises legibility at distance and in poor light over refinement.

## Applying the system

- **Markdown (these docs):** identity through naming, clean headings, polished tables and restrained language. Markdown renderers do not guarantee fonts or colours, and these documents do not pretend otherwise.
- **Future PDF or documentation site:** reuse this palette and typography.
- **Future product UI:** define the palette and type scale once as design tokens in a shared package ([repository structure](repository-structure.md)) so no surface hard-codes colours.
- Dark mode and kitchen high-contrast variants are not designed yet; derive them from the tokens and re-measure contrast rather than inverting by eye.
