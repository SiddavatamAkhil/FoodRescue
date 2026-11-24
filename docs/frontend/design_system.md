# FoodRescue design system

The web app (`apps/web`) uses one set of tokens and one component library for every page, public and authenticated. This document is the reference for anyone adding a screen.

## Principles

1. **Operational, not decorative.** Every element helps someone move food safely. No gradients, glows, glass effects or decorative illustrations.
2. **The custody chain is the brand device.** A rescue is a chain of checked handovers. The `CustodyChain` component shows that chain on the landing page, the sign-in screen and every donation timeline. It is the one visual idea the product repeats.
3. **Honest data.** Show only recorded values. When there is no data, show an empty state that says what will appear and how to make it appear. Never show estimates, placeholder figures or sample records.
4. **Plain words.** Sentence case and active voice. Buttons say what they do ("Publish donation", "Confirm pickup"). Error messages say what went wrong and how to fix it.
5. **Every control works.** A feature that isn't available (billing, SMS verification, the listing assistant without a configured model) is labelled as unavailable. It is never shown as a working control.

## Tokens (`apps/web/tailwind.config.js`)

| Token | Hex | Use |
|---|---|---|
| `forest` | `#174C3C` | Primary actions, active navigation, brand mark |
| `forest-hover` | `#10392D` | Primary hover |
| `forest-50` / `forest-100` | `#EEF4F0` / `#DCE9E1` | Selected rows, active nav background |
| `sage` | `#6D927B` | Secondary accents, small markers (not for text: 3.5:1) |
| `mint` | `#B8D6B2` | Accent on forest backgrounds, text selection |
| `canvas` | `#F7F8F5` | Page background |
| `surface` | `#FFFFFF` | Panels, inputs, dialogs |
| `ink` | `#202A26` | Primary text (13.9:1 on canvas) |
| `muted` | `#5F6964` | Secondary text (5.3:1 on canvas; darkened from the brief's `#69736D` for comfortable AA) |
| `line` / `line-strong` | `#E4E9E3` / `#CDD5CE` | Dividers / input borders |
| `success` (+`text`, `50`) | `#27834A` | Completed, verified |
| `warning` (+`text`, `50`) | `#C48A31` | Pending, near deadline. Text uses `#8A5A12` |
| `danger` (+`text`, `50`) | `#C44747` | Errors, safety alerts, expired. Text uses `#A83737` |
| `info` (+`50`) | `#3C6488` | Claimed, in-progress states |

All text and background pairs used for status badges were checked at 4.5:1 or higher.

**Radii:** 4px (badges), 6px (controls), 8px (panels), 10px (large containers). **Shadow:** a single `shadow-pop`, used only for menus, dialogs and toasts.

## Typography

One family: **Manrope** (variable, self-hosted via `@fontsource-variable/manrope`, so no third-party font requests). Scale: 12 / 13 / 15 (body) / 16 / 18 / 22 / 28 / 38 / 52 px, with tighter tracking on the larger sizes. Numbers in tables and figures use tabular figures (`.tabular`). There are no all-caps labels.

## Components (`apps/web/components`)

| Area | Components |
|---|---|
| `ui/button.tsx` | `Button`, `ButtonLink`. Variants: primary, secondary, ghost, quiet, danger. Sizes: sm, md, lg. `loading` state |
| `ui/field.tsx` | `Field` (label, hint, error, wires `aria-describedby` / `aria-invalid`), `Input`, `Textarea`, `Select`, `PasswordInput` (show/hide), `Checkbox`, `Segmented` |
| `ui/status.tsx` | `Badge`, `DonationStatusBadge`, `VerificationBadge`, `TASK_STATUS`. Status always has a text label as well as a colour |
| `ui/panel.tsx` | `Panel`, `PanelHeader`, `PanelBody`, `StatStrip` (one row of key figures, instead of a grid of identical cards), `KeyValue` |
| `ui/table.tsx` | Responsive `Table` (stacks into labelled rows below `md`), `Pagination`, `SearchInput`, `FilterTabs` |
| `ui/dialog.tsx` | `Dialog` (native `<dialog>`: focus trap, Esc to close), `ConfirmDialog` for anything irreversible |
| `ui/feedback.tsx` | `Alert`, `EmptyState`, `Skeleton`, `LoadingRows`, `ErrorState` (with retry) |
| `ui/toast.tsx` | `ToastProvider` / `useToast` for success and error notifications (`aria-live`) |
| `ui/misc.tsx` | `PageHeader` (with breadcrumbs), `Tip` (tooltip) |
| `brand/logo.tsx` | `LogoMark`, `Logo`. The mark is a leaf whose midrib becomes a handover stroke |
| `shared/custody-chain.tsx` | `CustodyChain`, the brand device |
| `charts/charts.tsx` | `BarChart` (1–2 series, legend, hover/focus tooltip, table view), `BarList` |
| `app/*` | `AppShell` (sidebar, top bar, mobile drawer), role navigation, notifications, user menu, account banners |

## Charts

Charts follow the internal data-visualisation method:

* Two series, **Listed `#5B8DC9`** and **Rescued `#16855A`**, validated with the palette checker for lightness band, chroma, colour-vision-deficiency separation (ΔE 15.7 deutan) and 3:1 contrast. Single-series bars use one of the two.
* One axis only. Bars have rounded data ends and a 2px gap. Gridlines and axes recede.
* Legend for two or more series. Every chart has a hover/focus tooltip and a **Show table** toggle.
* Charts render at the container's real pixel width (via `ResizeObserver`), so labels stay 11px on every screen.
* Charts appear only when the API returned data; otherwise an empty state explains why.

## Accessibility

* Skip links, landmark regions, visible focus (`2px forest` outline), `prefers-reduced-motion` respected.
* Every form control has a label. Errors are announced and linked to their field.
* Dialogs use native `<dialog>`. Menus close with Esc and on outside click.
* An axe-core scan (WCAG 2.0/2.1 A and AA rules) of all public pages and the admin, NGO, volunteer and corporate workspaces reports **0 violations** (see the redesign report).

## Localisation

* Dates and times are shown in India Standard Time with the `en-IN` locale. The API stores naive UTC, and `lib/format.ts` converts it.
* The public site's navigation and hero have a Telugu translation (toggle in the header, remembered per browser). The signed-in product is English only for now.
