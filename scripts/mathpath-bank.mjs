import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import katex from 'katex';
import {canParseExactExpression,compareExactExpressions} from '../src/lib/exams/exact-expression.ts';

export const bankRoot=path.resolve('content/extracted/mathpath-new-20261022');
export const outputRoot=path.resolve('tmp/mathpath-new');
export const sha=value=>createHash('sha256').update(value).digest('hex');
export function uuid(value){const h=sha('mathpath-original-20261022:'+value);return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;}
export async function readBank(){return JSON.parse(await readFile(path.join(bankRoot,'questions.json'),'utf8'));}
export function runtimeExam(bank,id){
 const e=bank.exams.find(e=>e.id===id);if(!e)throw Error('Unknown exam');
 const official=e.kind==='mock_thpt',qs=bank.questions.filter(q=>q.exam_id===id);
 const sectionIds=[...new Set(qs.map(q=>q.section))];
 const points=q=>official?(q.type==='true_false'?1:q.type==='short_answer'?.5:.25):.25;
 return {id:e.id,title:e.title,description:'Bộ câu hỏi MathPath biên soạn mới.',mode:official?'official_thptqg':'practice',demo:false,timingMode:official?'countdown':'elapsed',durationSeconds:official?5400:null,totalScore:10,
 sections:sectionIds.map(key=>({id:uuid(id+':'+key),title:key==='PI'?'Phần I':key==='PII'?'Phần II':key==='PIII'?'Phần III':key,description:'',maxScore:qs.filter(q=>q.section===key).reduce((sum,q)=>sum+points(q),0)})),
 questions:qs.map(q=>({id:uuid(q.id),sectionId:uuid(id+':'+q.section),number:String(q.number),sourceQuestionId:q.id,stem:q.stem,topic:q.topic,subtopic:q.subtopic,points:points(q),figures:q.figures.map(f=>({url:'/problem-assets/mathpath-20261022/'+path.basename(f.file),alt:f.alt})),
 ...(q.type==='single_choice'?{type:'multiple_choice',options:q.options.map(o=>({key:o.id,text:o.text})),correctOptionKey:q.answer.correct}:q.type==='true_false'?{type:'true_false',statements:q.statements.map(s=>({key:s.id,text:s.text})),correctStatements:Object.fromEntries(q.statements.map((s,i)=>[s.id,q.answer.correct[i]])),scoring:{kind:'partial',pointsByCorrectCount:[0,.1,.25,.5,1]}}:{type:'short_answer',canonicalAnswer:q.answer.exact,acceptedNormalizedAnswers:[q.answer.exact],inputPolicy:official?{kind:'thptqg_numeric'}:{kind:'expression',maxLength:256}})
 }))};
}
export async function validateBank(bank){
 const datasetHash=sha(await readFile(path.join(bankRoot,'questions.json')));
 let symbolic;try{symbolic=JSON.parse(await readFile(path.join(outputRoot,'symbolic.json'),'utf8'));}catch{symbolic=null;}
 const errors=[],warnings=[],add=(id,code,detail)=>errors.push({id,code,detail});
 if(bank.exams.length!==19||bank.questions.length!==634)add('BANK','COUNT','Expected 19/634');
 const ids=new Set(),stems=new Map();let mathBlocks=0,figures=0;
 for(const q of bank.questions){
  if(ids.has(q.id))add(q.id,'DUPLICATE_ID','ID repeated');ids.add(q.id);
  const stem=q.stem.normalize('NFC').replace(/\s+/g,' ').trim();
  if(stems.has(stem))add(q.id,'DUPLICATE_STEM',stems.get(stem));stems.set(stem,q.id);
  if(q.origin.type!=='independently_authored_mathpath'||q.origin.pdf_original_question_reproduced)add(q.id,'ORIGIN','Unexpected source');
  for(const [field,text] of [['stem',q.stem],['solution',q.solution],...(q.options??[]).map(o=>['option_'+o.id,o.text]),...(q.statements??[]).map(s=>['statement_'+s.id,s.text])]){
   if(typeof text!=='string'||!text.trim()){add(q.id,'EMPTY',field);continue;}
   if((text.match(/\$/g)??[]).length%2)add(q.id,'MATH_DELIMITERS',field);
   for(const match of text.matchAll(/\$([^$]+)\$/gs)){mathBlocks++;try{katex.renderToString(match[1],{throwOnError:true,strict:'error',trust:false});}catch(error){add(q.id,'LATEX',field+': '+error.message);}}
  }
  if(q.type==='single_choice'){
   if(q.options.map(o=>o.id).join('')!=='ABCD')add(q.id,'OPTIONS','Expected ordered A–D');
   const equivalent=q.options.filter(o=>compareExactExpressions(o.canonical,q.answer.exact)==='equivalent');
   const symbolicPassed=symbolic?.dataset_sha256===datasetHash&&symbolic.errors.length===0&&symbolic.mc_equivalence_passed.includes(q.id);
   if((equivalent.length!==1||equivalent[0].id!==q.answer.correct)&&!symbolicPassed)add(q.id,'ANSWER_CHOICE','Expected exactly one equivalent correct option');
   for(let a=0;a<q.options.length;a++)for(let b=a+1;b<q.options.length;b++)if(compareExactExpressions(q.options[a].canonical,q.options[b].canonical)==='equivalent')add(q.id,'DUPLICATE_OPTION','Equivalent distractors');
  }else if(q.type==='true_false'){
   if(q.statements.map(s=>s.id).join('')!=='abcd'||q.answer.correct.length!==4||q.answer.correct.some(v=>typeof v!=='boolean'))add(q.id,'TF_STRUCTURE','Expected four boolean statements');
  }else if(q.type==='short_answer'){
   if(!canParseExactExpression(q.answer.exact))add(q.id,'UNSUPPORTED_ANSWER',q.answer.exact);
   if(q.exam_id.startsWith('THI_')&&(!/^-?\d+(?:[.,]\d+)?$/.test(q.answer.exact)||q.answer.exact.length>4))add(q.id,'OFFICIAL_INPUT',q.answer.exact);
  }else add(q.id,'TYPE',q.type);
  for(const f of q.figures){figures++;const file=path.resolve(bankRoot,f.file);if(!file.startsWith(bankRoot+path.sep)||!path.basename(file).startsWith(q.id+'_')){add(q.id,'FIGURE_MAPPING',f.file);continue;}try{const bytes=await readFile(file);if(bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')add(q.id,'PNG',f.file);}catch{add(q.id,'FIGURE_MISSING',f.file);}}
 }
 for(const e of bank.exams){const exam=runtimeExam(bank,e.id),qs=bank.questions.filter(q=>q.exam_id===e.id);if(qs.length!==e.expected_questions)add(e.id,'EXAM_COUNT','Count mismatch');if(exam.questions.reduce((sum,q)=>sum+q.points,0)!==10)add(e.id,'SCORE','Total must be 10');
  const types=Object.fromEntries(['single_choice','true_false','short_answer'].map(t=>[t,qs.filter(q=>q.type===t).length]));
  if(e.kind==='mock_thpt'&&(types.single_choice!==12||types.true_false!==4||types.short_answer!==6))add(e.id,'OFFICIAL_STRUCTURE','Expected 12/4/6');
  const groups=Object.groupBy(qs,q=>q.subtopic);for(const [topic,items] of Object.entries(groups))if(items.length>5)warnings.push({id:e.id,code:'TEMPLATE_CONCENTRATION',detail:`${topic}: ${items.length}/${qs.length}`});
 }
 const report={dataset:'mathpath-original-20261022',dataset_sha256:sha(await readFile(path.join(bankRoot,'questions.json'))),exams:bank.exams.length,questions:bank.questions.length,figures,mathBlocks,errors,warnings,automatic_qa_passed:errors.length===0,human_reviewed:false};
 await mkdir(outputRoot,{recursive:true});await writeFile(path.join(outputRoot,'validation.json'),JSON.stringify(report,null,2));return report;
}
