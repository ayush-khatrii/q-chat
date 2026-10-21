const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createServer } = require('node:http');
const { build } = require('esbuild');
const { chromium } = require('@playwright/test');

async function fixture() {
  const result = await build({
    stdin: { contents: `import React from 'react';import{createRoot}from'react-dom/client';import InviteJoin from './components/rooms/InviteJoin';import{PwaProvider,InstallApp}from'./components/pwa/InstallApp';
      createRoot(document.getElementById('root')).render(location.pathname.startsWith('/join/')?<InviteJoin code="QC-TEAM"/>:<PwaProvider><InstallApp/></PwaProvider>);`, resolveDir: process.cwd(), loader: 'tsx' },
    bundle:true,write:false,platform:'browser',jsx:'automatic',define:{'process.env.NODE_ENV':'"test"'},
    plugins:[{name:'auth',setup(builder){builder.onResolve({filter:/^@\/lib\/auth-client$/},()=>({path:'auth',namespace:'mock'}));builder.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:`export const authClient={useSession:()=>({data:window.__signedIn?{user:{id:'self'}}:null,isPending:false}),signIn:{social:async params=>{window.__oauth=params;return window.__failSignIn?{error:{message:'Sign-in failed'}}:{}}}};` }));}}]
  });
  const server=createServer((req,res)=>{
    if(req.url==='/bundle.js'){res.setHeader('Content-Type','application/javascript');res.end(result.outputFiles[0].contents);}
    else{res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><body><div id="root"></div><script>window.process={env:{}};</script><script src="/bundle.js"></script></body></html>');}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  return{server,url:`http://127.0.0.1:${server.address().port}`};
}

test('browser: invitation preserves OAuth destination, confirms joining and permits retries', {timeout:60000},async()=>{
  const {server,url}=await fixture(); const browser=await chromium.launch({headless:true});
  const page=await browser.newPage();page.setDefaultTimeout(8000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{
    await page.goto(`${url}/join/QC-TEAM`);
    await page.evaluate(()=>window.__failSignIn=true);
    await page.getByRole('button',{name:'Sign in with Google'}).click();
    await page.getByRole('alert').filter({hasText:'Sign-in failed'}).waitFor();
    assert.equal(await page.evaluate(()=>window.__oauth.callbackURL),'/join/QC-TEAM');
    assert.equal(await page.evaluate(()=>window.__oauth.newUserCallbackURL),'/join/QC-TEAM');
    await page.addInitScript(()=>window.__signedIn=true);
    let requests=0;
    await page.route('**/api/rooms/join',async route=>{
      requests++;assert.deepEqual(route.request().postDataJSON(),{code:'QC-TEAM'});
      if(requests===1)return route.fulfill({status:409,json:{error:'This room is full.'}});
      return route.fulfill({json:{room:{code:'QC-TEAM'}}});
    });
    await page.reload();
    await page.getByRole('button',{name:'Join room',exact:true}).waitFor();
    assert.equal(requests,0);
    await page.getByRole('button',{name:'Join room',exact:true}).click();
    await page.getByRole('alert').filter({hasText:'This room is full.'}).waitFor();
    await page.getByRole('button',{name:'Join room',exact:true}).click();
    await page.waitForURL('**/chat/QC-TEAM');
    assert.equal(requests,2);assert.deepEqual(errors,[]);
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
});

test('browser: install action offers fallback instructions and invokes deferred native prompt', {timeout:60000},async()=>{
  const {server,url}=await fixture();const browser=await chromium.launch({headless:true});const page=await browser.newPage();page.setDefaultTimeout(8000);
  try{
    await page.goto(url);
    await page.getByRole('button',{name:'Install QChat',exact:true}).click();
    await page.getByRole('dialog').waitFor();
    await page.getByText('Chatting requires an internet connection.').waitFor();
    await page.keyboard.press('Escape');
    await page.evaluate(()=>{
      const event=new Event('beforeinstallprompt',{cancelable:true});
      event.prompt=async()=>{window.__prompted=true;};event.userChoice=Promise.resolve({outcome:'accepted'});
      window.dispatchEvent(event);
    });
    await page.getByRole('button',{name:'Install QChat',exact:true}).click();
    assert.equal(await page.evaluate(()=>window.__prompted),true);
    await page.evaluate(()=>window.dispatchEvent(new Event('appinstalled')));
    await page.getByRole('button',{name:'Install QChat',exact:true}).waitFor({state:'hidden'});
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
});
