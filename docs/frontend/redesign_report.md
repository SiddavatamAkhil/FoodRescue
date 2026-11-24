# Product redesign: brand, authentication and role workspaces

This report covers the November 2026 redesign of the FoodRescue web app and the backend changes it needed.

## 1. Audit of the previous frontend

The old app was a single 719-line `app/page.tsx` with tab switching in component state.

| Area | Before |
|---|---|
| Colours | Tailwind defaults: `slate-900` header, `emerald-600` accents, a `from-slate-900 to-emerald-950` gradient hero, and rose, amber and blue status colours chosen per element |
| Type | System UI font, mostly `text-xs` and `font-extrabold`. Used `text-xxs`, a class that doesn't exist, so it rendered unstyled |
| Navigation | Five tabs (Home, Donor, NGO, Volunteer, Operations Admin) open to anyone, with no sign-in |
| Data | Two hard-coded donations seeded on every render. A fixed "Match Score: 87.5%" with invented reasons ("Within 4.2 km"). A "DEMO MODE ACTIVE" badge |
| Backend use | Calls had no auth token. They used hard-coded organisation IDs (`demo_donor_o`, `demo_ngo_o`) and fell back to fake local success when the API rejected them, so claims and QR scans "worked" without the backend |
| Forms | Inline inputs with no labels associated, no validation messages, and a checkbox labelled "Plate leftovers (unsafe)" |
| Responsive | The top navigation was hidden below `md` with no alternative, so the dashboards couldn't be reached on a phone |

## 2. What was built

### Public site (`app/(marketing)`)
Home, How it works, For restaurants, For NGOs, Our impact, About us, Contact, Privacy policy and Terms of service. The impact figures come live from `/analytics/metrics`, which excludes demo records. When they are zero, the page says the network is just starting and shows no numbers. There are no partner logos, testimonials or invented statistics. The contact form stores messages, which administrators see on their overview page.

### Authentication (`app/(auth)`, `app/api/auth/*`, `middleware.ts`)
* **Sign in:** email and password, show/hide toggle, "Keep me signed in for 7 days", forgot-password link, clear errors (wrong credentials, deactivated account, too many attempts, expired session, signed out).
* **Sign up:** choose an account type first (Food donor, NGO / food bank, Volunteer, Corporate). Then full name, organisation name where relevant, email, mobile, password with a strength meter and its three rules, confirm password, and consent to the Terms and Privacy policy. Validation runs in the browser and is enforced again on the server.
* **Email verification and password reset:** single-use tokens, stored hashed, that expire after 48 hours and 30 minutes respectively. Without SMTP configured, the email body with its link is written to the API log.
* **Sessions:** the API's JWT is stored in an **httpOnly, SameSite=Lax cookie** (`Secure` in production) set by a Next.js route handler. Page scripts never see the token. Browser calls go through a same-origin proxy (`/api/backend/*`) that adds the bearer header. Sessions last 8 hours, or 7 days with "keep me signed in".
* **Route guards:** `middleware.ts` sends anyone without a live session from `/dashboard/*` and `/onboarding` to `/login?next=…`, and sends signed-in users away from `/login` and `/signup`. The dashboard layout then redirects users whose role doesn't match the URL section. **The backend remains the authority:** changing the URL or a client role gains no access, because every API call is authorized server-side. The end-to-end test checks this (`/admin/users` returns 403 for a donor).

### Onboarding (`app/onboarding`)
* **Food donor:** business name and category, FSSAI number (14 digits), address and city with optional exact device location, pickup contact, operating hours, food categories, then documents.
* **NGO:** registered name, registration number (NGO Darpan / trust / society), FSSAI number if held, address, other operating locations, contact, daily meal capacity, accepted categories, then documents.
* **Volunteer:** phone, service area and location, available days and hours, vehicle type and carrying capacity.
* **Corporate:** company, industry, CIN/GSTIN, registered office, authorised representative and designation, business email and phone, then documents. Branches are managed afterwards.
* Documents (PDF, JPG or PNG, up to 5 MB, checked by magic bytes) are stored on disk under `UPLOAD_DIR` and listed for admins with download links.
* Verification states: **Pending, Under review, Verified, Rejected, Information required, Suspended**. Rejecting, suspending or requesting information requires a note, which the organisation sees in a banner and in a notification. Resubmitting details after a request for information or a rejection returns the case to Pending.

