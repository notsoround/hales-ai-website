// Real components and full production themes, entirely local synthetic meals.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {homedir,tmpdir} from 'node:os';
import {mkdtempSync,realpathSync,rmSync} from 'node:fs';
import path from 'node:path';
import {createServer} from 'vite';
const require=createRequire(import.meta.url);
const playwright=require(process.env.PLAYWRIGHT_MODULE||path.join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const cacheDir=mkdtempSync(path.join(tmpdir(),'cupcake-readable-'));
const server=await createServer({cacheDir,server:{host:'127.0.0.1',port:0,hmr:false,fs:{allow:[process.cwd(),realpathSync('node_modules')]}}});
await server.listen();const base=server.resolvedUrls.local[0];let scenarios=0;
try {
  for(const engine of ['chromium','webkit']) {
    const browser=await playwright[engine].launch({headless:true});
    try {for(const width of [320,390,1280])for(const theme of ['caribbean','rose']) {
      const page=await browser.newPage({viewport:{width,height:844},serviceWorkers:'block'});page.setDefaultTimeout(10000);
      const errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.route('**/*',r=>new URL(r.request().url()).origin===new URL(base).origin?r.continue():r.abort());
      await page.goto(`${base}tests/nutrition-readability-preview.html?theme=${theme}`);
      const nutrients=page.getByLabel('Logged nutrients',{exact:true});
      await nutrients.getByText('Protein',{exact:true}).waitFor();
      assert.equal(await nutrients.getByText('40 g · partial',{exact:true}).count(),1);
      assert.equal(await nutrients.getByText('60 g · partial',{exact:true}).count(),1);
      assert.equal(await nutrients.getByText('Known for 2 of 3 meals',{exact:true}).count(),2);
      await page.getByRole('button',{name:'Toggle unknown fat',exact:true}).click();
      assert.equal(await nutrients.getByText('Unknown',{exact:true}).count(),1);
      assert.equal(await nutrients.getByText('0 g',{exact:true}).count(),0);
      const scale=page.getByRole('group',{name:'Calendar scale'}),display=page.getByRole('group',{name:'Calendar display'});
      await scale.getByRole('button',{name:'Week',exact:true}).click();
      assert.equal(await display.getByRole('button',{name:'Readable list',exact:true}).getAttribute('aria-pressed'),String(width<=600));
      await display.getByRole('button',{name:'Readable list',exact:true}).click();
      const list=page.getByRole('region',{name:'Weekly food list',exact:true});
      assert.equal(await list.getByRole('button').count(),7);
      assert.equal(await list.getByText('99,999',{exact:true}).count(),1);
      assert.equal(await list.getByText('Known kcal · partial',{exact:true}).count(),1);
      assert.ok(await list.getByText('Calories unknown',{exact:true}).count()>0);
      assert.equal(await list.locator('small').evaluateAll(els=>els.every(el=>parseFloat(getComputedStyle(el).fontSize)>=13)),true);
      await display.getByRole('button',{name:'Chart',exact:true}).click();assert.equal(await page.locator('.cc-nutrition-week button').count(),7);
      await scale.getByRole('button',{name:'Month',exact:true}).click();
      await display.getByRole('button',{name:'Calendar',exact:true}).click();assert.equal(await page.locator('.cc-nutrition-month button').count(),30);
      await display.getByRole('button',{name:'Readable list',exact:true}).click();
      const month=page.getByRole('region',{name:'Monthly food list',exact:true});assert.equal(await month.getByRole('button').count(),30);
      assert.equal(await month.getByRole('button',{name:/Nov 9, 2026/}).isDisabled(),true);
      const geometry=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,rows:[...document.querySelectorAll('.cc-nutrition-day-list button')].map(el=>({left:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right,scroll:el.scrollWidth,client:el.clientWidth,height:el.clientHeight}))}));
      assert.ok(geometry.scroll<=width,`${engine}/${width}/${theme}: document overflow`);
      assert.ok(geometry.rows.every(r=>r.left>=0&&r.right<=width&&r.scroll<=r.client&&r.height>=44));
      await month.getByRole('button',{name:/Nov 7, 2026/}).click();
      assert.equal(await scale.getByRole('button',{name:'Day',exact:true}).getAttribute('aria-pressed'),'true');
      await page.locator('.cc-nutrition-timeline-item button').click();assert.equal(await page.getByRole('status').textContent(),'d');
      await scale.getByRole('button',{name:'Month',exact:true}).click();
      await page.getByRole('button',{name:'Previous month',exact:true}).click();await page.getByRole('heading',{name:'October 2026',exact:true}).waitFor();
      await page.getByRole('button',{name:'Next month',exact:true}).click();await page.getByRole('heading',{name:'November 2026',exact:true}).waitFor();
      await scale.getByRole('button',{name:'Year',exact:true}).click();assert.equal(await page.locator('.cc-nutrition-year>button').count(),12);
      assert.deepEqual(errors,[]);await page.close();scenarios++;
    }}finally{await browser.close();}
  }
}finally{await server.close();rmSync(cacheDir,{recursive:true,force:true});}
console.log(`PASS: ${scenarios} local Chromium/WebKit nutrition scenarios; both themes/320/390/1280; exact list values, unknown/partial nutrients, all grids/day/year navigation retained; no external data or writes`);
