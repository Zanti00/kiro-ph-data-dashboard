# Product Requirements Document: Philippine Flood Control Data Dashboard

## 1. Overview

### 1.1 Product Purpose
A public-facing web dashboard that visualizes Philippine flood control infrastructure projects from Department of Public Works and Highways (DPWH) data. The dashboard enables citizens, researchers, and policymakers to explore geographic distribution, budget allocation, project timelines, and contractor performance across Philippine flood control initiatives.

### 1.2 Target Users
- **Primary**: General public seeking transparency in infrastructure spending
- **Secondary**: Researchers, journalists, policy analysts
- **Tertiary**: DPWH stakeholders monitoring project progress

### 1.3 Data Source
- **File**: `flood_control.json` (16.4MB)
- **Format**: ArcGIS Feature Layer export
- **Content**: ~3,000+ flood control infrastructure projects
- **Update Frequency**: One-time static dataset (no live updates planned)

---

## 2. System Architecture

### 2.1 High-Level Architecture
```
┌─────────────────┐      ┌──────────────┐      ┌─────────────────┐
│  flood_control  │─────▶│   Pipeline   │─────▶│   Dashboard     │
│     .json       │      │  (Node.js +  │      │ (React + Vite + │
│   (16.4 MB)     │      │   DuckDB)    │      │  DuckDB-WASM)   │
└─────────────────┘      └──────────────┘      └─────────────────┘
                              │                          │
                              ▼                          ▼
                         .parquet file              Browser (User)
```

### 2.2 Technology Stack
| Component | Technology | Justification |
|-----------|-----------|---------------|
| **Pipeline** | Node.js + DuckDB | Native performance for JSON → Parquet conversion |
| **Frontend** | Vite + React 18 + TypeScript | Fast dev experience, type safety |
| **In-Browser DB** | DuckDB-WASM | Client-side SQL queries on Parquet |
| **Styling** | Tailwind CSS | Rapid UI development |
| **Charts** | Chart.js | Lightweight, flexible charting |
| **Maps** | Leaflet + react-leaflet | Free, no API keys, good PH coverage |
| **State Management** | React Context | Sufficient for single-page filter state |
| **Deployment** | Static site (Vercel) | No backend needed, fast CDN delivery |

---

## 3. Pipeline Requirements

### 3.1 Functional Requirements

#### FR-P1: Data Extraction
**Description**: Extract project records from ArcGIS JSON structure  
**Input**: `flood_control.json` with nested `features[].attributes` structure  
**Output**: Flat array of project records  
**Acceptance Criteria**:
- Successfully parse all features from JSON
- Handle malformed records gracefully (log and skip)
- Preserve all records (no data loss)

#### FR-P2: Data Cleaning
**Description**: Remove unnecessary columns and metadata  
**Columns to Drop**:
- ArcGIS metadata: `Creator`, `Editor`, `CreationDate`, `EditDate`, `GlobalID`, `ObjectId`
- Duplicate data: `ABC_String`, `ContractCost_String` (keep numeric versions)
- Geometry metadata: `geometry.x`, `geometry.y` (keep `Longitude`, `Latitude`)

**Columns to Keep** (23 total):
- **Geographic**: Region, Province, Municipality, ImplementingOffice, Longitude, Latitude
- **Project**: InfraYear, ProjectID, ProjectDescription, ProjectComponentID, ProjectComponentDescription
- **Classification**: Program, TypeofWork, infra_type
- **Financial**: ABC, ContractCost
- **Timeline**: CompletionDateOriginal, CompletionYear, CompletionDateActual, StartDate
- **Contractor**: ContractID, Contractor, FundingYear, LegislativeDistrict, DistrictEngineeringOffice

**Acceptance Criteria**:
- Output contains exactly 23 columns
- No dropped columns remain in output
- All kept columns have correct data types

#### FR-P3: Date Normalization
**Description**: Standardize date formats for consistent querying

**Transformations**:
1. `CompletionDateOriginal`: Convert from Unix milliseconds (e.g., `1720828800000`) to ISO 8601 string (`2024-07-13`)
2. `CompletionDateActual`: Already in `YYYY-MM-DD` format, validate and keep
3. `StartDate`: Convert from `MM/DD/YYYY` (e.g., `02/15/2024`) to `YYYY-MM-DD` (`2024-02-15`)

**Acceptance Criteria**:
- All dates are valid ISO 8601 strings
- Null dates remain null (no placeholder dates)
- Invalid dates logged as warnings but not dropped

