# Step 13 Implementation Plan: Frontend Dashboard

---

## 1. Objective

Build a modern, responsive, production-grade **Frontend Dashboard** for RicozIngest that connects seamlessly to the existing backend (Steps 1–12). The frontend will provide an intuitive interface for data engineers and developers to:
- Authenticate securely (JWT-based registration, login, session persistence, logout).
- Manage Sources (REST API, databases, etc.) and Destinations (MongoDB, etc.) without exposing sensitive credentials.
- Orchestrate, configure, and inspect ETL Pipelines.
- Trigger manual pipeline executions with live progress indicators and concurrency guards (HTTP 409 handling).
- Monitor execution history, run status, error diagnostics, and throughput metrics (`recordsExtracted`, `recordsTransformed`, `recordsLoaded`).
- Configure Incremental Sync checkpoints and cursor tracking.
- Manage automated pipeline schedules (Intervals & Cron expressions) with one-click enable/disable controls.
- Design, configure, and visually preview Data Transformations & Field Mappings (projections, renaming, casting, defaults, string transforms, PII masking via redaction and SHA-256 hashing, metadata injection) with zero risk of writing to destination databases during preview.

---

## 2. Current Frontend Assessment

An inspection of the workspace root (`d:\Recozingest`) and server repository reveals:
1. **Frontend Directory**: No `client/` directory currently exists in the workspace.
2. **Current Project Structure**:
   ```
   d:\Recozingest\
   └── server\
       ├── src\
       │   ├── config\
       │   ├── connectors\
       │   ├── controllers\
       │   ├── middleware\
       │   ├── models\
       │   ├── routes\
       │   ├── services\
       │   └── utils\
       ├── server.js
       ├── package.json
       └── test-step*.js
   ```
3. **Backend Communication**:
   - Backend runs on `http://localhost:3000` (configurable via `process.env.PORT`).
   - CORS is already globally enabled in `server/server.js` (`app.use(cors())`).
   - All protected backend APIs expect `Authorization: Bearer <token>`.
4. **Conclusion**:
   - We will initialize a clean, lightweight, high-performance **React + Vite** application in `client/`.
   - We will configure Vite proxy (`/api` -> `http://localhost:3000`) for seamless local development without cross-origin configuration friction.
   - We will use Vanilla CSS with a curated Design System (custom properties, clean dark/light themes, typography, and card tokens) to deliver a modern dashboard without heavy unnecessary dependencies.

---

## 3. Frontend Architecture

The frontend will be structured in `client/` following modular separation of concerns:

```
client/
├── public/
│   └── favicon.svg
├── src/
│   ├── assets/               # Brand assets and SVG icons
│   ├── components/           # Reusable UI components
│   │   ├── common/           # Button, Input, Modal, Badge, Card, Spinner, Alert, Table
│   │   ├── layout/           # Sidebar, Navbar, PageHeader, Container
│   │   ├── pipeline/         # PipelineCard, StatusBadge, ExecutionModal, RunHistoryTable
│   │   ├── transform/        # MappingRow, RuleSelector, TypeSelector, PreviewTable
│   │   └── schedule/         # ScheduleBadge, CronBuilder, IntervalPicker
│   ├── context/              # Global React contexts
│   │   ├── AuthContext.jsx   # User state, token lifecycle, login/logout
│   │   └── ToastContext.jsx  # Notification toasts for success/error feedback
│   ├── hooks/                # Custom React hooks
│   │   ├── useAuth.js        # Auth state consumer
│   │   ├── useToast.js       # Toast dispatch hook
│   │   └── useAsync.js       # Async state lifecycle helper
│   ├── layouts/              # Route layout wrappers
│   │   ├── AppLayout.jsx     # Authenticated dashboard layout (Sidebar + Nav + Content)
│   │   └── AuthLayout.jsx    # Centered unauthenticated layout for Login/Register
│   ├── pages/                # Top-level view pages
│   │   ├── auth/
│   │   │   ├── LoginPage.jsx
│   │   │   └── RegisterPage.jsx
│   │   ├── dashboard/
│   │   │   └── DashboardPage.jsx
│   │   ├── sources/
│   │   │   ├── SourcesListPage.jsx
│   │   │   └── SourceFormModal.jsx
│   │   ├── destinations/
│   │   │   ├── DestinationsListPage.jsx
│   │   │   └── DestinationFormModal.jsx
│   │   ├── pipelines/
│   │   │   ├── PipelinesListPage.jsx
│   │   │   ├── PipelineCreatePage.jsx
│   │   │   └── PipelineDetailPage.jsx  # Unified tabbed view (Overview, Runs, Sync, Schedule, Transform)
│   │   ├── history/
│   │   │   └── RunHistoryPage.jsx
│   │   └── NotFoundPage.jsx
│   ├── services/             # Centralized API service layer
│   │   ├── api.js            # Axios / fetch instance with auth & error interceptors
│   │   ├── auth.service.js
│   │   ├── source.service.js
│   │   ├── destination.service.js
│   │   ├── pipeline.service.js
│   │   └── pipelineRun.service.js
│   ├── utils/                # Formatting & validation helpers
│   │   ├── formatters.js     # Date, number, duration, and status formatters
│   │   ├── validators.js     # Field validation, cron syntax validation
│   │   └── constants.js      # Type enums, transform rules, defaults
│   ├── styles/               # Design system & theme styles
│   │   ├── index.css         # Global resets, CSS variables, typography
│   │   └── dashboard.css     # Data tables, cards, tabs, and form styles
│   ├── App.jsx               # Route definitions and context providers
│   └── main.jsx              # React DOM root entrypoint
├── index.html
├── package.json
└── vite.config.js
```

