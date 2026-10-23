import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',args:['--no-sandbox','--disable-gpu']});
try{
 const context=await browser.newContext({viewport:{width:1100,height:900}}),page=await context.newPage(),errors=[],external=[];
 page.on('pageerror',e=>errors.push(e.message));
 const url=process.env.FOUNDATION_URL??new URL('../Synthia-Foundation-Offline.html',import.meta.url).href;
 await page.route(/^https?:/,r=>{if(process.env.FOUNDATION_URL&&r.request().url().startsWith(new URL(url).origin+'/'))return r.continue();external.push(r.request().url());return r.abort();});
 await page.goto(url);await page.waitForFunction(()=>document.getElementById('status').textContent.includes('ready'));
 await page.locator('#photo-files').setInputFiles(['gradient.png','photo.jpg'].map(f=>fileURLToPath(new URL('../tests/fixtures/'+f,import.meta.url))));
 await page.waitForFunction(()=>globalThis.synthiaFoundation.photos.size===2);
 await page.locator('#photo-list article').nth(0).getByRole('button',{name:'Analyze and reconstruct pixels'}).click();
 await page.waitForFunction(()=>globalThis.synthiaFoundation.imageMemory.images.size===1);
 const first=await page.evaluate(()=>globalThis.synthiaFoundation.imageMemory.images.keys().next().value);
 const pixelCheck=await page.evaluate(async id=>{
  const app=globalThis.synthiaFoundation,record=app.imageMemory.images.get(id),photo=app.recoverPhoto(record.source),bitmap=await createImageBitmap(new Blob([photo.bytes],{type:photo.photo.mime}));
  const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(bitmap,0,0);const original=ctx.getImageData(0,0,canvas.width,canvas.height).data;bitmap.close();
  const reconstructed=app.imageMemory.reconstruct(id);const equal=original.length===reconstructed.rgba.length&&original.every((v,i)=>v===reconstructed.rgba[i]);
  const memory=app.photoMemory;app.photoMemory=null;let independent;try{independent=app.imageArtifact(id).bytes.length>54;}finally{app.photoMemory=memory;}
  return {equal,independent,width:canvas.width,height:canvas.height};
 },first);
 assert.equal(pixelCheck.equal,true);assert.equal(pixelCheck.independent,true);
 await page.locator('#image-source').selectOption(first);await page.locator('#image-label').fill('colored reference');await page.locator('#teach-image button').click();
 await page.waitForFunction(()=>globalThis.synthiaFoundation.imageMemory.feedback.length===1);
 await page.waitForFunction(()=>document.getElementById('recognition').textContent.includes('colored reference'));
 assert.match(await page.locator('#recognition').textContent(),/colored reference/);
 const address={planetary:1,dimension:'Being',gate:17,line:1,color:1,tone:1,base:1,degree:0,minute:0,second:0,arcFraction:0,zodiac:1,house:1};
 await page.locator('#command').fill(JSON.stringify([{operation:'image:bind',payload:{imageId:first,address,provenance:{source:'browser-QA:explicit-address'}}},{operation:'image:teach',payload:{imageId:first,label:'colored reference',source:'browser-QA:numeric-outcome',outcome:0.75}}]));
 await page.locator('#field-command button').click();await page.waitForFunction(()=>globalThis.synthiaFoundation.field.runs.length===2);
 await page.locator('#photo-list article').nth(1).getByRole('button',{name:'Analyze and reconstruct pixels'}).click();
 await page.waitForFunction(()=>globalThis.synthiaFoundation.imageMemory.images.size===2);
 const second=await page.evaluate(()=>[...globalThis.synthiaFoundation.imageMemory.images.keys()][1]);
 const perception=await page.evaluate(id=>({recognition:globalThis.synthiaFoundation.imageMemory.recognize(id),lastRun:globalThis.synthiaFoundation.field.runs.at(-1)}),second);
 assert.equal(perception.recognition.candidates[0].label,'colored reference');assert.equal(perception.lastRun.micro[0].gate,17);
 await page.locator('#compose-left').selectOption(first);await page.locator('#compose-right').selectOption(second);await page.locator('#compose-images button').click();
 await page.waitForFunction(()=>globalThis.synthiaFoundation.imageMemory.images.size===3&&document.getElementById('image-preview').naturalWidth>0);
 const generated=await page.evaluate(()=>{const app=globalThis.synthiaFoundation,id=[...app.imageMemory.images.keys()].at(-1),artifact=app.imageArtifact(id);return {id,sha256:artifact.sha256,width:artifact.width,height:artifact.height,summary:app.imageMemory.summary(id)};});
 assert.equal(generated.summary.lineage.parts.length,2);
 const downloadPromise=page.waitForEvent('download');await page.locator('#image-list article').last().getByRole('button',{name:'Save image',exact:true}).click();
 const download=await downloadPromise;await download.saveAs(fileURLToPath(new URL('../evidence/visual-composition.bmp',import.meta.url)));
 await page.locator('#photo-files').setInputFiles({name:'broken.png',mimeType:'image/png',buffer:Buffer.from([1,2,3])});await page.waitForFunction(()=>globalThis.synthiaFoundation.photos.size===3);
 await page.locator('#photo-list article').last().getByRole('button',{name:'Analyze and reconstruct pixels'}).click();await page.waitForFunction(()=>globalThis.synthiaFoundation.history.at(-1)?.result?.imageFailure);
 const failureTrace=await page.evaluate(()=>globalThis.synthiaFoundation.history.at(-1).result.imageFailure.decoderTrace);assert.ok(failureTrace.length>=1);assert.equal(failureTrace.at(-1).status,'FAILED');
 assert.equal(await page.evaluate(()=>globalThis.synthiaFoundation.imageMemory.images.size),3);
 const before=await page.evaluate(()=>({field:globalThis.synthiaFoundation.field.snapshot(),entries:globalThis.synthiaFoundation.history.length,feedback:globalThis.synthiaFoundation.imageMemory.feedback}));
 await page.reload();await page.waitForFunction(n=>globalThis.synthiaFoundation?.history.length===n,before.entries);
 const after=await page.evaluate(id=>({field:globalThis.synthiaFoundation.field.snapshot(),feedback:globalThis.synthiaFoundation.imageMemory.feedback,artifact:globalThis.synthiaFoundation.imageArtifact(id).sha256}),generated.id);
 assert.deepEqual(after.field,before.field);assert.deepEqual(after.feedback,before.feedback);assert.equal(after.artifact,generated.sha256);
 await page.locator('#image-list article').last().getByRole('button',{name:'Reconstruct image',exact:true}).click();await page.waitForFunction(()=>document.getElementById('image-preview').naturalWidth>0);
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.locator('#image-preview').scrollIntoViewIfNeeded();await page.screenshot({path:fileURLToPath(new URL('../evidence/image-browser.png',import.meta.url))});
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);

 // Continue the real UI flow through learned field meaning and contextual construction.
 await page.setViewportSize({width:1100,height:900});
 await page.locator('#command').fill(JSON.stringify([
  {operation:'image:bind',payload:{imageId:second,address:{...address,gate:18},provenance:{source:'browser-QA:second-coordinate'}}},
  ...['first-frame','second-frame'].map(id=>({operation:'defineStructure',payload:{id,dimension:'Being',source:'browser-QA:context'}}))
 ]));await page.locator('#field-command button').click();
 await page.waitForFunction(()=>document.getElementById('image-context').options.length===3);
 for(const [ctx,labels] of [['first-frame',['foreground','background']],['second-frame',['background','foreground']]]){
  for(const [i,imageId] of [first,second].entries()){
   const before=await page.evaluate(()=>globalThis.synthiaFoundation.history.length);
   await page.locator('#image-source').selectOption(imageId);await page.locator('#image-context').selectOption(ctx);await page.locator('#image-label').fill(labels[i]);await page.locator('#teach-image button').click();
   await page.waitForFunction(n=>globalThis.synthiaFoundation.history.length>n,before);
  }
 }
 await page.locator('#program-example').selectOption(generated.id);await page.locator('#program-name').fill('Observed pair');await page.locator('#learn-construction button').click();
 await page.waitForFunction(()=>document.getElementById('generation-program').options.length===1);
 const constructed=[];
 for(const ctx of ['first-frame','second-frame']){
  const before=await page.evaluate(()=>globalThis.synthiaFoundation.imageMemory.images.size);
  await page.locator('#generation-context').selectOption(ctx);await page.locator('#generation-terms').fill('foreground\nbackground');await page.locator('#generate-state-image button').click();
  await page.waitForFunction(n=>globalThis.synthiaFoundation.imageMemory.images.size>n,before);
  constructed.push(await page.evaluate(()=>{const a=globalThis.synthiaFoundation,id=[...a.imageMemory.images.keys()].at(-1);return a.imageMemory.summary(id);}));
 }
 assert.notEqual(constructed[0].pixelSha256,constructed[1].pixelSha256);
 assert.equal(constructed[0].fieldAddress.dominatingStructure,'first-frame');assert.equal(constructed[1].fieldAddress.dominatingStructure,'second-frame');
 await page.locator('#command').fill(JSON.stringify({operation:'tool',payload:{tool:'klein-analogy',source:'browser-QA:tool',input:{vocab:['a','b'],A:['a'],B:['b'],C:['a']}}}));await page.locator('#field-command button').click();
 await page.waitForFunction(()=>globalThis.synthiaFoundation.history.at(-1)?.result?.tool?.status==='EXECUTED');
 assert.match(await page.locator('#activity').textContent(),/UNVERIFIED_TOOL_RESULT/);
 const final=await page.evaluate(()=>({field:globalThis.synthiaFoundation.field.snapshot(),entries:globalThis.synthiaFoundation.history.length}));
 await page.reload();await page.waitForFunction(n=>globalThis.synthiaFoundation?.history.length===n,final.entries);
 assert.deepEqual(await page.evaluate(()=>globalThis.synthiaFoundation.field.snapshot()),final.field);
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.locator('#generate-state-image').scrollIntoViewIfNeeded();await page.screenshot({path:fileURLToPath(new URL('../evidence/context-construction-mobile.png',import.meta.url))});
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 console.log(JSON.stringify({contextualConstructionUI:'PASS',sameTermsDifferentContextChangesPixels:true,toolReceiptVisible:true,replayExact:true,pageErrors:errors,externalRequests:external}));

 const report={status:'PASS',contextualConstructionUI:true,sameTermsDifferentContextChangesPixels:true,toolReceiptVisible:true,contextualReplayExact:true,gpuDisabled:true,pixelCheck,sourceFormats:['PNG','JPEG'],taughtExamplesChangeCandidates:true,sourceSuppliedGateActivated:17,numericOutcomeLearned:true,generated:{id:generated.id,width:generated.width,height:generated.height,sha256:generated.sha256},artifactDownloaded:true,corruptInputRecorded:true,fullReplayExact:true,mobileOverflow:false,pageErrors:errors,externalRequests:external};
 await writeFile(new URL('../evidence/image-browser-qa.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