#### FR-P4: Parquet Export
**Description**: Write cleaned data to Parquet format  
**Output Location**: `pipeline/output/flood_control.parquet`  
**Compression**: Snappy (default)  
**Acceptance Criteria**:
- File size < 5MB (significant reduction from 16.4MB JSON)
- File is readable by DuckDB-WASM
- All rows preserved (no data loss)

#### FR-P5: Metadata Generation
**Description**: Pre-compute aggregations for faster dashboard initialization  
**Output File**: `pipeline/output/metadata.json`

**Metadata Contents**:
```json
{
  "totalProjects": 3142,
  "totalABC": 45000000000,
  "totalContractCost": 44500000000,
  "regions": ["Region I", "Region II", ...],
  "years": [2020, 2021, 2022, 2023, 2024],
  "typeOfWork": ["Construction of Flood Mitigation Structure", ...],
  "generatedAt": "2026-07-24T10:30:00Z"
}
```

**Acceptance Criteria**:
- Metadata matches Parquet data exactly
- Generated in <5 seconds
- Valid JSON format

### 3.2 Non-Functional Requirements

#### NFR-P1: Performance
- Conversion completes in <10 seconds on standard laptop
- Memory usage < 500MB during conversion

#### NFR-P2: Error Handling
- Log malformed records to `pipeline/errors.log`
- Continue processing on individual record errors
- Fail fast on file read/write errors

#### NFR-P3: Idempotency
- Running conversion multiple times produces identical output
- No side effects beyond output files

---

## 4. Dashboard Requirements

### 4.1 Functional Requirements

#### FR-D1: Data Loading
**Description**: Load Parquet file and initialize DuckDB-WASM  
**Loading Sequence**:
1. Show full-page skeleton loader
2. Fetch `flood_control.parquet` from `/data/`
3. Initialize DuckDB-WASM instance
4. Execute: `CREATE TABLE projects AS SELECT * FROM 'flood_control.parquet'`
5. Load metadata.json for initial summary
6. Hide skeleton, show dashboard

**Acceptance Criteria**:
- Loads successfully on Chrome, Firefox, Safari, Edge
- Shows progress indicator during load (percentage if possible)
- Retry up to 3 times on network failure
- Show user-friendly error message on final failure

#### FR-D2: Summary Cards
**Description**: Display key metrics at top of dashboard  
**Metrics** (4 cards):
1. **Total Projects**: Count of all projects
2. **Total Approved Budget (ABC)**: Sum of ABC column, formatted as PHP currency
3. **Total Contract Cost**: Sum of ContractCost column, formatted as PHP currency
4. **Budget Variance**: `(ABC - ContractCost) / ABC * 100`, displayed as percentage with positive/negative indicator

**Visual Design**:
- Card layout: 4 columns on desktop, 2 columns on tablet, 1 column on mobile
- Each card shows: icon, metric value, label, change indicator (if applicable)
- Skeleton loaders during data fetch

**Acceptance Criteria**:
- Calculations match SQL query results
- Currency formatted with PHP symbol and commas (e.g., "₱45,000,000,000")
- Updates in real-time when filters applied

#### FR-D3: Interactive Map
**Description**: Geographic visualization of all project locations

**Map Features**:
- **Base Layer**: OpenStreetMap tiles
- **Markers**: Circular markers for each project location (Longitude/Latitude)
- **Marker Clustering**: Group nearby markers when zoomed out (use `react-leaflet-cluster`)
- **Popup**: Click marker to show project card:
  - Project name
  - Municipality, Province
  - ABC and ContractCost
  - Contractor
  - Completion date
- **Heat Map Toggle**: Button to overlay heat map showing project density

**Interaction**:
- Click marker → apply region filter to all visualizations
- Double-click cluster → zoom into that area
- Pan and zoom controls

**Acceptance Criteria**:
- All projects with valid coordinates displayed
- Clustering works smoothly (no lag)
- Heat map updates when filters applied
- Initial view centers on Philippines (approximately 12.8797° N, 121.7740° E)

#### FR-D4: Budget by Region Chart
**Description**: Horizontal bar chart showing total budget allocation per region

**Chart Type**: Horizontal Bar Chart (Chart.js)  
**X-Axis**: Total ABC (PHP)  
**Y-Axis**: Region names (sorted by total ABC, descending)  
**Data Source**: 
```sql
SELECT Region, SUM(ABC) as TotalBudget 
FROM projects 
GROUP BY Region 
ORDER BY TotalBudget DESC
```

