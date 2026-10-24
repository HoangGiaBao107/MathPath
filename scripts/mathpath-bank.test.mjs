import {describe,it,expect} from 'vitest';
import {readFile,writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {Blob} from 'node:buffer';
import {PGlite} from '@electric-sql/pglite';
import {readBank,runtimeExam,validateBank} from './mathpath-bank.mjs';
import {scoreExam} from '../src/lib/exams/scoring';
import {toSafeQuestion} from '../src/lib/exams/demo-data.mock';
const bank=await readBank();
const correct=q=>q.type==='multiple_choice'?{type:q.type,optionKey:q.correctOptionKey}:q.type==='true_false'?{type:q.type,statements:q.correctStatements}:{type:q.type,raw:q.canonicalAnswer};
describe('MathPath new bank integration',()=>{
 it('passes complete content QA',async()=>{expect((await validateBank(bank)).errors).toEqual([]);});
 it('grades every answer, empty exams, all official TF combinations and strips private keys',()=>{
  for(const e of bank.exams){const exam=runtimeExam(bank,e.id);
   expect(scoreExam(exam,Object.fromEntries(exam.questions.map(q=>[q.id,correct(q)]))).score).toBe(10);
   expect(scoreExam(exam,{}).score).toBe(0);
   for(const q of exam.questions){const safe=toSafeQuestion(q);expect(safe).not.toHaveProperty('canonicalAnswer');expect(safe).not.toHaveProperty('correctStatements');expect(safe).not.toHaveProperty('correctOptionKey');
    if(q.type==='true_false')for(let count=0;count<=4;count++){
     const answers=Object.fromEntries(Object.entries(q.correctStatements).map(([key,value],i)=>[key,i<count?value:!value]));
     const result=scoreExam({...exam,questions:[q]},{[q.id]:{type:'true_false',statements:answers}});
     expect(result.score).toBe([0,.1,.25,.5,1][count]);
    }
   }
  }
 });
 it('runs all 19 exams through actual PostgreSQL attempt/result functions',async()=>{
  const db=new PGlite({loadDataDir:new Blob([await readFile('tmp/mathpath-new/local-postgres.tar.gz')])});
  const results=[];
  try{
   await db.exec(await readFile('supabase/migrations/20261022000100_exam_runtime_figures.sql','utf8'));
   await db.exec(await readFile('supabase/migrations/20261023000100_preserve_archived_exam_attempts.sql','utf8'));
   // Publication is isolated in the disposable local database, never remote.
   await db.exec(`update public.problem_source_documents set publication_rights_status='approved_for_publication';
    update public.problem_assets set review_status='approved';
    update private.problem_explanations set review_status='approved',rights_status='approved_for_publication';
    update public.problems set review_status='approved',content_review_status='approved',rights_status='approved_for_publication',publication_status='published';
    update public.problem_sets set review_status='approved',rights_status='approved_for_publication',publication_status='published';`);
   const user=randomUUID();await db.query('insert into auth.users(id,email) values($1,$2)',[user,'local-test@example.invalid']);
   for(const e of bank.exams){
    const exam=(await db.query('select public.get_exam_runtime($1) as result',[e.id])).rows[0].result;
    expect(exam.questions.length).toBe(e.expected_questions);
    expect(exam.questions.flatMap(q=>q.figures??[]).length).toBe(bank.questions.filter(q=>q.exam_id===e.id).flatMap(q=>q.figures).length);
    const request=randomUUID(),attempt=(await db.query('select public.start_exam_attempt($1,null,$2,$3) as id',[user,e.id,request])).rows[0].id;
    expect((await db.query('select public.start_exam_attempt($1,null,$2,$3) as id',[user,e.id,request])).rows[0].id).toBe(attempt);
    for(const q of exam.questions)await db.query('select public.save_exam_attempt_state($1,$2,null,$3,$4::jsonb,false)',[attempt,user,q.id,JSON.stringify(correct(q))]);
    const score=scoreExam(exam,Object.fromEntries(exam.questions.map(q=>[q.id,correct(q)])));
    expect(score.score).toBe(10);
    const submission=randomUUID();
    await db.query("select public.claim_exam_attempt_submission($1,$2,null,$3,'manual')",[attempt,user,submission]);
    await db.query("select public.submit_exam_attempt($1,$2,null,$3,'manual',$4::jsonb)",[attempt,user,submission,JSON.stringify(score)]);
    const result=(await db.query('select public.get_student_attempt_result($1,$2) as result',[user,attempt])).rows[0].result;
    expect(result.result.score).toBe(10);expect(result.result.questionOutcomes.length).toBe(e.expected_questions);
    expect(result.result.questionOutcomes.every(q=>q.review.correctAnswer&&q.review.explanation)).toBe(true);
    results.push({exam:e.id,questions:e.expected_questions,score:10,submitted:true,solutions_available:true});
   }
   await db.exec("update public.problem_sets set publication_status='archived';");
   await db.exec("update public.problems set publication_status='archived';");
   expect((await db.query('select count(*)::int as n from public.attempts')).rows[0].n).toBe(19);
   const attempts=(await db.query('select id from public.attempts')).rows;
   for(const {id} of attempts){
    const owned=(await db.query('select public.get_exam_attempt($1,$2,null) as result',[id,user])).rows[0].result;
    expect(owned.exam.questions.length).toBeGreaterThan(0);
    expect((await db.query('select public.get_exam_attempt($1,$2,null) as result',[id,randomUUID()])).rows[0].result).toBeNull();
    expect((await db.query('select public.get_exam_runtime($1) as result',[owned.exam.id])).rows[0].result).toBeNull();
    const historical=(await db.query('select public.get_student_attempt_result($1,$2) as result',[user,id])).rows[0].result;
    expect(historical.result.score).toBe(10);
    expect(historical.result.questionOutcomes.every(q=>q.review?.explanation)).toBe(true);
   }
   await writeFile('tmp/mathpath-new/local-flow.json',JSON.stringify({results,history_preserved_after_archive:true},null,2));
  }finally{await db.close();}
 },90000);
});
