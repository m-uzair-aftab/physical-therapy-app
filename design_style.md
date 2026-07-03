# Physical Therapy Tracker Design Style

Use this guide when creating or changing any Physical Therapy Tracker UI. The app should continue to feel like the clinic-theme prototype in `specs/Rehab Log (standalone).html`: quiet, modern, compact, and focused on repeated daily logging rather than marketing-style presentation.

## Design Principles

- Prioritize a calm clinical workspace: low visual noise, compact information, generous but not oversized spacing.
- Keep every screen centered and scannable. Most views should use one readable content column rather than full-width dashboard layouts.
- Preserve function over decoration. Avoid illustrative backgrounds, gradients, decorative blobs, nested cards, and oversized hero sections.
- Use simple symbols and familiar controls. The app uses a calm line-icon family for brand, navigation, and Today workout types, with small square sparks still reserved for progress-list rows.
- Make repeated actions easy to scan: workout cards, history rows, settings rows, and progress rows should keep consistent sizing and alignment.

## Core Tokens

These values are the source of truth for new UI:

| Purpose | Value |
| --- | --- |
| Font | `"Hanken Grotesk", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif` |
| App background | `#F6F8F5` |
| Surface | `#FFFFFF` |
| Alternate surface | `#F1F4EF` |
| Primary green | `#256D5A` |
| Primary hover | `#1F5C4C` |
| Accent orange | `#D98F45` |
| Text | `#1F2933` |
| Muted text | `#67737F` |
| Border | `#E3E8DF` |
| Success | `#2F855A` |
| Danger | `#C2413D` |
| Base radius | `14px` |
| Control radius | `10px` |
| Soft focus | `3px solid rgba(37, 109, 90, 0.16)` |

Use letter spacing `0` unless matching the existing uppercase kicker style. Do not use negative letter spacing.

## Layout

- Desktop shell: fixed `248px` left sidebar, scrollable main area, white sidebar with a right border.
- Mobile shell: `56px` top header and bottom nav; no sidebar below `900px`.
- Default content measure: `max-width: 720px`, centered with `28px` desktop padding and `18px` mobile padding.
- Workout screens: content is still centered to `720px`; the sticky finish bar spans the main scroll area but its inner content is also capped at `720px`.
- On desktop, the workout finish bar's top divider should visually align with the sidebar account divider above the user name/email area. Keep the desktop finish bar at the same `81px` bottom measure and use the same border token.
- Page sections should be unframed layouts. Use cards only for individual repeated items, settings groups, workout panels, summary/table containers, and modals.
- Avoid horizontal overflow. Fixed-format elements like steppers, rows, and finish bars need stable dimensions and responsive wrapping.

## Typography

- Body text: `15px`, Hanken Grotesk, text color `#1F2933`.
- Page titles: `30px` desktop, `26px` mobile, weight `700`, line-height about `1.15`.
- Section titles: `19px`, weight `700`, margin about `30px 0 14px`.
- Card/item titles: `15px-16px`, weight `600-700`.
- Supporting text and metadata: `13px-15px`, muted color `#67737F`.
- Field labels: `12px`, uppercase, weight `700`, muted.
- Kicker labels such as workout category/date: `13px`, uppercase, accent orange.

## Components

### Brand And Navigation

- Brand mark: `26px` primary-green tile with `8px` radius and the white `15px` ascending-pulse SVG from `public/app.js` and `public/favicon.svg`; the Physical Therapy Tracker brand name may wrap in the desktop sidebar to avoid overflow.
- Desktop nav items: `20px` line icon, label, `11px 14px` padding, `10px` radius, muted inactive and primary active.
- Active nav background: `rgba(37, 109, 90, 0.09)`.
- Mobile nav uses the same page line icons at `22px`, stacked above the label.
- Today workout cards use the Functional dumbbell and Core / Hip bridge icons inside the existing tinted `34px` square marks.

