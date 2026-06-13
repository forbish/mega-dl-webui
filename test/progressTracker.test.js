import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ProgressTracker } from "../server/progressTracker.js";

describe("ProgressTracker", () => {
  it("returns null when update threshold not met", () => {
    const tracker = new ProgressTracker(1000);
    assert.equal(tracker.update(100), null);
  });

  it("returns speed and eta after threshold elapses", () => {
    const tracker = new ProgressTracker(1000);
    tracker.lastUpdate = Date.now() - 300;
    const result = tracker.update(500);
    assert.notEqual(result, null);
    assert.ok(result.speed > 0);
    assert.ok(result.eta >= 0);
  });

  it("calculates speed based on byte delta and elapsed time", () => {
    const tracker = new ProgressTracker(10000);
    tracker.lastUpdate = Date.now() - 1000;
    tracker.lastBytes = 0;
    const result = tracker.update(5000);
    assert.ok(result.speed >= 4000 && result.speed <= 6000);
  });

  it("calculates eta based on remaining bytes and speed", () => {
    const tracker = new ProgressTracker(10000);
    tracker.lastUpdate = Date.now() - 1000;
    tracker.lastBytes = 0;
    const result = tracker.update(5000);
    assert.ok(result.eta > 0 && result.eta < 3);
  });

  it("reset sets lastBytes to given value and refreshes timestamp", () => {
    const tracker = new ProgressTracker(10000);
    tracker.lastBytes = 999;
    tracker.speed = 500;
    tracker.eta = 10;

    tracker.reset(5000);

    assert.equal(tracker.lastBytes, 5000);
    assert.equal(tracker.speed, 0);
    assert.equal(tracker.eta, 0);
  });

  it("reset defaults lastBytes to 0", () => {
    const tracker = new ProgressTracker(10000);
    tracker.lastBytes = 999;

    tracker.reset();

    assert.equal(tracker.lastBytes, 0);
  });
});
