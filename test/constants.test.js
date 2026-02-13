import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { extractSessionId } from "../server/constants.js";

describe("extractSessionId", () => {
  it("extracts session from single-digit session ID", () => {
    assert.equal(extractSessionId("s1-0"), "s1");
    assert.equal(extractSessionId("s1-42"), "s1");
  });

  it("extracts session from multi-digit session ID", () => {
    assert.equal(extractSessionId("s12-5"), "s12");
    assert.equal(extractSessionId("s999-0"), "s999");
  });
});
