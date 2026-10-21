const assert = require("node:assert/strict");
const { test } = require("node:test");
const { createServer } = require("node:http");
const { readFile } = require("node:fs/promises");
const { build } = require("esbuild");
const postcss = require("postcss");
const tailwind = require("@tailwindcss/postcss");
const { chromium } = require("@playwright/test");
const { DEFAULT_ROOM_THEME } = require("../lib/rooms.ts");

test(
  "appearance fits mobile and tablet screens and saves both borders with primary fill",
  { timeout: 60000 },
  async () => {
    const mocks = {
      "@ably/chat": 'export const ChatMessageAction={MessageDelete:"deleted"};',
      "next/navigation":
        "export const useRouter=()=>({back(){},replace(){}});export const useSearchParams=()=>new URLSearchParams();",
      "@/lib/auth-client":
        'export const authClient={useSession:()=>({data:{user:{id:"self"}}})};',
      "@/hooks/use-rooms": `import {DEFAULT_ROOM_THEME} from '@/lib/rooms';const rooms=Array.from({length:4},(_,i)=>({id:'room'+i,code:'QC-ROOM'+i,name:'A very long chat name that should truncate safely '+i,theme:DEFAULT_ROOM_THEME,members:[]}));export const useRooms=()=>({rooms,isLoading:false});`,
    };
    const [bundle, css] = await Promise.all([
      build({
        stdin: {
          contents: `import React from 'react';import {createRoot} from 'react-dom/client';import {QueryClient,QueryClientProvider} from '@tanstack/react-query';import Settings from './components/chat/ChatAppearanceSettings';import {ChatBubbleMessage} from './components/chat/ChatBubbleMessage';import {getRoomThemeStyle} from './components/chat/chat-appearance';import {DEFAULT_ROOM_THEME} from './lib/rooms';import {TooltipProvider} from './components/ui/tooltip';const root=createRoot(document.getElementById('root'));window.renderActualBubbles=(theme=DEFAULT_ROOM_THEME)=>root.render(<TooltipProvider><div style={getRoomThemeStyle(theme)}>{[true,false].map(isMe=><ChatBubbleMessage key={String(isMe)} roomId="room" message={{serial:String(isMe),text:isMe?'My real message':'Received real message',timestamp:new Date(),metadata:{},clientId:isMe?'self':'other'}} senderName={isMe?'Me':'Other'} isMe={isMe} isPageVisible={false} onRead={async()=>false} onCopy={()=>{}} onDelete={()=>{}} onEdit={()=>{}} />)}</div></TooltipProvider>);root.render(<QueryClientProvider client={new QueryClient()}><div className="flex h-dvh min-w-0 flex-col"><Settings/></div></QueryClientProvider>);`,
          loader: "tsx",
          resolveDir: process.cwd(),
        },
        bundle: true,
        write: false,
        platform: "browser",
        jsx: "automatic",
        define: { "process.env.NODE_ENV": '"test"' },
        plugins: [
          {
            name: "services",
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
      }),
      readFile("app/globals.css", "utf8").then((source) =>
        postcss([tailwind()]).process(source, {
          from: require("node:path").resolve("app/globals.css"),
        }),
      ),
    ]);
    const server = createServer((req, res) => {
      if (req.url === "/bundle.js") {
        res.setHeader("Content-Type", "application/javascript");
        res.end(bundle.outputFiles[0].contents);
      } else if (req.url === "/style.css") {
        res.setHeader("Content-Type", "text/css");
        res.end(css.css);
      } else {
        res.setHeader("Content-Type", "text/html");
        res.end(
          '<!doctype html><html><head><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script>window.process={env:{}}</script><script src="/bundle.js"></script></body></html>',
        );
      }
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    let browser;
    try {
      browser = await chromium.launch({ headless: true });
      const page = await browser.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      let saved;
      await page.route("**/api/rooms/*/theme", (route) => {
        if (route.request().method() === "PATCH")
          saved = route.request().postDataJSON();
        return route.fulfill({
          json: {
            theme: saved ?? DEFAULT_ROOM_THEME,
            updatedAt: new Date().toISOString(),
          },
        });
      });
      await page.goto(`http://127.0.0.1:${server.address().port}`);
      for (const width of [320, 375, 390, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: 800 });
        await page.getByRole("heading", { name: "Room appearance" }).waitFor();
        const overflow = await page.evaluate(() => ({
          document: document.documentElement.scrollWidth,
          viewport: innerWidth,
          main: [...document.querySelectorAll("main,section,header")].map(
            (element) => ({
              client: element.clientWidth,
              scroll: element.scrollWidth,
            }),
          ),
        }));
        assert.ok(
          overflow.document <= width,
          JSON.stringify({ width, overflow }),
        );
        assert.ok(
          overflow.main.every(
            (element) => element.scroll <= element.client + 1,
          ),
          JSON.stringify({ width, overflow }),
        );
      }
      await page.setViewportSize({ width: 375, height: 800 });
      await page
        .getByLabel("Your bubble border", { exact: true })
        .fill("#123456");
      await page
        .getByLabel("Received bubble border", { exact: true })
        .fill("#654321");
      await page.getByRole("button", { name: "Use shadcn primary" }).click();
      const outgoing = page
        .getByText("The hearts are subtle and readable!")
        .locator("..");
      const incoming = page
        .getByText("Try the new room background.")
        .locator("..");
      assert.equal(
        await outgoing.evaluate(
          (element) => getComputedStyle(element).borderColor,
        ),
        "rgb(18, 52, 86)",
      );
      assert.equal(
        await incoming.evaluate(
          (element) => getComputedStyle(element).borderColor,
        ),
        "rgb(101, 67, 33)",
      );
      await page
        .getByRole("button", { name: "Save theme", exact: true })
        .click();
      await page.waitForTimeout(100);
      assert.equal(saved.outgoingBorder, "#123456");
      assert.equal(saved.incomingBorder, "#654321");
      assert.equal(saved.outgoingBubble, "primary");
      assert.equal(saved.incomingBubble, "#262626");
      await page.getByRole("button", { name: "Reset", exact: true }).click();
      for (const bubble of [outgoing, incoming]) {
        assert.equal(
          await bubble.evaluate(
            (element) => getComputedStyle(element).borderTopWidth,
          ),
          "0px",
        );
      }
      assert.equal(
        await page
          .getByRole("button", {
            name: "No border for your bubbles",
            exact: true,
          })
          .getAttribute("aria-pressed"),
        "true",
      );
      // Removing just one border must not affect the other bubble direction.
      await page
        .getByLabel("Your bubble border", { exact: true })
        .fill("#123456");
      await page
        .getByLabel("Received bubble border", { exact: true })
        .fill("#654321");
      await page
        .getByRole("button", {
          name: "No border for your bubbles",
          exact: true,
        })
        .click();
      assert.equal(
        await outgoing.evaluate(
          (element) => getComputedStyle(element).borderTopWidth,
        ),
        "0px",
      );
      assert.equal(
        await incoming.evaluate(
          (element) => getComputedStyle(element).borderTopWidth,
        ),
        "1px",
      );
      await page
        .getByRole("button", {
          name: "No border for received bubbles",
          exact: true,
        })
        .click();
      await page
        .getByRole("button", { name: "Save theme", exact: true })
        .click();
      await page.waitForTimeout(100);
      assert.equal(saved.outgoingBorder, "none");
      assert.equal(saved.incomingBorder, "none");
      await page.evaluate(() => window.renderActualBubbles());
      const actualOutgoing = page
        .getByText("My real message", { exact: true })
        .locator("..");
      const actualIncoming = page
        .getByText("Received real message", { exact: true })
        .locator("..");
      await actualOutgoing.waitFor();
      for (const bubble of [actualOutgoing, actualIncoming])
        assert.equal(
          await bubble.evaluate(
            (element) => getComputedStyle(element).borderTopWidth,
          ),
          "0px",
        );
      const primary = await page.evaluate(() => {
        const probe = document.createElement("div");
        probe.style.backgroundColor = "var(--primary)";
        document.body.append(probe);
        const color = getComputedStyle(probe).backgroundColor;
        probe.remove();
        return color;
      });
      assert.equal(
        await actualOutgoing.evaluate(
          (element) => getComputedStyle(element).backgroundColor,
        ),
        primary,
      );
      assert.equal(
        await actualIncoming.evaluate(
          (element) => getComputedStyle(element).backgroundColor,
        ),
        "rgb(38, 38, 38)",
      );
      await page.evaluate(
        (theme) =>
          window.renderActualBubbles({
            ...theme,
            outgoingBorder: "#123456",
            incomingBorder: "#654321",
          }),
        DEFAULT_ROOM_THEME,
      );
      await page.waitForTimeout(50);
      assert.equal(
        await actualOutgoing.evaluate(
          (element) => getComputedStyle(element).borderTopWidth,
        ),
        "1px",
      );
      assert.equal(
        await actualIncoming.evaluate(
          (element) => getComputedStyle(element).borderTopWidth,
        ),
        "1px",
      );
      assert.deepEqual(errors, []);
    } finally {
      await browser?.close();
      await new Promise((resolve) => server.close(resolve));
    }
  },
);
