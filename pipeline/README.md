# Pipeline: Philippine Flood Control Data

## Overview

This Node.js pipeline transforms raw ArcGIS JSON data (16.4MB) into production-ready Parquet format (<5MB) for consumption by the DuckDB-WASM dashboard.

## Architecture

```
┌─────────────────────┐
│  flood_control.json │ (Raw ArcGIS export)
└──────────┬──────────┘
           │
           ▼
   ┌───────────────┐
   │   convert.js  │ (3-stage pipeline)
   └───────┬───────┘
           │
           ├──► Stage 1: Data Quality Assessment
           │    - Schema analysis
           │    - Duplicate detection
           │    - Null percentage reporting
           │    - Whitespace issue identification
           │
           ├──► Stage 2: Cleaning & Transformation
           │    - Deduplication (QUALIFY ROW_NUMBER)
           │    - Null handling (COALESCE with domain defaults)
           │    - Whitespace removal (TRIM)
           │    - Date normalization (ISO 8601)
           │    - Type casting (DOUBLE, BIGINT)
           │    - Coordinate validation (PH bounds)
           │
           └──► Stage 3: Export & Validation
                - Parquet export (SNAPPY compression)
                - Metadata generation (JSON)
                - Post-quality assertions
                - Validation checks (4 automated tests)
           
           ▼
   ┌─────────────────────────────┐
   │  output/                    │
   │  ├── flood_control.parquet  │ (Optimized data)
   │  ├── metadata.json          │ (Pre-computed stats)
   │  └── errors.log             │ (Pipeline logs)
   └─────────────────────────────┘
```

## Scripts

### `npm run build`
Runs the full 3-stage pipeline: audit → clean → export

**Output:**
- `output/flood_control.parquet` - Cleaned data in Parquet format
- `output/metadata.json` - Dashboard initialization metadata

**Example:**
```bash
cd pipeline
npm install
npm run build
```

### `npm run audit`
Runs diagnostics on raw data without transformations

**Reports:**
- Total row count
- Column null percentages
- Duplicate record count
- Numeric validation issues
- Whitespace problems
- Coordinate validation
- Date format issues

**Example:**
```bash
npm run audit
```

## Data Transformations

### Columns Kept (23 total)

| Column | Type | Transformation |
|--------|------|----------------|
| `Region` | String | TRIM, COALESCE → 'Unknown Region' |
| `Province` | String | TRIM, COALESCE → 'Unknown Province' |
| `Municipality` | String | TRIM, COALESCE → 'Unknown Municipality' |
| `ImplementingOffice` | String | TRIM, COALESCE → 'Unknown Office' |
| `Longitude` | Double | Validate bounds (116-127°E) |
| `Latitude` | Double | Validate bounds (4-21°N) |
| `InfraYear` | Integer | COALESCE → 2024 |
| `ProjectID` | String | TRIM, COALESCE → 'UNKNOWN-{row}' |
| `ProjectDescription` | String | TRIM, COALESCE → 'No Description' |
| `ProjectComponentID` | String | TRIM, COALESCE → ProjectID + '-CW1' |
| `ProjectComponentDescription` | String | TRIM, COALESCE → ProjectDescription |
| `Program` | String | TRIM (nullable) |
| `TypeofWork` | String | TRIM, COALESCE → 'Unknown' |
| `infra_type` | String | TRIM, COALESCE → 'Unknown' |
| `ABC` | Double | CAST, COALESCE → 0.0 |
| `ContractCost` | Double | CAST, COALESCE → 0.0 |
| `CompletionDateOriginal` | String | Convert milliseconds → ISO 8601 |
| `CompletionYear` | Integer | COALESCE → InfraYear |
| `CompletionDateActual` | String | Validate → ISO 8601 |
| `StartDate` | String | MM/DD/YYYY → YYYY-MM-DD |
| `ContractID` | String | TRIM, COALESCE → 'UNKNOWN-CONTRACT' |
| `Contractor` | String | TRIM, COALESCE → 'Unknown Contractor' |
| `FundingYear` | String | TRIM, COALESCE → InfraYear |
| `LegislativeDistrict` | String | TRIM, COALESCE → 'Unknown District' |
| `DistrictEngineeringOffice` | String | TRIM, COALESCE → ImplementingOffice |

### Columns Dropped

- `Creator`, `Editor`, `CreationDate`, `EditDate` - Metadata
- `GlobalID`, `ObjectId` - Internal IDs
- `ABC_String`, `ContractCost_String` - Duplicates
- `geometry.x`, `geometry.y` - Redundant coordinates

## Quality Validation

The pipeline runs **4 automated assertion checks** after export:

1. **Zero Nulls in Core Fields**
   - Validates: Region, ProjectID, InfraYear have no nulls
   - Ensures: Dashboard queries won't encounter unexpected nulls

