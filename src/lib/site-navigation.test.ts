import assert from "node:assert/strict";
import test from "node:test";

import {
  PRIMARY_NAV_ITEMS,
  isNavigationItemActive,
  resolveWhatsAppUrl,
} from "./site-navigation";

test("primary navigation keeps the four resident journeys in order", () => {
  assert.deepEqual(
    PRIMARY_NAV_ITEMS.map((item) => item.label),
    ["Razgovor", "Karta", "Karepovac", "Problemi"],
  );
});

test("WhatsApp navigation accepts only a real group invitation", () => {
  assert.equal(resolveWhatsAppUrl(undefined), null);
  assert.equal(resolveWhatsAppUrl("https://chat.whatsapp.com/"), null);
  assert.equal(
    resolveWhatsAppUrl("https://example.com/not-a-group"),
    null,
  );
  assert.equal(
    resolveWhatsAppUrl("https://chat.whatsapp.com/AbCdEf123"),
    "https://chat.whatsapp.com/AbCdEf123",
  );
});

test("nested Karepovac and Problems routes keep their primary item active", () => {
  const karepovac = PRIMARY_NAV_ITEMS.find((item) => item.id === "karepovac");
  const problemi = PRIMARY_NAV_ITEMS.find((item) => item.id === "problemi");

  assert.ok(karepovac);
  assert.ok(problemi);
  assert.equal(
    isNavigationItemActive("/karepovac/metodologija", karepovac),
    true,
  );
  assert.equal(isNavigationItemActive("/prijavi", problemi), true);
  assert.equal(isNavigationItemActive("/karta", problemi), false);
});
