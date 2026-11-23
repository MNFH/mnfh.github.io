// Content and behaviour checks for the resume page.
// Run with: node --test tests/
// No dependencies: the page is read as text and inspected with small helpers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

const NAME = 'Muhammad Nur Faiz Habibullah';
const TITLE = 'Senior Backend Engineer';
const AVATAR = 'https://github.com/MNFH.png';

/** Content of <meta {attr}="{key}" content="…">, or undefined. */
function meta(attr, key) {
  const re = new RegExp(`<meta\\s+${attr}="${key.replace(/[.:]/g, '\\$&')}"\\s+content="([^"]*)"`);
  return html.match(re)?.[1];
}

// ---------- T1.1 page head and Link_Preview (R8.1, R8.2) ----------

test('R8.2 tab title gives name and professional title', () => {
  const title = html.match(/<title>([^<]*)<\/title>/)?.[1];
  assert.equal(title, `${NAME} — ${TITLE}`);
});

test('R8.1 Link_Preview shows name, title, one-sentence description and photo', () => {
  for (const [attr, prefix] of [['property', 'og'], ['name', 'twitter']]) {
    assert.equal(meta(attr, `${prefix}:title`), `${NAME} — ${TITLE}`, `${prefix}:title`);
    const desc = meta(attr, `${prefix}:description`);
    assert.ok(desc, `${prefix}:description present`);
    assert.equal(desc.split(/(?<=[.!?])\s+/).length, 1, `${prefix}:description is one sentence`);
    assert.equal(meta(attr, `${prefix}:image`), AVATAR, `${prefix}:image`);
  }
  assert.equal(meta('property', 'og:url'), 'https://mnfh.github.io/');
  assert.equal(meta('property', 'og:type'), 'profile');
  assert.equal(meta('name', 'twitter:card'), 'summary');
  assert.equal(meta('name', 'description'), meta('property', 'og:description'));
});

// ---------- T1.2 Profile_Header, Summary, status line (R1.1–R1.4) ----------

/** Inner HTML of the first element matching an opening-tag regex source, e.g. '<p class="lead">'. */
function inner(openTag, closeTag) {
  const i = html.search(new RegExp(openTag));
  assert.ok(i >= 0, `${openTag} present`);
  const start = html.indexOf('>', i) + 1;
  return html.slice(start, html.indexOf(closeTag, start));
}
const text = (s) => s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

test('R1.1 Profile_Header is the first element in main and shows photo, name and title', () => {
  const afterMain = html.slice(html.indexOf('<main>') + '<main>'.length);
  assert.match(afterMain, /^\s*(<!--[^]*?-->\s*)*<header class="hero">/);
  const hero = inner('<header class="hero">', '</header>');
  assert.match(hero, new RegExp(`<img src="${AVATAR}"`));
  assert.match(hero, new RegExp(`<h1>${NAME}</h1>`));
  assert.match(hero, new RegExp(`<p>${TITLE}\\b`));
});

test('R1.4 avatar has a fixed size and empty alt so a failed load keeps the layout', () => {
  const img = html.match(/<header class="hero">\s*(<img[^>]*>)/)[1];
  assert.match(img, /width="48"/);
  assert.match(img, /height="48"/);
  assert.match(img, /alt=""/);
});

test('R1.2 Summary has at most three sentences', () => {
  const sentences = text(inner('<p class="lead">', '</p>')).split(/(?<=[.!?])\s+/);
  assert.ok(sentences.length >= 1 && sentences.length <= 3, `${sentences.length} sentences`);
});

test('R1.3 status line directly beneath the Summary: open to backend roles, names recent employers', () => {
  const afterLead = html.slice(html.indexOf('<p class="lead">'));
  assert.match(afterLead, /<\/p>\s*<p class="role">/, 'role line follows the Summary');
  assert.match(text(inner('<p class="role">', '</p>')), /^Open to backend engineering roles\.$/);
  const prev = text(inner('<p class="role-prev">', '</p>'));
  assert.match(prev, /ByteDance/);
  assert.match(prev, /Tokopedia/);
});

// ---------- T1.3 Contact_Links and footer (R5.1–R5.6) ----------

const EMAIL = 'm.nurfaizh@gmail.com';
const anchors = () => [...html.matchAll(/<a\s[^>]*>/g)].map((m) => m[0]);
const attr = (tag, name) => tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];

test('R5.1 Contact_Links come directly after the status line', () => {
  assert.match(html, /<p class="role-prev">[^]*?<\/p>\s*<p class="links">/);
});

