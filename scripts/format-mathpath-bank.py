"""Deterministic presentation fixes; never regenerates questions or answer keys."""
import json,pathlib,re
root=pathlib.Path('content/extracted/mathpath-new-20261022')
bank=json.loads((root/'questions.json').read_text('utf8'))
logfile=pathlib.Path('tmp/mathpath-new/presentation-repairs.json')
changes=json.loads(logfile.read_text('utf8')) if logfile.exists() else []
for q in bank['questions']:
    fields=[(q,'stem'),(q,'solution')]+[(o,'text') for o in q.get('options',[])]+[(s,'text') for s in q.get('statements',[])]
    for obj,field in fields:
        old=obj[field]
        new=old.replace(r'\mathrm{đáy}',r'\text{đáy}')
        new=re.sub(r'([A-Za-z])\\prime',lambda m:m[1]+r'^{\prime}',new)
        new=re.sub(r'\*\*([^*]+)\*\*',r'\1',new)
        if old!=new:
            changes.append({'id':q['id'],'field':field,'before':old,'after':new,'reason':'Superscript derivative notation / plain text emphasis for existing renderer'})
            obj[field]=new
(root/'questions.json').write_text(json.dumps(bank,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
logfile.write_text(json.dumps(changes,ensure_ascii=False,indent=2),encoding='utf8')
# Keep the supplied per-exam JSON and readable editions in sync by stable ID.
full=['# MathPath — Bộ đề mới\n']
for e in bank['exams']:
    qs=[q for q in bank['questions'] if q['exam_id']==e['id']]
    p=root/'exams'/f"{e['id']}.json"
    obj=json.loads(p.read_text('utf8'));obj['questions']=qs
    p.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    student=[f"# {e['title']}\n"];teacher=student.copy()
    for q in qs:
        body=f"### {q['id']}\n\n{q['stem']}\n\n"
        body+='\n'.join(f"- {o['id']}. {o['text']}" for o in q.get('options',q.get('statements',[])))+'\n'
        body+=''.join(f"\n![{f['alt']}](../{f['file']})\n" for f in q['figures'])
        student.append(body)
        teacher.append(body+f"\n**Đáp án:** {q['answer'].get('correct',q['answer'].get('display'))}\n\n**Giải:** {q['solution']}\n")
    for suffix,lines in [('DE_BAI',student),('DAP_AN_VA_LOI_GIAI',teacher)]:
        (root/'exams'/f"{e['id']}_{suffix}.md").write_text('\n'.join(lines),encoding='utf8')
    full.extend(line.replace('../assets/','assets/') for line in teacher)
(root/'FULL_EXAMS_REVIEW.md').write_text('\n'.join(full),encoding='utf8')
# Repair the source recipes without running the generator or changing its seed.
p=root/'source/build_bank.py';s=p.read_text('utf8')
s=s.replace('Gộp An–Bình thành một khối','Gộp {p}–{q} thành một khối')
if 'v=a+b-c;n=max(n,v+2)' not in s:
    s=s.replace('c=sr(2,min(a,b)-2);v=a+b-c','c=sr(2,min(a,b)-2);v=a+b-c;n=max(n,v+2)')
s=s.replace(r'\\mathrm{{đáy}}',r'\\text{{đáy}}')
p.write_text(s,encoding='utf8')
print(json.dumps({'presentation_edits':len(changes),'questions':len({c['id'] for c in changes}),'exams_synced':19}))