### Buttons

- Primary buttons: green background, white text, `10px` radius, `15px` font, weight `600`, about `12px 20px` padding.
- Secondary buttons: transparent/white surface, `1px` border, text color.
- Destructive buttons: keep danger red text for low-emphasis full-width actions; use red fill only for confirmation actions.
- Ghost/back buttons: text-only muted controls, compact padding.
- Button labels should be sentence case in the prototype style: `Mark done`, `Finish Workout`, `Back to Today`, `Sign out`.

### Cards And Rows

- Base card: white surface, `1px solid #E3E8DF`, `14px` radius, no heavy shadow.
- Type cards: `22px` padding, `4px` colored left border, `34px` pale square mark, hover lift with subtle shadow.
- List rows: `15px 16px` padding, flex layout, row title plus metadata, right chevron when navigable.
- Badges: pill shape, `12px` text, `4px 11px` padding; green for Functional, orange for Core / Hip.
- Settings cards: grouped rows with borders between rows.

### Workout UI

- Workout title area: category kicker, `Workout` page title, text-only Cancel control.
- Progress bar: `8px` high, pill border, alternate surface background, green fill.
- Progress text: `13px`, muted, weight `600`.
- Exercise panels: `16px` mobile / `18px` desktop padding, `14px` radius, `14px` vertical gap.
- Exercise name: `16px`, weight `700`; cues: `13px`, muted.
- Last time line: `13px`, accent orange, `Last time · value`.
- Steppers: `42px` square minus/plus buttons, `10px` radius, centered value with tabular numerals.
- Exercise notes: hidden behind `+ Note`; expanded note area uses alternate surface, `10px` radius.
- Done state: green left border and circular green check; done button becomes outlined success with `✓ Done`.
- Skipped state: muted opacity and border treatment.
- Desktop finish bar: sticky bottom, white surface, `1px` top border, no shadow, `81px` tall in the normal no-error state so its top line matches the sidebar account divider.
- Do not show workout-level notes in create/edit workout screens. Keep existing saved workout-level notes preserved in draft state when editing.

### Progress UI

- Progress list rows use an `8px` primary square spark, exercise name, metric label, current value in primary green, and chevron.
- Progress detail starts with back control, category badge, exercise name, cues, and large current value.
- Large metric value: `42px`, primary green, weight `700`, tabular numerals.
- Chart cards use compact padding, muted `13px` chart label, primary green line, subtle border/grid.
- History table rows are compact flex rows, date muted and value bold.

### Modals

- Modal overlay: `rgba(20, 30, 25, 0.38)`.
- Modal card: white surface, `14px` radius, `24px` padding, max width about `380px`.
- Use concise titles and direct actions. Danger confirmations use a red filled confirm button.

## Content Guidance

- Keep copy short and task-focused. Avoid explaining the UI inside the UI.
- Prefer concrete labels over clever labels.
- Use `Core / Hip` exactly for that category.
- Use `Functional` exactly for the functional category.
- Use `Pounds (lb)` in settings/preferences.
- Dates should stay readable and locale-formatted by existing helpers.

## Responsive And Accessibility Requirements

- Verify at desktop and mobile widths for any UI change.
- Ensure tap targets are at least about `42px` where practical.
- Preserve keyboard focus states.
- Use semantic buttons for actions and links/routes as existing app patterns do.
- Text must not overflow buttons, cards, rows, or the mobile viewport.
- Avoid relying on color alone for state; pair state with text or marks such as check icons and labels.

## Implementation Notes

- Prefer existing classes and patterns in `public/styles.css` and markup helpers in `public/app.js`.
- Keep UI state and API behavior separate from styling changes.
- Do not introduce a frontend build step just for styling.
- When adding new UI, update `architecture.md` if the structure, behavior, routes, state, or documented visual system changes.
- After UI changes, run `npm test` and visually verify the affected screens in a browser.
