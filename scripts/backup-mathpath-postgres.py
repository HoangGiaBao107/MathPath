"""Read-only production backup using portable PostgreSQL tools.

Requires a private `supabase db dump --linked --dry-run` plan. Never executes
that shell script or prints its connection variables. Backups stay gitignored.
Archive inspection is not represented as a successful restore test.
"""
import argparse,hashlib,json,os,pathlib,re,shlex,subprocess
parser=argparse.ArgumentParser()
parser.add_argument('--backup-name',default='production-20261023')
args=parser.parse_args()
if not re.fullmatch(r'production-\d{8}(?:-\d{6})?',args.backup_name):
    raise ValueError('Backup name must contain only production date and optional time')
root=pathlib.Path('tmp/mathpath-backups').resolve()
plan=(root/'dump-plan.private.txt').read_text('utf-8-sig')
env=os.environ.copy()
required={'PGHOST','PGPORT','PGUSER','PGPASSWORD','PGDATABASE'}
found=set()
for line in plan.splitlines():
    if re.match(r'(export )?PG[A-Z_]+=',line):
        parts=shlex.split(line.removeprefix('export '))
        if len(parts)!=1:raise RuntimeError('Unexpected connection-plan syntax')
        key,value=parts[0].split('=',1)
        if key in required:env[key]=value;found.add(key)
if found!=required or not env['PGPASSWORD'] or '*' in env['PGPASSWORD']:
    raise RuntimeError('Private connection plan has no usable credentials')
env.update(PGCONNECT_TIMEOUT='20',PGSSLMODE='require')
tools=root/'tools/pgsql/bin'
folder=root/args.backup_name;folder.mkdir(exist_ok=True)
archive=folder/'database.dump'
if archive.exists():raise RuntimeError('Refusing to overwrite an existing backup')
def run(binary,args,log):
    result=subprocess.run([str(tools/binary),*args],env=env,capture_output=True,timeout=600)
    (folder/log).write_bytes(result.stderr)
    if result.returncode:
        # Logs can contain private object names. Keep them on disk only.
        raise RuntimeError(f'{binary} failed; see private {log}')
    return result.stdout
partial=folder/'database.partial'
run('pg_dump.exe',['--role=postgres','--format=custom','--lock-wait-timeout=10000',f'--file={partial}'],'dump.stderr.log')
toc=run('pg_restore.exe',['--list',str(partial)],'inspect.stderr.log')
(folder/'archive-list.private.txt').write_bytes(toc)
for table in [b'public problems ',b'public problem_sets ',b'public attempts ',b'auth users ',b'private problem_answer_keys ']:
    if table not in toc:raise RuntimeError('Expected table missing in archive')
partial.rename(archive)
roles=run('pg_dumpall.exe',['--role=postgres','--roles-only','--no-role-passwords'],'roles.stderr.log')
(folder/'roles.sql').write_bytes(roles)
manifest={'archive_bytes':archive.stat().st_size,'archive_sha256':hashlib.sha256(archive.read_bytes()).hexdigest(),
  'roles_sha256':hashlib.sha256(roles).hexdigest(),'archive_inspected':True,'restore_tested':False,
  'storage_blobs_included':False,'production_content_modified':False}
(folder/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf8')
print(json.dumps(manifest))
