#!/usr/bin/env python3
from __future__ import annotations
from pathlib import Path
from urllib.parse import unquote
import re, sys, json, yaml, collections

ROOT=Path(__file__).resolve().parents[1]
DOCS=ROOT/'docs'
errors=[]; warnings=[]; stats=collections.Counter()

def err(code,msg): errors.append({'code':code,'message':msg})
def warn(code,msg): warnings.append({'code':code,'message':msg})

def split_frontmatter(text):
    if not text.startswith('---\n'): return None,text
    parts=text.split('---',2)
    if len(parts)<3:return None,text
    return yaml.safe_load(parts[1]) or {},parts[2]

def slug(s):
    s=re.sub(r'<[^>]+>','',s.strip().lower())
    s=re.sub(r'[`*_~]','',s)
    s=re.sub(r'[^\w\-\u4e00-\u9fff ]','',s)
    return re.sub(r'[\s_]+','-',s).strip('-')

ids={}
md=list(DOCS.rglob('*.md')); stats['markdown']=len(md)
for p in md:
    text=p.read_text('utf8'); rel=p.relative_to(DOCS)
    fm,body=split_frontmatter(text)
    if fm is None: err('FRONT_MATTER_MISSING',str(rel)); continue
    for k in ['id','title','version','status','classification','owners','last_reviewed','related_adrs','source_of_truth_for']:
        if k not in fm: err('FRONT_MATTER_FIELD',f'{rel}: missing {k}')
    if str(fm.get('version'))!='1.1': err('VERSION',f'{rel}: {fm.get("version")}')
    i=fm.get('id')
    if i in ids: err('DUPLICATE_ID',f'{i}: {ids[i]} and {rel}')
    ids[i]=str(rel)
    if body.count('```')%2: err('CODE_FENCE',str(rel))
    headings=[]
    for line in body.splitlines():
        m=re.match(r'^(#{1,6})\s+(.+?)\s*$',line)
        if m: headings.append(slug(m.group(2)))
    anchors=set(headings)
    for m in re.finditer(r'(?<!!)\[[^\]]*\]\(([^)]+)\)',body):
        target=m.group(1).strip()
        if not target or target.startswith(('http://','https://','mailto:')): continue
        target=target.split(' ',1)[0]
        filepart,sep,frag=target.partition('#')
        q=(p.parent/unquote(filepart)).resolve() if filepart else p
        if filepart and not q.exists(): err('BROKEN_LINK',f'{rel}: {target}')
        if frag and q.exists() and q.suffix=='.md':
            qfm,qbody=split_frontmatter(q.read_text('utf8'))
            qanchors={slug(x.group(2)) for x in re.finditer(r'^(#{1,6})\s+(.+?)\s*$',qbody,re.M)}
            if unquote(frag) not in qanchors: err('BROKEN_ANCHOR',f'{rel}: {target}')

# legacy term/state lint
patterns={
 'SNAKE_STATE':r'\b(?:pause_requested|cancel_requested|rollback_required|rolling_back|rolled_back|partially_rolled_back|source_quiesced|traffic_switched|initial_syncing|final_syncing|commit_pending|waiting_window)\b',
 'LEGACY_BLUEPRINT_TYPE':r'(?<!Workload)\bBlueprintRevision\b',
 'LEGACY_PROVIDER_TYPE':r'(?<!Secret)\bProviderBinding\b',
}
for p in [*DOCS.rglob('*.md'),*DOCS.rglob('*.mmd'),*DOCS.rglob('*.yaml'),*DOCS.rglob('*.sql')]:
 t=p.read_text('utf8')
 for code,pat in patterns.items():
  for m in re.finditer(pat,t): err(code,f'{p.relative_to(DOCS)}:{t.count(chr(10),0,m.start())+1}: {m.group(0)}')

# old roadmap lint
for p in DOCS.rglob('*.md'):
 t=p.read_text('utf8')
 for pat in [r'Phase 1[:：].*Discovery',r'Phase 2[:：].*(Decision|Planning)',r'Phase 3[:：].*Durable',r'Phase 4[:：].*Build',r'Phase 7[:：].*(Capture.*Restore|Capture、Archive、Scrub、Drill、Restore)']:
  if re.search(pat,t): err('OLD_PHASE_SCHEME',str(p.relative_to(DOCS)))

# Mermaid static
mmd=list(DOCS.rglob('*.mmd'));stats['mermaid']=len(mmd)
for p in mmd:
 t=p.read_text('utf8')
 if 'diagram-version:' not in t: err('MERMAID_VERSION',str(p.relative_to(DOCS)))
 if 'source-of-truth:' not in t: err('MERMAID_SOURCE',str(p.relative_to(DOCS)))
 if not re.search(r'\b(flowchart|graph|stateDiagram|sequenceDiagram|classDiagram)\b',t): err('MERMAID_TYPE',str(p.relative_to(DOCS)))

