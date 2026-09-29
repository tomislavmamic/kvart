import assert from "node:assert/strict";
import test from "node:test";
import { extractOwners, readShare, sanitizeReview } from "./verify-bilice-ownership";

const registry = [{ id: "city", label: "GRAD SPLIT", aliases: ["Grad Split"], category: "local" }];

test("owner extraction uses List B and omits identifiers, addresses, and burdens", () => {
  const result = extractOwners([{ ownershipSheetB: { lrUnitShares: [{
    share: "1 / 2", lrOwners: [{ name: "Testna Osoba", taxNumber: "12345678901", address: "Testna adresa" }],
  }, { share: "1/2", lrOwners: [{ name: "Grad Split" }] }] },
  burdensSheetC: { text: "Testni teret" } }], registry);
  assert.deepEqual(result, [
    { name: "Testna Osoba", share: "1/2", publicEntity: null },
    { name: "Grad Split", share: "1/2", publicEntity: { id: "city", label: "GRAD SPLIT", category: "local" } },
  ]);
});

test("unknown and shared person-level shares stay unresolved", () => {
  assert.equal(readShare({}), null);
  assert.equal(readShare({ share: "1/0" }), null);
  assert.equal(readShare({ share: "unknown" }), null);
  const result = extractOwners([{ ownershipSheetB: { lrUnitShares: [{ share: "1/1",
    lrOwners: [{ name: "Testna Osoba A" }, { name: "Testna Osoba B" }] }] } }], registry);
  assert.ok(result);
  assert.ok(result.every((owner) => owner.share === null));
});

test("possessors and ambiguous units cannot become owners", () => {
  assert.equal(extractOwners([{ possessionSheets: [{ possessors: [{ name: "Testna Osoba" }] }] }], registry), null);
  assert.equal(extractOwners([{}, {}], registry), null);
  assert.equal(extractOwners([{ ownershipSheetB: { lrUnitShares: [{ share: "1/1",
    lrOwners: [{ name: "Testna Osoba 12345678901" }] }] } }], registry), null);
});

test("public summary removes private owners and reports unknown counts as null", () => {
  const row = { parcelNumber: "1/1", municipality: "SPLIT", status: "owners_verified" as const,
    checkedAt: "2026-09-22T00:00:00Z", ownerEvidenceAt: "2026-09-22T00:00:00Z", reason: "Test",
    sources: { cadastre: null, landRegister: null }, owners: [
      { name: "Testna Osoba", share: "1/2", publicEntity: null },
      { name: "Grad Split", share: "1/2", publicEntity: { id: "city", label: "GRAD SPLIT", category: "local" } },
    ] };
  const summary = sanitizeReview(row);
  assert.equal(summary.ownerCount, 2);
  assert.equal(summary.otherOwnerCount, 1);
  assert.deepEqual(summary.publicOwners, [{ name: "GRAD SPLIT", category: "local", share: "1/2" }]);
  assert.ok(!JSON.stringify(summary).includes("Testna Osoba"));
  const unresolved = sanitizeReview({ ...row, status: "missing_land_register_link", ownerEvidenceAt: null, owners: [] });
  assert.equal(unresolved.ownerCount, null);
  assert.equal(unresolved.otherOwnerCount, null);
});
