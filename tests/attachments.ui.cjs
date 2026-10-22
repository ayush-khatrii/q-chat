const assert = require("node:assert/strict");
const { test } = require("node:test");
const { createServer } = require("node:http");
const { build } = require("esbuild");
const { chromium } = require("@playwright/test");

// Bundle the real composer and attachment UI, replacing only external services.
// The browser still runs the real upload hook, file picker, dialogs, and fetches.
async function fixture() {
  const mocks = {
    "@/lib/auth-client":
      'export const authClient = { useSession: () => ({data:{user:{id:"self",name:"Me",email:"me@example.com"}}}) };',
    "@/lib/fcm": "export const initFcm = async () => {};",
    "@/hooks/use-read-receipts":
      "export const useReadReceipts = () => ({readReceipts:{},markRead:async()=>true});",
    "@/components/chat/chat-appearance":
      "export const getRoomThemeStyle = () => ({}); export const useRoomTheme = () => ({theme:{}});",
    "@ably/chat":
      'export const ChatMessageEventType={Created:"created",Deleted:"deleted"}; export const ChatMessageAction={MessageDelete:"deleted"}; export const MessageReactionType={Distinct:"distinct"};',
    "@ably/chat/react": `import {useEffect} from 'react';
      export const useTyping=()=>({currentTypers:new Set(),keystroke:async()=>{},stop:async()=>{}});
      export function useMessages({listener}) {
        useEffect(()=>{window.__emit=listener;});
        return { historyBeforeSubscribe:undefined,
          sendMessage:async ({text,metadata})=>{
            window.__sendCount=(window.__sendCount||0)+1;
            if(window.__failSend)throw new Error('Connection failed');
            const message={serial:'serial-'+window.__sendCount,text,metadata,clientId:'self',timestamp:new Date(),action:'created'};
            listener({type:'created',message});return message;
          },deleteMessage:async()=>{} };
      }`,
  };
  const result = await build({
    stdin: {
      contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; import Chat from './components/Chat'; import {ChatOutboxProvider} from './components/chat/outbox-context'; import {TooltipProvider} from './components/ui/tooltip';
      createRoot(document.getElementById('root')).render(<TooltipProvider><ChatOutboxProvider><Chat roomId="room" roomCode="CODE" members={[]} initialTheme={{}} /></ChatOutboxProvider></TooltipProvider>);`,
      resolveDir: process.cwd(),
      loader: "tsx",
    },
    bundle: true,
    write: false,
    platform: "browser",
    jsx: "automatic",
    define: { "process.env.NODE_ENV": '"test"' },
    plugins: [
      {
        name: "external-service-stubs",
        setup(builder) {
          builder.onResolve({ filter: /.*/ }, (args) =>
            Object.hasOwn(mocks, args.path)
              ? { path: args.path, namespace: "stub" }
              : undefined,
          );
          builder.onLoad({ filter: /.*/, namespace: "stub" }, (args) => ({
            contents: mocks[args.path],
            resolveDir: process.cwd(),
          }));
        },
      },
    ],
  });
  const server = createServer((req, res) => {
    if (req.url === "/image.png") {
      res.setHeader("Content-Type", "image/png");
      res.end(
        Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aNZkAAAAASUVORK5CYII=",
          "base64",
        ),
      );
    } else if (req.url === "/bundle.js") {
      res.setHeader("Content-Type", "application/javascript");
      res.end(result.outputFiles[0].contents);
    } else {
      res.setHeader("Content-Type", "text/html");
      res.end(
        '<!doctype html><html><body><div id="root"></div><script>window.process={env:{}};</script><script src="/bundle.js"></script></body></html>',
      );
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return { server, url: `http://127.0.0.1:${server.address().port}` };
}

test(
  "browser: queued uploads, failed send retry, independent actions, preview and expiry",
  { timeout: 60_000 },
  async () => {
    const { server, url } = await fixture();
    const browser = await chromium.launch({ headless: true }).catch((error) => {
      server.close();
      throw error;
    });
    const page = await browser.newPage();
    page.setDefaultTimeout(10000);
    const browserErrors = [];
    page.on("pageerror", (error) => browserErrors.push(error.message));
    let sent = false;
    let rejectBinding = true;
    let completed = 0;
    let cancelled = 0;
    await page.route("**/api/**", async (route) => {
      const request = route.request();
      const body = request.postDataJSON();
      const pathname = new URL(request.url()).pathname;
      const respond = (value, status = 200) =>
        route.fulfill({ status, json: value });
      if (pathname === "/api/attachments" && body?.action === "initiate")
        return respond({
          id: "file",
          partBytes: 16 * 1024 * 1024,
          expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
        });
      if (pathname === "/api/attachments" && body?.action === "resolve") {
        if (rejectBinding)
          return respond({ error: "Binding temporarily unavailable" }, 503);
        sent = true;
        return respond({
          attachments: [
            {
              id: "file",
              name: "photo.png",
              size: 68,
              mimeType: "image/png",
              preview: "image",
              expiresAt: new Date(Date.now() + 3000).toISOString(),
              state: "ready",
            },
          ],
        });
      }
      if (pathname === "/api/attachments/file" && body?.action === "sign")
        return respond({ url: `${url}/upload` });
      if (pathname === "/api/attachments/file" && body?.action === "complete") {
        completed++;
        return respond({ id: "file" });
      }
      if (pathname === "/api/attachments/file" && body?.action === "cancel") {
        cancelled++;
        return respond({ cancelled: true });
      }
      if (pathname === "/api/attachments/file")
        return respond({ url: `${url}/image.png` });
      return respond({});
    });
    await page.route("**/upload", (route) =>
      route.fulfill({ status: 200, body: "" }),
    );
    await page.route("**/image.png", (route) =>
      route.fulfill({
        contentType: "image/png",
        body: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aNZkAAAAASUVORK5CYII=",
          "base64",
        ),
      }),
    );
    try {
      await page.goto(url);
      const input = page.locator("input[type=file]");
      const file = {
        name: "photo.png",
        mimeType: "image/png",
        buffer: Buffer.from("original image bytes"),
      };
      await input.setInputFiles(file);
      await page.getByText("Ready · expires 24 hours after sending").waitFor();
      assert.equal(completed, 1);
      await page.evaluate(() => {
        window.__failSend = true;
      });
      await page
        .getByRole("button", { name: "Send message", exact: true })
        .click();
      await page.getByText("Connection failed").waitFor();
      assert.equal(
        await page.getByText("1 attachment", { exact: true }).count(),
        1,
      );
      await page.evaluate(() => {
        window.__failSend = false;
      });
      await page
        .getByRole("button", { name: "Retry", exact: true })
        .click();
      await page.getByText("Attachments could not be loaded.").waitFor();
      const countBefore = await page.evaluate(() => window.__sendCount);
      rejectBinding = false;
      await page.evaluate(() => window.dispatchEvent(new Event("online")));
      await page.getByRole("button", { name: "Retry attachments" }).click();
      assert.equal(await page.evaluate(() => window.__sendCount), countBefore);
      await page
        .getByRole("button", { name: "Preview photo.png", exact: true })
        .waitFor();
      assert.equal(sent, true);
      // Download uses a separate action and preserves the original response bytes.
      const [download] = await Promise.all([
        page.waitForEvent("download"),
        page
          .getByRole("button", { name: "Download photo.png", exact: true })
          .click(),
      ]);
      const bytes = require("node:fs").readFileSync(await download.path());
      assert.equal(
        bytes.toString("base64"),
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aNZkAAAAASUVORK5CYII=",
      );
      assert.equal(await page.getByRole("dialog").count(), 0);
      // Card trigger and download action are separate keyboard targets.
      await page
        .getByRole("button", { name: "Preview photo.png", exact: true })
        .focus();
      await page.keyboard.press("Enter");
      await page.getByRole("dialog").waitFor();
      await page.getByRole("img", { name: "photo.png", exact: true }).waitFor();
      const image = page.getByRole("img", { name: "photo.png", exact: true });
      const allowsNativeMenu = await image.evaluate(element => {
        const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
        element.dispatchEvent(event);
        return !event.defaultPrevented;
      });
      assert.equal(allowsNativeMenu, true, 'preview allows the browser image menu');
      assert.equal(await page.getByRole('menu').count(), 0, 'preview does not open message actions');
      await image.dispatchEvent('pointerdown', {pointerType:'touch', pointerId:1, bubbles:true});
      await page.waitForTimeout(800);
      await image.dispatchEvent('pointerup', {pointerType:'touch', pointerId:1, bubbles:true});
      assert.equal(await page.getByRole('menu').count(), 0, 'preview touch hold does not open message actions');

      await page
        .getByRole("dialog")
        .waitFor({ state: "hidden", timeout: 8000 });
      await page.getByText("Attachment expired", { exact: true }).waitFor();
      assert.equal(
        await page
          .getByRole("button", { name: "Download photo.png", exact: true })
          .count(),
        0,
      );
      await input.setInputFiles(file);
      await page.getByText("Ready · expires 24 hours after sending").waitFor();
      await page
        .getByRole("button", { name: "Remove photo.png", exact: true })
        .click();
      await page.waitForTimeout(100);
      assert.equal(cancelled, 1);
      assert.deepEqual(browserErrors, []);
    } catch (error) {
      console.error("Browser errors:", browserErrors);
      console.error("Browser text:", await page.locator("body").innerText());
      throw error;
    } finally {
      await browser.close();
      await new Promise((resolve) => server.close(resolve));
    }
  },
);
