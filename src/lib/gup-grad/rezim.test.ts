import assert from "node:assert/strict";
import test from "node:test";

import { planskiRezim, REZIM } from "@/lib/gup-grad/rezim";

test("plan na snazi ima prednost pred obvezom i ispunama", () => {
  assert.equal(planskiRezim(REZIM.VAZECI | REZIM.OBVEZA, 2015, "3.1").rezim, "vazeci");
  assert.equal(planskiRezim(REZIM.VAZECI | REZIM.SANACIJA, 2025, null).rezim, "vazeci");
});

test("GUP 2006./2015.: obveza plana zamrzava gradnju samo u nisko konsolidiranom području", () => {
  assert.equal(planskiRezim(REZIM.OBVEZA, 2015, "3.1").rezim, "ceka");
  assert.equal(planskiRezim(REZIM.OBVEZA, 2006, "3.4").rezim, "ceka");
  assert.equal(planskiRezim(REZIM.OBVEZA, 2015, "2.5").rezim, "neposredno");
  assert.equal(planskiRezim(REZIM.OBVEZA, 2015, null).rezim, "neposredno");
  assert.equal(planskiRezim(0, 2015, "3.1").rezim, "neposredno");
});

test("prijedlog 2025.: zamrzavaju sanacija, preobrazba i neuređeno; sam obuhvat UPU-a je preporuka", () => {
  assert.equal(planskiRezim(REZIM.OBVEZA | REZIM.SANACIJA, 2025, null).rezim, "ceka");
  assert.equal(planskiRezim(REZIM.PREOBRAZBA, 2025, null).rezim, "ceka");
  assert.equal(planskiRezim(REZIM.NEUREDENO, 2025, "2.5").rezim, "ceka");
  assert.equal(planskiRezim(REZIM.OBVEZA, 2025, "3.1").rezim, "neposredno");
});

test("oznake 2025. ne vrijede za stariji plan i obrnuto", () => {
  assert.equal(planskiRezim(REZIM.SANACIJA, 2015, "3.1").rezim, "neposredno");
  assert.equal(planskiRezim(REZIM.MARJAN, 2025, null).rezim, "neposredno");
  assert.equal(planskiRezim(REZIM.MARJAN, 2015, null).rezim, "ceka");
});
