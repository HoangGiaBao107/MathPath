/* Local-only browser acceptance check. Start dev with MATHPATH_EXAM_LAB=1,
 * MATHPATH_ATTEMPT_STORE=mock. AI HTTP responses are explicit test doubles. */
/* eslint-disable @typescript-eslint/no-require-imports */
/* global document, window, require */
const process = require("node:process");
const { Console } = require("node:console");
const console = new Console(process.stdout, process.stderr);
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const base = process.env.EXAM_LAB_URL || "http://127.0.0.1:3211";
(async () => {
  const browser = await chromium.launch({headless:true,channel:"chrome"});
  const reports=[];
  try {
    for(const viewport of [{width:1440,height:1000},{width:390,height:844}]) {
      const context=await browser.newContext({viewport});
      const page=await context.newPage();
      const errors=[];page.on("pageerror",e=>errors.push(e.message));
      page.on("response",async r=>{if(r.url().includes("/api/attempts")&&!r.ok()) console.error("ATTEMPT API",r.status(),await r.text().catch(()=>"closed"));});
      await page.goto(base+"/dev/exam-lab");
      await page.getByRole("button",{name:/Bắt đầu/}).click();
      await page.locator('input[name="answer-lab-mc"][value="A"]').check();
      await page.getByRole("button",{name:"Câu tiếp",exact:true}).click();
      for(const key of ["a","b","c","d"]) await page.locator(`input[name="tf-lab-tf-${key}"][value="true"]`).check();
      await page.getByRole("button",{name:"Câu tiếp",exact:true}).click();
      const input=page.locator("#short-lab-expression");
      assert.equal(await input.getAttribute("maxlength"),"128");
      await input.fill("sqrt(20)/2");
      await page.getByRole("button",{name:"Câu tiếp",exact:true}).click();
      await page.getByRole("button",{name:"Nộp bài",exact:true}).click();
      const submission=page.waitForResponse(r=>r.url().endsWith("/submit")&&r.request().method()==="POST").catch(async error=>{await page.screenshot({path:"tmp/exam-lab-failure.png",fullPage:true});console.error(await page.locator("body").innerText());throw error;});
      await page.getByRole("button",{name:"Xác nhận nộp bài",exact:true}).click();
      const submitted=await (await submission).json();
      assert.equal(submitted.attempt.result.score,1.5);
      assert.equal(submitted.attempt.result.partialCount,1);
      assert.equal(submitted.attempt.result.unansweredCount,1);
      await page.getByRole("link",{name:"Đáp án và lời giải tham khảo",exact:true}).click();
      await page.locator(".result-question-item").first().waitFor();
      assert.equal(await page.locator(".result-question-item").count(),4);
      for(const details of await page.locator(".result-question-item").all()) await details.locator("summary").click();
      assert.ok((await page.locator(".katex").count())>5);
      assert.equal(await page.locator(".result-review-statement--incorrect").count(),1);
      assert.ok(await page.locator(".result-question-figure img").evaluate(img=>img.complete&&img.naturalWidth>0));
      const calls=[];
      await page.route("**/api/attempts/*/ai-review",async route=>{
        const body=route.request().postDataJSON();calls.push(body);
        await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({answer:body.mode==="hint"?`Gợi ý thử nghiệm mức ${body.level}: $\\sqrt{20}=2\\sqrt{5}$.`:"Phản hồi chat thử nghiệm: hãy thay x vào hàm số.",quota:{remaining:4}})});
      });
      const hint=page.locator(".result-ai-hint").nth(2);
      for(const [index,label] of ["Định hướng","Gợi ý công thức","Hướng dẫn từng bước"].entries()) {
        await hint.getByRole("button",{name:label,exact:true}).click();
        await hint.getByText(`Gợi ý thử nghiệm mức ${index+1}:`,{exact:false}).waitFor();
      }
      await page.locator("#result-study-chat-input").fill("Giải thích câu sai và cho một bài tương tự");
      await page.locator(".result-study-chat-form").getByRole("button",{name:"Gửi",exact:true}).click();
      await page.getByText("Phản hồi chat thử nghiệm:",{exact:false}).waitFor();
      assert.deepEqual(calls.slice(0,3).map(c=>c.level),[1,2,3]);
      assert.equal(calls[3].mode,"chat");
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true,"horizontal overflow");
      assert.deepEqual(errors,[]);
      const screenshot=`tmp/exam-lab-${viewport.width}.png`;
      await page.screenshot({path:screenshot,fullPage:true});
      reports.push({viewport,score:1.5,resultQuestions:4,hintLevels:[1,2,3],chat:"test-double response rendered",horizontalOverflow:false,pageErrors:errors,screenshot});
      await context.close();
    }
    await fs.writeFile("tmp/exam-lab-e2e.json",JSON.stringify({aiProvider:"mocked HTTP at browser boundary; real route/credit covered separately by Vitest",reports},null,2));
    console.log(JSON.stringify(reports,null,2));
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