---

## 4. Design System & UI/UX Approach

The user interface will adhere to modern data platform design standards (resembling platforms like Databricks, Fivetran, or Airbyte):
- **Typography**: Inter / Outfit via Google Fonts with clear typographic hierarchy.
- **Color Palette**:
  - Background: Deep slate dark mode (`#0B0F19`) or crisp light mode (`#F8FAFC`).
  - Card & Surface: Elevated panels (`#111827` / `#FFFFFF`) with subtle 1px border accents (`#1F2937` / `#E2E8F0`).
  - Accent / Brand: Electric Indigo (`#6366F1`) and Cyan (`#06B6D4`).
  - Status Indicators:
    - Success: Emerald (`#10B981`)
    - Running / In-Flight: Amber pulse (`#F59E0B`)
    - Failed: Rose (`#EF4444`)
    - Inactive / Disabled: Muted Slate (`#64748B`)
- **Micro-Animations & Feedback**:
  - Pulse indicator when a pipeline execution is running.
  - Interactive toast notifications for API success/errors.
  - Skeleton loaders and animated spinners during asynchronous data fetching.
  - Hover states and tactile transitions on interactive buttons.

---

## 5. API Integration Plan (Exact Backend Endpoint Map)

The frontend will interact exclusively with the verified existing backend API endpoints:

| Domain | Method | Backend Route | Purpose in Frontend |
|---|---|---|---|
| **Auth** | `POST` | `/api/auth/register` | Register new user account |
| **Auth** | `POST` | `/api/auth/login` | Login and acquire JWT |
| **Auth** | `GET` | `/api/auth/me` | Fetch authenticated user profile & verify session |
| **Sources** | `GET` | `/api/sources` | List user's sources |
| **Sources** | `POST` | `/api/sources` | Create new source connector config |
| **Sources** | `GET` | `/api/sources/:id` | Fetch single source details |
| **Sources** | `PUT` | `/api/sources/:id` | Update source connector config |
| **Sources** | `DELETE`| `/api/sources/:id` | Remove source connector |
| **Destinations** | `GET` | `/api/destinations` | List user's destination targets |
| **Destinations** | `POST` | `/api/destinations` | Create new destination config |
| **Destinations** | `GET` | `/api/destinations/:id`| Fetch single destination details |
| **Destinations** | `PUT` | `/api/destinations/:id`| Update destination config |
| **Destinations** | `DELETE`| `/api/destinations/:id`| Remove destination connector |
| **Pipelines** | `GET` | `/api/pipelines` | List all user pipelines |
| **Pipelines** | `POST` | `/api/pipelines` | Create pipeline (with optional syncMode, schedule, transformations) |
| **Pipelines** | `GET` | `/api/pipelines/:id` | Fetch complete pipeline configuration |
| **Pipelines** | `PUT` | `/api/pipelines/:id` | Update pipeline name, status, syncMode, cursor, transformations |
| **Pipelines** | `DELETE`| `/api/pipelines/:id` | Delete pipeline |
| **Execution** | `POST` | `/api/pipelines/:id/run` | Trigger manual pipeline run (handles 409 concurrency lock) |
| **Run History**| `GET` | `/api/pipelines/:id/runs` | Fetch run history scoped to specific pipeline with pagination |
| **Run History**| `GET` | `/api/pipeline-runs` | Fetch global run history across all pipelines with pagination |
| **Run History**| `GET` | `/api/pipeline-runs/:id` | Fetch granular run details & error message diagnostics |
| **Schedule** | `GET` | `/api/pipelines/:id/schedule` | Retrieve schedule configuration |
| **Schedule** | `PUT` | `/api/pipelines/:id/schedule` | Update schedule type, expression, enabled state |
| **Schedule** | `PATCH`| `/api/pipelines/:id/schedule/enable` | One-click enable schedule |
| **Schedule** | `PATCH`| `/api/pipelines/:id/schedule/disable` | One-click disable schedule |
| **Transform** | `GET` | `/api/pipelines/:id/transform` | Fetch transformation & field mapping configuration |
| **Transform** | `PUT` | `/api/pipelines/:id/transform` | Save transformation & field mapping configuration |
| **Transform** | `POST` | `/api/pipelines/:id/transform/preview` | Preview transformations in-memory (zero destination writes) |