test('R5.5 Contact_Links list exactly Email, GitHub and LinkedIn, then the Download_Link', () => {
  const links = inner('<p class="links">', '</p>');
  const labels = [...links.matchAll(/<a\s[^>]*>([^<]*)<\/a>/g)].map((m) => m[1]);
  assert.deepEqual(labels, ['Email', 'GitHub', 'LinkedIn', 'Download PDF']);
  assert.match(links, /href="https:\/\/github\.com\/MNFH"/);
  assert.match(links, /href="https:\/\/www\.linkedin\.com\/in\/m-nur-faiz-h\/"/);
  for (const a of links.match(/<a\s[^>]*>/g).slice(0, 3)) assert.ok(attr(a, 'data-print'), `data-print on ${a}`);
});

test('R5.2 email links open a new message to the Owner', () => {
  const mail = anchors().filter((a) => attr(a, 'href')?.startsWith('mailto:'));
  assert.ok(mail.length >= 2, 'email in Contact_Links and footer');
  for (const a of mail) assert.equal(attr(a, 'href'), `mailto:${EMAIL}`);
});

test('R5.3 / R3.4 every external link opens in a new tab safely', () => {
  for (const a of anchors().filter((a) => /^https?:/.test(attr(a, 'href') ?? ''))) {
    assert.equal(attr(a, 'target'), '_blank', a);
    assert.equal(attr(a, 'rel'), 'noopener noreferrer', a);
  }
});

test('R5.4 the footer repeats a way to contact the Owner', () => {
  assert.match(inner('<footer class="site-footer">', '</footer>'), new RegExp(`href="mailto:${EMAIL}"`));
});

test('R5.6 Property 3: no run of 9+ digits (ignoring spaces, dashes, +) anywhere in the page', () => {
  const runs = html.match(/[\d+][\d\s+\-–—]*\d/g) ?? [];
  for (const run of runs) {
    const digits = run.replace(/\D/g, '');
    assert.ok(digits.length < 9, `possible phone number: "${run}"`);
  }
  assert.doesNotMatch(html, /href="tel:/);
});

// ---------- T2.1 Experience_Section (R2.1–R2.5) ----------

/** Each <li class="job…"> block in document order. */
const jobs = () => {
  const timeline = inner('<ul class="timeline">', '\n      </ul>');
  return timeline.split(/(?=<li class="job[\s"])/).slice(1);
};

test('R2.1 Property 2: Experience_Entries are newest first', () => {
  const starts = jobs().map((j) => j.match(/data-start="(\d{4}-\d{2})"/)?.[1]);
  assert.ok(starts.length >= 1, 'at least one job');
  starts.forEach((s, i) => assert.ok(s, `job ${i} has data-start`));
  for (let i = 1; i < starts.length; i++) assert.ok(starts[i - 1] >= starts[i], `${starts[i - 1]} before ${starts[i]}`);
});

test('R2.2 each Experience_Entry shows title, employer · team, start and end month', () => {
  const month = '(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \\d{4}';
  for (const j of jobs()) {
    assert.match(j, /<span class="title">[^<]+<\/span>/);
    assert.match(j, /<div class="org">[^<]+ · [^<]+<\/div>/);
    assert.match(j, new RegExp(`<span class="end">${month} — (${month}|Now)</span>`));
  }
  const orgs = jobs().map((j) => text(j.match(/<div class="org">([^<]*)/)[1]));
  assert.deepEqual(orgs, ['ByteDance · Shopping Flow Team', 'Tokopedia · Purchase Experience Team']);
});

test('R2.3 only a job ending "Now" is marked current; none is today', () => {
  for (const j of jobs()) {
    const isCurrent = /^<li class="job current"/.test(j);
    const endsNow = /— Now<\/span>/.test(j);
    assert.equal(isCurrent, endsNow, j.slice(0, 60));
  }
  assert.equal(jobs().filter((j) => /— Now</.test(j)).length, 0);
});

test('R2.4 each job gives a role summary, separate responsibilities and a tech stack', () => {
  const stacks = [];
  for (const j of jobs()) {
    assert.ok(text(j.match(/<p class="role-desc">([^]*?)<\/p>/)[1]).length > 20, 'role summary');
    const items = j.match(/<ul class="points">([^]*?)<\/ul>/)[1].match(/<li>/g) ?? [];
    assert.ok(items.length >= 2 && items.length <= 4, `${items.length} responsibilities`);
    stacks.push([...j.match(/<div class="stack"[^>]*>([^]*?)<\/div>/)[1].matchAll(/<span class="pill">([^<]+)<\/span>/g)].map((m) => m[1]));
  }
  assert.deepEqual(stacks, [['Go', 'gRPC', 'PostgreSQL', 'Redis'], ['Go', 'NSQ', 'Redis', 'PostgreSQL']]);
});


