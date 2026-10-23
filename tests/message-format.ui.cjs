const assert = require('node:assert/strict');
const { test } = require('node:test');
const { build } = require('esbuild');
const { createServer } = require('node:http');
const { chromium } = require('@playwright/test');
const { readFile } = require('node:fs/promises');
const postcss = require('postcss');
const tailwind = require('@tailwindcss/postcss');

test('browser: Markdown and code stay safe, copyable and within mobile bubbles', { timeout: 60000 }, async () => {
  const result = await build({ stdin: { contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; import {MessageBody} from './components/chat/MessageBody'; window.renderText=(text)=>root.render(<div style={{width:280, padding:10}}><MessageBody text={text}/></div>); const root=createRoot(document.getElementById('root'));`, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, jsx: 'automatic', platform: 'browser' });
  const css = await postcss([tailwind()]).process(await readFile('app/globals.css', 'utf8'), { from: require('node:path').resolve('app/globals.css') });
  const server = createServer((req,res)=> { res.setHeader('Content-Type', req.url === '/bundle.js' ? 'text/javascript' : req.url === '/style.css' ? 'text/css' : 'text/html'); res.end(req.url === '/bundle.js' ? result.outputFiles[0].contents : req.url === '/style.css' ? css.css : '<link rel="stylesheet" href="/style.css"><div id="root"></div><script src="/bundle.js"></script>'); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({headless:true});
    const page = await browser.newPage({viewport:{width:390,height:844}});
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.evaluate(()=>Object.defineProperty(navigator, 'clipboard', {value:{writeText:async(text)=>{window.copied=text;}}}));
    const code = '  function demo() {\n    return "' + 'x'.repeat(300) + '";\n  }\n';
    await page.evaluate(text=>window.renderText(text), code);
    await page.locator('pre').waitFor();
    assert.equal(await page.locator('pre code').textContent(),code);
    await page.getByRole('button',{name:'Copy code',exact:true}).click();
    assert.equal(await page.evaluate(()=>window.copied),code);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth), true);
    assert.equal(await page.locator('pre').evaluate(el=>el.scrollWidth > el.clientWidth), true);
    await page.evaluate(()=>window.renderText('# Title\n\nfirst\nsecond\n\n| A | B |\n| --- | --- |\n| '+ 'wide'.repeat(100) +' | value |\n\n<script>window.pwned=true</script>\n\n[bad](javascript:alert(1))\n\n![remote](https://example.com/image.png)'));
    await page.getByRole('heading',{name:'Title'}).waitFor();
    assert.equal(await page.locator('table').count(),1);
    assert.equal(await page.locator('img').count(),0);
    assert.equal(await page.locator('a[href^="javascript:"]').count(),0);
    assert.equal(await page.evaluate(()=>window.pwned),undefined);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth),true);
    assert.equal(await page.getByText('first\nsecond',{exact:true}).evaluate(el=>getComputedStyle(el).whiteSpace),'pre-wrap');
    await page.evaluate(()=>window.renderText('```js\nconst x = 1;\n```'));
    await page.locator('pre').waitFor();
    assert.equal(await page.locator('pre code').textContent(),'const x = 1;\n');
  } finally { if(browser) await browser.close(); await new Promise(resolve=>server.close(resolve)); }
});