---

## 6. Authentication & Session Strategy

1. **Storage**:
   - The JWT token will be stored in `localStorage` under `ricozingest_token`.
   - The user profile (`id`, `name`, `email`) will be stored in React state within `AuthContext`.
2. **App Initialization / Rehydration**:
   - On initial page load, `AuthProvider` checks for the token in `localStorage`.
   - If present, it executes `GET /api/auth/me` to validate the token and rehydrate user state.
   - If the token is invalid or expired (401 response), `localStorage` is cleared and the user is redirected to `/login`.
3. **Route Protection**:
   - `ProtectedRoute` component checks `isAuthenticated`. If false and loading is complete, it renders `<Navigate to="/login" replace state={{ from: location }} />`.
   - Public route guard redirects already-authenticated users from `/login` or `/register` directly to `/dashboard`.
4. **Centralized Interceptor**:
   - The API client automatically attaches `Authorization: Bearer <token>` to all outgoing requests.
   - Any `401 Unauthorized` response automatically invokes `logout()`, clears state, and redirects to login with an error toast message ("Session expired. Please log in again.").

---

## 7. Page Structure & User Workflows

### 7.1. Login & Registration (`/login`, `/register`)
- Clean, focused card design with branding.
- Form validation: email format, required password, minimum length.
- Clear error alerts if credentials fail.
- Smooth link transition between Login and Register.

### 7.2. Main Dashboard (`/dashboard`)
- **Metric Cards (KPIs)**:
  - Total Pipelines & Active Pipelines count
  - Scheduled Pipelines count
  - Total Records Ingested & Transformed (computed from run history)
  - Run Success Rate (% of SUCCESS vs FAILED runs)
- **Recent Executions Widget**:
  - Live table showing the last 5 pipeline executions with status pills, execution duration, and record counts.
- **Active Schedules Widget**:
  - Cards showing pipelines scheduled to run next, with countdown / next execution timestamp.
- **Quick Actions**:
  - "New Pipeline", "New Source", "New Destination", "View Run History".

### 7.3. Sources Management (`/sources`)
- List of configured sources displayed in grid cards or data table.
- Source Type badge (`REST_API`, `POSTGRESQL`, `MYSQL`, `CSV`).
- "New Source" modal form:
  - Dynamic fields based on selected `type`:
    - `REST_API`: URL, HTTP Method (`GET`, `POST`), custom headers JSON/key-value builder.
  - Friendly connection status badge.
- Edit Source modal (allows updating name and config).
- Delete Source with confirmation dialog.

### 7.4. Destinations Management (`/destinations`)
- List of configured destinations.
- Destination Type badge (`MONGODB`, `POSTGRESQL`, `MYSQL`, `CSV`).
- **Security**: The backend never returns stored `uri` or `password` in `formatDestination()`. The UI displays connection details cleanly (e.g. Database name, Collection name) without requesting or revealing credentials.
- "New Destination" modal form:
  - Dynamic fields for `MONGODB`:
    - Connection URI (`mongodb://...` with password masked input), Database name, Collection name.
- Edit Destination modal (allows updating name and target collection).
- Delete Destination with confirmation dialog.

### 7.5. Pipelines List (`/pipelines`)
- Data table displaying:
  - Name
  - Source & Destination tags
  - Status toggle (`ACTIVE` / `INACTIVE`)
  - Sync Mode badge (`FULL` / `INCREMENTAL`)
  - Schedule status badge (`Enabled` / `Disabled`)
  - Transformation status badge (`Active` / `Pass-through`)
  - Last Synced timestamp
  - Action buttons: "Run Now", "Configure", "Delete"