**Interaction**:
- Click bar → filter to that region
- Hover → tooltip showing exact value and project count

**Acceptance Criteria**:
- All regions displayed
- Bars sorted by value
- Responsive to container width
- Updates when filters applied

#### FR-D5: Projects Over Time Chart
**Description**: Line chart showing project count trends by infrastructure year

**Chart Type**: Line Chart (Chart.js)  
**X-Axis**: InfraYear (2020-2024)  
**Y-Axis**: Count of projects  
**Data Source**:
```sql
SELECT InfraYear, COUNT(*) as ProjectCount 
FROM projects 
GROUP BY InfraYear 
ORDER BY InfraYear
```

**Interaction**:
- Click point → filter to that year
- Hover → tooltip showing exact count

**Acceptance Criteria**:
- Line connects all years (no gaps)
- Y-axis starts at 0
- Smooth animation on data change

#### FR-D6: Completion Status Chart
**Description**: Doughnut chart showing completed vs. in-progress projects

**Chart Type**: Doughnut Chart (Chart.js)  
**Segments**: 
- Completed: `CompletionDateActual IS NOT NULL`
- In Progress: `CompletionDateActual IS NULL`

**Data Source**:
```sql
SELECT 
  CASE WHEN CompletionDateActual IS NOT NULL THEN 'Completed' ELSE 'In Progress' END as Status,
  COUNT(*) as Count
FROM projects
GROUP BY Status
```

**Interaction**:
- Click segment → filter to that status
- Hover → tooltip showing percentage and count

**Acceptance Criteria**:
- Percentages sum to 100%
- Colors: Green (completed), Yellow (in progress)
- Center shows total project count

#### FR-D7: Top Contractors Chart
**Description**: Bar chart showing top 10 contractors by total contract value

**Chart Type**: Horizontal Bar Chart (Chart.js)  
**X-Axis**: Total ContractCost (PHP)  
**Y-Axis**: Contractor names (top 10 only)  
**Data Source**:
```sql
SELECT Contractor, SUM(ContractCost) as TotalValue, COUNT(*) as ProjectCount
FROM projects
GROUP BY Contractor
ORDER BY TotalValue DESC
LIMIT 10
```

**Interaction**:
- Click bar → filter to that contractor
- Hover → tooltip showing total value and project count

**Acceptance Criteria**:
- Shows exactly 10 contractors (or fewer if <10 total)
- Sorted by value descending
- Truncate long contractor names with ellipsis

#### FR-D8: Type of Work Distribution Chart
**Description**: Pie chart showing breakdown of projects by work type

**Chart Type**: Pie Chart (Chart.js)  
**Data Source**:
```sql
SELECT TypeofWork, COUNT(*) as Count
FROM projects
GROUP BY TypeofWork
ORDER BY Count DESC
```

**Interaction**:
- Click slice → filter to that work type
- Hover → tooltip showing percentage and count

**Acceptance Criteria**:
- All work types displayed (no limit)
- Labels show percentage and type name
- Colors: standard data viz palette (blues, greens, purples)

#### FR-D9: Filter Toolbar
**Description**: Top toolbar with multi-select filters and URL state

**Filter Controls**:
1. **Region**: Multi-select dropdown (checkboxes)
2. **Province**: Multi-select dropdown (checkboxes, cascades from Region)
3. **InfraYear**: Multi-select dropdown (checkboxes)
4. **TypeOfWork**: Multi-select dropdown (checkboxes)
5. **Date Range**: Start and end date pickers (filters by CompletionDateActual)
6. **Clear All**: Button to reset all filters

**Filter Logic**:
- OR within same category (Region=NCR OR Region I)
- AND across categories (Region=NCR AND Year=2024)

**URL State**:
- Filters encoded in query params: `?regions=NCR,Region%20I&years=2024`
- On page load, parse URL and apply filters
- On filter change, update URL (use `history.pushState`)

**Acceptance Criteria**:
- Filter changes debounced (300ms)
- URL state shareable (copy/paste works)
- Province dropdown disabled if no region selected
- Filter counts show results (e.g., "Region (5 selected)")

#### FR-D10: Cross-Visualization Filtering
**Description**: Clicking any chart element or map marker applies filters

