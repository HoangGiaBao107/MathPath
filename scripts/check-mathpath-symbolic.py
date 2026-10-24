"""Offline authored-bank checks. No student input is parsed by SymPy."""
import json, pathlib, hashlib, re
import sympy as s
root=pathlib.Path('content/extracted/mathpath-new-20261022')
bank=json.loads((root/'questions.json').read_text('utf8'))
passed=[]; errors=[]
for q in bank['questions']:
    if q['type']=='single_choice':
        values=[o['canonical'] for o in q['options']]+[q['answer']['exact']]
        if any(not re.fullmatch(r'[0-9eExpsqrtpi*+\-/(). ]+',v) for v in values):
            errors.append({'id':q['id'],'code':'SYMBOLIC_TOKEN'});continue
        parsed=[s.sympify(v) for v in values]
        matched=[i for i,v in enumerate(parsed[:-1]) if s.simplify(v-parsed[-1])==0]
        duplicate=any(s.simplify(parsed[a]-parsed[b])==0 for a in range(4) for b in range(a+1,4))
        if len(matched)!=1 or q['options'][matched[0]]['id']!=q['answer']['correct'] or duplicate:
            errors.append({'id':q['id'],'code':'MC_EQUIVALENCE'})
        else:passed.append(q['id'])
    if q['subtopic']=='Bao hàm – loại trừ':
        n,a,b,c=map(int,re.findall(r'\d+',q['stem']))
        if not 0<=c<=min(a,b) or a+b-c>n or s.sympify(q['answer']['exact'])!=a+b-c:
            errors.append({'id':q['id'],'code':'IMPOSSIBLE_CLASS_COUNTS'})
    if q['subtopic']=='Sắp xếp ràng buộc':
        match=re.search(r'trong đó có (.*?) và (.*?)\.',q['stem'])
        if match and not all(name in q['solution'] for name in match.groups()):
            errors.append({'id':q['id'],'code':'SOLUTION_NAMES'})
report={'dataset_sha256':hashlib.sha256((root/'questions.json').read_bytes()).hexdigest(),'mc_equivalence_passed':passed,'errors':errors,'human_reviewed':False}
pathlib.Path('tmp/mathpath-new').mkdir(parents=True,exist_ok=True)
pathlib.Path('tmp/mathpath-new/symbolic.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps({'multiple_choice_checked':len(passed),'errors':errors},ensure_ascii=False))
raise SystemExit(bool(errors))
