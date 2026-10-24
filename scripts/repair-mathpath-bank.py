import pathlib,json,re,hashlib
root=pathlib.Path('content/extracted/mathpath-new-20261022')
bank=json.loads((root/'questions.json').read_text('utf8'));changes=[];replacements=[]
for q in bank['questions']:
    if q['subtopic']=='Bao hàm – loại trừ':
        n,a,b,c=map(int,re.findall(r'\d+',q['stem']))
        if a+b-c>n:
            old=q['stem'];new=old.replace(f'lớp {n} học sinh',f'lớp {a+b-c+2} học sinh')
            replacements.append((old,new));changes.append({'id':q['id'],'field':'stem','before':old,'after':new,'reason':'Class size must contain the union; answer unchanged'})
    if q['subtopic']=='Sắp xếp ràng buộc':
        names=re.search(r'trong đó có (.*?) và (.*?)\.',q['stem']).groups()
        old=q['solution'];new=old.replace('An–Bình','–'.join(names))
        if new!=old:
            replacements.append((old,new));changes.append({'id':q['id'],'field':'solution','before':old,'after':new,'reason':'Match names in the question'})
# Identical solutions may occur with different names; update JSON by ID, not global replacement.
for file in [root/'questions.json',*sorted((root/'exams').glob('*.json'))]:
    obj=json.loads(file.read_text('utf8'));items=obj.get('questions',[]) if isinstance(obj,dict) else obj
    for q in items:
        for edit in changes:
            if q['id']==edit['id']:q[edit['field']]=edit['after']
    file.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
# Human-readable review copies are regenerated from corrected canonical JSON later.
log=pathlib.Path('tmp/mathpath-new/content-repairs.json')
previous=json.loads(log.read_text('utf8')) if log.exists() else []
log.write_text(json.dumps(previous+changes,ensure_ascii=False,indent=2),encoding='utf8')
print('Content repairs:',len(changes))
