# ContinuityX — Navigation Performance & UI Audit Specification

Act as a Senior Next.js Performance Engineer and Full-Stack Architect.

PROJECT: ContinuityX
STACK: Next.js, TypeScript, Prisma, Neon PostgreSQL, Gemini AI.

CRITICAL ISSUE:

When navigating from one page to another using the left sidebar,
the application takes an unusually long time to load the next page.

This happens repeatedly during navigation.

I need you to investigate and fix the actual root cause.

PRIMARY OBJECTIVE:
Make navigation between all application pages fast, smooth,
and consistent without breaking existing functionality.

IMPORTANT:
Do not redesign the UI.
Do not remove existing features.
Do not replace real database data with mock data.
Do not hide loading delays using animations.
Do not compromise authentication or authorization.

==================================================
PHASE 1 — INVESTIGATE ROUTE NAVIGATION
==================================================

Inspect:

1. Next.js routing architecture.
2. App Router or Pages Router implementation.
3. Sidebar navigation components.
4. Link and router.push usage.
5. Layout and nested layout architecture.
6. Server Components and Client Components.
7. Loading.tsx and Suspense boundaries.
8. Middleware and authentication checks.
9. Route-level data fetching.
10. Server actions and API requests.

Identify why every navigation takes so long.

Check whether:
- Full page reload happens on every click.
- Next.js client-side navigation is being bypassed.
- Sidebar uses window.location unnecessarily.
- Every route repeats authentication queries.
- Shared layout remounts on every navigation.
- Every page refetches the same data.
- Multiple API requests execute sequentially.
- Server components block rendering.
- Database queries delay initial page response.
- AI calls execute during normal page navigation.
- Middleware performs expensive operations on every request.

Do not assume the cause. Prove it using measurements.

==================================================
PHASE 2 — MEASURE NAVIGATION PERFORMANCE
==================================================

Measure navigation time for every sidebar route.

Record:
- Click-to-navigation time.
- Route response time.
- Server rendering time.
- API request duration.
- Database query duration.
- Time until meaningful content appears.

Use browser Network timings and available Next.js
server-side instrumentation.

Compare:
- First visit to a page.
- Second visit to the same page.
- Navigation between two different pages.
- Navigation after refreshing the browser.

Identify slow routes and common bottlenecks.

==================================================
PHASE 3 — OPTIMIZE NEXT.JS NAVIGATION
==================================================

Apply optimizations only when justified by the audit.

Investigate:

1. Use next/link for internal navigation.
2. Avoid unnecessary full page reloads.
3. Preserve shared layouts between routes.
4. Avoid unnecessary component remounting.
5. Implement route-level loading.tsx where useful.
6. Use Suspense for independently loadable sections.
7. Use dynamic imports for genuinely heavy components.
8. Use route prefetching appropriately.
9. Avoid unnecessary client-side JavaScript.
10. Prevent duplicate route data fetching.

Ensure the sidebar remains responsive during navigation.

Do not aggressively prefetch every route if it creates
excessive database or server load.

==================================================
PHASE 4 — AUTHENTICATION OPTIMIZATION
==================================================

Investigate repeated authentication work.

Check:
- Session retrieval.
- Middleware.
- Server-side user lookup.
- Role and permission checks.
- Repeated Prisma user queries.

Avoid repeating identical authentication queries
multiple times during one request.

Use safe request-scoped caching where appropriate.

Do not weaken:
- Session validation.
- Authorization.
- Project-level access control.
- OWNER, REVIEWER and VIEWER restrictions.

Never trust client-side role information alone.

==================================================
PHASE 5 — DATABASE AND API OPTIMIZATION
==================================================

Identify API calls executed during page navigation.

Check:
- Duplicate requests.
- Sequential queries that can safely run in parallel.
- N+1 queries.
- Excessively large database responses.
- Missing pagination.
- Missing database indexes.
- Repeated Prisma client initialization.
- Unnecessary database round trips.
- Connection pooling configuration.

Optimize the actual slow queries.

Use caching only for data that is safe to cache.

Never serve stale permission information or unauthorized data.

Ensure data mutations invalidate relevant cached data.

==================================================
PHASE 6 — PREVENT AI BLOCKING PAGE NAVIGATION
==================================================

Very important:

Normal page navigation should not trigger expensive Gemini
operations unless that page genuinely requires them.

Check whether:
- Knowledge Loss Radar runs AI analysis on every visit.
- Continuity Score is recalculated on every render.
- Project Q&A initializes unnecessary AI requests.
- Claim extraction executes during normal navigation.
- Intelligence services block the initial page response.

Separate expensive AI processing from normal page rendering.

Where appropriate:
- Load primary page content first.
- Load secondary intelligence panels independently.
- Reuse valid previously computed results.
- Provide explicit refresh/recompute actions.
- Cache results with proper invalidation.

Do not cache results across different users or projects
without strict authorization checks.

==================================================
PHASE 7 — FRONTEND DATA FETCHING
==================================================

Inspect all page-level data fetching.

Check:
- useEffect dependencies.
- Duplicate fetch calls.
- State update loops.
- Excessive re-renders.
- Fetch waterfalls.
- Missing request cancellation.
- Stale state between projects.
- Unnecessary refetching after navigation.

Where appropriate, introduce request deduplication
and shared data fetching.

Ensure changing projects always retrieves the correct data.

Never show another project's cached information.

==================================================
PHASE 8 — IMPLEMENT SAFE FIXES
==================================================