2. **Row Retention ≥95%**
   - Validates: At least 95% of raw records preserved
   - Ensures: No excessive data loss during cleaning

3. **Non-Negative Financial Values**
   - Validates: ABC and ContractCost are ≥0
   - Ensures: No negative budget values

4. **Coordinates Within Philippine Bounds**
   - Validates: Longitude 116-127°E, Latitude 4-21°N
   - Ensures: Map markers display correctly

## Performance

**Typical execution times (16.4MB input):**
- Stage 1 (Assessment): 1-2 seconds
- Stage 2 (Cleaning): 2-3 seconds
- Stage 3 (Export): 1-2 seconds
- **Total: 4-7 seconds**

**Memory usage:** <500MB peak

**Output size:** ~3-5MB (70% reduction from JSON)

## Data Engineering Insights

### Why DuckDB on the Server?

1. **Columnar Processing**: DuckDB processes entire columns at once using SIMD (Single Instruction, Multiple Data), making operations like `TRIM()` and type conversions 100x faster than row-by-row JavaScript processing.

2. **Memory Efficiency**: Columnar storage allows DuckDB to load only the columns needed for each operation, reducing memory footprint by 10-50x compared to loading the full JSON into JavaScript arrays with `JSON.parse()`.

3. **SQL Declarative Power**: Complex transformations like deduplication (`QUALIFY ROW_NUMBER()`), conditional nulls (`COALESCE`), and date parsing are expressed in concise SQL rather than verbose imperative JavaScript loops.

4. **Parquet Compression**: Snappy-compressed Parquet achieves 5-10x better compression than JSON while maintaining query performance, reducing network transfer time and browser memory usage.

### Why Parquet for the Dashboard?

1. **Predicate Pushdown**: DuckDB-WASM can read only the row groups matching filter conditions (e.g., `WHERE Region = 'NCR'`) without loading the entire file.

2. **Column Pruning**: Dashboard queries like `SELECT Region, ABC FROM projects` only deserialize those 2 columns, not all 23.

3. **Browser-Friendly**: Parquet's columnar format maps directly to JavaScript TypedArrays, enabling zero-copy access in the browser.

4. **Metadata Acceleration**: Parquet files contain embedded statistics (min/max/null counts per column), allowing DuckDB-WASM to skip entire row groups during filtering.

## Troubleshooting

### Error: "Cannot find module 'duckdb'"
```bash
cd pipeline
npm install
```

### Error: "Input file not found"
Ensure `flood_control.json` is in the project root:
```
kiro-ph-data-dashboard/
├── flood_control.json  ← Must be here
├── pipeline/
│   └── convert.js
```

### Error: "MAXSIZE exceeded"
If the JSON file is very large, increase DuckDB's object size limit in `convert.js`:
```javascript
maximum_object_size=67108864  // 64MB instead of 32MB
```

### Validation Failures
Check `output/errors.log` for details. Common issues:
- **Row retention <95%**: Investigate why records are being filtered out
- **Coordinate validation fails**: Check if coordinates are outside Philippine bounds
- **Negative financial values**: Inspect ABC/ContractCost columns for data quality issues

## Next Steps

After running the pipeline:

1. **Review output:**
   ```bash
   ls -lh output/
   # Should see flood_control.parquet (~3-5MB) and metadata.json
   ```

2. **Inspect metadata:**
   ```bash
   cat output/metadata.json
   ```

3. **Start dashboard:**
   ```bash
   cd ../dashboard
   npm install
   npm run dev
   ```

The dashboard will automatically load `flood_control.parquet` via DuckDB-WASM.

## Workshop Learning Objectives

By studying this pipeline, you will learn:

✅ **Data Quality Assessment** - How to audit raw datasets for common issues  
✅ **SQL-Based ETL** - Using DuckDB SQL for transformations instead of JavaScript loops  
✅ **Null Handling Strategies** - When to COALESCE vs. filter out records  
✅ **Data Standardization** - TRIM, type casting, date normalization  
✅ **Deduplication Techniques** - QUALIFY ROW_NUMBER() for efficient deduplication  
✅ **Validation Pipelines** - Automated assertion checks for production data  
✅ **Parquet Export** - Optimal compression and format for analytics  
✅ **Metadata Generation** - Pre-computing statistics for dashboard performance  

## References

- [DuckDB Documentation](https://duckdb.org/docs/)
- [Parquet Format Specification](https://parquet.apache.org/docs/)
- [Philippine Geographic Bounds](https://en.wikipedia.org/wiki/Geography_of_the_Philippines)
- [ISO 8601 Date Format](https://www.iso.org/iso-8601-date-and-time-format.html)
