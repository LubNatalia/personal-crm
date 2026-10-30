import { expect, test } from "vitest";

// Fails on purpose: checks that a PR with a red CI can't be merged into main.
// This PR is closed without merging
test("fails on purpose", () => {
  expect(1 + 1).toBe(3);
});
