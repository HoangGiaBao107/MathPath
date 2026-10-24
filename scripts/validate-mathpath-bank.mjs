import {Console} from 'node:console';
import process from 'node:process';
import {readBank,validateBank} from './mathpath-bank.mjs';
const report=await validateBank(await readBank());
new Console(process.stdout,process.stderr).log(JSON.stringify(report,null,2));
process.exitCode=report.errors.length?2:0;
