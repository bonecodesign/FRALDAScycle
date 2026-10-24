import { DIAPER_SIZES } from "./diaper-catalog.js";

export const MANUFACTURER_CATALOG_COLUMNS = Object.freeze([
  "product_key", "category", "brand", "model", "size",
  "min_age_months", "max_age_months", "min_weight_kg", "max_weight_kg",
]);

function fail(code, row = null) {
  return Object.assign(new Error(code), { code, row });
}

function csvRows(csv) {
  if (typeof csv !== "string" || csv.length < 1 || csv.length > 5_000_000) throw fail("invalid_catalog_csv");
  const rows = []; let row = [], field = "", quoted = false;
  for (let index = 0; index < csv.length; index++) {
    const char = csv[index];
    if (quoted) {
      if (char === '"' && csv[index + 1] === '"') { field += '"'; index++; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"' && field === "") quoted = true;
    else if (char === ",") { row.push(field); field = ""; }
    else if (char === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (char !== "\r") field += char;
  }
  if (quoted) throw fail("invalid_catalog_csv");
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows.filter(item => item.some(value => value !== ""));
}

function optionalNumber(value, { integer = false } = {}) {
  if (value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || (integer && !Number.isInteger(parsed))) return NaN;
  return parsed;
}

function completeRange(minimum, maximum, ceiling) {
  return minimum === null && maximum === null
    || Number.isFinite(minimum) && Number.isFinite(maximum) && minimum <= maximum && maximum <= ceiling;
}

export function parseManufacturerCatalogCsv(csv, metadata) {
  const manufacturer = String(metadata?.manufacturer ?? "").trim();
  let sourceUrl;
  try { sourceUrl = new URL(metadata?.sourceUrl); } catch { throw fail("invalid_catalog_source"); }
  if (!manufacturer || manufacturer.length > 120 || sourceUrl.protocol !== "https:" || sourceUrl.username || sourceUrl.password
      || !/^[a-f0-9]{64}$/i.test(metadata?.documentSha256 ?? "")
      || !/^\d{4}-\d{2}-\d{2}$/.test(metadata?.effectiveDate ?? "")) throw fail("invalid_catalog_source");

  const table = csvRows(csv);
  if (table.length < 2 || table.length > 10_001
      || table[0].length !== MANUFACTURER_CATALOG_COLUMNS.length
      || table[0].some((value, index) => value.trim() !== MANUFACTURER_CATALOG_COLUMNS[index])) {
    throw fail("invalid_catalog_columns");
  }
  const seen = new Set();
  const entries = table.slice(1).map((values, index) => {
    const row = index + 2;
    if (values.length !== MANUFACTURER_CATALOG_COLUMNS.length) throw fail("invalid_catalog_row", row);
    const [productKey, category, brand, model, size, minAgeValue, maxAgeValue, minWeightValue, maxWeightValue]
      = values.map(value => value.trim());
    const minAgeMonths = optionalNumber(minAgeValue, { integer: true });
    const maxAgeMonths = optionalNumber(maxAgeValue, { integer: true });
    const minWeightKg = optionalNumber(minWeightValue);
    const maxWeightKg = optionalNumber(maxWeightValue);
    if (!/^[A-Za-z0-9._-]{3,80}$/.test(productKey) || !["infant", "swim"].includes(category)
        || !brand || brand.length > 120 || !model || model.length > 160 || !DIAPER_SIZES.includes(size)
        || !completeRange(minAgeMonths, maxAgeMonths, 156)
        || !completeRange(minWeightKg, maxWeightKg, 100)
        || minAgeMonths === null && minWeightKg === null) throw fail("invalid_catalog_row", row);
    const identity = `${productKey}\u0000${size}`;
    if (seen.has(identity)) throw fail("duplicate_catalog_entry", row);
    seen.add(identity);
    return Object.freeze({ productKey, category, brand, model, size,
      minAgeMonths, maxAgeMonths, minWeightKg, maxWeightKg });
  });
  return Object.freeze({ manufacturer, sourceUrl: sourceUrl.toString(),
    documentSha256: metadata.documentSha256.toLowerCase(), effectiveDate: metadata.effectiveDate,
    status: "pending_first_review", entries: Object.freeze(entries) });
}

export function reviewManufacturerCatalog(batch, { reviewerId, decision }) {
  if (!batch || !["pending_first_review", "pending_second_review"].includes(batch.status)
      || !reviewerId || reviewerId === batch.importedBy || reviewerId === batch.firstReviewerId
      || !["approve", "reject"].includes(decision)) throw fail("invalid_catalog_review");
  if (decision === "reject") return Object.freeze({ ...batch, status: "rejected", rejectedBy: reviewerId });
  if (batch.status === "pending_first_review") {
    return Object.freeze({ ...batch, status: "pending_second_review", firstReviewerId: reviewerId });
  }
  return Object.freeze({ ...batch, status: "approved", secondReviewerId: reviewerId });
}
