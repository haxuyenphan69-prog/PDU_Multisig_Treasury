import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(new Request("http://localhost/", { headers: { accept: "text/html" } }), {
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
  }, { waitUntil() {}, passThroughOnException() {} });
}

test("server renders the real-wallet PDU treasury shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /PDU Treasury/);
  assert.match(html, /Ba ví độc lập/);
  assert.match(html, /TESTNET LIVE/);
  assert.match(html, /Chưa có proposal on-chain/);
  assert.doesNotMatch(html, /Tài trợ Demo Day mùa thu/);
  assert.match(html, /treasury-app/);
  assert.doesNotMatch(html, /Alice|Bob|Carol/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/);
});
