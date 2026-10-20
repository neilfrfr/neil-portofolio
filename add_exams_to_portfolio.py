"""Add an Exams tab using the existing Firestore records and Cloudinary upload flow.
Run from the root of neil-portofolio: python add_exams_to_portfolio.py
"""
from pathlib import Path

root = Path.cwd()

def replace_once(text, old, new, label):
    if new in text:
        print(f'Already applied: {label}')
        return text
    if text.count(old) != 1:
        raise RuntimeError(f'Expected exactly one match for {label}, found {text.count(old)}')
    return text.replace(old, new, 1)

html_path = root / 'documents.html'
js_path = root / 'app.js'
if not html_path.exists() or not js_path.exists():
    raise SystemExit('Run this script in the root of the neil-portofolio repository.')
html = html_path.read_text(encoding='utf-8')
js = js_path.read_text(encoding='utf-8')

html = replace_once(html,
    '      <button class="tab-btn" data-category="long-quiz" type="button">Long quizzes</button>',
    '      <button class="tab-btn" data-category="long-quiz" type="button">Long quizzes</button>\n'
    '      <button class="tab-btn" data-category="exams" type="button">Exams</button>', 'Exams tab')

exams_block = '''
    <div class="tab-content" data-category="exams">
      <div class="tab-content-header">
        <div>
          <h3>Exams</h3>
          <p>Midterms, finals, and other examination documents.</p>
        </div>
        <button class="btn btn-small admin-only add-record-btn" type="button" data-category="exams" style="display:none;">+ Add exam</button>
      </div>
      <div class="record-list" data-list="exams">
        <p class="loading-state">Loading…</p>
      </div>
    </div>
'''
if 'class="tab-content" data-category="exams"' not in html:
    anchor = '    </div>\n  </div>\n</section>\n\n<footer id="contact">'
    html = replace_once(html, anchor, '    </div>' + exams_block + '  </div>\n</section>\n\n<footer id="contact">', 'Exams content')

html = html.replace('Academic directory of activities, short quizzes, and long quizzes',
                    'Academic directory of activities, short quizzes, long quizzes, and exams')

js = replace_once(js,
    '  "long-quiz": "Long Quiz"\n',
    '  "long-quiz": "Long Quiz",\n  exams: "Exam"\n', 'Exam viewer label')
js = replace_once(js,
    '["activities", "short-quiz", "long-quiz"].forEach(renderCategory);',
    '["activities", "short-quiz", "long-quiz", "exams"].forEach(renderCategory);', 'Live Exams rendering')
js = replace_once(js,
    '  "long-quiz": "No long quizzes yet. Your uploaded quizzes will appear here."\n',
    '  "long-quiz": "No long quizzes yet. Your uploaded quizzes will appear here.",\n'
    '  exams: "No exams yet. Uploaded exams will appear here."\n', 'Exams empty state')

# No new DB collection is needed; records are already stored in Firestore with a category field.
html_path.write_text(html, encoding='utf-8')
js_path.write_text(js, encoding='utf-8')
print('Updated documents.html and app.js. Exams now use the existing records collection and viewer.')