After identifying root causes:

1. Fix confirmed navigation bottlenecks.
2. Fix repeated authentication queries.
3. Fix unnecessary database calls.
4. Fix duplicate API requests.
5. Separate expensive AI processing.
6. Improve loading states.
7. Preserve existing visual design.
8. Preserve all current functionality.

Do not perform unrelated refactoring.

Do not make speculative optimizations.

==================================================
PHASE 9 — REGRESSION TESTING
==================================================

Test every sidebar route:

- Project Dashboard
- Documents & Extraction
- Claims & Fact Graph
- Entity Registry
- Pairwise Conflicts
- Evidence Review Queue
- Knowledge Loss Radar
- Continuity Intelligence
- Handover Workspace
- Team & Permissions
- All other existing routes

For each route verify:
- Navigation works.
- Correct page appears.
- Correct project data appears.
- No duplicate API requests.
- No unexpected full page reload.
- No authorization regression.
- Loading and error states work.
- Browser refresh works.
- Back and forward navigation work.

Run:
- TypeScript typecheck.
- ESLint.
- Unit tests.
- Integration tests.
- Production build.

==================================================
PHASE 10 — PERFORMANCE REPORT
==================================================

Create:

docs/NAVIGATION_PERFORMANCE_REPORT.md

Include:

1. Root cause of slow navigation.
2. Routes affected.
3. API requests causing delays.
4. Database queries causing delays.
5. Authentication overhead.
6. AI operations blocking navigation.
7. Fixes implemented.
8. Files modified.
9. Test results.

Provide a before-and-after table:

Route | Before | After | Root Cause | Verification Method

If exact measurements are unavailable, write NOT MEASURED.

Do not fabricate performance improvements.

FINAL RESTRICTIONS:

- Do not redesign the application.
- Do not remove functionality.
- Do not insert fake data.
- Do not weaken security.
- Do not change benchmark results.
- Do not deploy.
- Do not push or merge.
- Do not commit.

First investigate, then fix confirmed issues,
then verify and report.

==================================================
PHASE 8 — UI CONSISTENCY, TEXT OVERLAP & RESPONSIVE AUDIT
==================================================

Perform a complete visual and layout audit of EVERY page
in the ContinuityX application.

CRITICAL REQUIREMENT:

NO TEXT OVERLAPPING, CLIPPING, COLLIDING, OR
BECOMING UNREADABLE ON ANY PAGE.

Inspect every page, component, modal, dropdown, card,
table, sidebar, navigation bar, form, and dashboard section.

A. TEXT OVERLAP CHECK

Check for:

1. Heading overlapping with descriptions.
2. Text overlapping with icons.
3. Buttons overlapping with labels.
4. Long titles overflowing their cards.
5. Navigation labels overlapping with icons.
6. Text extending outside card boundaries.
7. Table columns overlapping.
8. Modal content overflowing the viewport.
9. Dropdown text getting clipped.
10. Form labels overlapping with input fields.
11. Badges overlapping with other text.
12. Long filenames breaking document cards.
13. Numbers and statistics overlapping their labels.
14. Tooltips covering important interactive elements.
15. Text becoming unreadable because of incorrect line-height.
16. Breadcrumbs overflowing their containers.
17. Sidebar labels getting truncated incorrectly.
18. Empty-state messages misaligned or clipped.

B. RESPONSIVE LAYOUT CHECK

Verify the application at these viewport sizes:

- 1920 × 1080
- 1440 × 900
- 1366 × 768
- 1024 × 768
- 768 × 1024
- 390 × 844
- 360 × 800

Ensure:
- No unwanted horizontal scrolling.
- No overlapping elements.
- No hidden important content.
- Sidebar behaves correctly.
- Cards resize appropriately.
- Tables remain readable.
- Modals fit within the viewport.
- Buttons remain accessible.
- Text wraps naturally.

C. TYPOGRAPHY AND SPACING

Check:
- Font sizes.
- Font weights.
- Line heights.
- Letter spacing.
- Text wrapping.
- Padding.
- Margins.
- Flexbox alignment.
- Grid alignment.
- Minimum and maximum widths.
- Overflow behavior.

Use consistent typography and spacing across all pages.

D. SAFE FIXES

Where problems are found:

- Use appropriate flex-wrap and grid behavior.
- Apply min-width: 0 where required.
- Use sensible max-width constraints.
- Fix incorrect fixed heights.
- Use overflow-wrap: anywhere for long identifiers where appropriate.
- Use word-break only when necessary.
- Apply line-clamp only when truncation is intentional.
- Use responsive breakpoints.
- Ensure icons and text have sufficient spacing.

Do not solve layout problems by simply hiding text.

Do not reduce font sizes excessively to force content to fit.

Do not introduce unnecessary scrollbars.

Preserve the existing premium enterprise SaaS design system.

E. VISUAL REGRESSION CHECK

After changes:

- Capture screenshots of every major page.
- Compare layouts before and after.
- Inspect all important sections.
- Check desktop and mobile layouts.
- Verify text remains readable.
- Verify buttons and navigation remain functional.

If browser automation or screenshot testing is unavailable,
explicitly report which pages and viewport sizes were not tested.

ACCEPTANCE CRITERIA:

1. Zero confirmed text overlaps.
2. Zero unintended text clipping.
3. Zero broken card layouts.
4. Zero unintended horizontal overflow.
5. Consistent typography and spacing.
6. Responsive layouts remain usable.
7. No existing functionality is broken.
