# CustomForge admin design

[Design-system home](README.md) · [Admin navigation source](../admin/lib/admin-navigation.ts)

## Identity and theme tokens

A focused operations workspace using the store's cyan identity. Dark mode uses raised navy surfaces and luminous cyan. Light mode uses white/soft-gray surfaces, navy text and deeper teal/violet accents. Status color accompanies a label or icon; charts retain readable units and scope.

The runtime source is [forge-admin.css](../admin/app/forge-admin.css) plus [forge-themes.css](../admin/app/forge-themes.css). Shared control styles load before theme overrides.

| Role | Token | Dark | Light |
| --- | --- | --- | --- |
| Canvas | `--background` | #0b1018 | #f3f6fa |
| Surface | `--card` | #131c28 | #ffffff |
| Raised surface | `--fa-surface-raised` | #182535 | #edf2f8 |
| Subtle surface | `--fa-surface-subtle` | #101823 | #f8fafc |
| Field surface | `--fa-input-surface` | #0e1723 | #ffffff |
| Primary text | `--foreground` | #edf3fa | #17273b |
| Secondary text | `--muted-foreground` | #a5b5c7 | #53657a |
| Border | `--border` | #2b3c50 | #d4deea |
| Input boundary | `--input` | #536b84 | #7e93a9 |
| Primary/focus | `--primary`, `--ring` | #62f0dd | #08756e |
| Primary text on fill | `--primary-foreground` | #081713 | #ffffff |
| Violet | `--fa-violet` | #a696ff | #6c45c7 |
| Warning | `--fa-warning` | #ffc078 | #945606 |
| Danger | `--fa-danger` | #ff959c | #bd344c |
| Success | `--fa-success` | #62f0dd | #167452 |

Use semantic roles rather than raw page-level colors. In particular, light success is green and differs from the primary teal. Preserve the theme's foreground-on-fill roles when styling primary/destructive actions.

[layout.tsx](../admin/app/layout.tsx) mounts next-themes with Dark as default, System support and the storage key `customforge-admin-theme`. [admin-theme-switch.tsx](../admin/components/admin-theme-switch.tsx) offers Light, Dark and System. Theme choice has no effect on session permissions or data.

## Typography and geometry

Geist is the main heading/body face; Geist Mono is reserved for compact IDs, codes and labels. Both are loaded through next/font in the root layout, with the mono preload disabled. The CSS variables are `--font-admin-sans` and `--font-admin-mono`.

| Type role | Runtime token/value |
| --- | --- |
| Page title | `--fa-type-title`: clamp(1.75rem, 2.6vw, 2.25rem), weight 650 |
| Panel title | `--fa-type-panel`: 1.0625rem; shared panel heading is 17px |
| Compact body/data | `--fa-type-body`: .875rem |
| Form label | `--fa-type-label`: .8125rem |
| Caption | `--fa-type-caption`: .75rem |
| Base body | 15px, line-height 1.6 |
| Mobile inputs | 16px |

Keep values tabular and label units, periods and missing comparisons. Long IDs use wrapping/truncation with an accessible way to read the value; they should not force the page wider than its viewport.

- Content width: .fa-content-wrap is at most 1720px; horizontal gutters are 32px desktop, 24px tablet and 18px mobile.
- Sidebar: 252px expanded and 78px collapsed; below 1024px, navigation uses the mobile sheet.
- Page rhythm: `--fa-page-gap` is 24px. Panel padding is 20px desktop and 16px mobile.
- Panel radius is 12px, controls 8px and dialogs 14px. Use shared borders/elevation instead of per-page geometry overrides.

## Universal page pattern

All sidebar views use [PageShell](../admin/components/patterns/page-shell.tsx) and [SectionHeader](../admin/components/patterns/section-header.tsx). They own page rhythm, separator, title hierarchy and action placement. SectionHeader supports the eyebrow/icon slots already used by the pages.

Use [ActionBar](../admin/components/patterns/action-bar.tsx) for context controls: filters gives a responsive labeled filter grid; split groups reporting controls. Put labels above their control row and align refresh buttons to the segmented-control center. Use shared results/panel/table classes: `fa-results-panel`, `fa-panel-heading` and `fa-data-table`.

[Pagination](../admin/components/patterns/pagination.tsx) is the only admin paging footer. It provides results/page summaries, Previous/Next, bounded numbered choices, pending disablement and optional page-size controls. Keep it available for a one-page result; mobile buttons wrap through the shared CSS rather than page-specific pager classes.

Use the shared [EmptyState](../admin/components/patterns/empty-state.tsx), [ErrorState](../admin/components/patterns/error-state.tsx), [QueryError](../admin/components/patterns/query-error.tsx) and [LoadingSkeleton](../admin/components/patterns/loading-skeleton.tsx). Empty results and a failed request have different messages/actions; an empty log day is not a failed request.