// ---------- T2.2 Projects_Section (R3.1–R3.5) ----------

const projectsHtml = () => inner('<section id="projects">', '</section>');
const cards = () => [...projectsHtml().matchAll(/<a class="card[^"]*"[^>]*>[^]*?<\/a>/g)].map((m) => m[0]);

test('R3.2 Featured_Projects: Telegram attendance bot first, then finance bot, then card tracker', () => {
  assert.deepEqual(cards().map((c) => attr(c, 'data-project')), ['absensi', 'keuanganku', 'optcg-tracker']);
  assert.match(cards()[0], /^<a class="card wide"/, 'absensi is the wide card');
  assert.match(cards()[0], /Telegram/);
});

test('R3.1 each Featured_Project shows name, description, stack and a repo link', () => {
  for (const c of cards()) {
    const slug = attr(c, 'data-project');
    assert.equal(attr(c, 'href'), `https://github.com/MNFH/${slug}`);
    assert.match(c, /<div class="head">[^]*?<\/span>[^<]*\w/, `${slug} name`);
    assert.ok(text(c.match(/<p class="desc">([^]*?)<\/p>/)[1]).length > 40, `${slug} description`);
    assert.match(c.match(/<div class="meta">([^]*?)<\/div>/)[1], /<b>Go<\/b>/, `${slug} stack`);
  }
});

test('R3.3 no placeholder Project_Rows remain', () => {
  assert.doesNotMatch(projectsHtml(), /small-repo|another-repo|Project Two|Project Three|Featured Project/);
});

// ---------- T2.3 Skills_Section and Education_Section (R4.1–R4.4) ----------

test('R4.1 skills are grouped under the resume categories, one pill per skill', () => {
  const dl = inner('<dl class="skill-groups">', '</dl>');
  const groups = Object.fromEntries(
    [...dl.matchAll(/<dt>([^<]+)<\/dt>\s*<dd class="pills">([^]*?)<\/dd>/g)].map((m) => [
      m[1].replace('&amp;', '&'),
      [...m[2].matchAll(/<span class="pill">([^<]+)<\/span>/g)].map((p) => p[1]),
    ]),
  );
  assert.deepEqual(groups, {
    Languages: ['Go', 'Python', 'Java', 'Ruby', 'PHP', 'SQL'],
    'Backend & APIs': ['GraphQL', 'gRPC', 'Spring Boot', 'Django', 'Laravel'],
    'Data & Messaging': ['PostgreSQL', 'Redis', 'RabbitMQ'],
    Tools: ['Git', 'Figma', 'Trello'],
  });
});

test('R4.2 / R4.3 education shows degree, institution and years, newest first', () => {
  const rows = [...inner('<section id="education">', '</section>').matchAll(/<li class="edu" data-start="([\d-]+)">([^]*?)<\/li>/g)];
  assert.equal(rows.length, 1);
  const row = rows[0][2];
  assert.match(row, /<span class="title">Bachelor of Information Systems<\/span>/);
  assert.match(row, /<span class="sub">Universitas Indonesia — Faculty of Computer Science<\/span>/);
  assert.match(row, /<span class="end">2017 — 2021<\/span>/);
  const starts = rows.map((r) => r[1]);
  assert.deepEqual(starts, [...starts].sort().reverse());
});

// ---------- T2.4 content comes only from the resume and GitHub (R1.5) ----------

test('R1.5 no placeholder or sample text remains anywhere in the page', () => {
  const placeholders = [
    'Your Name', 'Company A', 'Company B', 'Project Two', 'Project Three', 'Featured Project',
    'small-repo', 'another-repo', 'University Name', 'City, Country', 'example.com', 'your-handle',
    'One-line description', 'Accomplishment with', 'One sentence about who you are', 'href="#" target',
  ];
  for (const p of placeholders) assert.ok(!html.includes(p), `placeholder found: "${p}"`);
});

test('R1.5 every fact in the Data Models table is on the page', () => {
  const facts = [
    // resume header and summary
    NAME, TITLE, 'South Tangerang, Indonesia', EMAIL, 'linkedin.com/in/m-nur-faiz-h', 'github.com/MNFH',
    '4+ years', 'Go, gRPC, PostgreSQL and Redis', 'e-commerce and payments', 'lifelong learner', 'easy-going',
    // experience
    'ByteDance · Shopping Flow Team', 'Feb 2024 — Aug 2026', 'Price Center', 'TikTok Paylater',
    'Tokopedia · Purchase Experience Team', 'Oct 2021 — Feb 2024', 'Wishlist Collection', 'add-to-cart, cart, checkout and wishlist',
    // GitHub projects
    'github.com/MNFH/absensi', 'github.com/MNFH/keuanganku', 'github.com/MNFH/optcg-tracker',
    // skills and education
    'RabbitMQ', 'Spring Boot', 'Bachelor of Information Systems', 'Universitas Indonesia',
  ];
  for (const f of facts) assert.ok(html.includes(f), `missing: "${f}"`);
});

test('R3.5 Projects_Section ends with a link to all repositories', () => {
  assert.match(projectsHtml(), /<a class="more" href="https:\/\/github\.com\/MNFH\?tab=repositories"[^>]*>More on GitHub →<\/a>\s*$/);
});

// ---------- T4.1 Theme_Switch (R7.2–R7.4, Property 1) ----------

const script = (id) => html.match(new RegExp(`<script id="${id}">([^]*?)</script>`))[1];

/** Run both theme scripts against a fake DOM and storage; returns handles for assertions. */
function bootTheme(storage) {
  const attrs = {};
  const root = {
    setAttribute: (k, v) => { attrs[k] = String(v); },
    removeAttribute: (k) => { delete attrs[k]; },
  };
  const buttons = ['light', 'system', 'dark'].map((mode) => {
    const b = { dataset: { mode }, attrs: {}, handlers: [] };
    b.setAttribute = (k, v) => { b.attrs[k] = v; };
    b.addEventListener = (ev, fn) => { if (ev === 'click') b.handlers.push(fn); };
    b.click = () => b.handlers.forEach((fn) => fn());
    return b;
  });
  const ctx = vm.createContext({
    localStorage: storage,
    document: { documentElement: root, querySelectorAll: () => buttons },
  });
  vm.runInContext(script('theme-core'), ctx);
  vm.runInContext(script('theme-switch'), ctx);
  const checked = () => buttons.filter((b) => b.attrs['aria-checked'] === 'true').map((b) => b.dataset.mode);
  return { ctx, attrs, buttons, checked, button: (m) => buttons.find((b) => b.dataset.mode === m) };
}

function memoryStorage(initial) {
  const m = new Map(initial == null ? [] : [['theme', initial]]);
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    map: m,
  };
}
const throwingStorage = {
  getItem() { throw new Error('SecurityError'); },
  setItem() { throw new Error('SecurityError'); },
  removeItem() { throw new Error('SecurityError'); },
};

