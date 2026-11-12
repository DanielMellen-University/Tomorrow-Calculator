import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";

// The app is a single index.html with no build step, so the tests read the
// shipped file and evaluate the pure logic it actually contains. Nothing here
// re-implements getTomorrow; if the page changes, these tests test the change.
const html = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "..", "index.html"),
  "utf8",
);

function extract(pattern, name) {
  const m = html.match(pattern);
  assert.ok(m, `${name} not found in index.html`);
  // Return the full matched statement so the evaluated code assigns the name.
  return m[0];
}

// Evaluate the days list and getTomorrow exactly as written in the page.
// const bindings do not land on the vm global object, so read them back by
// evaluating the identifiers; spread into this realm's arrays for deepEqual.
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(
  extract(/const days = \[[^\]]+\];/, "days list") +
    "\n" +
    extract(/function getTomorrow\(today\) \{[\s\S]*?\n        \}/, "getTomorrow"),
  sandbox,
);
const days = [...vm.runInContext("days", sandbox)];
const getTomorrow = vm.runInContext("getTomorrow", sandbox);

// Evaluate the loading-message pool exactly as written in the page.
const messagesSandbox = {};
vm.createContext(messagesSandbox);
vm.runInContext(
  extract(/const loadingMessages = \[[\s\S]*?\n        \];/, "loadingMessages"),
  messagesSandbox,
);
const loadingMessages = [...vm.runInContext("loadingMessages", messagesSandbox)];

test("days covers all seven weekdays in order", () => {
  assert.deepEqual(days, [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ]);
});

test("getTomorrow advances each day by one", () => {
  const expected = {
    Monday: "Tuesday",
    Tuesday: "Wednesday",
    Wednesday: "Thursday",
    Thursday: "Friday",
    Friday: "Saturday",
    Saturday: "Sunday",
    Sunday: "Monday",
  };
  for (const [today, tomorrow] of Object.entries(expected)) {
    assert.equal(getTomorrow(today), tomorrow, `${today} -> ${tomorrow}`);
  }
});

test("getTomorrow returns null for invalid input instead of a wrong day", () => {
  for (const bad of ["", "Funday", "monday", "MONDAY", null, undefined, 3, " Mon"]) {
    assert.equal(getTomorrow(bad), null, `input ${JSON.stringify(bad)}`);
  }
});

test("loading pool has 41 unique messages", () => {
  assert.equal(loadingMessages.length, 41);
  assert.equal(new Set(loadingMessages).size, 41);
});