- "Create Pipeline" button leading to `/pipelines/new`.

### 7.6. Pipeline Create Wizard (`/pipelines/new`)
- Intuitive 3-step setup:
  1. **Basics**: Pipeline Name, select Source, select Destination, Status.
  2. **Sync Mode**: Choose `FULL` (reloads all records) or `INCREMENTAL` (requires `cursorField`, e.g. `id` or `updatedAt`).
  3. **Transformations (Optional)**: Enable transformations or keep as identity pass-through.
- On submit, redirects directly to the newly created pipeline's Detail Page.

### 7.7. Pipeline Details Page (`/pipelines/:id`)
A central, tabbed hub containing all facets of the pipeline:
1. **Overview Tab**:
   - Summary cards: Source connection, Destination target, Current Status, Sync Mode, Checkpoint Cursor, Schedule summary, Transformation count.
   - Quick "Run Pipeline" button with live spinner and status banner.
   - Edit Pipeline settings modal.
2. **Execution & Run History Tab**:
   - Execution banner showing status of latest execution.
   - Paginated historical runs table specific to this pipeline (`GET /api/pipelines/:id/runs`).
   - Detailed modal for inspectable error messages on failed runs.
3. **Incremental Sync Tab**:
   - Visual checkpoint card explaining the current sync mechanics:
     - Sync Mode (`FULL` vs `INCREMENTAL`).
     - Cursor Field (e.g. `id`).
     - Last Committed Checkpoint Value (e.g. `105`).
     - Last Sync Timestamp.
   - "Reset Checkpoint" button (sets `cursorValue: null` so next run re-baselines safely).
4. **Schedule Tab**:
   - Schedule configuration card:
     - Toggle: Enabled / Disabled (triggers `PATCH /enable` or `/disable`).
     - Schedule Type: `INTERVAL` (e.g. `15m`, `1h`, `1d`) vs `CRON` (e.g. `*/10 * * * *`).
     - Next scheduled run timestamp with live countdown.
     - Last scheduled run timestamp.
     - Interactive form to modify and save schedule expressions.
5. **Transformations & Preview Tab**:
   - Transformation toggle: Enable / Disable.
   - Settings: `includeUnmapped` (Keep unmapped fields vs strict projection), `addMetadata` (inject `_ingestedAt` & `_pipelineId`).
   - **Visual Field Mapping Table**:
     - Dynamic rows: `sourceField`, `destinationField`, `dataType` (`STRING`, `NUMBER`, `BOOLEAN`, `DATE`, `JSON`), `defaultValue`, `transformRule` (`NONE`, `UPPERCASE`, `LOWERCASE`, `TRIM`, `MASK_REDACT`, `MASK_HASH`).
     - "Add Mapping Row" / "Delete Row" controls.
   - **Interactive Live Preview Panel**:
     - JSON sample editor with sample source records.
     - "Generate Preview" button calling `POST /api/pipelines/:id/transform/preview`.
     - Side-by-side or tabbed comparison of original input vs transformed output.
     - Explicit warning banner: *"Preview executes purely in-memory. Zero records are written to your destination database."*

### 7.8. Global Run History (`/history`)
- Unified audit log of all runs across the tenant.
- Filters: Filter by Pipeline dropdown, filter by Status (`SUCCESS`, `FAILED`, `RUNNING`), filter by Trigger (`MANUAL`, `SCHEDULED`).
- Pagination controls (Page navigation, limit selector 10 / 25 / 50).
- Detailed view modal showing:
  - Error diagnosis with credential redaction verification.
  - Throughput counts (`recordsExtracted`, `recordsTransformed`, `recordsLoaded`).
  - Execution runtime duration (completedAt - startedAt).

---

## 8. Component Structure & Hierarchy

