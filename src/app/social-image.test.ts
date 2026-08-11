import assert from "node:assert/strict";
import test from "node:test";

import {
  alt as openGraphAlt,
  contentType as openGraphContentType,
  size as openGraphSize,
} from "./opengraph-image";
import {
  alt as twitterAlt,
  contentType as twitterContentType,
  size as twitterSize,
} from "./twitter-image";

test("the shared image matches social crawler conventions", () => {
  assert.deepEqual(openGraphSize, { width: 1200, height: 630 });
  assert.equal(openGraphContentType, "image/png");
  assert.match(openGraphAlt, /Zračna snimka Dračevca i Bilica/u);
});

test("Open Graph and Twitter publish the same image contract", () => {
  assert.deepEqual(twitterSize, openGraphSize);
  assert.equal(twitterContentType, openGraphContentType);
  assert.equal(twitterAlt, openGraphAlt);
});
