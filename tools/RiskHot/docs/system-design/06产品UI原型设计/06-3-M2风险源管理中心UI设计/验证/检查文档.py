from pathlib import Path
from urllib.parse import unquote
import json
import re

output = Path(__file__).resolve().parent.parent
wiki = next(parent for parent in output.parents if (parent / 'SCHEMA.md').is_file())
project = wiki / 'tools/RiskHot'
base = output.relative_to(wiki).as_posix()
errors = []
link_count = 0
report_path = output / '验证/文档检查结果.json'
if not report_path.exists():
    report_path.write_text('{}', encoding='utf-8')


def exists(target):
    # 编号文档名中的点不是文件扩展名，省略扩展时追加 .md。
    path = wiki / target.split('#', 1)[0]
    return path.is_file() or Path(str(path) + '.md').is_file()


for file in output.rglob('*'):
    if not file.is_file() or file.suffix not in {'.md', '.html', '.css', '.mjs', '.json', '.js'}:
        continue
    if file.name == 'lucide.min.js':
        continue
    text = file.read_text(encoding='utf-8')
    if '\ufffd' in text or any(char in text for char in ('鍐', '鐭', '鎯', '灏')):
        errors.append(f'UTF-8 替换／乱码：{file.name}')
    if file.suffix == '.md':
        if text.count('```') % 2:
            errors.append(f'Markdown 围栏：{file.name}')
        for target in re.findall(r'\[\[([^\]|]+)(?:\|[^\]]*)?\]\]', text):
            if not exists(target):
                errors.append(f'缺失双链：{file.name} → {target}')
            link_count += 1
    if file.suffix == '.html':
        for target in re.findall(r'(?:src|href)="([^"]+)"', text):
            if target.startswith(('http:', 'https:', '/')):
                errors.append(f'非本地资源：{file.name} → {target}')
            elif not (file.parent / unquote(target)).is_file():
                errors.append(f'缺失资源：{file.name} → {target}')

for file in (project / 'docs/system-design/06产品UI原型设计/readme.md', project / 'index.md', wiki / 'index.md'):
    entries = [line for line in file.read_text(encoding='utf-8').splitlines() if base in line]
    if len(entries) != 2:
        errors.append(f'导航应各有两个入口：{file}')
    for line in entries:
        for target in re.findall(r'\[\[([^\]|]+)', line):
            if not exists(target):
                errors.append(f'导航目标缺失：{target}')
            link_count += 1

text = (output / 'reconcile-m2.md').read_text(encoding='utf-8')
rows = [line for line in text.splitlines() if re.match(r'\| M2-F\d\d \|', line)]
if len(rows) != 20:
    errors.append('功能对照未包含二十行')
covered = set()
for row in rows:
    covered.update(int(number) for number in re.findall(r'(?:AC-M2-|、)(\d{2})', row.split('|')[-2]))
if covered != set(range(1, 28)):
    errors.append(f'建议验收覆盖缺口：{set(range(1, 28)) - covered}')
if len(list((output / 'mockups').glob('*.html'))) != 4:
    errors.append('关键页面 HTML 数量错误')
if len(list(output.rglob('*.png'))) != 19:
    errors.append('截图数量错误')


app = (output / '原型资源/app.js').read_text(encoding='utf-8')
for html in output.rglob('*.html'):
    if 'data-view="indicators"' in html.read_text(encoding='utf-8'):
        errors.append(f'仍有独立关键指标tab：{html.name}')
if 'data-detail-tab="${v}"' not in app or "['observations','观测指标']" not in app:
    errors.append('缺少变量观测指标入口')
if "['usage','使用关系']" in app or 'function usage(' in app or 'function renderImpact(' in app:
    errors.append('原型仍保留首版使用关系／独立影响查询')
if 'function renderInitialization(' in app or "button('initialization'" in app or "a==='init-confirm'" in app:
    errors.append('原型仍保留初始化入口或预览页面')
if not any('M2-F18' in row and '后续' in row and '首版' in row for row in rows):
    errors.append('M2-F18 尚未标为首版移出')

functional = (project / 'docs/system-design/03-系统功能架构/M2风险源管理中心功能设计.md').read_text(encoding='utf-8')
for number in range(1, 9):
    if f'| 审核-{number:02d} |' not in functional:
        errors.append(f'首次指标审核业务规则缺失：审核-{number:02d}')
if '正式确认仍须在身份获批后逐项完成' in functional or '身份未确认时单项审核按钮禁用' in functional:
    errors.append('主功能文档仍保留先分配身份后审核指标的旧规则')

report = {
    'checks': ['UTF-8与Markdown围栏', '新文档与三处新增导航双链', '独立HTML本地资源', '20项功能追踪', '首次指标审核8条业务规则', '27项历史验收关联（AC-M2-08首版移除，AC-M2-22转后续）', '4份关键页面与19张截图'],
    'link_count': link_count,
    'errors': errors,
    'scope': '仅新文档、新增导航及本地资源；不检查既有无关链接',
}
report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(report, ensure_ascii=False))
raise SystemExit(1 if errors else 0)