```
Components
├── Common
│   ├── Button.jsx           # Variant (primary, secondary, danger, ghost), size, loading state
│   ├── Input.jsx            # Text, password, number inputs with validation errors
│   ├── Select.jsx           # Dropdown selector
│   ├── Switch.jsx           # Clean boolean toggle switch
│   ├── Badge.jsx            # Color-coded status pills (green, red, yellow, slate)
│   ├── Modal.jsx            # Accessible overlay modal with backdrop click and Esc close
│   ├── Card.jsx             # Card container with title, subtitle, and action slots
│   ├── Spinner.jsx          # CSS-based loading spinner
│   ├── EmptyState.jsx       # Informative empty placeholder with icon & action CTA
│   └── Table.jsx            # Responsive data table with header, rows, and empty state
├── Layout
│   ├── Navbar.jsx           # Current user greeting, quick status, logout button
│   ├── Sidebar.jsx          # Primary navigation (Dashboard, Pipelines, Sources, Destinations, History)
│   └── PageHeader.jsx       # Breadcrumbs, page title, and top action buttons
├── Pipeline
│   ├── PipelineCard.jsx     # Overview card for pipeline lists
│   ├── ExecutionModal.jsx   # Live progress modal during pipeline execution
│   └── RunHistoryTable.jsx  # Reusable execution history table with pagination
├── Schedule
│   ├── IntervalPicker.jsx   # Presets (15m, 1h, 6h, 1d) + custom interval input
│   └── CronBuilder.jsx      # Cron expression input with human-readable helper text
└── Transform
    ├── MappingRow.jsx       # Individual mapping row with input, selects, and remove button
    ├── PreviewModal.jsx     # Side-by-side JSON / Table comparison modal
    └── RuleBadge.jsx        # Pill displaying active transform rules (e.g. HASH, REDACT)
```

---

## 9. State Management Strategy

1. **Global Auth State (`AuthContext`)**:
   - `user`: `{ id, name, email }` or `null`.
   - `token`: JWT string or `null`.
   - `loading`: boolean (initial session rehydration).
   - Functions: `login(email, password)`, `register(name, email, password)`, `logout()`.
2. **Global Notification State (`ToastContext`)**:
   - Toast queue: array of `{ id, type: 'success' | 'error' | 'info', message }`.
   - Dispatches toasts with auto-dismiss after 4000ms.
3. **Local Page & Form State**:
   - React `useState` and `useEffect` for data-fetching, modals, and forms.
   - Form changes tracked locally with immediate validation feedback before API dispatch.
4. **Concurrency & Execution Lock Handling**:
   - When a pipeline is executing (`POST /api/pipelines/:id/run`), the execution button enters `loading` and `disabled` state.
   - If the backend returns `409 Conflict` (due to concurrent run or background scheduler), the UI gracefully displays: *"Pipeline is currently running. Concurrent executions are not permitted."* and polls/refreshes pipeline state.

---

## 10. Security & Credential Protection Considerations

1. **No Sensitive Data Stored in LocalStorage**:
   - Only the standard session JWT is saved in `localStorage`.
   - No database connection strings, passwords, or secrets are ever persisted in the browser.
2. **Credential Sanitization in UI**:
   - Destination MongoDB connection URIs are write-only during creation.
   - Backend `formatDestination()` automatically removes `uri`, `password`, and `secret`. The UI never displays them or expects them back in read operations.
3. **Tenant Isolation**:
   - The UI strictly sends the `Authorization: Bearer <token>` on all requests.
   - All authorization and data isolation is enforced server-side via `req.user.id`. The UI never attempts to filter or authorize cross-user data locally.
4. **Safe Error Presentation**:
   - Backend error messages from `PipelineExecutionService` are already sanitized (stripping credentials and URIs). The UI displays these safely without risk of exposing infrastructure secrets.

---

## 11. Backend Compatibility & Missing Endpoint Analysis

According to Requirement 19:
> *"The frontend must work with the existing backend without changing backend behavior unnecessarily. Use the actual existing API response structures discovered during inspection. Do not invent endpoints. If an endpoint is missing, document it in the implementation plan rather than silently assuming it exists."*

### Inspection Finding: Source & Destination Connection Testing
- **Existing Connectors**: Both `RestApiConnector.js` and `MongoDbConnector.js` have functional `testConnection()` methods.
- **Existing Controller Routes**:
  - `source.routes.js` provides: `POST /`, `GET /`, `GET /:id`, `PUT /:id`, `DELETE /:id`.
  - `destination.routes.js` provides: `POST /`, `GET /`, `GET /:id`, `PUT /:id`, `DELETE /:id`.
- **Status of Dedicated Test Endpoints**:
  - `POST /api/sources/:id/test` and `POST /api/destinations/:id/test` **do NOT currently exist as dedicated HTTP routes**.
  - Connection testing is currently invoked automatically by the backend inside `PipelineExecutionService.executePipeline` and `pipeline.controller.js` (`previewTransformations`).
