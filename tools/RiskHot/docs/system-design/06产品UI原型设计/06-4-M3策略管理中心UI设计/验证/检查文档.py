"""检查 M3 UI 交付的本地文档、编号和资源，不访问网络。"""
from pathlib import Path
import json
import re

base = Path(__file__).resolve().parent.parent
wiki = next(p for p in base.parents if (p / 'schema.md').is_file())
errors = []
links = 0
for file in base.rglob('*'):
    if file.suffix not in {'.md', '.html', '.css', '.js', '.mjs', '.py', '.json'}:
        continue
    text = file.read_text(encoding='utf-8')
    if '\ufffd' in text or any(0xE000 <= ord(c) <= 0xF8FF for c in text):
        errors.append(f'{file.name}: replacement/private-use character')
    if file.suffix == '.md':
        if text.count('```') % 2:
            errors.append(f'{file.name}: unclosed code fence')
        for target in re.findall(r'\[\[([^\]|#]+)', text):
            links += 1
            path = wiki / target
            if not path.exists() and not Path(str(path) + '.md').exists():
                errors.append(f'{file.name}: missing link {target}')
    if file.suffix == '.html':
        for target in re.findall(r'(?:src|href)="([^"]+)"', text):
            if re.match(r'https?://', target):
                errors.append(f'{file.name}: external dependency {target}')
            elif not (file.parent / target).exists():
                errors.append(f'{file.name}: missing resource {target}')

coverage = (base / 'reconcile-m3.md').read_text(encoding='utf-8')
functions = sorted(set(re.findall(r'M3-F\d{2}', coverage)))
acceptance = sorted(set(re.findall(r'AC-M3-\d{2}', coverage)))
assert functions == [f'M3-F{i:02d}' for i in range(1, 24)]
assert acceptance == [f'AC-M3-{i:02d}' for i in range(1, 16)]
result = {'date': '2026-10-15', 'local_links': links, 'functions': len(functions),
          'acceptance_mappings': len(acceptance), 'screenshots': len(list((base/'验证').glob('*.png'))),
          'errors': errors}
(base / '验证/文档检查结果.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(result, ensure_ascii=False))
assert not errors
