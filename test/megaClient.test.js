import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as megaClient from "../server/megaClient.js";

describe("megaClient", () => {
  describe("getNodeById", () => {
    it("returns undefined for unknown id", () => {
      assert.equal(megaClient.getNodeById("nonexistent"), undefined);
    });
  });

  describe("getIdForNode", () => {
    it("returns null for unknown node", () => {
      assert.equal(megaClient.getIdForNode({}), null);
    });
  });

  describe("getNodePath", () => {
    it("returns empty string for unknown id", () => {
      assert.equal(megaClient.getNodePath("nonexistent"), "");
    });
  });

  describe("clearSession", () => {
    it("does not throw for nonexistent session", () => {
      megaClient.clearSession("s999");
    });
  });

  describe("downloadFile", () => {
    it("passes forceHttps and start to download", () => {
      let capturedOpts;
      const fakeMegaNode = {
        download(opts) {
          capturedOpts = opts;
          return { on() {}, pipe() {} };
        },
      };

      megaClient.downloadFile(fakeMegaNode, { start: 512 });
      assert.equal(capturedOpts.start, 512);
      assert.equal(capturedOpts.forceHttps, true);
    });

    it("defaults start to 0", () => {
      let capturedOpts;
      const fakeMegaNode = {
        download(opts) {
          capturedOpts = opts;
          return { on() {}, pipe() {} };
        },
      };

      megaClient.downloadFile(fakeMegaNode);
      assert.equal(capturedOpts.start, 0);
      assert.equal(capturedOpts.forceHttps, true);
    });

    it("passes handleRetries when provided", () => {
      let capturedOpts;
      const fakeMegaNode = {
        download(opts) {
          capturedOpts = opts;
          return { on() {}, pipe() {} };
        },
      };
      const handler = () => {};

      megaClient.downloadFile(fakeMegaNode, { handleRetries: handler });
      assert.equal(capturedOpts.handleRetries, handler);
    });

    it("omits handleRetries when not provided", () => {
      let capturedOpts;
      const fakeMegaNode = {
        download(opts) {
          capturedOpts = opts;
          return { on() {}, pipe() {} };
        },
      };

      megaClient.downloadFile(fakeMegaNode);
      assert.equal(capturedOpts.handleRetries, undefined);
    });
  });
});