- **Frontend Compatibility Strategy**:
  1. The frontend Source and Destination management UI will provide full CRUD support using the verified routes.
  2. For Connection Testing:
     - The pipeline detail page offers "Run Connection Test & Preview" via the existing `POST /api/pipelines/:id/transform/preview` endpoint (which verifies source connection and fetches sample records without writing to destination).
     - If dedicated standalone test buttons are desired on `/sources` and `/destinations`, we can add two small, lightweight controller actions (`testSourceConnection`, `testDestinationConnection`) in Phase 6/7. Otherwise, the frontend will accurately reflect the connector status based on the latest pipeline execution results.

---

## 12. Frontend Testing Strategy

A comprehensive multi-layer testing plan:

### 12.1. Component & Unit Tests
- Form validation tests (empty inputs, invalid emails, invalid intervals/crons).
- Data formatting tests (date strings, number commas, duration elapsed).
- Transformation mapping row generation and rule selection logic.

### 12.2. End-to-End User Journey Tests (via Browser Subagent / Automated Script)
1. **User Authentication Flow**:
   - Register new user -> verify redirect to dashboard.
   - Log out -> verify redirect to `/login`.
   - Log in -> verify JWT saved and dashboard loaded.
2. **Source & Destination Setup**:
   - Create REST API source (using local mock or test API).
   - Create MongoDB destination.
   - Verify sources and destinations appear in list views.
3. **Pipeline Creation & Execution**:
   - Create new pipeline linking source and destination.
   - Trigger manual execution from UI.
   - Verify loading spinner, verify execution summary displayed (recordsExtracted, recordsTransformed, recordsLoaded).
   - Verify execution added to Run History table.
4. **Incremental Sync Verification**:
   - Set pipeline to `INCREMENTAL` with cursor `id`.
   - Execute run 1 -> verify checkpoint updates in UI.
   - Execute run 2 -> verify UI indicates 0 new records extracted.
5. **Scheduling Verification**:
   - Configure schedule expression (`15m`), enable schedule.
   - Verify "Active" badge and "Next Run" calculation in UI.
   - Disable schedule -> verify next run cleared.
6. **Transformation & Preview Verification**:
   - Configure field mappings: rename field, cast type, uppercase name, mask SSN, hash email, inject metadata.
   - Click "Preview Transformation" -> verify preview table shows transformed columns and masked values.
   - Confirm destination collection is untouched after preview.
   - Execute pipeline -> verify destination contains transformed records.
7. **Error Handling & Concurrency**:
   - Trigger execution while already running -> verify 409 Conflict notification.
   - Enter invalid schedule -> verify 400 validation error toast.
   - Simulate expired token -> verify automatic redirect to login.

### 12.3. Backend Regression Verification
- Run existing test suites:
  - `server/test-step9.js`
  - `server/test-step10.js`
  - `server/test-step11.js`
  - `server/test-step12.js`
- Ensure 100% pass rate is preserved across all backend functionality.

---

## 13. Files to Create

All frontend code will reside in `client/`:

