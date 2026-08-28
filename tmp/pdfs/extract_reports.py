from pathlib import Path

from pypdf import PdfReader


REPORTS = {
    Path("sources/papers/柳工机构研报-2026-07-30/柳工2026年半年度报告.pdf"): Path(
        "tmp/pdfs/liugong-2026H1.txt"
    ),
    Path("sources/papers/三花智控机构研报-2026-07-17/三花智控2026年半年度报告.pdf"): Path(
        "tmp/pdfs/sanhua-2026H1.txt"
    ),
}


for source, destination in REPORTS.items():
    reader = PdfReader(source)
    text = "\n\n".join(page.extract_text() or "" for page in reader.pages)
    destination.write_text(text, encoding="utf-8")
    print(f"{source.name}: pages={len(reader.pages)} chars={len(text)}")
