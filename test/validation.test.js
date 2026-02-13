import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isValidMegaUrl,
  requireArray,
  requireString,
} from "../server/validation.js";
import { assertPathSafe } from "../server/utils.js";

describe("URL validation", () => {
  it("accepts https://mega.nz/ URLs", () => {
    assert.equal(isValidMegaUrl("https://mega.nz/file/abc#key"), true);
    assert.equal(isValidMegaUrl("https://mega.nz/folder/abc#key"), true);
  });

  it("accepts https://mega.co.nz/ URLs", () => {
    assert.equal(isValidMegaUrl("https://mega.co.nz/#!abc!key"), true);
  });

  it("rejects non-MEGA URLs", () => {
    assert.equal(isValidMegaUrl("https://example.com"), false);
    assert.equal(isValidMegaUrl("http://mega.nz/file/abc"), false);
  });

  it("rejects empty/null input", () => {
    assert.ok(!isValidMegaUrl(""));
    assert.ok(!isValidMegaUrl(null));
    assert.ok(!isValidMegaUrl(undefined));
  });
});

describe("Path traversal check", () => {
  it("allows normal paths", () => {
    assert.doesNotThrow(() => assertPathSafe("/data", "/data/folder/file.txt"));
  });

  it("blocks traversal attempts", () => {
    assert.throws(() => assertPathSafe("/data", "/data/../etc/passwd"), {
      message: "Path traversal detected",
    });
  });

  it("blocks exact match of download dir (needs to be inside)", () => {
    assert.throws(() => assertPathSafe("/data", "/data"), {
      message: "Path traversal detected",
    });
  });
});

describe("requireArray", () => {
  it("accepts a valid array", () => {
    assert.doesNotThrow(() => requireArray(["a", "b"], "ids"));
  });

  it("rejects non-array values", () => {
    assert.throws(() => requireArray("not-array", "ids"), {
      message: "ids must be an array",
    });
    assert.throws(() => requireArray(null, "ids"), {
      message: "ids must be an array",
    });
    assert.throws(() => requireArray(123, "ids"), {
      message: "ids must be an array",
    });
  });

  it("accepts empty array", () => {
    assert.doesNotThrow(() => requireArray([], "ids"));
  });
});

describe("requireString", () => {
  it("accepts a valid non-empty string", () => {
    assert.doesNotThrow(() => requireString("hello", "name"));
  });

  it("rejects non-string values", () => {
    assert.throws(() => requireString(123, "name"), {
      message: "name required",
    });
    assert.throws(() => requireString(null, "name"), {
      message: "name required",
    });
  });

  it("rejects empty string", () => {
    assert.throws(() => requireString("", "name"), {
      message: "name required",
    });
  });
});
