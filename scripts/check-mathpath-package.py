"""Verify immutable delivery and record a separate manifest for edited derivatives."""
import hashlib,json,pathlib,zipfile
root=pathlib.Path('content/extracted/mathpath-new-20261022')
out=pathlib.Path('tmp/mathpath-new');out.mkdir(parents=True,exist_ok=True)
sha=lambda b:hashlib.sha256(b).hexdigest()
with zipfile.ZipFile('MATHPATH_19_DE_MOI_634_CAU_CODEX.zip') as z:
    assert z.testzip() is None,'ZIP CRC failed'
    manifest=json.loads(z.read('MANIFEST_SHA256.json'))
    failures=[name for name,digest in manifest.items() if sha(z.read(name))!=digest]
    assert not failures,failures
    original=json.loads(z.read('questions.json'))
    current=json.loads((root/'questions.json').read_text('utf8'))
    before={q['id']:q for q in original['questions']}
    changes=[{'id':q['id'],'fields':[k for k in q if q[k]!=before[q['id']].get(k)]} for q in current['questions'] if q!=before[q['id']]]
    derived={name:sha((root/name).read_bytes()) for name in manifest if (root/name).is_file()}
    report={'zip_crc_passed':True,'original_manifest_files_passed':len(manifest),
      'original_manifest_unchanged':json.loads((root/'MANIFEST_SHA256.json').read_text('utf8'))==manifest,
      'dataset_sha256':sha((root/'questions.json').read_bytes()),'changed_questions':changes,
      'answer_keys_changed':[q['id'] for q in current['questions'] if q['answer']!=before[q['id']]['answer']],
      'derived_files_sha256':derived}
    (out/'package-integrity.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
    print(json.dumps({'original_manifest_passed':len(manifest),'changed_questions':len(changes),'answer_keys_changed':report['answer_keys_changed']}))
