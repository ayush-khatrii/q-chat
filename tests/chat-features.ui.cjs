const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createServer } = require('node:http');
const { build } = require('esbuild');
const { chromium } = require('@playwright/test');
const { readFile } = require('node:fs/promises');
const postcss = require('postcss');
const tailwind = require('@tailwindcss/postcss');

// Bundle the real composer and attachment UI, replacing only external services.
// The browser still runs the real upload hook, file picker, dialogs, and fetches.
async function fixture() {
  const mocks = {
    '@/lib/auth-client': 'export const authClient = { useSession: () => ({data:{user:{id:"self",name:"Me",email:"me@example.com"}}}) };',
    '@/lib/fcm': 'export const initFcm = async () => {};',
    '@/hooks/use-read-receipts': 'export const useReadReceipts = () => ({readReceipts:{},markRead:async()=>true});',
    '@/components/chat/chat-appearance': 'export const getRoomThemeStyle = () => ({}); export const useRoomTheme = () => ({theme:{}});',
    '@ably/chat/react': `import {useEffect,useCallback,useRef} from 'react';
      import {ChatMessageAction,ChatMessageEventType,MessageReactionSummaryEventType} from '@ably/chat';
      import {DefaultMessage,emptyMessageReactions} from './node_modules/@ably/chat/src/core/message.ts';
      const first = new DefaultMessage({serial:'001',clientId:'self',text:'Original message',metadata:{displayName:'Me',attachmentIds:[]},headers:{preserve:'yes'},timestamp:new Date(),action:ChatMessageAction.MessageCreate,version:{serial:'001',timestamp:new Date()},reactions:emptyMessageReactions()});
      const other = new DefaultMessage({serial:'002',clientId:'other',text:'Incoming message',metadata:{},headers:{},timestamp:new Date(),action:ChatMessageAction.MessageCreate,version:{serial:'002',timestamp:new Date()},reactions:emptyMessageReactions()});
      let stored = first, version=2, summary=emptyMessageReactions();
      export const useTyping=()=>({currentTypers:new Set(),keystroke:async()=>{},stop:async()=>{}});
      export function useMessages({listener,reactionsListener}) {
        const callbacks=useRef({listener,reactionsListener});callbacks.current={listener,reactionsListener};
        const historyBeforeSubscribe=useCallback(async()=>({items:[stored,other],isLast:()=>true}),[]);
        useEffect(()=>{window.__delete=()=>{stored=new DefaultMessage({...stored,action:ChatMessageAction.MessageDelete,version:{serial:'999',timestamp:new Date()}});callbacks.current.listener({type:ChatMessageEventType.Deleted,message:stored});};},[]);
        return {historyBeforeSubscribe,
          sendMessage:async(params)=>{window.__sends=(window.__sends||0)+1;window.__sendParams=params;const sent=new DefaultMessage({serial:'003',clientId:'self',text:params.text,metadata:params.metadata,headers:{},timestamp:new Date(),action:ChatMessageAction.MessageCreate,version:{serial:'003',timestamp:new Date()},reactions:emptyMessageReactions()});callbacks.current.listener({type:ChatMessageEventType.Created,message:sent});return sent;},
          getMessage:async(serial)=>serial==='001'?stored:other,deleteMessage:async()=>{},
          updateMessage:async(serial,params)=>{
            window.__updates=(window.__updates||0)+1;
            if(window.__failEdit)throw new Error('Temporary update failure');
            window.__params=params;
            stored=new DefaultMessage({...stored,...params,action:ChatMessageAction.MessageUpdate,version:{serial:String(++version).padStart(3,'0'),timestamp:new Date()}});
            callbacks.current.listener({type:ChatMessageEventType.Updated,message:stored});return stored;
          },
          sendReaction:async(serial,{name,type})=>{
            if(window.__failReaction)throw new Error('Reaction failed');
            window.__reactionType=type;
            summary={...summary,distinct:{...summary.distinct,[name]:{total:1,clientIds:['self'],clipped:false}}};
            callbacks.current.reactionsListener({type:MessageReactionSummaryEventType.Summary,messageSerial:serial,reactions:summary});
          },
          deleteReaction:async(serial,{name})=>{
            summary={...summary,distinct:{...summary.distinct}};delete summary.distinct[name];
            callbacks.current.reactionsListener({type:MessageReactionSummaryEventType.Summary,messageSerial:serial,reactions:summary});
          }
        };
      }`,
  };
  const result = await build({
    stdin: {
      contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; import Chat from './components/Chat'; import {TooltipProvider} from './components/ui/tooltip';
      createRoot(document.getElementById('root')).render(<TooltipProvider><div className="flex h-dvh flex-col"><Chat roomId="room" roomCode="CODE" members={[]} initialTheme={{}} /></div></TooltipProvider>);`,
      resolveDir: process.cwd(),
      loader: 'tsx',
    },
    bundle: true,
    write: false,
    platform: 'browser',
    jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"test"' },
    plugins: [
      {
        name: 'external-service-stubs',
        setup(builder) {
          builder.onResolve({ filter: /.*/ }, (args) => (Object.hasOwn(mocks, args.path) ? { path: args.path, namespace: 'stub' } : undefined));
          builder.onLoad({ filter: /.*/, namespace: 'stub' }, (args) => ({
            contents: mocks[args.path],
            resolveDir: process.cwd(),
          }));
        },
      },
    ],
  });
  const css = await postcss([tailwind()]).process(await readFile('app/globals.css', 'utf8'), { from: require('node:path').resolve('app/globals.css') });
  const server = createServer((req, res) => {
    if (req.url === '/style.css') {
      res.setHeader('Content-Type', 'text/css');
      res.end(css.css);
      return;
    }
    if (req.url === '/image.png') {
      res.setHeader('Content-Type', 'image/png');
      res.end(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aNZkAAAAASUVORK5CYII=', 'base64'));
    } else if (req.url === '/bundle.js') {
      res.setHeader('Content-Type', 'application/javascript');
      res.end(result.outputFiles[0].contents);
    } else {
      res.setHeader('Content-Type', 'text/html');
      res.end('<!doctype html><html class="dark"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script>window.process={env:{}};</script><script src="/bundle.js"></script></body></html>');
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { server, url: `http://127.0.0.1:${server.address().port}` };
}

test('browser: edits preserve drafts and metadata; distinct reactions toggle on both sides', { timeout: 60000 }, async () => {
  const { server, url } = await fixture();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
  });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    await page.goto(url);
    await page.getByText('Original message', { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'React to message' }).count(), 0);
    assert.equal(await page.locator('[data-slot=bubble-reactions]').count(), 0);
    // The composer has a placeholder rather than an accessible name in older versions.
    const composer = page.locator('textarea').first();
    await composer.fill('Unfinished draft');
    await page.getByText('Original message', { exact: true }).click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Edit', exact: true }).click();
    await page.getByRole('textbox', { name: 'Edit message text' }).fill('Changed message');
    await page.evaluate(() => (window.__failEdit = true));
    await page.getByRole('button', { name: 'Save changes' }).click();
    await page.getByRole('alert').filter({ hasText: 'Temporary update failure' }).waitFor();
    await page.evaluate(() => (window.__failEdit = false));
    await page.getByRole('button', { name: 'Save changes' }).click();
    await page.getByText('Changed message', { exact: true }).waitFor();
    assert.equal(await composer.inputValue(), 'Unfinished draft');
    assert.equal(await page.evaluate(() => window.__params.headers.preserve), 'yes');
    assert.deepEqual(await page.evaluate(() => window.__params.metadata.attachmentIds), []);
    assert.equal(await page.evaluate(() => window.__sends || 0), 0);
    await page.getByText('· edited', { exact: true }).waitFor();
    await page.getByText('Changed message', { exact: true }).click({ button: 'right' });
    await page.getByRole('menuitemcheckbox', { name: 'React 👍', exact: true }).click();
    await page
      .getByRole('button', {
        name: '👍: 1 reaction, including you',
        exact: true,
      })
      .waitFor();
    await page.getByText('Changed message', { exact: true }).click({ button: 'right' });
    await page.getByRole('menuitemcheckbox', { name: 'React ❤️', exact: true }).click();
    await page
      .getByRole('button', {
        name: '❤️: 1 reaction, including you',
        exact: true,
      })
      .waitFor();
    assert.equal(await page.evaluate(() => window.__reactionType), 'distinct');
    const bubble = page.locator('[data-slot=bubble]').filter({ has: page.getByText('Changed message', { exact: true }) });
    const bubbleBox = await bubble.boundingBox();
    const badge = bubble.locator('[data-slot=bubble-reactions]');
    const badgeBox = await badge.boundingBox();
    assert.ok(badgeBox.y < bubbleBox.y + bubbleBox.height && badgeBox.y + badgeBox.height > bubbleBox.y + bubbleBox.height, 'badge overlaps lower bubble edge');
    assert.ok(badgeBox.x + badgeBox.width <= bubbleBox.x + bubbleBox.width, 'outgoing badge stays anchored to bubble right');
    const footerBox = await bubble.locator('..').locator('[data-slot=message-footer]').boundingBox();
    assert.ok(footerBox.y >= badgeBox.y + badgeBox.height, 'badge does not overlap timestamp');
    await page.screenshot({ path: '/tmp/qchat-reactions-mobile.png' });

    await page
      .getByRole('button', {
        name: '👍: 1 reaction, including you',
        exact: true,
      })
      .click();
    assert.equal(
      await page
        .getByRole('button', {
          name: '👍: 1 reaction, including you',
          exact: true,
        })
        .count(),
      0,
    );
    await page.getByText('Incoming message', { exact: true }).click({ button: 'right' });
    assert.equal(await page.getByRole('menuitem', { name: 'Edit', exact: true }).count(), 0);
    await page.keyboard.press('Escape');
    await page.getByText('Changed message', { exact: true }).click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Edit', exact: true }).click();
    await page.evaluate(() => window.__delete());
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    assert.equal(
      await page
        .getByRole('button', {
          name: '❤️: 1 reaction, including you',
          exact: true,
        })
        .count(),
      0,
    );
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
});