### Role workspaces (`app/dashboard/<role>`)
Every workspace uses the same shell and design system but has its own navigation and information architecture.

| Role | Sidebar |
|---|---|
| Donor | Overview, Create donation, My donations, Pickup tracking, Food inventory, Surplus predictions, Waste analytics, Reports, Branch management, Settings |
| NGO | Overview, Available donations, My requests, Food requirements, Inventory, Incoming deliveries, Distribution records, Demand forecasting, Impact reports, Settings |
| Volunteer | Overview, Available tasks, My assignments, Route navigation, Pickup verification, Delivery history, Availability, Profile |
| Admin | Overview, Verification requests, Rescue operations, Incidents, Users, Organizations, Donations, Audit logs, Food safety, Reports, System settings |
| Corporate | Overview, Branches, Food rescue activity, Waste analytics, Sustainability reports, CSR performance, Subscription, Settings |

Details that matter operationally:
* **Custody codes.** Each pickup task now has two single-use codes. The donor's pickup code is shown only to the donor; the NGO's delivery code only to the NGO; the volunteer never receives either and must get each from the person handing over. Codes are shown as QR codes with a copy button. The volunteer enters a code, or scans it with the camera where the browser supports `BarcodeDetector`. A code used at the wrong step is rejected.
* **Match reasons** on Available donations are computed from the listing: distance, time left, category match and capacity. Nothing is hard-coded.
* **Surplus predictions** average each weekday's listed quantity over the last 8 weeks, and appear only with at least 3 weeks of history. The method is stated on the page.
* **Demand forecasting** compares each requirement with the weekly average delivered over the last 4 weeks.
* **Route navigation** embeds OpenStreetMap maps for each stop and links to OSM directions from the volunteer's live or saved location.
* **The listing assistant and regulation Q&A** appear only when a real language model is configured (`GET /ai/status`). The mock provider used by tests returns a fixed biryani listing for any input, so the UI says these features aren't available rather than showing invented output.
* **Subscription** says billing isn't available, rather than showing a plan or price picker.
* **CSV export** is available on My donations, Reports, Distribution records, Sustainability and Admin reports.

## 3. Backend changes

New or extended endpoints (all under `/api/v1`):

| Area | Endpoints |
|---|---|
| Auth | `POST /auth/register` (phone, organisation name, consent, password policy, duplicate email and phone checks, rate limited), `POST /auth/login` (`remember`, failure rate limit with `Retry-After`), `POST /auth/verify-email`, `POST /auth/resend-verification`, `POST /auth/forgot-password`, `POST /auth/reset-password`, `GET/PATCH /auth/me`, `POST /auth/change-password`, `POST /auth/onboarding` |
| Organisations | `GET /organizations/mine`, `PATCH /organizations/{id}/profile`, real document upload, `GET …/documents`, `GET …/documents/{doc}/file`, verification notes and notifications |
| Donations | `GET /donations/?org_id=`, `GET /donations/available`. History is exposed as status and time only |
| Claims | `GET /claims/organization/{org_id}` |
| Pickups | `GET /pickups/available`, `POST /pickups/accept/{donation_id}`, `GET /pickups/mine`, `GET /pickups/donation/{id}` |
| Demands | `GET /demands/?org_id=`, `DELETE /demands/{id}` |
| Analytics | `GET /analytics/organization/{id}`, `/analytics/volunteer`, `/analytics/platform` |
| Admin | `/admin/overview`, `/admin/users` (+ activate/deactivate), `/admin/organizations`, `/admin/donations`, `/admin/audit-logs`, `/admin/contact-messages`, `/admin/system` |
| Other | `/incidents` (report, list, update), `POST /contact/`, `GET /notifications/`, `POST /notifications/read-all`, `GET /ai/status` |

Schema migration `002_accounts_onboarding` adds user, organisation, volunteer and pickup-task fields and creates `auth_tokens`, `incidents` and `contact_messages`. It was tested up, down and up again on PostgreSQL 16. Administrators are created with `python -m app.scripts.create_admin --email … --name …`; public sign-up can never create one.

