import assert from "node:assert/strict";
import test from "node:test";
import { loadHomepageData } from "../src/lib/homepage-data";

test("a refused database connection returns an unavailable homepage result", async () => {
  const refused = Object.assign(new Error("connect ECONNREFUSED"), {
    code: "ECONNREFUSED",
  });
  const queryError = new Error("Failed query", {
    cause: new AggregateError([refused]),
  });

  const result = await loadHomepageData(
    async () => {
      throw queryError;
    },
    async () => [],
  );

  assert.deepEqual(result, {
    available: false,
    stats: null,
    updates: null,
  });
});
