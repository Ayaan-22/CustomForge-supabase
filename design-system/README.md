# CustomForge design system

This is the maintained design reference for the public CustomForge project. It describes reusable rules and their implementation sources, rather than a history of redesign phases or QA results.

| Guide | Responsibility |
| --- | --- |
| [Storefront](FORGE.md) | Gaming-store identity, shopping components, navigation, motion and product media. |
| [Admin](ADMIN.md) | Light/dark workspace tokens, typography, universal page layout and operational controls. |

The guides share brand and interaction principles. Each application owns its runtime styles and components; do not copy one application's palette or density into the other without checking its use. When documentation and code differ, check the linked runtime source and update the guide with the implementation change.

## Shared principles

- Cyan identifies primary actions and focus. Violet supports secondary information. Status colors always accompany readable text or an icon.
- Use consistent page structure, spacing and control variants within each application. Add reusable patterns before introducing page-specific overrides.
- Keep shopping and operational tasks immediate. Decoration never blocks navigation, typing, submission or visible content.
- Show real data, explicit pending state and actionable failures. Missing stock, ratings, compatibility information or order events remain missing; they are not replaced with invented values.
- Preserve service-owned price, stock, order, payment and security state. A visual success animation is not proof that a request or payment succeeded.

## Component rules

| Element | Rule |
| --- | --- |
| Buttons | Use the existing Button variants: default, outline, secondary, ghost, link and destructive. Name icon-only actions and retain visible focus and disabled/pending feedback. |
| Fields | Associate visible labels, errors and descriptions with their input. Mobile text inputs use 16px. Keep entered values on recoverable errors. |
| Menus | Use the canonical Radix Select, DropdownMenu, Popover and dialog primitives. Preserve keyboard/typeahead behavior, Escape, focus return and viewport bounds. |
| Data cards/tables | Label units, periods and scope. Keep long values readable and overflow contained; table hover must not trap vertical page scrolling. |
| Feedback | Use skeletons for loading structure, contextual inline errors with retry, honest empty states and existing toast feedback. Do not use native alerts as editor validation. |
| Confirmations | Require a clear destructive-action confirmation where supported; cancellation must leave the underlying form/data intact. |

Primary action targets should be at least 44px in each dimension. Existing styles supply shared control height; check the width of compact/icon actions rather than assuming height alone guarantees the target size.

## Accessibility and responsive behavior

Use semantic headings/landmarks and existing skip links. Keep focus visible, keyboard order logical and modal focus contained/restored. Announce asynchronous status without turning routine feedback into disruptive alerts. Text, field boundaries and focus indicators must remain readable against their actual surface; check both admin themes and portaled overlays.

Use content-driven responsive layouts. Keep critical buy/submit controls reachable, allow filter rows to wrap, and avoid horizontal body overflow. Preserve native wheel, touch and keyboard scrolling. Forced-color modes must retain system visibility, and color must not be the only status indicator.

These are implementation rules, not a blanket claim that every page has passed an accessibility audit. Validate changes to the affected component in its actual states.

## Motion and media

Respect prefers-reduced-motion, including continuous effects, route entrances, smooth scrolling and loading decoration. Favor brief transform/opacity transitions and visible content at first paint. Animation must never delay an input response or hide the product/admin data while it loads.

Keep media dimensions explicit, use next/image for product imagery, prioritize only above-the-fold media and lazy-load the rest. Optional storefront video is muted, bounded by viewport visibility and backed by its poster. Admin workflows use concise CSS state transitions rather than cinematic media.

## Where to change things

| Change | Storefront source | Admin source |
| --- | --- | --- |
| Base tokens and geometry | [forge.css](../client/app/forge.css) | [forge-admin.css](../admin/app/forge-admin.css) |
| Theme surfaces and typography | [globals.css](../client/app/globals.css) plus Forge overrides | [forge-themes.css](../admin/app/forge-themes.css) |
| Menus and scrollbars | [forge-controls.css](../client/app/forge-controls.css) | [forge-controls.css](../admin/app/forge-controls.css) plus light overrides |
| Shared control variants | [UI primitives](../client/components/ui/) | [UI primitives](../admin/components/ui/) |
| Feature/page patterns | [Forge components](../client/components/forge/) | [Admin patterns](../admin/components/patterns/) |

The root layouts define stylesheet order. Client loads globals, Forge, navigation and controls; feature styles stay with their route/component. Admin loads globals, workspace, controls and themes; light-theme overrides follow base/control styles. Preserve that order when changing shared tokens.

## Maintenance

Keep this index and the two application guides current. Put navigation guidance in the storefront guide and shared admin patterns in the admin guide instead of adding duplicate per-page documents. Link new reusable sources from the relevant guide.

Keep dated test counts, screenshots, generated contrast reports and phase-by-phase audit narratives out of this directory. Maintained automated tests remain in their application suites. Setup and backend constraints belong in the [root README](../README.md); pending removals belong in [clean-up.md](../clean-up.md).
