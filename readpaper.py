from pathlib import Path
import sys
try:
    import PyPDF2
except Exception as e:
    print('IMPORT_ERROR', e)
    raise
pdf = Path(r'c:\Users\cheme\Downloads\_THSST__Student_Led_Group_Chats (1).pdf')
print('PDF_EXISTS', pdf.exists())
if not pdf.exists():
    raise SystemExit(1)
reader = PyPDF2.PdfReader(str(pdf))
print('PAGE_COUNT', len(reader.pages))
text = '\n\n'.join((page.extract_text() or '') for page in reader.pages)
Path('paper_extracted.txt').write_text(text, encoding='utf-8', errors='replace')
print('WROTE', 'paper_extracted.txt')
print(text[:1500])
