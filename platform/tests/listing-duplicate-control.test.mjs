import assert from "node:assert/strict";
import test from "node:test";
import { assessListingDuplicate, listingDuplicateFingerprints } from "../packages/contracts/listing-duplicate-control.js";

const base = Object.freeze({ id: "listing-1", sellerId: "seller-1", status: "published",
  category: "infant", brand: "Pampers", model: "Premium Care", size: "M",
  packageCondition: "sealed", kind: "sale", mediaHashes: ["a".repeat(64), "b".repeat(64)] });

test("fingerprints normalize product text, ignore image order and contain no raw data", () => {
  const first = listingDuplicateFingerprints(base);
  const second = listingDuplicateFingerprints({ ...base, brand: " PÁMPERS ", mediaHashes: [...base.mediaHashes].reverse() });
  assert.deepEqual(first, second);
  assert.match(first.exactFingerprint, /^[A-Za-z0-9_-]{43}$/);
  assert.doesNotMatch(JSON.stringify(first), /pampers|aaaa/);
});

test("same owner cannot maintain an exact duplicate in an active state", () => {
  const candidate = { ...base, id: "listing-2" };
  const result = assessListingDuplicate(candidate, [base]);
  assert.equal(result.action, "block");
  assert.equal(result.blocker, "active_listing_duplicate");
  assert.equal(result.premiumBypassAllowed, false);
});

test("same media from another owner routes to review instead of automatic accusation", () => {
  const candidate = { ...base, id: "listing-2", sellerId: "seller-2" };
  const result = assessListingDuplicate(candidate, [base]);
  assert.equal(result.action, "review");
  assert.equal(result.blocker, "shared_media_duplicate_review");
  assert.equal(result.matches[0].sameOwner, false);
});

test("completed or removed records do not block republication and distinct media is allowed", () => {
  assert.equal(assessListingDuplicate({ ...base, id: "listing-2" }, [{ ...base, status: "completed" }]).action, "allow");
  assert.equal(assessListingDuplicate({ ...base, id: "listing-2", mediaHashes: ["c".repeat(64)] }, [base]).action, "allow");
});

test("missing verified media hashes fails safely into review", () => {
  const result = assessListingDuplicate({ ...base, mediaHashes: [] }, []);
  assert.equal(result.action, "review");
  assert.equal(result.blocker, "listing_duplicate_evidence_incomplete");
});