**Clickable Elements**:
- Map marker → filter by Region
- Bar chart bar → filter by that dimension
- Pie/doughnut slice → filter by that category
- Line chart point → filter by year

**Behavior**:
- Single-click adds filter (multi-select)
- Ctrl/Cmd+click toggles filter
- Filter updates URL and re-queries DuckDB

**Acceptance Criteria**:
- All visualizations update simultaneously
- No visual lag (<100ms)
- Clear indication of active filters (highlight in toolbar)

### 4.2 Non-Functional Requirements

#### NFR-D1: Performance
- Initial load time: <5 seconds on 4G connection
- Filter application: <200ms
- Smooth scrolling and interactions (60fps)
- Handle up to 5,000 projects without performance degradation

#### NFR-D2: Responsiveness
- Desktop-first design (1920x1080 primary target)
- Functional on tablet (768px+)
- Mobile responsive deferred to future iteration

#### NFR-D3: Browser Support
- Chrome 100+
- Firefox 100+
- Safari 15+
- Edge 100+

#### NFR-D4: Accessibility
- WCAG 2.1 Level AA compliance (best effort)
- Keyboard navigation for all filters
- ARIA labels on charts and interactive elements
- Sufficient color contrast (4.5:1 minimum)

#### NFR-D5: Error Handling
- Graceful degradation if DuckDB-WASM unsupported (show static summary)
- User-friendly error messages (no stack traces)
- Retry mechanism for network failures

---

## 5. Data Model

### 5.1 Parquet Schema
```typescript
interface FloodControlProject {
  // Geographic
  Region: string;
  Province: string;
  Municipality: string;
  ImplementingOffice: string;
  Longitude: number;
  Latitude: number;
  
  // Project
  InfraYear: number;
  ProjectID: string;
  ProjectDescription: string;
  ProjectComponentID: string;
  ProjectComponentDescription: string;
  
  // Classification
  Program: string | null;
  TypeofWork: string;
  infra_type: string;
  
  // Financial
  ABC: number;
  ContractCost: number;
  
  // Timeline
  CompletionDateOriginal: string; // ISO 8601
  CompletionYear: number;
  CompletionDateActual: string | null; // ISO 8601
  StartDate: string; // ISO 8601
  
  // Contractor
  ContractID: string;
  Contractor: string;
  FundingYear: string;
  LegislativeDistrict: string;
  DistrictEngineeringOffice: string;
}
```

### 5.2 Filter State Model
```typescript
interface FilterState {
  regions: string[];
  provinces: string[];
  years: number[];
  typeOfWork: string[];
  dateRange: {
    start: string | null; // ISO 8601
    end: string | null;   // ISO 8601
  };
}
```

---

## 6. User Stories

### 6.1 Core User Stories

**US-1: View Geographic Distribution**  
As a citizen, I want to see flood control projects on a map, so I can understand which areas are receiving infrastructure investment.

**Acceptance Criteria**:
- Map shows all project locations with markers
- Clicking marker shows project details
- Can zoom and pan across Philippines

---

**US-2: Compare Regional Budgets**  
As a researcher, I want to compare budget allocation across regions, so I can identify funding disparities.

**Acceptance Criteria**:
- Bar chart shows budget by region
- Regions sorted by total budget
- Clicking region filters all visualizations

---

**US-3: Track Project Completion**  
As a journalist, I want to see how many projects are completed vs. in-progress, so I can report on implementation status.

**Acceptance Criteria**:
- Doughnut chart shows completion percentage
- Can filter by completion status
- Summary cards update accordingly

---

**US-4: Identify Top Contractors**  
As a policy analyst, I want to see which contractors receive the most funding, so I can evaluate procurement patterns.

**Acceptance Criteria**:
- Chart shows top 10 contractors by value
- Displays total contract value and project count
- Can filter to specific contractor

---

**US-5: Share Filtered View**  
As any user, I want to share a specific filtered view via URL, so others can see the same insights.

**Acceptance Criteria**:
- URL updates when filters applied
- Copying URL and opening in new tab preserves filters
- Filters are human-readable in URL

---

## 7. Success Metrics

### 7.1 Technical Metrics
- [ ] Parquet file size < 5MB (70% reduction from JSON)
- [ ] Initial page load < 5 seconds (4G connection)
- [ ] Filter response time < 200ms
- [ ] Zero data loss during pipeline conversion

### 7.2 User Engagement Metrics (Future)
- Time on page
- Filter interaction rate
- Share URL click-through rate
- Geographic distribution of users

