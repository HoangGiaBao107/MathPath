import {writeFile,mkdir,copyFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import process from 'node:process';
import {Console} from 'node:console';
import {readBank,validateBank,runtimeExam,uuid,sha,bankRoot,outputRoot} from './mathpath-bank.mjs';
const quote=v=>v===null?'null':typeof v==='number'?String(v):"'"+String(v).replaceAll("'","''")+"'";
const json=v=>quote(JSON.stringify(v))+'::jsonb';
function insert(table,record){const keys=Object.keys(record);return `insert into ${table} (${keys.join(',')}) values (${Object.values(record).join(',')}) on conflict do nothing;`;}
export function buildBankSql(bank,examIds){
 const statements=['begin;'];
 const sourceId=uuid('source:mathpath-original-20261022');
 statements.push(insert('public.problem_source_documents',{id:quote(sourceId),document_name:quote('MathPath original questions.json — 20261022'),source_type:quote('generated'),provenance_status:quote('verified'),publication_rights_status:quote('approved_for_internal'),source_fingerprint:quote('mathpath-original-20261022'),provenance_note:quote('Original bank supplied by owner; question IDs are provenance locators. Automatic checks are separate from manual review.')}));
 for(const id of examIds){
  const e=bank.exams.find(e=>e.id===id),runtime=runtimeExam(bank,id),qs=bank.questions.filter(q=>q.exam_id===id),setId=uuid('set:'+id);
  const revision=sha(JSON.stringify({exam:e,questions:qs}));
  statements.push(`do $$ begin if exists(select 1 from public.problem_sets where id=${quote(setId)}::uuid and exam_metadata->>'import_sha256' is distinct from ${quote(revision)}) then raise exception 'Existing MathPath content differs; explicit reviewed migration required'; end if; end $$;`);
  // Refuse any existing slug owned by another dataset; never overwrite old attempts.
  statements.push(`do $$ begin if exists(select 1 from public.problem_sets where slug=${quote(id)} and id<>${quote(setId)}::uuid) then raise exception 'Exam slug collision'; end if; end $$;`);
  statements.push(insert('public.problem_sets',{id:quote(setId),slug:quote(id),title:quote(e.title),description:quote(runtime.description),language:quote('vi'),source_name:quote('MathPath original 20261022'),source_type:quote('generated'),category:quote(e.kind==='mock_thpt'?'mock_exam':'chapter_review'),timing_mode:quote(runtime.timingMode),time_limit_seconds:quote(runtime.durationSeconds),review_status:quote('needs_review'),publication_status:quote('unpublished'),rights_status:quote('approved_for_internal'),exam_metadata:json({dataset:'mathpath-original-20261022',sourceExamId:id,import_sha256:revision,automatic_qa_passed:true,human_reviewed:false}),scoring_config:json({examMode:runtime.mode,totalScore:10,sections:runtime.sections.map((s,i)=>({key:[...new Set(qs.map(q=>q.section))][i],maxScore:s.maxScore,description:s.description})),questionScoring:runtime.questions.map((q,orderIndex)=>({orderIndex,points:q.points,...(q.scoring?{scoring:q.scoring}:{})}))})}));
  statements.push(`update public.problem_sets set source_document_id=${quote(sourceId)} where id=${quote(setId)} and publication_status='unpublished';`);
  runtime.sections.forEach((s,i)=>statements.push(insert('public.problem_set_sections',{id:quote(s.id),problem_set_id:quote(setId),section_key:quote([...new Set(qs.map(q=>q.section))][i]),title:quote(s.title),order_index:i})));
  for(let i=0;i<qs.length;i++){
   const source=qs[i],q=runtime.questions[i];
   statements.push(insert('public.problems',{id:quote(q.id),problem_set_id:quote(setId),source_reference:quote(source.id),source_question_number:quote(source.id),order_index:i,question_number:quote(q.number),section_id:quote(q.sectionId),stem:quote(q.stem),display_stem_vi:quote(q.stem),question_type:quote(q.type),topic:quote(q.topic),subtopic:quote(q.subtopic),review_status:quote('needs_review'),content_review_status:quote('needs_review'),publication_status:quote('unpublished'),rights_status:quote('approved_for_internal'),provenance_status:quote('verified')}));
   for(const [n,o] of (q.options??[]).entries())statements.push(insert('public.problem_options',{id:quote(uuid(source.id+':option:'+o.key)),problem_id:quote(q.id),option_key:quote(o.key),option_text:quote(o.text),display_text_vi:quote(o.text),order_index:n}));
   for(const [n,s] of (q.statements??[]).entries())statements.push(insert('public.problem_substatements',{id:quote(uuid(source.id+':statement:'+s.key)),problem_id:quote(q.id),statement_key:quote(s.key),statement_text:quote(s.text),display_text_vi:quote(s.text),order_index:n}));
   const answer=q.type==='multiple_choice'?{option_key:q.correctOptionKey}:q.type==='true_false'?{statements:q.correctStatements,scoring:q.scoring}:{canonical_answer:q.canonicalAnswer,accepted_values:q.acceptedNormalizedAnswers,input_policy:q.inputPolicy};
   statements.push(insert('private.problem_answer_keys',{problem_id:quote(q.id),correct_answer:json(answer),verification_status:quote('verified'),provenance_note:quote('Authored KEY; automatic checks passed. Not individual human review.')}));
   statements.push(`update public.problems set source_document_id=${quote(sourceId)} where id=${quote(q.id)} and publication_status='unpublished';`);
   statements.push(insert('private.problem_explanations',{problem_id:quote(q.id),explanation:quote(source.solution),display_explanation_vi:quote(source.solution),review_status:quote('needs_review'),rights_status:quote('approved_for_internal')}));
   for(const [n,f] of q.figures.entries())statements.push(insert('public.problem_assets',{id:quote(uuid(source.id+':figure:'+n)),problem_id:quote(q.id),asset_path:quote(f.url),alt_text_vi:quote(f.alt),order_index:n,review_status:quote('needs_review')}));
  }
 }
 statements.push('commit;');return statements.join('\n');
}
export async function prepareBank(){
 const bank=await readBank(),report=await validateBank(bank);if(report.errors.length)throw Error('New bank failed QA; no SQL generated');
 await mkdir(outputRoot,{recursive:true});
 await writeFile(path.join(outputRoot,'import-one.sql'),buildBankSql(bank,['THI_01']));
 await writeFile(path.join(outputRoot,'import-all.sql'),buildBankSql(bank,bank.exams.map(e=>e.id)));
 await writeFile(path.join(outputRoot,'runtime-exams.json'),JSON.stringify(bank.exams.map(e=>runtimeExam(bank,e.id)),null,2));
 const assets='public/problem-assets/mathpath-20261022';await mkdir(assets,{recursive:true});
 for(const q of bank.questions)for(const f of q.figures)await copyFile(path.join(bankRoot,f.file),path.join(assets,path.basename(f.file)));
 return bank;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){const b=await prepareBank();new Console(process.stdout,process.stderr).log(`Prepared unpublished SQL for ${b.exams.length} exams / ${b.questions.length} questions; no remote database writes`);}
