"""Apply release and rollback ONLY to the restored loopback database."""
import json,pathlib,subprocess
root=pathlib.Path('tmp/mathpath-backups').resolve()
out=pathlib.Path('tmp/mathpath-new').resolve()
psql=root/'tools/pgsql/bin/psql.exe'
base=[str(psql),'-X','-h','127.0.0.1','-p','54329','-U','local_backup_admin','-d','mathpath_restore','-v','ON_ERROR_STOP=1','-q','-t','-A']
context="set request.jwt.claim.role='service_role'; set request.jwt.claims='{\"role\":\"service_role\"}';\n"
def sql(text,label):
    file=root/'production-20261023'/f'{label}.local.sql';file.write_text(context+text,encoding='utf8')
    result=subprocess.run([*base,'-f',str(file)],capture_output=True,timeout=180)
    (file.with_suffix('.stderr.log')).write_bytes(result.stderr)
    if result.returncode:raise RuntimeError(f'Local {label} failed; inspect private log')
    return result.stdout.decode('utf8').strip()
tables=['auth.users','public.profiles','public.attempts','public.attempt_answers','private.exam_attempt_results']
def fingerprint():
    result={}
    for i,table in enumerate(tables):
        result[table]=json.loads(sql(f"select json_build_object('count',count(*),'hash',md5(coalesce(string_agg(payload,E'\\n' order by payload),''))) from (select row_to_json(t)::text payload from {table} t) rows;",f'hash-{i}'))
    return result
def active():
    return json.loads(sql("select json_build_object('sets',(select count(*) from public.problem_sets where publication_status='published'),'questions',(select count(*) from public.problems where publication_status='published'));",'active'))
def accessible():
    return int(sql("select count(*) from public.attempts a where (a.user_id is not null or a.guest_session_hash is not null) and jsonb_array_length(coalesce(public.get_exam_attempt(a.id,a.user_id,a.guest_session_hash)->'exam'->'questions','[]'::jsonb))>0;",'owned-attempt-access'))
before=fingerprint();old_active=active()
checkpoint=root/'production-20261023/rehearsed-migrations.json'
applied=json.loads(checkpoint.read_text()) if checkpoint.exists() else []
for version in ['20261020000100','20261021000100','20261022000100','20261023000100']:
    if version in applied:continue
    file=next(pathlib.Path('supabase/migrations').glob(version+'*.sql'))
    sql(file.read_text('utf8'),'migration-'+version)
    applied.append(version);checkpoint.write_text(json.dumps(applied))
readable_before=accessible()
sql((out/'import-one.sql').read_text('utf8'),'import-one')
sql((out/'import-all.sql').read_text('utf8'),'import-all')
sql((out/'activate.sql').read_text('utf8'),'activate')
new_active=active()
assert new_active=={'sets':19,'questions':634},new_active
assert fingerprint()==before,'Student records changed during activation'
assert accessible()==readable_before,'Old attempts became inaccessible'
sql((out/'rollback.sql').read_text('utf8'),'rollback')
assert active()==old_active,'Rollback did not restore active bank'
assert fingerprint()==before,'Student records changed during rollback'
report={'environment':'restored production backup on 127.0.0.1:54329/mathpath_restore',
 'production_modified':False,'backup_restore':'all except managed Vault; role grantors adapted locally',
 'old_active':old_active,'activated':new_active,'rolled_back':active(),
 'student_tables_unchanged':True,'old_attempts_readable':readable_before,
 'migration_compatibility_passed':True,'activation_passed':True,'rollback_passed':True}
(out/'release-rehearsal.json').write_text(json.dumps(report,indent=2),encoding='utf8')
print(json.dumps(report))
