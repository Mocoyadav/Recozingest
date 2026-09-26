# Step 12 Implementation Plan: Data Transformation & Field Mapping Engine

---

## 1. Step 12 Feature Name
**Data Transformation & Field Mapping Engine (Pipeline Schema Mapping & Transformation)**

---

## 2. Purpose
Enable RicozIngest users to transform, filter, rename, cast, and sanitize records extracted from source connectors before they are loaded into destination connectors. 

This transitions RicozIngest from a simple EL (Extract-Load) pipeline into a full **ETL / ELT (Extract-Transform-Load)** platform, giving users total control over the schema and content of the data loaded into destination databases.

Key capabilities:
- **Field Selection & Projection**: Choose specific fields to keep or omit (`includeUnmapped: false` vs `true`).
- **Field Renaming / Aliasing**: Map source property names to destination property names (e.g., `id` → `externalId`, `title` → `postTitle`).
- **Data Type Casting**: Safely convert types (e.g., String to Number, String to ISO Date, Boolean conversion).
- **Default Values**: Supply fallback values when source fields are missing or null.
- **Value Transformations**: String formatting (`UPPERCASE`, `LOWERCASE`, `TRIM`) and privacy masking (`MASK_REDACT`, `MASK_HASH` for PII protection).
- **Metadata Injection**: Optional injection of ingestion metadata (`_ingestedAt`, `_pipelineId`).
- **Interactive Transformation Preview**: Test and validate transformation rules against sample records before execution without writing to destination.

---

## 3. Why This Feature is the Logical Next Step for RicozIngest
1. **The Ingestion Reality**: In real-world data engineering, source schemas rarely match destination requirements. For example, in Step 6 (`test-connectors.js`), records from JSONPlaceholder had to be manually mapped in code (`externalId: r.id, title: r.title, body: r.body, ingestedAt: new Date()`). Currently, pipelines have no configuration to do this automatically.
2. **Natural Architectural Progression**:
   - Steps 1–5: Core entities (Auth, Sources, Destinations).
   - Step 6: Connector abstraction (`extract`, `loadBatch`).
   - Steps 7–8: Pipeline orchestration & execution.
   - Step 9: Run history & execution logs.
   - Step 10: Incremental sync (filtering records at extraction).
   - Step 11: Pipeline scheduling (automating execution frequency).
   - **Step 12: Data Transformation (completing the core Extract → Transform → Load lifecycle)**.
3. **Data Security & PII Protection**: Allows users to strip unneeded or sensitive fields (e.g. passwords, internal IDs, user contact info) or mask them before persisting into target databases.
4. **Preserves Prior Modules**: Sits cleanly between `extract()` and `loadBatch()`, leaving connector contracts, incremental cursor mechanics, schedule loops, and tenant isolation fully intact.

---

## 4. Existing Architecture & Components Involved

```
[ Source ] 
    ↓ (extract)
[ Raw Records ] 
    ↓
★ [ Transformation Engine (Step 12) ] ★ 
    ↓ (transformed records)
[ Destination ] (loadBatch)
```

Existing components interacting with Step 12:
- **`Pipeline.js` (Model)**: Extends schema to store `transformations` configuration.
- **`PipelineRun.js` (Model)**: Tracks `recordsTransformed` in addition to `recordsExtracted` and `recordsLoaded`.
- **`PipelineExecutionService.js` (Service)**: Orchestrates the pipeline lifecycle: loads pipeline → extracts records → invokes `TransformationService.transformRecords()` → loads transformed batch into destination.
- **`pipeline.controller.js` (Controller)**: Validates transformation configurations, exposes transformation CRUD and preview APIs.
- **`pipelineRun.controller.js` (Controller)**: Exposes `recordsTransformed` in execution history.
- **`pipeline.routes.js` (Routes)**: Mounts transformation configuration and preview routes.
- **`cursor.util.js` & Incremental Sync**: Incremental sync evaluates the source cursor from raw extracted records, ensuring transformed field aliases do not break cursor progression.
- **`scheduler.service.js`**: Scheduled jobs automatically execute transformation rules configured on the pipeline.

---

## 5. Proposed Architecture

### Dedicated Transformation Service
Create `server/src/services/transformation.service.js` containing pure, reusable, side-effect-free transformation logic:
- `transformRecords(records, transformationConfig, context)`: Processes a batch of records.
- `transformRecord(record, transformationConfig, context)`: Processes an individual record.
- `castDataType(val, targetType, defaultValue)`: Safely casts values to `STRING`, `NUMBER`, `BOOLEAN`, `DATE`, `JSON`.
- `applyRule(val, rule)`: Applies `UPPERCASE`, `LOWERCASE`, `TRIM`, `MASK_REDACT`, `MASK_HASH`.
- `validateTransformationConfig(config)`: Validates mapping rules, field names, and types.
- `previewTransformation(sampleRecords, transformationConfig)`: Pure execution for preview API.

