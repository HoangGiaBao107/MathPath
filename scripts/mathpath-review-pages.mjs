import {writeFile,mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import katex from 'katex';
import {readBank,outputRoot,bankRoot} from './mathpath-bank.mjs';
const bank=await readBank(),samples=new Map(),topics=new Set(),exams=new Set();
for(const q of bank.questions)if(!topics.has(q.subtopic)){samples.set(q.id,q);topics.add(q.subtopic);exams.add(q.exam_id);}
for(const q of bank.questions)if(!exams.has(q.exam_id)){samples.set(q.id,q);exams.add(q.exam_id);}
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
function render(text){let out='',start=0;for(const m of text.matchAll(/\$([^$]+)\$/gs)){out+=esc(text.slice(start,m.index));out+=katex.renderToString(m[1],{throwOnError:true,strict:'error'});start=m.index+m[0].length;}return out+esc(text.slice(start));}
await mkdir(outputRoot,{recursive:true});const list=[...samples.values()];
for(let i=0;i<list.length;i+=4){const cards=list.slice(i,i+4).map(q=>`<article><h2>${q.id} · ${q.subtopic}</h2><p>${render(q.stem)}</p>${q.figures.map(f=>`<img src="${pathToFileURL(path.join(bankRoot,f.file))}" alt="${esc(f.alt)}">`).join('')}<div>${(q.options??q.statements??[]).map(o=>`<p>${o.id}. ${render(o.text)}</p>`).join('')}</div><h3>Đáp án: ${esc(JSON.stringify(q.answer.correct??q.answer.exact))}</h3><p class="solution">${render(q.solution)}</p></article>`).join('');await writeFile(path.join(outputRoot,`review-${i/4}.html`),`<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="${pathToFileURL(path.resolve('node_modules/katex/dist/katex.min.css'))}"><style>body{font:16px Arial;margin:20px;background:#f4f5f7;color:#202630}.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}article{background:white;border:1px solid #ddd;border-top:4px solid #d71920;padding:18px;min-width:0}h2{font-size:17px}h3{font-size:15px;color:#b51219}p{line-height:1.6;white-space:pre-line}img{max-width:260px;max-height:170px} .solution{border-top:1px solid #eee;padding-top:10px}</style><div class="grid">${cards}</div>`);}
await writeFile(path.join(outputRoot,'visual-sample-plan.json'),JSON.stringify({sample_ids:list.map(q=>q.id),topics:topics.size,exams:exams.size,pages:Math.ceil(list.length/4),human_reviewed:false},null,2));