Content grids can adapt to the data. Common surfaces, control geometry, header/panel typography and pagination must stay universal.

## Navigation and scrolling

[admin-navigation.ts](../admin/lib/admin-navigation.ts) owns route names, groups, icons and command-search entries. [Sidebar](../admin/app/admin/components/sidebar.tsx) and [Topbar](../admin/app/admin/components/topbar.tsx) consume it. Ctrl/Cmd+K searches available pages, not remote product records.

The sidebar keeps brand/collapse controls fixed while links scroll in their own available space. Promotional panels do not take navigation height. The main content area scrolls independently inside the viewport workspace. Table wrappers preserve horizontal scrolling while vertical wheel/touch scrolling continues through the page; do not introduce wheel interception or scroll containment that traps the pointer over a table.

The mobile sheet retains keyboard focus management, route active states and reachable account/theme actions. Opening a menu or editor should return focus to its actual opener when closed.

## Controls and editors

[Button](../admin/components/ui/button.tsx) exposes data-variant/data-size, allowing one shared style implementation for default, outline, secondary, ghost, link and destructive controls. Icon actions use the shared 44px square geometry; large actions use at least 48px height. Page families must not independently override button radius, border, font or fill.

Use canonical [Select](../admin/components/ui/select.tsx), [DropdownMenu](../admin/components/ui/dropdown-menu.tsx), [Popover](../admin/components/ui/popover.tsx) and [Calendar](../admin/components/ui/calendar.tsx). [forge-controls.css](../admin/app/forge-controls.css) owns menu geometry, keyboard/selected surfaces, bounded scrolling and scrollbar styling. forge-themes.css supplies light surfaces and accents, including for portals.

Fields have visible associated labels, themed fills, explicit errors and focus indication. Editors group related fields and fit within viewport height. Pending requests disable duplicate actions while preserving recoverable drafts. Existing toast systems provide completion/failure feedback; inline validation stays with the field or action.

[useConfirmation](../admin/hooks/use-confirmation.tsx) provides a themed destructive-action dialog. Escape/cancel does not execute the mutation. Sensitive operations keep their existing password/TOTP and API eligibility checks; visual control state does not grant permission.

## Data presentation

| Area | Pattern |
| --- | --- |
| Overview/analytics | Real API data, labeled metric scope, text summaries and expandable data tables. Chart entry animation stays disabled. Missing comparison values remain unavailable. |
| Products | Real grid/list presentation, contained images and the existing URL/upload media flows. |
| Orders | Expandable details with recorded shipping, payment and totals; buttons follow existing fulfillment/payment eligibility. |
| Coupons | Code-focused campaigns with optional date bounds; unchanged calendar days preserve the existing exact timestamps. |
| Customers/reviews | Readable account directory and moderation queue, with recoverable filters and explicit actions. |
| Logs | Inspectable recorded events, server-local date scope, honest empty days and available compressed archives. |
| Profile | Dedicated password and two-factor panels with clear pending and recovery feedback. |

Do not fabricate exports, refunds, invitations, integrations or order events. Unsupported functions stay unavailable. API/backend constraints and setup belong in the [root README](../README.md), rather than in page-specific design exceptions.

## Motion, sources and assets

Use short CSS state transitions, generally 150–200ms, with skeleton/request motion only while pending. Shared reduced-motion rules stop animations, transitions and smooth scrolling. Keep operational workflows free of cursor takeover, sound, scroll hijacking or cinematic media.

| Area | Implementation |
| --- | --- |
| Workspace, shared geometry and variants | [forge-admin.css](../admin/app/forge-admin.css) |
| Semantic themes and type scale | [forge-themes.css](../admin/app/forge-themes.css) |
| Menus and scrollbars | [forge-controls.css](../admin/app/forge-controls.css) |
| Auth screens | [forge-auth.css](../admin/app/forge-auth.css), [admin-auth-shell.tsx](../admin/components/admin-auth-shell.tsx) |
| Overview and analytics | [forge-insights.css](../admin/app/admin/forge-insights.css), fi-* classes |
| Products, orders, coupons and editors | [forge-commerce.css](../admin/app/admin/forge-commerce.css), fc-* classes |
| Customers, reviews, logs and security | [forge-operations.css](../admin/app/admin/forge-operations.css), fo-* classes |

Brand artwork lives in [admin-brand.tsx](../admin/components/admin-brand.tsx), auth artwork in admin-auth-shell.tsx and the favicon in [forge-icon.svg](../admin/public/forge-icon.svg). Product images remain catalog data edited through the media UI. Change these sources directly rather than adding a second logo/icon system or duplicated per-page art.

Follow the shared [accessibility, data and maintenance rules](README.md). This guide documents the implementation and intended component discipline, not a measured Lighthouse/accessibility certification.
