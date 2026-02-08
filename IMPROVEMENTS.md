# Bernard Admin – Suggested Improvements

Summary of findings and recommendations after reviewing the project.

---

## ✅ Already fixed in this pass

1. **Duplicate mobile menu handler** (`src/app.js`) – The same `mDrawer.querySelectorAll('button[data-view]')` listener was attached twice (lines 337–372 and 374–407). The duplicate block was removed so each menu button fires only once.
2. **Trailing typo** (`src/app.js`) – Removed the stray `"` at the end of the file (`// ========== END OF FILE =========="`).

---

## High priority

### 1. Centralise Sojourn API base URL

- **Issue:** `SOJOURN_API_BASE_URL` is hardcoded in three places:
  - `src/reservations.js` (line 12)
  - `src/custom_booking.js` (line 13)
  - `src/package_booking.js` (line 6)
- **Also:** `index.html` sets `window.SOJOURN_API_BASE_URL = "%NEXT_PUBLIC_SOJOURN_API_BASE_URL%"`, but Vite does not replace `%VAR%` in HTML, so that value is never injected.
- **Recommendation:**
  - Add a single source of truth, e.g. `src/config/env.js`:
    - Export `SOJOURN_API_BASE_URL` from `import.meta.env.VITE_SOJOURN_API_BASE_URL` with a fallback (e.g. `'https://sojourn-cabins.vercel.app'`).
  - In `reservations.js`, `custom_booking.js`, and `package_booking.js`, import from that config instead of defining a local constant.
  - Document `VITE_SOJOURN_API_BASE_URL` in `.env.example` and remove or repurpose the inline script in `index.html` so it doesn’t imply a different mechanism.

### 2. Add Vite config for env and build

- **Issue:** No `vite.config.js`; HTML env substitution and build behaviour rely on defaults.
- **Recommendation:** Add `vite.config.js` and:
  - Use Vite’s `define` (or rely on `import.meta.env.VITE_*`) for any build-time values you need in JS.
  - Avoid `%VAR%` in HTML unless you add a custom plugin to replace it; prefer reading config in JS from `import.meta.env` and, if needed, exposing a single value to `window` from one place (e.g. in `main.js` or your env module).

### 3. Reduce console logging in production

- **Issue:** `src/config/supabase.js` logs whether Supabase URL/key exist; useful in dev, noisy in prod.
- **Recommendation:** Guard with `import.meta.env.DEV` (or a small `isDev` helper) so these logs run only in development.

### 4. Very large files – consider splitting

- **Issue:** Some modules are very long and mix many concerns:
  - `src/analytics.js` (~2,800 lines)
  - `src/analytics-comparison.js` (~1,157 lines)
  - `src/client-analytics.js` (~980 lines)
  - `src/reservations.js` (~4,500+ lines)
  - `src/custom_booking.js` (~2,500+ lines)
  - `src/package_booking.js` (~1,200+ lines)
- **Recommendation:** Gradually split by feature or layer, e.g.:
  - Analytics: separate modules for data fetching, date-range logic, chart config, and DOM rendering.
  - Reservations/booking: separate modules for API calls, form state, validation, and UI (list/calendar/modals).
  - Share small helpers (date formatting, currency, API base URL) via `utils/` or `config/` to avoid duplication.

---

## Medium priority

### 5. Duplicate “titles” map

- **Issue:** In `app.js`, the same `titles` object (view id → section title) is defined in two places: once for desktop tabs and once for the mobile menu. The mobile one was also missing `'chef-menu'` and `'extra-selections'` (partially fixed by the duplicate block removal; the remaining block has the full set).
- **Recommendation:** Define `titles` once at module or `initApp` scope and reuse it in both tab and mobile menu handlers.

### 6. Documentation consolidation

- **Issue:** Multiple overlapping docs: `README.md`, `QUICK_START.md`, `QUICKSTART.md`, `START_HERE.md`, `PROJECT_SUMMARY.md`, `FILE_INDEX.md`, `CHECKLIST.md`, `TODO.md`, `DEPLOYMENT.md`.
- **Recommendation:** Keep one primary entry (e.g. `README.md`) and link to a short “Quick start” and “Deployment”. Merge or archive the rest to avoid confusion and stale copies.

### 7. Missing `vite.config.js` reference

- **Issue:** `README.md` project structure mentions `vite.config.js` (optional); the repo doesn’t have one.
- **Recommendation:** Either add a minimal `vite.config.js` (see above) or update the README to say “no Vite config file” so the structure matches the repo.

### 8. Env and API key docs

- **Issue:** `.env.example` doesn’t mention `VITE_SOJOURN_API_BASE_URL`; README doesn’t document it.
- **Recommendation:** Once you centralise the Sojourn URL in config, add `VITE_SOJOURN_API_BASE_URL` to `.env.example` and a one-line note in the README “Configure environment variables” section.

---

## Lower priority / polish

### 9. Linting and formatting

- Add ESLint (and optionally Prettier) with a shared config so style and simple bugs are consistent. Run lint in CI or pre-commit.

### 10. Tests

- No test runner or tests were found. Adding a few unit tests for:
  - `utils/helpers.js` (e.g. `formatDate`, `formatCurrency`, `formatDateForDB`)
  - Any pure date/range logic in analytics
  would make refactors safer.

### 11. PWA and service worker

- `index.html` disables the service worker on localhost (good for dev). Ensure `sw.js` and cache strategy are still appropriate for production and that the manifest and icons are up to date.

### 12. Accessibility

- Modal focus trap and “focus return” when closing modals would help keyboard and screen-reader users. `aria-expanded` on the mobile menu button is already set; keep that pattern for other dynamic UI.

---

## Quick reference: what was changed

| File            | Change                                                                 |
|-----------------|------------------------------------------------------------------------|
| `src/app.js`    | Removed duplicate mobile menu `button[data-view]` listener block.       |
| `src/app.js`    | Removed trailing `"` at end of file.                                  |
| `IMPROVEMENTS.md` | Added (this file).                                                   |

If you want, the next step can be implementing the central `SOJOURN_API_BASE_URL` config and a minimal `vite.config.js` as in sections 1 and 2.
