import "server-only";
import { mkdir, open, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { DevelopmentAttemptRepository, MockAttemptRepository } from "./attempt-repository.mock";
import { isExamLabEnabled } from "./lab-exam.fixture";
import type { AttemptRepository } from "./attempt-repository";

/** Acceptance-test adapter only. File locking bridges Next dev route workers.
 * Production always uses Supabase; this adapter cannot run in production. */
async function withStore<T>(action:(repo:DevelopmentAttemptRepository)=>Promise<T>):Promise<T> {
  if (!isExamLabEnabled()) throw new Error("exam_lab_disabled");
  const dir=path.join(process.cwd(),"tmp","exam-lab");
  await mkdir(dir,{recursive:true});
  const file=path.join(dir,"attempts.json"),lock=path.join(dir,"attempts.lock");
  let handle;
  for(let i=0;i<100;i++) {
    try {handle=await open(lock,"wx");break;}
    catch(error) {if((error as NodeJS.ErrnoException).code!=="EEXIST")throw error;await new Promise(resolve=>setTimeout(resolve,20));}
  }
  if(!handle)throw new Error("lab_store_busy");
  try {
    const store=new MockAttemptRepository();
    try {store.restore(JSON.parse(await readFile(file,"utf8")));}
    catch(error){if((error as NodeJS.ErrnoException).code!=="ENOENT")throw error;}
    const result=await action(new DevelopmentAttemptRepository(store));
    await writeFile(file+".tmp",JSON.stringify(store.snapshot()));await rename(file+".tmp",file);
    return result;
  } finally {await handle.close();await unlink(lock);}
}
export const labAttemptRepository:AttemptRepository={
  getExam:(...args)=>withStore(repo=>repo.getExam(...args)),
  getGuestQuestionUsage:(...args)=>withStore(repo=>repo.getGuestQuestionUsage(...args)),
  findCurrent:(...args)=>withStore(repo=>repo.findCurrent(...args)),
  start:(...args)=>withStore(repo=>repo.start(...args)),
  get:(...args)=>withStore(repo=>repo.get(...args)),
  save:(...args)=>withStore(repo=>repo.save(...args)),
  abandon:(...args)=>withStore(repo=>repo.abandon(...args)),
  submit:(...args)=>withStore(repo=>repo.submit(...args)),
  claimGuestAttempts:()=>withStore(repo=>repo.claimGuestAttempts()),
};
