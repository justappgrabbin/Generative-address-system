from pathlib import Path
import re, json, base64

root=Path(__file__).resolve().parents[1]
modules={}
pattern=re.compile(r'(^\s*(?:import\s+(?:[^;]*?\s+from\s+)?|export\s+[^;]*?\s+from\s+)[\'"])([^\'"]+)([\'"])',re.M)
dynamic=re.compile(r'(import\s*\(\s*[\'"])([^\'"]+)([\'"])')
def collect(path):
 path=path.resolve()
 if path.is_relative_to(root):
  key='synthia/'+path.relative_to(root).as_posix()
 else:
  # Bundle the existing authority directly, rather than copying its runtime
  # into another vendor tree. Reject unrelated paths outside this package.
  authority=root.parent/'Synthia-Generative-Address-Morphology-Integrated-v0.2.1-RUNNABLE'/'authorities'/'execution-spine'/'src'/'pure-synthia'/'engine'
  key='synthia-authority/'+path.relative_to(authority).as_posix()
 if key in modules:return key
 modules[key]=''
 source=path.read_text()
 def replace(match):
  spec=match.group(2)
  if spec.startswith('.'):
   spec=collect(path.parent/spec)
  return match.group(1)+spec+match.group(3)
 source=dynamic.sub(replace,pattern.sub(replace,source))
 modules[key]='data:text/javascript;base64,'+base64.b64encode(source.encode()).decode()
 return key
entry=collect(root/'src/app.mjs')
markup=(root/'index.html').read_text()
markup=markup.replace('<script type="module" src="./src/app.mjs"></script>', '<script type="importmap">'+json.dumps({'imports':modules})+'</script><script type="module">import "'+entry+'";</script>')
(root/'Synthia-Foundation-Offline.html').write_text(markup)
print(f'Embedded {len(modules)} source modules; {len(markup):,} bytes')
