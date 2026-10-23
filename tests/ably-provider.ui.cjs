const assert = require("node:assert/strict");
const { test } = require("node:test");
const { createServer } = require("node:http");
const { build } = require("esbuild");
const { chromium } = require("@playwright/test");

async function fixture() {
  const mocks = {
    "@/lib/auth-client": `import {useSyncExternalStore} from 'react';
      let snapshot={data:null}; const listeners=new Set();
      export const setSession=(user)=>{snapshot={data:user?{user}:null};for(const listener of listeners)listener();};
      export const authClient={useSession:()=>useSyncExternalStore((listener)=>{listeners.add(listener);return()=>listeners.delete(listener);},()=>snapshot,()=>snapshot)};`,
    "@/components/room-activity-context": "export function RoomActivityProvider({children}){return children}",
    ably: `export class Realtime { constructor(){this.auth={authorize:async()=>{}}} close(){} }
      export class Message {}`,
    "@ably/chat": `export const LogLevel={Info:'info'};
      export class ChatClient { constructor(){} async dispose(){} }`,
  };
  const result = await build({
    stdin: {
      contents: `import React,{useEffect,useState} from 'react';
        import {createRoot} from 'react-dom/client';
        import AppAblyProvider,{useAblyConnection} from './providers/AblyProvider';
        import {setSession} from '@/lib/auth-client';
        function Probe(){const [count,setCount]=useState(0);const connection=useAblyConnection();useEffect(()=>{window.__mounts=(window.__mounts||0)+1},[]);return <><button onClick={()=>setCount(count+1)}>Increment</button><output data-testid="probe">{count}:{connection?'ready':'waiting'}</output></>}
        function App(){return <><button onClick={()=>setSession({id:'user-1'})}>Resolve session</button><button onClick={()=>setSession(null)}>Sign out</button><AppAblyProvider><Probe/></AppAblyProvider></>}
        createRoot(document.getElementById('root')).render(<App/>);`,
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
        name: "service-stubs",
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
    res.setHeader("Content-Type", "text/html");
    if (req.url === "/bundle.js") {
      res.setHeader("Content-Type", "application/javascript");
      res.end(result.outputFiles[0].contents);
      return;
    }
    res.end('<!doctype html><div id="root"></div><script src="/bundle.js"></script>');
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return { server, url: `http://127.0.0.1:${server.address().port}` };
}

test(
  "browser: session and Ably startup do not remount the application subtree",
  { timeout: 60000 },
  async () => {
    const { server, url } = await fixture();
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    try {
      await page.goto(url);
      const probe = page.locator('[data-testid="probe"]');
      await probe.waitFor();
      await page.getByRole("button", { name: "Increment" }).click();
      assert.equal(await probe.textContent(), "1:waiting");

      await page.getByRole("button", { name: "Resolve session" }).click();
      await page.getByText("1:ready", { exact: true }).waitFor();
      assert.equal(await page.evaluate(() => window.__mounts), 1);

      await page.getByRole("button", { name: "Sign out" }).click();
      await page.getByText("1:waiting", { exact: true }).waitFor();
      assert.equal(await page.evaluate(() => window.__mounts), 1);
    } finally {
      await browser.close();
      await new Promise((resolve) => server.close(resolve));
    }
  },
);
