import {PGlite} from '@electric-sql/pglite';
import {Buffer} from 'node:buffer';
import {readFile,readdir,writeFile} from 'node:fs/promises';
import {Console} from 'node:console';
import process from 'node:process';
import {prepareBank,buildBankSql} from './import-mathpath-bank.mjs';
const console=new Console(process.stdout,process.stderr);
const bank=await prepareBank();
const db=new PGlite();
try{
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
 create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql as $$select null::uuid$$;
 create function auth.role() returns text language sql as $$select 'service_role'::text$$;
 create function auth.jwt() returns jsonb language sql as $$select '{"role":"service_role"}'::jsonb$$;`);
 const all=(await readdir('supabase/migrations')).sort();
 const migrations=all.filter(f=>f.startsWith('20261003')||f.startsWith('20261004')||['20261008000300_enable_published_exam_runtime.sql','20261020000100_attempt_result_review_assets_and_duration.sql','20261021000100_short_answer_input_policy.sql'].includes(f));
 for(const file of migrations){let sql=await readFile('supabase/migrations/'+file,'utf8');sql=sql.replace('create extension if not exists pgcrypto;','-- pgcrypto extension not needed for this isolated content test; gen_random_uuid is PostgreSQL core.');try{await db.exec(sql);}catch(error){throw Error(`Migration ${file}: ${error.message}`);}}
 await db.exec(buildBankSql(bank,['THI_01']));
 const one=(await db.query('select count(*)::int as n from public.problems')).rows[0].n;
 if(one!==22)throw Error('First exam import count failed');
 await db.exec(buildBankSql(bank,bank.exams.map(e=>e.id)));
 await db.exec(buildBankSql(bank,bank.exams.map(e=>e.id)));
 const changed=JSON.parse(JSON.stringify(bank));changed.questions[0].stem+=' changed';
 let overwriteDenied=false;
 try{await db.exec(buildBankSql(changed,['THI_01']));}
 catch(error){overwriteDenied=error.message.includes('Existing MathPath content differs');await db.exec('rollback;');}
 if(!overwriteDenied)throw Error('Changed content must not silently reuse existing rows');
 const counts=(await db.query(`select (select count(*)::int from public.problem_sets) as exams,(select count(*)::int from public.problems) as questions,(select count(*)::int from private.problem_answer_keys) as answers,(select count(*)::int from private.problem_explanations) as solutions,(select count(*)::int from public.problem_assets) as figures`)).rows[0];
 if(counts.exams!==19||counts.questions!==634||counts.answers!==634||counts.solutions!==634||counts.figures!==57)throw Error('Full bank import count failed');
 await db.exec('set role anon;');
 let privateDenied=false;try{await db.query('select * from private.problem_answer_keys limit 1');}catch{privateDenied=true;}
 const visible=(await db.query('select count(*)::int as n from public.problems')).rows[0].n;
 await db.exec('reset role;');
 if(!privateDenied||visible!==0)throw Error('Unpublished/private content exposed');
 const dump=await db.dumpDataDir();await writeFile('tmp/mathpath-new/local-postgres.tar.gz',Buffer.from(await dump.arrayBuffer()));
 const report={engine:'PGlite PostgreSQL, isolated local DB; Supabase auth functions stubbed only in this DB',migrations,first_exam_questions:one,...counts,idempotent_import:true,changed_content_rejected:overwriteDenied,anonymous_answer_access_denied:privateDenied,anonymous_unpublished_questions:visible,production_touched:false};
 await writeFile('tmp/mathpath-new/local-db.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await db.close();}