| File | Purpose |
|---|---|
| `client/index.html` | HTML document shell with Google Fonts and viewport metadata |
| `client/vite.config.js` | Vite build configuration with React plugin and `/api` proxy to backend |
| `client/package.json` | Dependencies (`react`, `react-dom`, `react-router-dom`, `lucide-react`) and scripts (`dev`, `build`, `preview`) |
| `client/src/main.jsx` | React root renderer |
| `client/src/App.jsx` | Router setup, global layout routes, and context providers |
| `client/src/styles/index.css` | Design system variables, typography, reset, card tokens, form inputs |
| `client/src/styles/dashboard.css` | Layout styles, sidebar, tables, status pills, tabs, mapping editor |
| `client/src/context/AuthContext.jsx` | Authentication state, token rehydration, login/register/logout handlers |
| `client/src/context/ToastContext.jsx` | Toast notification provider & queue manager |
| `client/src/hooks/useAuth.js` | Convenience hook for `AuthContext` |
| `client/src/hooks/useToast.js` | Convenience hook for `ToastContext` |
| `client/src/services/api.js` | Centralized fetch/axios HTTP client with JWT interceptor & 401 handling |
| `client/src/services/auth.service.js` | Login, register, getMe API methods |
| `client/src/services/source.service.js` | Source CRUD API methods |
| `client/src/services/destination.service.js` | Destination CRUD API methods |
| `client/src/services/pipeline.service.js` | Pipeline CRUD, execution, schedule, and transformation API methods |
| `client/src/services/pipelineRun.service.js` | Run history query and single run lookup API methods |
| `client/src/utils/formatters.js` | Timestamp formatting, duration calculation, number formatting |
| `client/src/utils/constants.js` | Status options, connector types, data types, transform rules |
| `client/src/components/common/Button.jsx` | Accessible button with variants and loading state |
| `client/src/components/common/Input.jsx` | Form text/password/number input with error labeling |
| `client/src/components/common/Select.jsx` | Dropdown select component |
| `client/src/components/common/Badge.jsx` | Status badge pill (Success, Running, Failed, Active, Inactive) |
| `client/src/components/common/Modal.jsx` | Backdrop modal container with close button |
| `client/src/components/common/Card.jsx` | Reusable dashboard card container |
| `client/src/components/common/Spinner.jsx` | Loading animation indicator |
| `client/src/components/common/EmptyState.jsx`| Empty data placeholder with CTA button |
| `client/src/components/common/Toast.jsx` | Toast notification component |
| `client/src/components/layout/Navbar.jsx` | Top navigation bar with user profile and quick logout |
| `client/src/components/layout/Sidebar.jsx` | Left navigation bar with navigation links and icon indicators |
| `client/src/components/pipeline/RunHistoryTable.jsx` | Table rendering runs with status, metrics, and pagination |
| `client/src/components/transform/MappingRow.jsx` | Interactive row for configuring a source-to-destination field mapping |
| `client/src/layouts/AppLayout.jsx` | Dashboard shell layout (Sidebar + Navbar + `<Outlet />`) |
| `client/src/layouts/AuthLayout.jsx` | Clean layout for Login & Registration views |
| `client/src/pages/auth/LoginPage.jsx` | User login form |
| `client/src/pages/auth/RegisterPage.jsx` | User registration form |
| `client/src/pages/dashboard/DashboardPage.jsx` | Main KPI overview, recent runs, active pipelines |
| `client/src/pages/sources/SourcesListPage.jsx` | Source management page with creation modal |
| `client/src/pages/destinations/DestinationsListPage.jsx` | Destination management page with creation modal |
| `client/src/pages/pipelines/PipelinesListPage.jsx` | Pipeline list with quick run and status toggles |
| `client/src/pages/pipelines/PipelineCreatePage.jsx` | Step-by-step pipeline creation wizard |
| `client/src/pages/pipelines/PipelineDetailPage.jsx` | Unified tabbed pipeline hub (Overview, History, Sync, Schedule, Transform) |
| `client/src/pages/history/RunHistoryPage.jsx` | Global execution history view with filtering and pagination |
| `client/src/pages/NotFoundPage.jsx` | 404 page with return link |

---

## 14. Files to Modify (Backend / Root)

| File | Proposed Change | Rationale |
|---|---|---|
| `server/package.json` | Add root dev script or concurrently runner (optional) | Allows starting both client and server conveniently |
| `server/src/controllers/source.controller.js` | *(Optional)* Add lightweight connection test handler if needed | Fulfills standalone source test action without pipeline |
| `server/src/controllers/destination.controller.js` | *(Optional)* Add lightweight connection test handler if needed | Fulfills standalone destination test action without pipeline |

*(Note: Backend changes are strictly optional and backward-compatible. All existing endpoints and behaviors remain 100% intact.)*

---

## 15. Implementation Order (Phase Breakdown)

To maintain stability and facilitate verification, Step 13 will be executed across **17 sequential phases**:

- **Phase 1: Project Scaffolding & Configuration**
  - Initialize `client/` with Vite and React.
  - Configure `vite.config.js` with API proxying to `http://localhost:3000`.
  - Install core frontend dependencies (`react-router-dom`, `lucide-react`).
- **Phase 2: Core Design System & Global Styles**
  - Create `index.css` and `dashboard.css` with CSS variables, typography, color tokens, and utility classes.
- **Phase 3: Centralized API Service Layer**
  - Implement `api.js` with auth headers, error handling, and 401 redirect logic.
  - Implement domain service modules (`auth`, `source`, `destination`, `pipeline`, `pipelineRun`).
- **Phase 4: Authentication State & Routing Infrastructure**
  - Implement `AuthContext` and `ToastContext`.
  - Build `AuthLayout`, `LoginPage`, and `RegisterPage`.
  - Configure router with `ProtectedRoute` guards.
