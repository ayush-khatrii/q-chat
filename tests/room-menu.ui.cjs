const assert = require("node:assert/strict");
const { test } = require("node:test");
const { createServer } = require("node:http");
const { readFile } = require("node:fs/promises");
const { build } = require("esbuild");
const postcss = require("postcss");
const tailwind = require("@tailwindcss/postcss");
const { chromium } = require("@playwright/test");

test(
  "room menu stays within the viewport and preserves its actions",
  { timeout: 60000 },
  async () => {
    const mocks = {
      "next/navigation": "export const useRouter=()=>({refresh(){},push(){}});",
      "@/lib/auth-client":
        "export const authClient={useSession:()=>({data:null})};",
      "@/hooks/use-rooms": "export const useRooms=()=>({hasLoaded:true});",
      "@/components/sidebar-context":
        "export const useSidebar=()=>({toggle(){window.chatListOpened=true}});",
      "@/components/room-activity-context":
        "export const useRoomActivity=()=>null;",
      "@/components/auth/GoogleOneTap":
        "export default function(){return null}",
      "@/components/auth/UserDropdown":
        "export default function(){return null}",
      "@/components/NotificationCenter":
        "export default function(){return null}",
    };
    const bundle = await build({
      stdin: {
        contents: `import React from 'react';import {createRoot} from 'react-dom/client';import {ThemeProvider} from 'next-themes';import RoomHeader from './components/chat/RoomHeader';import {PwaProvider} from './components/pwa/InstallApp';const members=Array.from({length:50},(_,i)=>({id:String(i),userId:String(i),role:i===0?'SUPER_ADMIN':'MEMBER',joinedAt:'2026-10-01',user:{name:'VeryLongUnbrokenMemberName'.repeat(5),email:'member@example.com',image:null}}));createRoot(document.getElementById('root')).render(<ThemeProvider attribute="class"><PwaProvider><RoomHeader room={{id:'room',name:'LongRoomName'.repeat(20),code:'QC-LONGROOMCODE',memberCount:50,isOwner:true,currentUserRole:'SUPER_ADMIN'}} members={members}/></PwaProvider></ThemeProvider>);`,
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
    });
    const css = await postcss([tailwind()]).process(
      await readFile("app/globals.css", "utf8"),
      { from: require("node:path").resolve("app/globals.css") },
    );
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
          '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script>window.process={env:{}}</script><script src="/bundle.js"></script></body></html>',
        );
      }
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    let browser;
    try {
      browser = await chromium.launch({
        headless: true,
        executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
      });
      const page = await browser.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      for (const [width, height] of [
        [320, 568],
        [360, 640],
        [390, 844],
        [430, 932],
        [844, 390],
        [768, 1024],
        [1440, 900],
      ]) {
        await page.setViewportSize({ width, height });
        await page.goto(`http://127.0.0.1:${server.address().port}`);
        await page
          .getByRole("button", { name: "Open chat menu", exact: true })
          .click();
        const sheet = page.locator('[data-slot="sheet-content"]');
        await sheet.waitFor();
        await page.waitForTimeout(250);
        const bounds = await sheet.boundingBox();
        assert.ok(
          bounds.x >= -1 && bounds.x + bounds.width <= width + 1,
          `sheet fits ${width}`,
        );
        assert.ok(
          bounds.y >= -1 && bounds.y + bounds.height <= height + 1,
          `sheet height fits ${height}`,
        );
        assert.deepEqual(
          await sheet
            .evaluate((el) => [
              el.scrollWidth <= el.clientWidth,
              ...Array.from(
                el.querySelectorAll(
                  '[data-slot="room-menu-scroll"],[data-slot="collapsible-content"]',
                ),
              ).map((child) => child.scrollWidth <= child.clientWidth),
            ])
            .then((values) => values.every(Boolean)),
          true,
        );
        const clipped = await sheet
          .locator("button,a,input")
          .evaluateAll((elements) =>
            elements
              .filter((el) => {
                if (!el.getClientRects().length) return false;
                const rect = el.getBoundingClientRect();
                const panel = el
                  .closest('[data-slot="sheet-content"]')
                  .getBoundingClientRect();
                return (
                  rect.left < panel.left - 1 || rect.right > panel.right + 1
                );
              })
              .map((el) => el.textContent),
          );
        assert.deepEqual(clipped, [], `controls fit ${width}`);
        await page.getByPlaceholder("Search members").fill("not found");
        await page.getByText("No members match your search.").waitFor();
        await page
          .getByRole("button", { name: "Workspace", exact: true })
          .click();
        assert.equal(
          await page
            .getByRole("button", { name: "Edit room settings", exact: true })
            .isVisible(),
          false,
        );
        await page
          .getByRole("button", { name: "Workspace", exact: true })
          .click();
        await page
          .getByRole("button", { name: "Developer", exact: true })
          .click();
        await page
          .getByRole("link", { name: "View on GitHub" })
          .scrollIntoViewIfNeeded();
        assert.equal(
          await page
            .getByRole("link", { name: "View on GitHub" })
            .getAttribute("href"),
          "https://github.com/ayush-khatrii",
        );
        const previousTheme = await page
          .getByRole("switch")
          .getAttribute("aria-checked");
        await page.getByRole("switch").click();
        assert.equal(
          await page.getByRole("switch").getAttribute("aria-checked"),
          previousTheme === "true" ? "false" : "true",
        );
        await page
          .getByRole("button", { name: "Edit room settings", exact: true })
          .click();
        await page
          .getByRole("heading", { name: "Edit room settings", exact: true })
          .waitFor();
        await sheet.waitFor({ state: "hidden" });
        await page.keyboard.press("Escape");
        await page
          .getByRole("button", { name: "Open chat menu", exact: true })
          .click();
        await page
          .getByRole("button", { name: "Open chat list", exact: true })
          .click();
        assert.equal(await page.evaluate(() => window.chatListOpened), true);
        await page
          .getByRole("button", { name: "Open chat menu", exact: true })
          .click();
        await page.keyboard.press("Escape");
        await sheet.waitFor({ state: "hidden" });
      }
      assert.deepEqual(errors, []);
    } finally {
      await browser?.close();
      await new Promise((resolve) => server.close(resolve));
    }
  },
);