---

## 6. Files to Create
1. **`server/src/services/transformation.service.js`**: Pure transformation and casting engine.
2. **`server/test-step12.js`**: Comprehensive test suite verifying all Step 12 features, preview endpoint, incremental synergy, scheduled execution, security, and full regression.

---

## 7. Files to Modify
1. **`server/src/models/Pipeline.js`**: Add `transformations` subdocument schema.
2. **`server/src/models/PipelineRun.js`**: Add `recordsTransformed: { type: Number, default: 0 }`.
3. **`server/src/services/pipelineExecution.service.js`**: Insert transformation step between extraction and loading; record `recordsTransformed`.
4. **`server/src/controllers/pipeline.controller.js`**: Add `getTransformations`, `updateTransformations`, and `previewTransformations` handlers; update `formatPipeline`.
5. **`server/src/controllers/pipelineRun.controller.js`**: Include `recordsTransformed` in `formatPipelineRun`.
6. **`server/src/routes/pipeline.routes.js`**: Add routes for `GET /:id/transform`, `PUT /:id/transform`, and `POST /:id/transform/preview`.

---

## 8. Database / Schema Changes

### `Pipeline.js` Schema Addition
```javascript
transformations: {
  enabled: {
    type: Boolean,
    default: false
  },
  includeUnmapped: {
    type: Boolean,
    default: true
  },
  addMetadata: {
    type: Boolean,
    default: false
  },
  fieldMappings: [
    {
      sourceField: {
        type: String,
        required: true,
        trim: true
      },
      destinationField: {
        type: String,
        required: true,
        trim: true
      },
      dataType: {
        type: String,
        enum: ['STRING', 'NUMBER', 'BOOLEAN', 'DATE', 'JSON'],
        default: null
      },
      defaultValue: {
        type: mongoose.Schema.Types.Mixed,
        default: null
      },
      transformRule: {
        type: String,
        enum: ['NONE', 'UPPERCASE', 'LOWERCASE', 'TRIM', 'MASK_REDACT', 'MASK_HASH'],
        default: 'NONE'
      }
    }
  ]
}
```

### `PipelineRun.js` Schema Addition
```javascript
recordsTransformed: {
  type: Number,
  default: 0
}
```

---

## 9. API Endpoints

All endpoints are protected by `authMiddleware` and scoped to `userId: req.user.id`:

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/pipelines/:id/transform` | Retrieve current transformation configuration |
| `PUT` | `/api/pipelines/:id/transform` | Update transformation configuration (enabled, fieldMappings, includeUnmapped, addMetadata) |
| `POST` | `/api/pipelines/:id/transform/preview` | Preview transformation on sample payload without executing or persisting |
| `POST` | `/api/pipelines` | Supports optional `transformations` during pipeline creation |
| `PUT` | `/api/pipelines/:id` | Supports updating `transformations` in standard pipeline update |

---

## 10. Detailed Execution Flow

```
1. PipelineExecutionService.executePipeline(pipelineId, userId, options)
   ↓
2. Acquire concurrency lock (isRunning: true)
   ↓
3. Extract records from sourceConnector.extract({ cursorField, cursorValue, syncMode })
   ↓
4. Calculate candidate cursor for incremental sync from RAW records
   (Ensures cursorField lookup matches the source record structure)
   ↓
5. Transformation Stage:
   If pipeline.transformations?.enabled:
       transformedRecords = TransformationService.transformRecords(
           records, 
           pipeline.transformations, 
           { pipelineId: pipeline._id, userId }
       )
       recordsTransformed = transformedRecords.length
   Else:
       transformedRecords = records (pass-through)
       recordsTransformed = records.length
   ↓
6. Update PipelineRun: recordsExtracted, recordsTransformed
   ↓
7. Load into destinationConnector.loadBatch(transformedRecords)
   ↓
8. Destination confirms insertion:
   - Commit incremental checkpoint to pipeline.cursorValue (if incremental)
   - Update PipelineRun: status: 'SUCCESS', recordsLoaded: insertedCount
   ↓
9. finally:
   - Release lock (isRunning: false)
   - Finalize destination connector (destinationConnector.finalize())