- **Phase 5: Dashboard Layout & Navigation**
  - Build `Sidebar`, `Navbar`, and `AppLayout`.
  - Create `DashboardPage` with KPI metrics, summary cards, and quick actions.
- **Phase 6: Source Management UI**
  - Implement `SourcesListPage` and Source Creation/Edit Modal.
  - Connect with `GET /api/sources`, `POST /api/sources`, `DELETE /api/sources/:id`.
- **Phase 7: Destination Management UI**
  - Implement `DestinationsListPage` and Destination Creation/Edit Modal.
  - Connect with `GET /api/destinations`, `POST /api/destinations`, `DELETE /api/destinations/:id`.
- **Phase 8: Pipeline List & Creation Wizard**
  - Implement `PipelinesListPage` with status pills and actions.
  - Implement `PipelineCreatePage` wizard for selecting source, destination, and sync mode.
- **Phase 9: Pipeline Details Hub (Overview Tab)**
  - Implement `PipelineDetailPage` layout with tabs.
  - Build Overview tab with configuration cards, status pills, and edit modal.
- **Phase 10: Manual Pipeline Execution UI**
  - Implement "Run Pipeline" button with loading state.
  - Integrate with `POST /api/pipelines/:id/run`.
  - Add execution summary modal with throughput indicators and 409 conflict handling.
- **Phase 11: Run History & Execution Diagnostics**
  - Implement `RunHistoryTable` with pagination controls.
  - Build pipeline-scoped run history tab and global `/history` page.
  - Add failed run diagnostics modal with sanitized error messages.
- **Phase 12: Incremental Sync UI**
  - Build Incremental Sync tab in `PipelineDetailPage`.
  - Display cursor field, current checkpoint value, and last sync timestamp.
  - Add checkpoint reset action.
- **Phase 13: Scheduling Management UI**
  - Build Schedule tab in `PipelineDetailPage`.
  - Implement interval presets, cron expression input, and next run countdown.
  - Add one-click enable/disable toggle actions (`PATCH /enable`, `PATCH /disable`).
- **Phase 14: Transformation & Field Mapping UI**
  - Build Transformations tab in `PipelineDetailPage`.
  - Implement dynamic `MappingRow` list for source/destination fields, type casting, defaults, string rules, and PII masking.
- **Phase 15: Transformation Preview UI**
  - Build interactive preview panel with JSON sample editor.
  - Connect with `POST /api/pipelines/:id/transform/preview`.
  - Render side-by-side comparison table of original vs transformed data.
- **Phase 16: Polishing, Responsiveness & State Feedback**
  - Implement skeleton loading states, empty state placeholders, and error toasts across all pages.
  - Optimize layout responsiveness for desktop, laptop, and tablet screens.
- **Phase 17: End-to-End Verification & Regression Testing**
  - Perform live browser walkthrough of complete user lifecycle.
  - Run all backend regression test suites (`test-step9.js`, `test-step10.js`, `test-step11.js`, `test-step12.js`).

---

## 16. Risks and Mitigations

| Risk | Impact | Mitigation Strategy |
|---|---|---|
| **CORS / Proxy Misconfiguration** | API requests blocked in browser during development | Configure Vite `server.proxy` to forward `/api` requests directly to backend port 3000. Backend `server.js` already includes global `cors()` middleware as fallback. |
| **Token Expiry During Active Session** | Unhandled 401 errors causing broken UI states | Centralized `api.js` response interceptor intercepts 401s, clears token, flashes friendly toast notification, and redirects cleanly to `/login`. |
| **Concurrent Pipeline Runs (409 Conflict)** | User clicks "Run" multiple times or scheduler fires simultaneously | Frontend disables "Run" button and shows loading state while request is in flight. Backend returns 409, which frontend catches and displays as an informative warning rather than a generic error. |
| **Accidental Destination Writes During Transformation Preview** | Test records pollute destination database | `TransformationService.previewTransformation` and `POST /api/pipelines/:id/transform/preview` are architected purely in-memory and never initialize or write to the destination connector. Frontend clearly labels preview with a non-destructive guarantee badge. |
| **Sensitive Credential Exposure in Frontend** | Database passwords or API keys leaked in state or DOM | Frontend never requests or displays stored credentials. Destination passwords/URIs are sanitized by the backend on creation/retrieval. |

---

## 17. Plan Verification & Conclusion

This implementation plan covers all 23 planning requirements specified in the user request, provides a complete blueprint for the Step 13 frontend dashboard, respects all existing backend APIs from Steps 1–12, and ensures zero regression across prior modules.
