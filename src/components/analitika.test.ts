import assert from "node:assert/strict";
import test from "node:test";

import { pripremiPosjet } from "./analitika";

const posjet = (url: string) => pripremiPosjet({ type: "pageview", url });

test("moderator pages are not counted", () => {
  assert.equal(posjet("https://dracevac.vercel.app/admin"), null);
  assert.equal(posjet("https://dracevac.vercel.app/admin/prijedlozi/12"), null);
  assert.notEqual(
    posjet("https://dracevac.vercel.app/administracija"),
    null,
    "only the /admin segment is excluded, not every path that starts with it",
  );
});

test("the address of a visit keeps the path and drops the query and hash", () => {
  assert.deepEqual(
    posjet("https://dracevac.vercel.app/prijavi?lat=43.521234&lng=16.487654"),
    { type: "pageview", url: "https://dracevac.vercel.app/prijavi" },
  );
  assert.deepEqual(
    posjet("https://dracevac.vercel.app/gup/dokument?oznaci=s37-5:10-80#s37-5"),
    { type: "pageview", url: "https://dracevac.vercel.app/gup/dokument" },
  );
});
