# CustomForge storefront design

[Design-system home](README.md) · [Component and asset guide](../client/REDESIGN.md)

## Identity and tokens

An energetic hardware showroom for gamers and PC builders. Electric cyan draws attention to purchase actions and focus; violet adds an RGB-style secondary accent. Raised navy surfaces, off-white text and restrained glow make the dark canvas readable. The current storefront root uses the dark theme; the admin's light theme is a separate system.

Runtime values come from [client/app/forge.css](../client/app/forge.css), loaded after the baseline globals:

| Role | Token | Value |
| --- | --- | --- |
| Canvas | `--background` | #090d14 |
| Main surface | `--card` | #111722 |
| Popover | `--popover` | #131b27 |
| Primary text | `--foreground` | #f2f5fa |
| Secondary text | `--muted-foreground` | #a3adbe |
| Primary/focus | `--primary`, `--ring` | #62f0dd |
| Primary text on fill | `--primary-foreground` | #081713 |
| Secondary accent | `--forge-violet` | #a696ff |
| Destructive | `--destructive` | #ff8f91 |
| Border | `--border` | #273140 |
| Input boundary | `--input` | #2c394b |

Menu/scroll tokens are owned by [forge-controls.css](../client/app/forge-controls.css). Menu surface is #111722, text #d6e0ee, border #36515e and highlight #1b343b. Scrollbars use #369e94 thumbs, #62f0dd interaction and #0c121c tracks. Keep these shared tokens visible to portaled menus.

## Typography and geometry

Geist Sans is the main UI, product-name and editorial font. Orbitron is available for existing account/form accents via next/font with preload disabled. Compact HUD/spec labels use the system monospace stack defined by `--font-geist-mono`; the storefront does not need another monospace font download. Font loading and root classes live in [layout.tsx](../client/app/layout.tsx).

Use fluid headline styles from the relevant stylesheet rather than copying a fixed display size into every page. Body copy remains readable, with 16px mobile form inputs. Small uppercase/monospace labels are secondary; they must not replace product names, field labels or important instructions.

- Use the existing 4px spacing rhythm and route-specific responsive grids.
- `.forge-container` is at most **1360px including its horizontal padding**. `--forge-gutter` is clamp(20px, 3vw, 40px). The generic `.container` separately has a 1280px maximum.
- Shared Button styles have a 44px minimum height and 6px radius. Select triggers are at least 46px high with an 8px radius; menu surfaces use 10px. Retain component-specific card/gallery shapes rather than asserting one radius for the whole store.
- Angular accents and glow belong to selected hero/editorial details. Forms, tables and buying information use clear solid surfaces.

## Navigation

The header keeps brand, search, wishlist/account/cart actions and desktop category links together. Mobile uses a compact utility row, an available search field and a navigation sheet. Preserve sticky positioning, active-route feedback, cart count when present and an accessible account action for both guests and signed-in customers.

Use [navbar.tsx](../client/components/navbar.tsx), [navigation-menus.tsx](../client/components/forge/navigation-menus.tsx) and [forge-navigation.css](../client/app/forge-navigation.css). Rich category panels and search suggestions use the same menu surface as ordinary dropdowns. Keep the complete accessible names, keyboard choices, focus return and viewport-bounded scrolling.

## Shared controls

Canonical primitives are [Select](../client/components/ui/select.tsx), [DropdownMenu](../client/components/ui/dropdown-menu.tsx) and [Button](../client/components/ui/button.tsx). Legacy select/dropdown import paths only re-export the canonical components; do not style those wrappers independently.

Menu rows preserve 44px targets, selection marks, typeahead and visible focus. Select content is bounded to 360px and can open wider than a compact trigger within the viewport. Action menus are bounded by available height and their shared limit. Mobile menu/trigger text is 16px. The Calendar dropdown adapter uses the same Select primitive.

[forge-select.css](../client/app/forge-select.css) only owns field layout. Page-specific filters must not redefine menu color, radius or selection behavior. Scrollbar styles also cover Radix ScrollArea, both axes and forced-color support. Native wheel/touch/keyboard behavior stays available.

## Shopping patterns

