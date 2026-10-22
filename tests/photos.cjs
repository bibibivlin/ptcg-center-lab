// Optional real-browser suite: requires local sample/ photos and Playwright.
// Start npm start first. Keep this out of the dependency-free npm test suite.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright'),{frames}=require('./sample-frames.json');
const root=path.resolve(__dirname,'..'),output=path.join(root,'outputs/sample-validation');
(async()=>{
 fs.mkdirSync(output,{recursive:true});
 const browser=await chromium.launch({headless:true,...(process.env.PTCG_BROWSER_CHANNEL?{channel:process.env.PTCG_BROWSER_CHANNEL}:{})});
 const report=[];
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true});
  await page.addInitScript(()=>{
   const Native=window.Worker;window.detectionMessages=[];
   window.Worker=class extends Native{constructor(...args){super(...args);this.addEventListener('message',e=>window.detectionMessages.push(e.data));}};
  });
  for(const [name,reference]of Object.entries(frames)){
   if(process.argv[2]&&!name.includes(process.argv[2]))continue;
   await page.goto(process.env.PTCG_TEST_URL||'http://127.0.0.1:4173');
   const start=Date.now();await page.locator('#upload').setInputFiles(path.join(root,'sample',name));
   await page.waitForFunction(()=>window.detectionMessages.some(m=>m.result||m.error),{},{timeout:120000});
   await page.waitForFunction(()=>!document.getElementById('autoBtn').disabled);
   const messages=await page.evaluate(()=>window.detectionMessages),final=messages.find(m=>m.result||m.error);
   assert.ok(final.result,`${name}: ${final.error}`);
   const outerStage=messages.findIndex(m=>m.stage==='outer');assert.ok(outerStage>=0&&outerStage<messages.indexOf(final),'outer stage must precede completion');
   const downloadPromise=page.waitForEvent('download');await page.locator('#exportBtn').click();
   const download=await downloadPromise,data=JSON.parse(fs.readFileSync(await download.path(),'utf8'));
   const dimensions=name.startsWith('IMG_LEICA')?[3632,5456]:[12288,16384];
   assert.deepEqual([data.originalWidth,data.originalHeight],dimensions,'retain EXIF-oriented original dimensions');
   const errors=data.derivedCorners.outer.map((p,i)=>Math.hypot(p.x*1000/data.originalHeight-reference[i][0],p.y*1000/data.originalHeight-reference[i][1]));
   assert.ok(Math.max(...errors)<12,`${name}: cut-edge corner errors ${errors.map(n=>n.toFixed(2)).join(', ')}`);
   if(final.result.innerSource==='estimated-centered'){
    assert.equal(data.localizationStatus,'estimated-inner-needs-calibration');
    assert.ok(Math.abs(data.results.leftPercent-50)<1e-7&&Math.abs(data.results.topPercent-50)<1e-7);
    assert.equal(await page.locator('#reviewNotice').isVisible(),true);
   }
   report.push({name,milliseconds:Date.now()-start,maximumReferenceError:Math.max(...errors),data});
   await page.screenshot({path:path.join(output,name+'.png')});
   console.log(`${name}: ${final.result.innerSource}, ${report.at(-1).milliseconds} ms`);
  }
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(output,'mobile.png')});
  assert.ok(await page.locator('#adjustDock').isVisible());
 }finally{
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));await browser.close();
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
