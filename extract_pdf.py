from pathlib import Path
try:
    import PyPDF2
except Exception as e:
    print('NO_PYPDF2', e)
    raise
p = Path(r'c:\Users\cheme\Downloads\_THSST__Student_Led_Group_Chats (1).pdf')
print('exists', p.exists())
if not p.exists():
    raise SystemExit
reader = PyPDF2.PdfReader(str(p))
print('pages', len(reader.pages))
for i, page in enumerate(reader.pages[:10], start=1):
    txt = page.extract_text() or ''
    print(f'--- PAGE {i} START ---')
    print(txt[:2500])
    print(f'--- PAGE {i} END ---')
