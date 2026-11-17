import assert from "node:assert/strict";
import test from "node:test";
import { createHass, entityState, installCardDom } from "./test-helpers.mjs";

const registry = installCardDom();
await import("../../src/homeassistant_custom_dishwasher_card.js");
const DishwasherCard = registry.get("dishwasher-card");
const eco = "dishcare_dishwasher_program_eco50";
const quick = "dishcare_dishwasher_program_quick45";

// Home Connect Local (homeconnect_ws): door is a binary_sensor, Active program
// is a read-only sensor and the wash is started with a dedicated button.
function fixture() {
  const card = new DishwasherCard();
  const entities = {
    connectivity: "binary_sensor.sample_connection", power: "switch.sample_power",
    remoteStart: "binary_sensor.sample_remote_start_allowed", door: "binary_sensor.sample_door",
    operation: "sensor.sample_operation_state", selectedProgram: "select.sample_selected_program",
    activeProgram: "sensor.sample_active_program", startButton: "button.sample_start",
  };
  const states = Object.fromEntries(Object.entries({
    connectivity: "on", power: "on", remoteStart: "on", door: "off", operation: "ready",
    selectedProgram: eco, activeProgram: "unknown", startButton: "unknown",
  }).map(([key, value]) => [entities[key], entityState(value, key === "selectedProgram" ? { options: [eco, quick] } : {})]));
  const hass = createHass(states, "en"), calls = [];
  hass.callService = async (...args) => { calls.push(args); };
  card.setConfig({ entities, title: "Dishwasher" }); card.hass = hass;
  const report = (key, value) => {
    hass.states[entities[key]] = { ...hass.states[entities[key]], state: value };
    card.hass = { ...hass };
  };
  return { card, entities, hass, calls, report };
}

test("Start presses the Home Connect Local start button exactly once", async () => {
  const f = fixture();
  assert.equal(f.card._startReason(), "", "never-pressed button (unknown) and closed door (off) allow start");
  assert.match(f.card._actions(), /data-action="start"/);
  f.card._startProgram(); f.card._startProgram();
  assert.deepEqual(f.calls, [["button", "press", { entity_id: f.entities.startButton }]]);
  await Promise.resolve();
  assert.ok(f.card._pending, "waits for the appliance to report a running state");
  f.report("operation", "run");
  assert.equal(f.card._pending, null);
  assert.equal(f.card._commandError, "");
});

test("Start button path also confirms a scheduled start", async () => {
  const f = fixture();
  f.card._startProgram(); await Promise.resolve();
  f.report("operation", "delayedstart");
  assert.equal(f.card._pending, null);
});

test("Start button path keeps every prerequisite and the button availability", () => {
  const cases = [
    ["startButton", "unavailable"], ["door", "on"], ["door", "unavailable"], ["remoteStart", "off"],
    ["power", "off"], ["connectivity", "off"], ["operation", "run"], ["selectedProgram", "unavailable"],
  ];
  for (const [key, value] of cases) {
    const f = fixture(); f.report(key, value);
    assert.ok(f.card._startReason(), `${key}/${value}`); f.card._startProgram();
    assert.equal(f.calls.length, 0, `${key}/${value}`);
  }
  const f = fixture(); f.report("startButton", "unavailable");
  assert.equal(f.card._startReason(), "The dishwasher does not report its Start button as available yet.");
});

test("a failed button press is reported without retry", async () => {
  const f = fixture();
  f.hass.callService = async (...args) => { f.calls.push(args); throw new Error("boom"); };
  f.card.hass = { ...f.hass };
  f.card._startProgram();
  await Promise.resolve(); await Promise.resolve();
  assert.equal(f.calls.length, 1);
  assert.equal(f.card._pending, null);
  assert.ok(f.card._commandError);
});

test("discovery maps the start button only within the button domain", async () => {
  const card = new DishwasherCard();
  card.setConfig({ device_id: "device-1" });
  card._hass = createHass();
  card._hass.callWS = async () => ({
    entities: [
      { di: "device-1", pl: "homeconnect_ws", ei: "binary_sensor.kitchen_remote_start" },
      { di: "device-1", pl: "homeconnect_ws", ei: "button.kitchen_start" },
    ],
  });
  await card._discover();
  assert.equal(card._entities.remoteStart, "binary_sensor.kitchen_remote_start");
  assert.equal(card._entities.startButton, "button.kitchen_start");
});
