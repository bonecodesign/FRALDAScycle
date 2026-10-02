import assert from "node:assert/strict";
import test from "node:test";
import { pagination } from "../apps/api/pagination.js";

test("pagination preserves service defaults and boundary behavior", () => {
  const cases = [
    [{}, { limit: 50, offset: 0 }, { limit: 24, offset: 0 }],
    [{ limit: "invalid", offset: "invalid" }, { limit: 50, offset: 0 }, { limit: 24, offset: 0 }],
    [{ limit: 0, offset: -4 }, { limit: 50, offset: 0 }, { limit: 24, offset: 0 }],
    [{ limit: -4, offset: "12" }, { limit: 1, offset: 12 }, { limit: 1, offset: 12 }],
    [{ limit: "12", offset: "3" }, { limit: 12, offset: 3 }, { limit: 12, offset: 3 }],
    [{ limit: 999, offset: 12 }, { limit: 100, offset: 12 }, { limit: 50, offset: 12 }],
    [{ limit: 12.5, offset: 1.5 }, { limit: 12.5, offset: 1.5 }, { limit: 12.5, offset: 1.5 }],
  ];
  for (const [input, administrative, marketplace] of cases) {
    assert.deepEqual(pagination(input), administrative);
    assert.deepEqual(pagination(input, { defaultLimit: 24, maxLimit: 50 }), marketplace);
  }
});