---

## 8. Future Enhancements (Out of Scope)

1. **Multi-Dataset Support**: Add other DPWH infrastructure types (roads, bridges)
2. **Mobile App**: React Native version for mobile users
3. **Export Features**: Download filtered data as CSV/Excel
4. **Comparison Mode**: Side-by-side comparison of two regions/years
5. **Administrative Login**: Allow DPWH to update data via upload
6. **Real-Time Updates**: Websocket integration for live project updates
7. **3D Visualization**: 3D bar chart showing budget over geography
8. **Historical Timeline**: Animated playback of project completion over time

---

## 9. Risks and Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| DuckDB-WASM browser incompatibility | High | Low | Fallback to JSON loading + client-side filtering |
| Parquet file too large for browser | High | Medium | Implement pagination or tile-based loading |
| Data quality issues (nulls, inconsistencies) | Medium | High | Comprehensive pipeline validation and logging |
| Performance degradation with filters | Medium | Medium | Optimize SQL queries, add debouncing |
| OpenStreetMap rate limiting | Low | Low | Self-host map tiles or use CDN |

---

## 10. Acceptance Criteria Summary

### Pipeline Acceptance
- ✅ Converts 16.4MB JSON to <5MB Parquet
- ✅ All 23 target columns present
- ✅ All dates normalized to ISO 8601
- ✅ Metadata.json generated
- ✅ Zero data loss (row count matches)

### Dashboard Acceptance
- ✅ Loads Parquet in <5 seconds
- ✅ All 6 visualizations render correctly
- ✅ Summary cards show accurate metrics
- ✅ Filters work across all visualizations
- ✅ URL state persists filters
- ✅ Map markers cluster properly
- ✅ Works on Chrome, Firefox, Safari, Edge

---

## 11. Timeline Estimate

| Phase | Tasks | Estimate |
|-------|-------|----------|
| **Pipeline Development** | JSON parser, data cleaning, Parquet export, metadata generation | 4-6 hours |
| **Dashboard Scaffolding** | Vite setup, Tailwind config, DuckDB-WASM integration | 2-3 hours |
| **Core Visualizations** | Map, charts, summary cards | 8-10 hours |
| **Filtering & State** | Filter UI, URL state, cross-filtering logic | 4-6 hours |
| **Polish & Testing** | Skeleton loaders, error handling, responsive design | 4-6 hours |
| **Total** | | **22-31 hours** |

---

## Appendix A: SQL Query Examples

### Query 1: Filtered Project List
```sql
SELECT * FROM projects
WHERE Region IN ('NCR', 'Region IV-A')
  AND InfraYear = 2024
  AND TypeofWork = 'Construction of Flood Mitigation Structure'
  AND CompletionDateActual BETWEEN '2024-01-01' AND '2024-12-31'
```

### Query 2: Summary Metrics with CTE
```sql
WITH filtered AS (
  SELECT * FROM projects
  WHERE Region IN (?)
    AND InfraYear IN (?)
)
SELECT
  COUNT(*) as TotalProjects,
  SUM(ABC) as TotalABC,
  SUM(ContractCost) as TotalContractCost,
  (SUM(ABC) - SUM(ContractCost)) / SUM(ABC) * 100 as BudgetVariance
FROM filtered
```

### Query 3: Multi-Dimensional Aggregation
```sql
SELECT
  Region,
  InfraYear,
  COUNT(*) as ProjectCount,
  SUM(ABC) as TotalBudget,
  AVG(ContractCost) as AvgCost
FROM projects
GROUP BY Region, InfraYear
ORDER BY Region, InfraYear
```

---

## Appendix B: Color Palette

**Summary Cards**: 
- Background: White (#FFFFFF)
- Text: Gray 900 (#111827)
- Accent: Blue 600 (#2563EB)

**Charts** (Standard Data Viz Palette):
- Primary: Blue 500 (#3B82F6)
- Secondary: Green 500 (#10B981)
- Tertiary: Purple 500 (#8B5CF6)
- Quaternary: Orange 500 (#F59E0B)
- Quinary: Pink 500 (#EC4899)

**Map**:
- Marker: Red (#EF4444)
- Cluster: Blue (#3B82F6)
- Heat Map: Red-Yellow gradient

---

**Document Version**: 1.0  
**Last Updated**: 2026-07-24  
**Author**: System Architect  
**Status**: Final - Ready for Implementation
