const assert = require("node:assert/strict");
const { test } = require("node:test");
const { createServer } = require("node:http");
const { build } = require("esbuild");
const { chromium } = require("@playwright/test");

test(
  "room inbox: visibility, persistence, local ignore, decisions, permissions and account isolation",
  { timeout: 60000 },
  async () => {
    const mocks = {
      "@/hooks/use-rooms": `export const useRooms=()=>({rooms:window.rooms});`,
    };
    const bundle = await build({
      stdin: {
        resolveDir: process.cwd(),
        loader: "tsx",
        contents: `
    import React,{useState} from 'react';import {createRoot} from 'react-dom/client';
    import NotificationCenter from './components/NotificationCenter';
    import {RoomActivityProvider} from './components/room-activity-context';
    window.rooms=[{id:'a',name:'Room A',currentUserRole:'ADMIN'},{id:'b',name:'Room B',currentUserRole:'ADMIN'},{id:'c',name:'Room C',currentUserRole:'MEMBER'}];
    const make=(id,room='a')=>({id,type:'join.requested',room:{id:room,name:room},actor:{id,name:'User '+id,email:id+'@test.com'},request:{id,ticket:'ticket'},createdAt:new Date().toISOString(),expiresAt:new Date(Date.now()+900000).toISOString()});
    window.historyEvents=[make('one'),make('two'),make('other','b')];
    const listeners=new Map();
    window.emit=(event)=>{window.historyEvents.push(event);for(const cb of listeners.get('qchat:room:'+event.room.id+':join-requests')||[])cb({data:event})};
    const client={channels:{get:(name)=>({subscribe:async(cb)=>{if(!listeners.has(name))listeners.set(name,new Set());listeners.get(name).add(cb)},unsubscribe:(cb)=>listeners.get(name)?.delete(cb),history:async()=>({items:window.historyEvents.filter(e=>name==='qchat:room:'+e.room.id+':join-requests').map(data=>({data})),hasNext:()=>false})})}};
    window.fetch=async()=>({ok:!window.failDecision,json:async()=>window.failDecision?{error:'Try again'}:{}});
    function App(){const [room,setRoom]=useState(window.rooms[0]);const [user,setUser]=useState('admin');window.configure=(id,userId='admin')=>{setRoom(window.rooms.find(r=>r.id===id));setUser(userId)};return <RoomActivityProvider realtimeClient={client} userId={user}><NotificationCenter room={room}/></RoomActivityProvider>}
    createRoot(document.getElementById('root')).render(<App/>);
  `,
      },
      bundle: true,
      write: false,
      platform: "browser",
      jsx: "automatic",
      define: { "process.env.NODE_ENV": '"test"' },
      plugins: [
        {
          name: "mocks",
          setup(b) {
            b.onResolve({ filter: /.*/ }, (args) =>
              Object.hasOwn(mocks, args.path)
                ? { path: args.path, namespace: "mock" }
                : undefined,
            );
            b.onLoad({ filter: /.*/, namespace: "mock" }, (args) => ({
              contents: mocks[args.path],
            }));
          },
        },
      ],
    });
    const server = createServer((req, res) => {
      if (req.url === "/bundle.js") {
        res.setHeader("Content-Type", "application/javascript");
        res.end(bundle.outputFiles[0].contents);
      } else {
        res.setHeader("Content-Type", "text/html");
        res.end(
          '<!doctype html><div id="root"></div><script src="/bundle.js"></script>',
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
      const context = await browser.newContext();
      await context.addInitScript(() => {
        window.observers = [];
        window.IntersectionObserver = class {
          constructor(cb, options) {
            this.cb = cb;
            this.options = options;
            this.targets = new Set();
            window.observers.push(this);
          }
          observe(el) {
            this.targets.add(el);
          }
          unobserve(el) {
            this.targets.delete(el);
          }
          disconnect() {
            this.targets.clear();
          }
        };
        window.intersect = (id, ratio) => {
          for (const observer of window.observers)
            for (const target of observer.targets)
              if (target.dataset.requestId === id)
                observer.cb([
                  {
                    target,
                    isIntersecting: ratio > 0,
                    intersectionRatio: ratio,
                  },
                ]);
        };
      });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      const url = `http://127.0.0.1:${server.address().port}`;
      const badge = async (n) =>
        page
          .getByRole("button", {
            name: n ? `Open join requests, ${n} unread` : "Open join requests",
            exact: true,
            includeHidden: true,
          })
          .waitFor();
      const open = async () =>
        page.getByRole("button", { name: /Open join requests/ }).click();
      const close = async () => {
        await page.keyboard.press("Escape");
        await page.getByRole("dialog").waitFor({ state: "hidden" });
      };
      await page.goto(url);
      await badge(2);
      await open();
      await page.locator('[data-request-id="one"]').waitFor();
      assert.equal(await page.locator('[data-request-id="other"]').count(), 0);
      await page.evaluate(() => window.intersect("one", 0.4));
      await badge(2);
      await page.evaluate(() => window.intersect("one", 0.5));
      await badge(1);
      assert.equal(
        await page.evaluate(() =>
          window.observers.some(
            (o) => o.options.root && o.options.threshold === 0.5,
          ),
        ),
        true,
      );
      await close();
      await page.evaluate(() => window.configure("b"));
      await badge(1);
      await page.evaluate(() => window.configure("a"));
      await badge(1);
      await page.reload();
      await badge(1);
      await open();
      await page
        .locator('[data-request-id="two"]')
        .getByRole("button", { name: "Ignore", exact: true })
        .click();
      await badge(0);
      await close();
      await page.reload();
      await badge(0);
      await open();
      assert.equal(await page.locator('[data-request-id="two"]').count(), 0);
      // Failed decisions keep the card; successful decisions remove it locally.
      await page.evaluate(() => (window.failDecision = true));
      await page
        .locator('[data-request-id="one"]')
        .getByRole("button", { name: "Accept", exact: true })
        .click();
      await page.getByRole("alert").filter({ hasText: "Try again" }).waitFor();
      await page.evaluate(() => (window.failDecision = false));
      await page
        .locator('[data-request-id="one"]')
        .getByRole("button", { name: "Accept", exact: true })
        .click();
      await page.getByText("No pending join requests.").waitFor();
      await close();
      // Resolutions and membership events never produce a new unread notification.
      await page.evaluate(() =>
        window.emit({ ...window.historyEvents[0], type: "join.approved" }),
      );
      await badge(0);
      await page.evaluate(() => window.configure("c"));
      await page
        .getByRole("button", { name: /Open join requests/ })
        .waitFor({ state: "hidden" });
      await page.evaluate(() => window.configure("a", "different-admin"));
      await badge(1);
      await open();
      assert.equal(await page.locator('[data-request-id="two"]').count(), 1);
      assert.deepEqual(errors, []);
    } finally {
      await browser?.close();
      await new Promise((resolve) => server.close(resolve));
    }
  },
);
