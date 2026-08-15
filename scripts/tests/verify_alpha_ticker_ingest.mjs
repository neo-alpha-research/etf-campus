import assert from "node:assert/strict";
import { __testables } from "../../functions/api/internal/ingest-prices.js";

const accepted = __testables.validatePayload({
  requestId: "alpha_ticker_20260813",
  records: [{ ticker: "09ABC0", date: "2026-08-13", close: 12345 }],
});
assert.equal(accepted.ok, true);
assert.equal(accepted.records[0].ticker, "09ABC0");

const rejected = __testables.validatePayload({
  requestId: "invalid_ticker_20260813",
  records: [{ ticker: "ABC-01", date: "2026-08-13", close: 12345 }],
});
assert.equal(rejected.ok, false);
assert.equal(rejected.error, "invalid_ticker");
console.log("alpha_numeric_ticker_ingest: PASS");