### Security and correctness fixes found along the way
* **Claim IDOR:** any signed-in user could claim on behalf of any NGO by passing its `org_id`. Claims now require membership of the claiming organisation.
* **Unauthorised transitions:** any user could publish or cancel any donation. Only the listing organisation or operations staff can now.
* **Unauthorised pickup assignment:** anyone could assign any volunteer to any donation. Only staff or the claiming NGO can now; volunteers accept for themselves.
* **Delivery without the recipient:** one code covered both pickup and delivery, so the volunteer who collected food could also confirm its delivery. Delivery now needs the NGO's own code.
* **Codes in the audit log:** custody codes were written to audit records visible to admins. Only the task ID is logged now.
* **Capacity check:** this was triggered by the organisation's *name* containing "Low Capacity". It now compares today's claimed quantity against the declared `daily_capacity`.
* **PostgreSQL-only failures** that the SQLite test suite couldn't catch, all of which would have broken production:
  * Registration audit rows, new-organisation memberships and knowledge-base chunks were flushed before their parent rows, causing foreign-key violations.
  * Assigning a volunteer who hadn't completed a profile violated the `volunteers` foreign key.
  * Timezone-aware times from browsers (`…Z`) couldn't be written to the naive `TIMESTAMP` columns. All incoming datetimes are now normalised to naive UTC.
* **Past deadlines:** donations with a pickup deadline in the past can no longer be created or published.
* **`/auth/me` crash:** the endpoint returned 500 for stored email addresses that `EmailStr` rejects on output. Responses no longer re-validate stored emails.
* **Date-dependent test:** `test_e2e_journey` had a hard-coded date (9 October 2026) that had passed. It now uses relative times.

## 4. Test results

| Suite | Result |
|---|---|
| Backend pytest, SQLite | **19 passed** (11 original + 8 new) |
| Backend pytest, PostgreSQL 16 (`TEST_DATABASE_URL`) | **19 passed**. Added to CI as a separate job |
| Frontend `next lint`, `tsc --noEmit`, `next build` | Clean. All 65 pages and 3 route handlers build |
| Browser end-to-end (Playwright, Chrome, against the live API on PostgreSQL) | **73/73 checks passed** |
| Accessibility (axe-core, WCAG 2.0/2.1 A + AA) | **0 violations** on 12 public pages and every admin, NGO, volunteer and corporate page |

The end-to-end run covered, with fresh accounts each time:
* all public pages, the Telugu toggle and the contact form
* client-side validation on sign-up, onboarding, the contact form and the donation form
* sign-up and onboarding for all four account types, including a real document upload and the email confirmation link
* route guards with no session, the wrong role and an expired session; the 403 on the admin API
* admin verification, including a request for information whose note appears in the organisation's banner
* the full rescue journey through the UI: publish, then claim, accept, pickup code, a rejected wrong-step code, delivery code, then completion
* notifications, incident reporting, the audit log, analytics charts and the table view
* every sidebar link for all five roles (47 pages)
* mobile layouts (390px) with no horizontal overflow, and the mobile drawer
* sign-out, password reset, the remember-me cookie lifetime, the httpOnly cookie not being readable by page scripts, and the login rate limit

The only console messages during the run were the HTTP 400/403/404/429 responses that the negative tests provoke on purpose. There were no JavaScript errors.

## 5. Known limitations

* **Individual / community member** accounts aren't offered; the brief marked them "if supported", and they need their own workflow.
* **Phone verification** waits for an SMS provider (`SMS_PROVIDER`); the UI says so. Phone numbers are still validated and checked for duplicates.
* **Email** goes to the API log until `SMTP_HOST` is set.
* **Rate limits** are kept in process memory: fine for one API instance, but multiple instances need a shared store (Redis is already configured).
* **Branch addresses** have no coordinates of their own, so distances for branch listings use the organisation's main location (the form explains this).
* **QR scanning by camera** needs `BarcodeDetector` (Chrome, Edge and Android). Other browsers enter the code by hand.
* **Telugu** covers the public navigation and hero only.
* **Migrations** aren't run automatically by the API container. Run `alembic upgrade head` on deploy.
* There's no dark mode.
