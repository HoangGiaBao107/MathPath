/* eslint-disable @typescript-eslint/no-require-imports */
/* global require, document, window */
const {chromium}=require('playwright');
const fs=require('node:fs/promises');
const assert=require('node:assert/strict');
const process=require('node:process');
const {Console}=require('node:console');
const console=new Console(process.stdout,process.stderr);
(async()=>{
 const exams=JSON.parse(await fs.readFile('tmp/mathpath-new/runtime-exams.json','utf8'));
 const browser=await chromium.launch({headless:true,channel:'chrome'}),reports=[];
 try{for(const width of [1440,390])for(const id of ['THI_01','OTC_04_01']){
  const exam=exams.find(e=>e.id===id),context=await browser.newContext({viewport:{width,height:950},reducedMotion:'reduce'}),page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  page.on('response',async r=>{if(r.url().includes('/api/attempts')&&!r.ok()) console.error('Attempt API',r.status(),await r.text());});
  // No external Supabase/AI calls from this isolated browser test.
  await page.route('**/*.supabase.co/**',r=>r.abort());
  await page.goto('http://127.0.0.1:3211/dev/mathpath-bank/'+id);
  const start=page.waitForResponse(r=>r.url().endsWith('/api/attempts')&&r.request().method()==='POST');
  await page.getByRole('button',{name:/Bắt đầu/}).click();
  const payload=await(await start).json();
  const persisted=await context.request.get('http://127.0.0.1:3211/api/attempts/'+payload.attempt.id);
  assert.equal(persisted.status(),200,'New attempt must be readable with its session cookie');
  assert.ok(!JSON.stringify(payload).includes('correctOptionKey')&&!JSON.stringify(payload).includes('canonicalAnswer'));
  const wanted=new Set([0,exam.questions.findIndex(q=>q.type==='true_false'),exam.questions.findIndex(q=>q.type==='short_answer')]);
  let expected=0;
  for(let index=0;index<exam.questions.length;index++){
   const q=exam.questions[index];
   if(wanted.has(index)){
    if(q.type==='multiple_choice')await page.locator(`input[name="answer-${q.id}"][value="${q.correctOptionKey}"]`).check();
    else if(q.type==='true_false')for(const [key,value] of Object.entries(q.correctStatements))await page.locator(`input[name="tf-${q.id}-${key}"][value="${value}"]`).check();
    else{const input=page.locator('#short-'+q.id);assert.equal(await input.getAttribute('maxlength'),id.startsWith('THI')?'4':'256');await input.fill(q.canonicalAnswer);}
    expected+=q.points;
   }
   assert.equal(await page.locator('.math-content-warning').count(),0);
   for(const img of await page.locator('.exam-question-body img').all()){await img.evaluate(i=>i.decode());assert.ok(await img.evaluate(i=>i.complete&&i.naturalWidth>0));}
   if(index===0)await page.screenshot({path:`tmp/mathpath-new/player-${id}-${width}.png`});
   if(index<exam.questions.length-1)await page.getByRole('button',{name:'Câu tiếp',exact:true}).click();
  }
  await page.getByRole('button',{name:'Nộp bài',exact:true}).click();
  const submission=page.waitForResponse(r=>r.url().endsWith('/submit')&&r.request().method()==='POST');
  await page.getByRole('button',{name:'Xác nhận nộp bài',exact:true}).click();
  const result=await(await submission).json();assert.equal(result.attempt.result.score,expected);
  await page.getByRole('link',{name:'Đáp án và lời giải tham khảo',exact:true}).click();
  await page.locator('.result-hub-card').first().waitFor();
  const overviewUrl=page.url();
  assert.equal(await page.locator('.result-hub-card').count(),3);
  assert.equal(await page.locator('.result-study-chat, .result-question-item, .result-weakness-chart').count(),0);
  await page.screenshot({path:`tmp/mathpath-new/result-hub-${id}-${width}.png`,animations:'disabled'});
  await page.locator('.result-hub-card').filter({hasText:'Phân tích kết quả'}).click();
  await page.locator('.analytics-result-section-list').waitFor();
  assert.ok(page.url().endsWith('/analysis'));
  await page.getByRole('link',{name:'← Về tổng quan kết quả',exact:true}).click();
  await page.locator('.result-hub-card').filter({hasText:'Đáp án và lời giải tham khảo'}).click();
  await page.locator('.result-question-item').first().waitFor();assert.equal(await page.locator('.result-question-item').count(),exam.questions.length);
  await page.locator('.analytics-page-heading').scrollIntoViewIfNeeded();
  await page.screenshot({path:`tmp/mathpath-new/result-heading-${id}-${width}.png`,animations:'disabled'});
  await page.locator('.result-question-item').first().locator('summary').click();
  const calls=[];await page.route('**/api/attempts/*/ai-review',async route=>{const body=route.request().postDataJSON();calls.push(body);await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({answer:`LOCAL AI ${body.mode} ${body.level??''}: $2+3=5$.`,quota:{remaining:4}})});});
  const hint=page.locator('.result-ai-hint').first();
  for(const [i,label] of ['Định hướng','Gợi ý công thức','Hướng dẫn từng bước'].entries()){await hint.getByRole('button',{name:label,exact:true}).click();await hint.getByText(`LOCAL AI hint ${i+1}:`,{exact:false}).waitFor();}
  await page.locator('.result-detail-nav').getByRole('link',{name:'Ôn tập cùng AI',exact:true}).click();
  await page.locator('.result-study-chat').waitFor();
  assert.ok(page.url().endsWith('/study'));
  assert.equal(await page.locator('.result-question-item').count(),0);
  await page.reload();
  await page.locator('.result-study-chat').waitFor();
  await page.locator('.result-study-chat').scrollIntoViewIfNeeded();
  await page.screenshot({path:`tmp/mathpath-new/result-chat-${id}-${width}.png`,animations:'disabled'});
  const picker=page.locator('.result-study-question-picker');
  assert.equal(await picker.locator('input:checked').count(),1);
  await page.getByRole('button',{name:'Nhắc lại công thức',exact:true}).click();
  assert.ok((await page.locator('#result-study-chat-input').inputValue()).includes('công thức'));
  await page.locator('#result-study-chat-input').fill('Giải thích cách làm câu này');
  await page.locator('.result-study-chat-form').getByRole('button',{name:'Gửi',exact:true}).click();await page.getByText('LOCAL AI chat',{exact:false}).waitFor();
  assert.equal(calls.length,4);assert.equal(await page.locator('.math-content-warning').count(),0);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));assert.deepEqual(errors,[]);
  await page.screenshot({path:`tmp/mathpath-new/result-${id}-${width}.png`});
  await page.getByRole('link',{name:'← Về tổng quan kết quả',exact:true}).click();
  await page.locator('.result-hub-card').first().waitFor();
  assert.equal(page.url(),overviewUrl);
  const stranger=await browser.newContext();
  assert.equal((await stranger.request.get(overviewUrl+'/study')).status(),404);
  await stranger.close();
  reports.push({id,width,score:expected,reviewQuestions:exam.questions.length,mathErrors:0,pageErrors:errors,hints:[1,2,3],chat:'test-double rendered',answersHiddenBeforeSubmission:true});await context.close();
 }
 for(const width of [1440,390]){
  const page=await browser.newPage({viewport:{width,height:950}});
  await page.goto('http://127.0.0.1:3211/dev/mathpath-bank');
  assert.equal(await page.locator('.bank-preview-card').count(),19);
  await page.getByRole('button',{name:'Thi thử THPTQG',exact:true}).click();
  assert.equal(await page.locator('.bank-preview-card').count(),7);
  await page.getByRole('button',{name:'Ôn tập chuyên đề',exact:true}).click();
  assert.equal(await page.locator('.bank-preview-card').count(),12);
  await page.getByRole('button',{name:'Tất cả',exact:true}).click();
  await page.getByRole('searchbox').fill('THI_05');
  assert.equal(await page.locator('.bank-preview-card').count(),1);
  await page.getByRole('searchbox').fill('');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
  await page.screenshot({path:`tmp/mathpath-new/catalog-${width}.png`});
  await page.close();
 }
 }finally{await browser.close();}
 await fs.writeFile('tmp/mathpath-new/browser-e2e.json',JSON.stringify({reports,aiProvider:'HTTP test double; provider not called',attemptStorage:'local isolated lab'},null,2));console.log(JSON.stringify(reports,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