/** Small seeded PRNG so the property test is reproducible. */
function rng(seed) {
  return () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 2 ** 32);
}
function randomStored(rand) {
  const pool = [null, '', 'light', 'dark', 'system', 'Light', 'DARK', ' dark', 'auto', 'null', 'undefined', '0', '<b>x</b>'];
  if (rand() < 0.6) return pool[Math.floor(rand() * pool.length)];
  return Array.from({ length: Math.floor(rand() * 12) }, () => String.fromCharCode(32 + Math.floor(rand() * 95))).join('');
}

test('R7.3 Property 1: any stored value resolves to light, dark or system; only light/dark set data-theme', () => {
  const rand = rng(42);
  for (let i = 0; i < 300; i++) {
    const stored = randomStored(rand);
    const { ctx, attrs, checked } = bootTheme(memoryStorage(stored));
    const mode = ctx.resolveTheme(stored);
    assert.ok(['light', 'dark', 'system'].includes(mode), `resolveTheme(${JSON.stringify(stored)}) = ${mode}`);
    if (stored === 'light' || stored === 'dark') assert.equal(attrs['data-theme'], stored);
    else assert.equal(attrs['data-theme'], undefined, `stored ${JSON.stringify(stored)} must not set data-theme`);
    assert.deepEqual(checked(), [mode]);
  }
});

test('R7.2 first visit follows the device: no data-theme, System checked', () => {
  const { attrs, checked } = bootTheme(memoryStorage(null));
  assert.equal(attrs['data-theme'], undefined);
  assert.deepEqual(checked(), ['system']);
});

test('R7.3 a click applies the theme at once and keeps it for the next visit', () => {
  const storage = memoryStorage(null);
  const t = bootTheme(storage);
  t.button('dark').click();
  assert.equal(t.attrs['data-theme'], 'dark');
  assert.deepEqual(t.checked(), ['dark']);
  assert.equal(storage.map.get('theme'), 'dark');
  assert.equal(bootTheme(storage).attrs['data-theme'], 'dark', 'next visit restores dark');

  t.button('system').click();
  assert.equal(t.attrs['data-theme'], undefined);
  assert.equal(storage.map.has('theme'), false, 'System clears the saved choice');
});

