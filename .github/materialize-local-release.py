"""Materialize reviewed line edits on the isolated release branch, hash checked."""
from pathlib import Path
import hashlib,json
pending=[]
for file in [Path('.github/local-release-core.json'),Path('.github/local-release-ui.json')]:
 for item in json.loads(file.read_text()):
  path=Path(item['path'])
  if path.is_absolute() or '..' in path.parts: raise SystemExit('Invalid patch path')
  before=path.read_bytes()
  if hashlib.sha256(before).hexdigest()!=item['before']: raise SystemExit('Source changed: '+str(path))
  lines=before.decode().splitlines(keepends=True)
  for start,end,text in reversed(item['edits']): lines[start:end]=[text]
  after=''.join(lines).encode()
  if hashlib.sha256(after).hexdigest()!=item['after']: raise SystemExit('Patch content hash mismatch: '+str(path))
  pending.append((path,after))
for path,data in pending: path.write_bytes(data)
print('Applied and hash-verified',len(pending),'reviewed file updates.')
