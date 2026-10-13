const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const context = { window: {} };
vm.createContext(context);
for (const f of ['js/data.js','js/data-extra.js','js/data-sim-more.js']) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), context, { filename: f });
const data = context.window.EA_DATA;

assert.ok(data, 'EA_DATA must load');
assert.equal(data.curriculum.length, 56, '56 daily lessons are expected');
assert.deepEqual(Array.from(new Set(data.curriculum.map(x => x.week))).sort((a, b) => a - b), [1,2,3,4,5,6,7,8]);
assert.deepEqual(Array.from(data.curriculum, x => x.day), Array.from({length:56}, (_, i) => i + 1));
for (const lesson of data.curriculum) {
  assert.ok(lesson.title && lesson.goal && lesson.example, `lesson ${lesson.day} needs content`);
  assert.ok(/^weekly\/Semaine_\d_Jours_\d\d-\d\d\.pdf$/.test(lesson.pdf), `bad PDF storage path for lesson ${lesson.day}: ${lesson.pdf}`);
}
assert.ok(data.vocab.length >= 35, 'vocabulary deck should be substantial');
assert.equal(new Set(data.vocab.map(x => x.id)).size, data.vocab.length, 'vocabulary ids must be unique');
for (const word of data.vocab) assert.ok(word.word && word.fr && word.example, 'flashcard should have translation and example');
assert.ok(data.quizzes.length >= 35, 'quiz bank should be substantial');
for (const q of data.quizzes) {
  assert.ok(q.question && q.explanation && Array.isArray(q.options), 'quiz needs question, options and feedback');
  assert.ok(q.options.length >= 2 && Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length, 'quiz answer index must be valid');
}
assert.ok(data.simulations.length >= 48, 'speaking lab should contain at least 8 simulations');
assert.ok(data.extraCourses.length >= 18, 'there should be at least 18 extra interactive workshops');
for (const c of data.extraCourses) assert.ok(c.id && c.track && c.title && c.objective && c.explanation && c.phrases.length >= 3 && c.challenge && c.model, 'mini-course needs objective, explanation, phrases, challenge and model answer');
for (const s of data.simulations) assert.ok(s.id && s.title && s.opening && s.hints.length && s.sample && s.followups.length, 'simulation needs usable dialogue materials');
for (const file of ['index.html','css/styles.css','js/config.js','js/data.js','js/cloud.js','js/app.js','manifest.webmanifest','sw.js','supabase/schema.sql','README.md','admin.html','js/admin.js','js/voice.js','js/boot.js','js/mascot.js','js/simulation.js','js/games.js','js/duel.js','js/badges.js','js/data-extra.js','LICENSE.txt']) {
  assert.ok(fs.existsSync(path.join(root, file)), `missing project file: ${file}`);
}
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
for (const asset of ['css/styles.css','js/config.js','js/data.js','js/cloud.js','js/app.js','manifest.webmanifest','assets/icons/icon.svg']) assert.ok(html.includes(asset), `index.html should reference ${asset}`);
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.webmanifest'), 'utf8'));
assert.ok(manifest.name && manifest.start_url && manifest.icons.length >= 2, 'PWA manifest must include app name, start URL and icons');
// --- Secret scan: nothing private may ever be in files that get published ---
const scan = ['index.html','admin.html','sw.js','manifest.webmanifest','css','js','assets'];
const bad = /sb_secret_|service_role|SUPABASE_SERVICE|-----BEGIN [A-Z ]*PRIVATE KEY|EA-(?!XXXX)[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}/;
function walk(p){const f=path.join(root,p);if(!fs.existsSync(f))return[];const st=fs.statSync(f);return st.isDirectory()?fs.readdirSync(f).flatMap(n=>walk(path.join(p,n))):[p];}
for (const file of scan.flatMap(walk)) {
  if (/\.(png|svg|ico|jpg|pdf)$/i.test(file)) continue;
  const text = fs.readFileSync(path.join(root, file), 'utf8');
  assert.ok(!bad.test(text), `SECRET FOUND in ${file} - remove it before pushing!`);
}
assert.ok(!fs.existsSync(path.join(root, 'assets/courses')), 'PDF must not be in the public repo (use Supabase private storage)');
for (const f of ['js/app.js','js/admin.js','js/voice.js','js/cloud.js','js/mascot.js','js/simulation.js','js/games.js','js/duel.js','js/badges.js','js/data-extra.js','js/boot.js']) new vm.Script(fs.readFileSync(path.join(root, f), 'utf8'), { filename: f }); // syntax check
const sql = fs.readFileSync(path.join(root, 'supabase/schema.sql'), 'utf8');
for (const fn of ['post_message','list_messages','report_message','admin_list_messages','leaderboard','is_admin']) assert.ok(sql.includes('function public.' + fn), `schema missing ${fn}`);
for (const page of ['index.html', 'admin.html']) {
  const html = fs.readFileSync(path.join(root, page), 'utf8');
  assert.ok(/Content-Security-Policy/.test(html), `${page}: CSP missing`);
  assert.ok(!/<script(?![^>]*\bsrc=)[^>]*>/i.test(html), `${page}: inline script forbidden by CSP`);
  assert.ok(!/esm\.sh|unpkg|cdn\./i.test(html), `${page}: third-party CDN not allowed`);
}
assert.ok(!/esm\.sh/.test(fs.readFileSync(path.join(root, 'js/cloud.js'), 'utf8')), 'cloud.js must not load third-party code');
for (const fn of ['audit_trigger','admin_audit','login_failures','realtime.messages']) assert.ok(sql.includes(fn), `schema missing ${fn}`);
console.log('PASS: 56 sequential lessons; lesson PDF paths valid; no secrets in public files; vocabulary and quiz records validate; 8+ speaking simulations; 18+ mini-courses; app assets and PWA manifest found.');
console.log(`Content inventory: ${data.curriculum.length} lessons, ${data.vocab.length} vocabulary cards, ${data.quizzes.length} quiz questions, ${data.simulations.length} speaking scenarios, ${data.extraCourses.length} mini-courses.`);