test('browser: touch hold and keyboard open emoji choices with message actions', { timeout: 60000 }, async () => {
  const { server, url } = await fixture();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    await page.goto(url);
    const message = page.locator('[data-slot=bubble-content]').filter({ hasText: 'Original message' });
    await message.waitFor();
    assert.equal(await page.locator('[data-slot=bubble-reactions]').count(), 0);
    await message.tap();
    assert.equal(await page.getByRole('menu').count(), 0, 'normal taps do not open the menu');
    const rect = await message.boundingBox();
    const session = await page.context().newCDPSession(page);
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }],
    });
    await page.getByRole('menu').waitFor();
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
    await page.getByRole('menuitem', { name: 'Copy', exact: true }).waitFor();
    await page.getByRole('menuitem', { name: 'Reply', exact: true }).waitFor();
    await page.getByRole('menuitem', { name: 'Edit', exact: true }).waitFor();
    await page.getByRole('menuitem', { name: 'Delete', exact: true }).waitFor();
    assert.equal(await page.getByRole('menuitemcheckbox').count(), 6);
    await page.screenshot({ path: '/tmp/qchat-message-menu-mobile.png' });
    await page.getByRole('menuitemcheckbox', { name: 'React ❤️', exact: true }).tap();
    await page
      .getByRole('button', {
        name: '❤️: 1 reaction, including you',
        exact: true,
      })
      .waitFor();
    await message.focus();
    await page.keyboard.press('Shift+F10');
    await page.getByRole('menu').waitFor();
    assert.equal(await page.getByRole('menuitemcheckbox', { name: 'React ❤️', exact: true }).getAttribute('aria-checked'), 'true');
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('button', { name: 'React to message' }).count(), 0);
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
});

test('browser: reply selection sends Ably reply metadata and links back to the parent', { timeout: 60000 }, async () => {
  const { server, url } = await fixture();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
  });
  try {
    await page.goto(url);
    await page.getByText('Incoming message', { exact: true }).click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Reply', exact: true }).click();
    await page.getByText('Replying to Unknown user', { exact: true }).waitFor();
    const composer = page.locator('textarea').first();
    await composer.fill('This is my reply');
    await page.getByRole('button', { name: 'Send message' }).click();
    await page.getByText('This is my reply', { exact: true }).waitFor();
    assert.deepEqual(await page.evaluate(() => window.__sendParams.metadata.reply), {
      serial: '002',
      clientId: 'other',
      previewText: 'Incoming message',
      timestamp: await page.evaluate(() => window.__sendParams.metadata.reply.timestamp),
    });
    await page.getByRole('button', { name: 'Go to message from Unknown user' }).click();
    await page.locator('[data-message-serial="002"]').waitFor();
    assert.match(await page.locator('[data-message-serial="002"]').getAttribute('class'), /ring-2/);
    assert.equal(await page.getByText('Replying to Unknown user', { exact: true }).count(), 0);
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
});