# YAML/OpenAPI
for p in DOCS.rglob('*.yaml'):
 try: yaml.safe_load(p.read_text('utf8')); stats['yaml']+=1
 except Exception as e: err('YAML_PARSE',f'{p.relative_to(DOCS)}: {e}')
openapi_path=DOCS/'08-api/openapi/openapi.yaml'
api=yaml.safe_load(openapi_path.read_text('utf8'))
ops=[]
for path,item in api.get('paths',{}).items():
    placeholders=set(re.findall(r'{([^}]+)}',path))
    for method,obj in item.items():
        if method not in {'get','post','put','patch','delete','head','options'}: continue
        oid=obj.get('operationId'); ops.append((oid,method,path,obj)); stats['openapi_operations']+=1
        params=[]
        for x in item.get('parameters',[])+obj.get('parameters',[]):
            if '$ref' not in x: params.append(x)
        defined={x.get('name') for x in params if x.get('in')=='path'}
        if not placeholders.issubset(defined): err('OPENAPI_PATH_PARAM',f'{method.upper()} {path}: missing {placeholders-defined}')
        if method in {'post','put','patch','delete'}:
            names={x.get('$ref','').split('/')[-1] if '$ref' in x else x.get('name') for x in obj.get('parameters',[])}
            if 'IdempotencyKey' not in names and 'Idempotency-Key' not in names: warn('OPENAPI_IDEMPOTENCY',f'{method.upper()} {path}')
        for r in ['401','403','404','409','412','422']:
            if r not in obj.get('responses',{}): warn('OPENAPI_RESPONSE',f'{method.upper()} {path}: missing {r}')
ids2=collections.defaultdict(list)
for oid,m,p,o in ops: ids2[oid].append((m,p))
for oid,locs in ids2.items():
 if not oid: err('OPENAPI_OPERATION_ID',str(locs))
 if len(locs)>1: err('OPENAPI_DUP_OPERATION_ID',f'{oid}: {locs}')

# Resolve external refs and JSON pointers
all_yaml={p.resolve():yaml.safe_load(p.read_text('utf8')) for p in DOCS.rglob('*.yaml')}
def resolve_pointer(doc,frag):
 cur=doc
 for part in frag.strip('/').split('/') if frag else []:
  part=part.replace('~1','/').replace('~0','~')
  if not isinstance(cur,dict) or part not in cur:return False
  cur=cur[part]
 return True
for p,doc in all_yaml.items():
 def walk(x):
  if isinstance(x,dict):
   if '$ref' in x:
    ref=x['$ref']; filepart,_,frag=ref.partition('#')
    target=(p.parent/filepart).resolve() if filepart else p
    if target not in all_yaml: err('OPENAPI_REF_FILE',f'{p.relative_to(DOCS)}: {ref}')
    elif not resolve_pointer(all_yaml[target],frag): err('OPENAPI_REF_POINTER',f'{p.relative_to(DOCS)}: {ref}')
   for v in x.values(): walk(v)
  elif isinstance(x,list):
   for v in x: walk(v)
 walk(doc)

# DDL checks
sql='\n'.join(p.read_text('utf8') for p in (DOCS/'07-persistence/ddl').glob('*.sql'))
for required in ['planning.plan_input_bindings','planning.plan_stages','planning.plan_gates','planning.plan_risks','execution.worker_leases','execution.resource_lock_heads','execution.resource_leases','execution.execution_commit_records']:
 if required not in sql: err('DDL_REQUIRED_OBJECT',required)
m=re.search(r'CREATE TABLE\s+discovery\.snapshots\s*\((.*?)\n\);',sql,re.I|re.S)
if m and re.search(r'\bfailed\b',m.group(1),re.I): err('DDL_FAILED_SNAPSHOT','failed must belong to snapshot_collection_runs')
if 'one_live_run_per_plan' in sql: warn('DDL_ROOT_RUN_CONSTRAINT','review rollback exception')

# Expected tree
expected=['README.md','00-governance/source-of-truth-map.md','03-domain/state-machines.md','08-api/openapi/openapi.yaml','12-roadmap/implementation-roadmap-v1.md','13-acceptance/phase-9-production-hardening.md','13-acceptance/phase-10-final-integration-and-ga-closure.md','15-experience/README.md','14-adr/ADR-012-queue-row-and-lease-authority.md']
for x in expected:
 if not (DOCS/x).exists():err('EXPECTED_FILE',x)

result={'status':'PASS' if not errors else 'FAIL','stats':dict(stats),'errors':errors,'warnings':warnings}
print(json.dumps(result,ensure_ascii=False,indent=2))
if errors: sys.exit(1)
