import {readFile,writeFile} from 'node:fs/promises';
import {readBank,validateBank,uuid,sha,outputRoot} from './mathpath-bank.mjs';
import path from 'node:path';
const bank=await readBank(),qa=await validateBank(bank);
if(qa.errors.length)throw Error('Bank QA failed');
const backup=JSON.parse(await readFile('tmp/mathpath-backups/production-20261023/manifest.json','utf8'));
if(!backup.archive_inspected||!backup.restore_tested)throw Error('No inspected and restore-tested backup');
const ids=bank.exams.map(e=>`'${uuid('set:'+e.id)}'::uuid`).join(',');
const selected=`problem_set_id in (${ids})`;
const revisionChecks=bank.exams.map(e=>{
 const digest=sha(JSON.stringify({exam:e,questions:bank.questions.filter(q=>q.exam_id===e.id)}));
 return `if not exists(select 1 from public.problem_sets where id='${uuid('set:'+e.id)}' and exam_metadata->>'import_sha256'='${digest}') then raise exception 'Missing or stale exam ${e.id}'; end if;`;
}).join('\n');
const activate=`begin;
set local lock_timeout='10s';
lock table public.problem_sets, public.problems in share row exclusive mode;
do $$ begin
${revisionChecks}
if (select count(*) from public.problems where ${selected})<>634 then raise exception 'Expected 634 new questions'; end if;
if (select count(*) from private.problem_answer_keys k join public.problems p on p.id=k.problem_id where p.${selected} and k.verification_status='verified')<>634 then raise exception 'Incomplete keys'; end if;
if (select count(*) from private.problem_explanations x join public.problems p on p.id=x.problem_id where p.${selected} and length(x.explanation)>0)<>634 then raise exception 'Incomplete solutions'; end if;
if (select count(*) from public.problem_assets a join public.problems p on p.id=a.problem_id where p.${selected})<>57 then raise exception 'Incomplete figures'; end if;
end $$;
create table if not exists private.mathpath_bank_release_snapshot(
 release_id text not null, kind text not null, id uuid not null, publication_status text not null,
 primary key(release_id,kind,id));
revoke all on private.mathpath_bank_release_snapshot from public,anon,authenticated;
insert into private.mathpath_bank_release_snapshot select 'mathpath-original-20261022','set',id,publication_status::text from public.problem_sets where id not in (${ids}) and publication_status='published' on conflict do nothing;
insert into private.mathpath_bank_release_snapshot select 'mathpath-original-20261022','question',id,publication_status::text from public.problems where (problem_set_id is null or problem_set_id not in (${ids})) and publication_status='published' on conflict do nothing;
update public.problem_source_documents set publication_rights_status='approved_for_publication' where id='${uuid('source:mathpath-original-20261022')}';
update public.problem_assets set review_status='approved' where problem_id in(select id from public.problems where ${selected});
update private.problem_explanations set review_status='approved',rights_status='approved_for_publication' where problem_id in(select id from public.problems where ${selected});
update public.problems set review_status='approved',content_review_status='approved',rights_status='approved_for_publication',publication_status='published' where ${selected};
update public.problem_sets set review_status='approved',rights_status='approved_for_publication',publication_status='published' where id in (${ids});
update public.problem_sets set publication_status='archived' where id in(select id from private.mathpath_bank_release_snapshot where release_id='mathpath-original-20261022' and kind='set');
update public.problems set publication_status='archived' where id in(select id from private.mathpath_bank_release_snapshot where release_id='mathpath-original-20261022' and kind='question');
do $$ begin if (select count(*) from public.problem_sets where publication_status='published')<>19 then raise exception 'Expected exactly 19 active sets'; end if; end $$;
commit;
`;
const rollback=`begin;
set local lock_timeout='10s';
lock table public.problem_sets, public.problems in share row exclusive mode;
update public.problem_sets set publication_status='unpublished' where id in (${ids});
update public.problems set publication_status='unpublished' where ${selected};
update public.problems p set publication_status=s.publication_status::public.problem_publication_status from private.mathpath_bank_release_snapshot s where s.release_id='mathpath-original-20261022' and s.kind='question' and p.id=s.id;
update public.problem_sets p set publication_status=s.publication_status::public.problem_publication_status from private.mathpath_bank_release_snapshot s where s.release_id='mathpath-original-20261022' and s.kind='set' and p.id=s.id;
commit;
`;
await writeFile(path.join(outputRoot,'activate.sql'),activate);
await writeFile(path.join(outputRoot,'rollback.sql'),rollback);
// Preparation only: these files are never automatically applied remotely.