| Area | Reusable behavior |
| --- | --- |
| Product cards | Whole-product imagery, category/brand, real price/rating/stock and a clear purchase action. Quick view and wishlist actions have independent labels and pending state. |
| Catalog | Sticky desktop filters, mobile drawer, URL-synchronized sort/filters, loading/empty recovery and real brand/specification choices. Counts must not imply a partial facet scan is complete. |
| Product detail | Thumbnail/gallery navigation, fit/zoom controls, real features/specs, compatibility limits, sticky buy panel and separate complementary/alternative suggestions. |
| PC builder | Eight canonical component slots, buying guidance, visible missing/conflicting metadata and live price/stock revalidation. A device-only budget covers selected parts, not shipping or tax. |
| Cart/checkout | Stock-aware quantity controls, factual server totals, pending/error recovery, preserved submission/idempotency and a mobile action with footer clearance. |
| Orders/invoice | Recorded order/payment states and totals. Missing packing events stay unavailable. Print/export uses saved pricing and never infers settlement from a redirect. |
| Account/collections | Shared navigation, session-aware drafts, existing security challenges, per-item wishlist recovery and resilient comparisons with explicitly missing/conflicting specs. |
| Authentication | Labeled fields, exact password characters, duplicate-request guards, recoverable validation, contextual errors and restored initiating focus. |

A desktop buy box that exceeds its viewport scrolls internally; the mobile buy bar remains independent. Sticky controls must not obscure content or trap page scrolling. Compatibility results separate checked, conflicting and unknown requirements.

## Motion and waiting

[experience.tsx](../client/components/forge/experience.tsx) owns the non-blocking, dismissible boot indicator and route entrance. The boot indicator appears once per browser session and clears after at most 1.1 seconds; it never hides the store. Reveal handling leaves first-paint sections visible and only animates later viewport entries.

[hero-scene.tsx](../client/components/forge/hero-scene.tsx) uses native observers and passive/requestAnimationFrame scroll scheduling for decorative motion. Desktop showcase progress/parallax and continuous effects stop for reduced motion. Shopping never waits for animation. Preserve reduced-motion rules in every feature stylesheet as well as the shared styles.

Keep product-grid skeletons, bounded queries and deferred noninteractive shelf placeholders. Remove placeholder containment when real interactive content activates. Existing route/error/empty states use honest loading and retry feedback; do not create delayed simulated processing.

## Source map

| Area | Styles and components |
| --- | --- |
| Global storefront | [forge.css](../client/app/forge.css), [layout.tsx](../client/app/layout.tsx) |
| Navigation, menus and scrolling | [forge-navigation.css](../client/app/forge-navigation.css), [forge-controls.css](../client/app/forge-controls.css) |
| Cards and discovery | [forge-cards.css](../client/app/forge-cards.css), [forge-catalog.css](../client/app/forge-catalog.css) |
| Product detail | [forge-detail.css](../client/app/forge-detail.css), [forge-product-depth.css](../client/app/forge-product-depth.css) |
| Builder | [forge-builder-guidance.css](../client/app/forge-builder-guidance.css), [compatibility rules](../client/lib/compatibility.ts) |
| Commerce | [forge-commerce.css](../client/app/forge-commerce.css), [forge-checkout.css](../client/app/forge-checkout.css), [invoice.tsx](../client/components/forge/invoice.tsx) |
| Account and collections | [forge-account.css](../client/app/forge-account.css), [forge-collections.css](../client/app/forge-collections.css) |
| Addresses, security and orders | [forge-addresses.css](../client/app/forge-addresses.css), [forge-security.css](../client/app/forge-security.css), [forge-order-detail.css](../client/app/forge-order-detail.css), [forge-payment.css](../client/app/forge-payment.css) |
| Authentication | [forge-auth.css](../client/app/forge-auth.css), [auth-shell.tsx](../client/components/forge/auth-shell.tsx), [password-input.tsx](../client/components/forge/password-input.tsx) |

Feature styles load from their owning route/component. Use the [component guide](../client/REDESIGN.md) for detailed source responsibilities and feature limitations.

## Asset replacement

- Brand: edit the inline mark/wordmark in [brand.tsx](../client/components/forge/brand.tsx) and the [favicon](../client/public/forge-icon.svg).
- Hero: replace [custom-gaming-pc-hero-image.jpg](../client/public/custom-gaming-pc-hero-image.jpg), used by hero-scene.tsx as the image and video poster. Optional video uses `NEXT_PUBLIC_HERO_VIDEO`; it stays muted/looped, pauses outside the viewport and falls back on error or reduced motion.
- Product media: edit the catalog product's image URLs. Rich media is keyed by exact SKU in [product-media.ts](../client/lib/product-media.ts); local files belong under `client/public/media/products/<sku>/`. Empty entries keep the real gallery; do not imply a 360-degree view exists when frames are absent.
- Authentication artwork: edit the inline SVG in auth-shell.tsx. Decorative art must not interfere with form labels or focus.

Use the shared [accessibility, motion and data rules](README.md). Supported payment/security operations remain those in the application and [root setup guide](../README.md).