test('R7.4 with storage blocked the switch still changes the theme for this visit', () => {
  const t = bootTheme(throwingStorage);
  assert.equal(t.attrs['data-theme'], undefined);
  for (const mode of ['light', 'dark', 'system']) {
    assert.doesNotThrow(() => t.button(mode).click());
    assert.equal(t.attrs['data-theme'], mode === 'system' ? undefined : mode);
    assert.deepEqual(t.checked(), [mode]);
  }
});

// ---------- T4.2 layout, keyboard and language (R1.1, R7.1, R7.5, R7.6) ----------

const css = readFileSync(new URL('../style.css', import.meta.url), 'utf8');
const screenCss = css.slice(0, css.indexOf('@media print'));

test('R7.1 no fixed width wider than a phone; single column below 560px; long words wrap', () => {
  const widths = [...screenCss.matchAll(/(?<![-\w])(min-)?width:\s*(\d+)px/g)].map((m) => Number(m[2]));
  for (const w of widths) assert.ok(w <= 320, `fixed width ${w}px could overflow a phone`);
  const phone = screenCss.slice(screenCss.indexOf('@media (max-width: 560px)'));
  assert.match(phone, /\.cards\s*\{\s*grid-template-columns:\s*1fr;/);
  assert.match(phone, /\.skill-groups\s*\{\s*grid-template-columns:\s*1fr;/);
  assert.match(screenCss, /main\s*\{[^}]*overflow-wrap:\s*break-word/);
});

test('R7.5 every control is a native link or button and has a visible focus outline', () => {
  assert.match(screenCss, /:focus-visible\s*\{[^}]*outline:\s*2px solid/);
  assert.doesNotMatch(html, /outline:\s*(none|0)/);
  assert.doesNotMatch(css, /outline:\s*(none|0)/);
  assert.doesNotMatch(html, /tabindex="-1"/);
  for (const b of html.match(/<button[^>]*>/g)) assert.ok(attr(b, 'aria-label'), `${b} has a label`);
  assert.doesNotMatch(html, /<(div|span)[^>]*onclick=/, 'no click handlers on non-interactive elements');
});

test('R7.6 the page is declared and written in English', () => {
  assert.match(html, /<html lang="en">/);
});

// ---------- T4.3 print stylesheet / Resume_Document (R6.1–R6.5) ----------

const printCss = css.slice(css.indexOf('@media print')).replace(/\/\*[^]*?\*\//g, '');

test('R6.1 the Download_Link opens the print dialog', () => {
  const a = anchors().find((t) => /class="download"/.test(t));
  assert.ok(a, 'Download_Link present');
  assert.equal(attr(a, 'onclick'), 'window.print(); return false;');
});

test('R6.2 print forces black-on-white tokens in every theme', () => {
  const rule = printCss.match(/([^{}]+)\{([^}]*--bg:[^}]*)\}/);
  assert.ok(rule, 'print token rule');
  for (const sel of [':root', ':root[data-theme="dark"]', ':root[data-theme="light"]', ':root:not([data-theme="light"])']) {
    assert.ok(rule[1].split(',').map((s) => s.trim()).includes(sel), `covers ${sel}`);
  }
  assert.match(rule[2], /--bg:\s*#fff/);
  assert.match(rule[2], /--text:\s*#000/);
  assert.ok(css.lastIndexOf('--bg:') > css.indexOf('@media print'), 'print tokens are defined after every theme rule');
});

test('R6.3 interactive controls are hidden on paper', () => {
  const hidden = printCss.match(/([^{}]+)\{\s*display:\s*none/)[1].split(',').map((s) => s.trim());
  for (const sel of ['.theme-switch', '.download', '.more', '.arrow', '.arrow-end']) assert.ok(hidden.includes(sel), sel);
});

test('R6.4 any paper size; jobs and cards are never split', () => {
  const page = printCss.match(/@page\s*\{([^}]*)\}/)[1];
  assert.doesNotMatch(page, /size:/, '@page must not fix a paper size');
  assert.match(printCss, /\.timeline > li,\s*\.card[^{]*\{\s*break-inside:\s*avoid/);
});

test('R6.5 contact addresses are printed as text', () => {
  assert.match(printCss, /\.links a\[data-print\]::after\s*\{\s*content:[^;]*attr\(data-print\)/);
  const links = inner('<p class="links">', '</p>');
  assert.match(links, /data-print="m\.nurfaizh@gmail\.com"/);
  assert.match(links, /data-print="github\.com\/MNFH"/);
  assert.match(links, /data-print="linkedin\.com\/in\/m-nur-faiz-h"/);
});
