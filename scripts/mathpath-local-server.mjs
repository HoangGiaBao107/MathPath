import {spawn} from 'node:child_process';
import process from 'node:process';
// Empty values deliberately override .env.local; no remote credentials enter
// the acceptance-test server. Production still uses its normal environment.
const env={...process.env,MATHPATH_EXAM_LAB:'1',MATHPATH_ATTEMPT_STORE:'mock',
  NEXT_PUBLIC_APP_URL:'http://127.0.0.1:3211',NEXT_PUBLIC_SUPABASE_URL:'',
  NEXT_PUBLIC_SUPABASE_ANON_KEY:'',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'',
  SUPABASE_SERVICE_ROLE_KEY:''};
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--hostname','127.0.0.1','--port','3211'],{env,stdio:'inherit',windowsHide:true});
child.on('exit',code=>{process.exitCode=code??1;});