```

---

## 11. Security Considerations
- **Tenant Isolation**: Transformation configuration and preview endpoints are strictly authenticated and scoped by `userId: req.user.id`. Cross-user access returns `404 Not Found`.
- **Credential Protection**:
  - Transformation rules are strictly schema mappings. No connection strings, tokens, or secrets are accepted or stored in `transformations`.
  - Sensitive error messages during transformation failures are passed through `sanitizeErrorMessage`.
- **PII Protection**:
  - `MASK_REDACT` replaces sensitive values with `"[REDACTED]"`.
  - `MASK_HASH` hashes sensitive values with SHA-256 for anonymized joins/analytics.

---

## 12. Error Handling & Resilience
- **Type Casting Resilience**: If a source record cannot be cast to the specified `dataType` (e.g. converting non-numeric text to `NUMBER`), the engine falls back to `defaultValue` (or `null`) rather than failing the entire batch, unless strictly invalid.
- **Fail-Safe Checkpoint**: If an unhandled error occurs during transformation, the catch block marks the run as `FAILED`, and the pipeline's incremental checkpoint remains untouched (rollback guarantee).
- **Concurrency & Finalize**: Concurrency lock (`isRunning`) is released and `destinationConnector.finalize()` is executed in `finally`.

---

## 13. Backward Compatibility Considerations
- If `transformations` is omitted, `null`, or `enabled: false`, the transformation step defaults to a zero-overhead pass-through.
- Existing pipelines from Steps 1–11 will continue operating identically without any configuration changes.
- Existing API responses (`POST /api/pipelines/:id/run`) maintain all previous fields while adding `recordsTransformed`.

---

## 14. Automated Test Cases (`test-step12.js`)
1. **Transformation Utility Unit Tests**:
   - Field renaming (`id` → `externalId`, `title` → `postTitle`).
   - Field projection (`includeUnmapped: false` excludes unmapped fields; `includeUnmapped: true` retains them).
   - Data type casting (`String` → `Number`, `String` → `Date`, etc.).
   - Default values applied when source fields are missing or null.
   - String transforms (`UPPERCASE`, `LOWERCASE`, `TRIM`).
   - PII masking (`MASK_REDACT`, `MASK_HASH`).
   - Metadata injection (`_ingestedAt`, `_pipelineId`).
2. **Transformation Configuration APIs**:
   - `PUT /api/pipelines/:id/transform` updates config and validates mappings.
   - Rejects invalid mapping format (`400 Bad Request`).
   - `GET /api/pipelines/:id/transform` returns transformation configuration.
3. **Interactive Preview API**:
   - `POST /api/pipelines/:id/transform/preview` tests transformation on sample records and returns preview without DB writes.
4. **End-to-End Pipeline Execution with Transformations**:
   - Run pipeline with mappings: source posts `{ id, title, body }` transformed to `{ externalId, postTitle, content, ingestedAt }`.
   - Verify documents stored in MongoDB destination match the transformed schema.
   - Verify `PipelineRun` records `recordsExtracted: 100`, `recordsTransformed: 100`, `recordsLoaded: 100`.
5. **Incremental Sync Synergy**:
   - Incremental pipeline with `cursorField: 'id'` and transformation mapping `id` → `externalId`.
   - Verify cursor progression continues to track correctly on `id` while destination receives `externalId`.
6. **Scheduled Execution Synergy**:
   - Scheduled run automatically applies transformations.
7. **Cross-User Tenant Isolation**:
   - User B attempting to view, update, or preview User A's transformation rules receives `404 Not Found`.

---

## 15. Regression Test Plan for Steps 1–11
- Steps 1–3: Authentication & JWT endpoints.
- Steps 4–5: Source & Destination CRUD.
- Step 6: Connector abstraction & contract tests (`test-connectors.js`).
- Steps 7–8: Pipeline CRUD & manual execution.
- Step 9: Run history, pagination, sanitization (`test-step9.js`).
- Step 10: Incremental sync, two-phase checkpoint commit, failure rollback (`test-step10.js`).
- Step 11: Pipeline scheduling, concurrency lock, `tick()` processing (`test-step11.js`).

---

## 16. Definition of Done
1. `server/src/services/transformation.service.js` created and unit tested.
2. `Pipeline` model updated with `transformations` subdocument.
3. `PipelineRun` model updated with `recordsTransformed`.
4. `PipelineExecutionService` seamlessly executes the transform step.
5. All transformation APIs (`GET`, `PUT`, `POST preview`) operational and protected.
6. End-to-end automated test suite `server/test-step12.js` passes all tests.
7. Regression test suites for Steps 6, 9, 10, and 11 pass 100%.

---

## 17. Risks & Potential Issues
| Risk | Severity | Mitigation |
|---|---|---|
| Deeply nested source objects (e.g. `user.profile.address`) | Medium | Implement dot-notation field resolver in `transformation.service.js`. |
| Incremental cursor field collision if renamed | High | Candidate cursor calculation evaluates against the source record *before* or *during* mapping using `cursorField`. |
| Invalid source data types causing crash | Low | Safe casting with fallback defaults prevents batch aborts. |
