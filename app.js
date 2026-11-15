const search = document.querySelector('#search');
const workspace = document.querySelector('#workspace');
const results = document.querySelector('#results');
const detail = document.querySelector('#detail');
const detailContent = document.querySelector('#detail-content');
const count = document.querySelector('#count');
const controls = document.querySelector('#search-controls');
const backToCatalog = document.querySelector('#back-to-catalog');
const previousSong = document.querySelector('#previous-song');
const nextSong = document.querySelector('#next-song');
const clearSearch = document.querySelector('#clear-search');
const decade = document.querySelector('#decade');
const sort = document.querySelector('#sort');
const filters = document.querySelectorAll('[data-writer]');
const compactScreen = matchMedia('(max-width: 760px)');
const badges = {'原曲':'original', '海外カバー':'cover', '別題・別歌詞':'self', 'ライブ客演':'duet', '提供音源':'original', 'セルフカバー':'self', 'カバー':'cover', '共演再録':'duet', '客演':'duet', 'ライブカバー':'cover', 'インスト':'instrumental', 'カラオケ':'instrumental', '英語歌唱版':'cover', 'ライブ映像':'self', 'ライブ歌唱':'self', 'ライブ音源':'self', '映像収録':'self', 'アルバム収録':'original', 'リミックス':'original', 'クラブMIX':'cover', 'アルバム版':'cover', '放送歌唱映像':'self', 'ラジオ歌唱':'self', '再録':'original', '再収録':'original', 'ベスト盤収録':'original'};
const duoNamePattern = /\bchage\s*(?:[&＆]|and)\s*asu?ka\b|チャゲ\s*(?:[&＆]|と)\s*飛鳥/gi;

// Editions and tours in the transition years are classified by their documented dates.
const duoNamesByTransitionWork = {
  1989: {
    'WALK': 'チャゲ＆飛鳥',
    'WALK（ライブ＆ドキュメンタリー）': 'チャゲ＆飛鳥',
    'LOVE SONG': 'CHAGE&ASUKA',
    'PRIDE': 'CHAGE&ASUKA',
    'HISTORY I ～10years after～': 'CHAGE&ASUKA',
    'CONCERT TOUR ’89 ～10 years after～': 'CHAGE&ASUKA',
  },
  1990: {
    'THE STORY of BALLAD': 'CHAGE&ASUKA',
    'HISTORY II ～PRIDE～': 'CHAGE&ASUKA',
    'Z=One（ポニーキャニオン再発CD）': 'CHAGE&ASKA',
    'SEE YA': 'CHAGE&ASKA',
    'SEE YA（映像作品）': 'CHAGE&ASKA',
    'CONCERT TOUR ’90 SEE YA': 'CHAGE&ASKA',
    'CONCERT TOUR ’90～’91 SEE YA!': 'CHAGE&ASKA',
    'CHAGE&ASKA STORY～太陽と埃の中で～': 'CHAGE&ASKA',
  },
};

function displayArtist(year, artist, work) {
  const spelling = duoNamesByTransitionWork[year]?.[work]
    || (year < '1989' ? 'チャゲ＆飛鳥' : '')
    || (year >= '1991' && year <= '2000' ? 'CHAGE&ASKA' : '')
    || (year >= '2001' ? 'CHAGE and ASKA' : '');
  return spelling ? artist.replace(duoNamePattern, spelling) : artist;
}

function normalizeArtistAliases(value) {
  return value.normalize('NFKC').replace(duoNamePattern, 'chageaska');
}

function normalize(value) {
  return String(value ?? '').normalize('NFKC').toLowerCase().replace(/[\p{P}\s]/gu, '');
}

const collator = new Intl.Collator('ja', { numeric: true, sensitivity: 'base' });
const catalogSongs = songs.flatMap((song, index) => {
  if (song.redirectTo) return [];
  const firstYear = song.versions[0][1];
  const fields = [song.title, song.lyrics, song.music, ...song.versions.flatMap(
    ([type, year, artist, work, , , meta]) => [type, year, artist, work, meta?.track, meta?.note, meta?.creditedAs]
  )].filter(Boolean).join(' ');
  return [{ song, number: index + 1, firstYear, text: normalize(fields + ' ' + normalizeArtistAliases(fields)) }];
});
const entries = new Map(catalogSongs.map(entry => [entry.song.id, entry]));
const redirects = new Map(songs.filter(song => song.redirectTo).map(song => [song.id, song.redirectTo]));
const sorters = {
  oldest: (a, b) => a.firstYear.localeCompare(b.firstYear) || a.number - b.number,
  newest: (a, b) => b.firstYear.localeCompare(a.firstYear) || a.number - b.number,
  title: (a, b) => collator.compare(a.song.title, b.song.title) || a.number - b.number,
  added: (a, b) => b.number - a.number,
};
let matches = [];
let writer = '';
let selected = null;
let listScroll = 0;
let compactScroll = 0;

for (const value of [...new Set(catalogSongs.map(({ firstYear }) => firstYear.slice(0, 3) + '0'))].sort()) {
  decade.add(new Option(value + '年代', value));
}

function activeIndex() {
  return matches.indexOf(selected);
}

function syncSelection() {
  for (const item of results.querySelectorAll('[data-song]')) {
    if (item.dataset.song === selected?.song.id) item.setAttribute('aria-current', 'true');
    else item.removeAttribute('aria-current');
  }
  const index = activeIndex();
  previousSong.disabled = index <= 0;
  nextSong.disabled = index < 0 || index >= matches.length - 1;
}

function showDetail() {
  detail.hidden = !selected;
  if (!selected) {
    detailContent.replaceChildren();
    return;
  }

  const { song, number } = selected;
  const rows = song.versions;
  detailContent.innerHTML = `
    <p class="eyebrow">No. ${String(number).padStart(2,'0')}</p>
    <h3>${song.title}</h3>
    <p class="credit">作詞　${song.lyrics}　／　作曲　${song.music}</p>
    ${song.note ? `<p class="note">${song.note}</p>` : ''}
    <p class="version-heading">収録・公演記録 <span>${rows.length}件</span></p>
    <ol class="timeline">${rows.map(([type, year, artist, release, url, source, meta]) => `
      <li><details class="version">
        <summary>
          <time datetime="${year}">${year}</time>
          <span class="version-summary">
            <span class="version-title"><strong>${displayArtist(year, artist, release)}</strong> <span class="badge ${badges[type]}">${type}</span></span>
            <span class="version-release">${meta?.track ? `「${meta.track}」 · ` : ''}『${release}』</span>
          </span>
        </summary>
        <div class="version-info">
          ${meta?.note ? `<p>${meta.note}</p>` : ''}
          ${meta?.creditedAs ? `<p>資料上の名義　${meta.creditedAs}</p>` : ''}
          <a class="source" href="${url}" target="_blank" rel="noopener">${source} ↗</a>
          ${meta?.reference ? `<a class="source" href="${meta.reference[0]}" target="_blank" rel="noopener">${meta.reference[1]} ↗</a>` : ''}
          ${meta?.creditSource ? `<a class="source" href="${meta.creditSource}" target="_blank" rel="noopener">名義の確認資料 ↗</a>` : ''}
        </div>
      </details></li>`).join('')}</ol>`;
}

function renderCatalog() {
  const query = search.value.trim();
  const terms = normalizeArtistAliases(query).split(/\s+/).map(normalize).filter(Boolean);
  const number = query.normalize('NFKC').match(/^(?:#|no\.?\s*)?(\d{1,3})$/i)?.[1];
  matches = catalogSongs.filter(entry =>
    (!writer || entry.song.writers.includes(writer)) &&
    (!decade.value || entry.firstYear.startsWith(decade.value.slice(0, 3))) &&
    (Number(number) === entry.number || terms.every(term => entry.text.includes(term)))
  ).sort(sorters[sort.value]);
  count.textContent = query || writer || decade.value
    ? `${matches.length}件 / 全${catalogSongs.length}曲`
    : `${catalogSongs.length}曲`;
  clearSearch.hidden = !query && !writer && !decade.value && sort.value === 'oldest';
  results.innerHTML = matches.length ? matches.map(({ song, number, firstYear }) => {
    const [, year, artist, work] = song.versions[0];
    return `<button type="button" class="song" data-song="${song.id}" aria-controls="detail">
      <span class="song-index"><span class="year">${firstYear}</span><small>No. ${number}</small></span>
      <span><strong>${song.title}</strong><small>${displayArtist(year, artist, work)} · ${song.versions.length}件</small></span>
      <span class="arrow" aria-hidden="true">›</span>
    </button>`;
  }).join('') : '<p class="empty">該当する曲がありません。検索語や絞り込みを変えてみてください。</p>';
  syncSelection();
}

function updateUrl(push = false) {
  const url = new URL(location.href);
  const params = { q: search.value.trim(), writer, decade: decade.value,
    sort: sort.value === 'oldest' ? '' : sort.value,
    song: workspace.dataset.view === 'detail' ? selected?.song.id : '' };
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
  }
  if (url.href === location.href) return;
  if (push) history.pushState(null, '', url);
  else history.replaceState(null, '', url);
}

function setWriter(value) {
  writer = value;
  for (const item of filters) item.setAttribute('aria-pressed', String(item.dataset.writer === writer));
}

function selectEntry(entry) {
  selected = entry ?? null;
  showDetail();
  syncSelection();
}

function openEntry(entry, push = true) {
  if (!entry) return;
  if (workspace.dataset.view === 'catalog') {
    listScroll = results.scrollTop;
    compactScroll = window.scrollY;
  }
  workspace.dataset.view = 'detail';
  document.body.dataset.view = 'detail';
  selectEntry(entry);
  updateUrl(push);
  detail.scrollIntoView({ block: 'start', behavior: 'instant' });
  detail.focus({ preventScroll: true });
  revealSelection();
}

function revealSelection() {
  if (compactScreen.matches) return;
  const item = results.querySelector('[aria-current="true"]');
  if (!item) return;
  const top = item.offsetTop - results.offsetTop;
  if (top < results.scrollTop || top + item.offsetHeight > results.scrollTop + results.clientHeight) {
    results.scrollTop = top - (results.clientHeight - item.offsetHeight) / 2;
  }
}

function showCatalog(restorePosition = false) {
  workspace.dataset.view = 'catalog';
  document.body.dataset.view = 'catalog';
  if (!matches.includes(selected)) selectEntry(matches[0]);
  if (!restorePosition) return;
  results.scrollTop = listScroll;
  if (compactScreen.matches) window.scrollTo({ top: compactScroll, behavior: 'instant' });
  const item = results.querySelector('[aria-current="true"]');
  if (item) item.focus({ preventScroll: true });
  else search.focus({ preventScroll: true });
}

function filterChanged() {
  renderCatalog();
  if (workspace.dataset.view === 'detail' && !matches.includes(selected)) {
    showCatalog();
    selectEntry(matches[0]);
  } else if (workspace.dataset.view === 'catalog') selectEntry(matches[0]);
  results.scrollTop = 0;
  updateUrl();
}

function restoreFromUrl(restorePosition = false) {
  const params = new URLSearchParams(location.search);
  const id = params.get('song');
  const entry = entries.get(redirects.get(id) ?? id);
  const query = params.get('q') ?? '';
  const nextWriter = params.get('writer') ?? '';
  const nextDecade = params.get('decade') ?? '';
  const nextSort = params.get('sort') ?? 'oldest';
  const sameFilters = search.value === query && writer === nextWriter && decade.value === nextDecade && sort.value === nextSort;
  search.value = query;
  setWriter(['ASKA', 'Chage'].includes(nextWriter) ? nextWriter : '');
  decade.value = [...decade.options].some(option => option.value === nextDecade) ? nextDecade : '';
  sort.value = Object.hasOwn(sorters, nextSort) ? nextSort : 'oldest';
  if (!sameFilters || !restorePosition) renderCatalog();
  if (entry) openEntry(entry, false);
  else showCatalog(restorePosition);
}

search.addEventListener('input', filterChanged);
decade.addEventListener('change', filterChanged);
sort.addEventListener('change', filterChanged);
for (const item of filters) item.addEventListener('click', () => {
  setWriter(item.dataset.writer);
  filterChanged();
});
clearSearch.addEventListener('click', () => {
  search.value = '';
  setWriter('');
  decade.value = '';
  sort.value = 'oldest';
  filterChanged();
  search.focus();
});
results.addEventListener('click', event => {
  const item = event.target.closest('[data-song]');
  if (item) openEntry(entries.get(item.dataset.song));
});
previousSong.addEventListener('click', () => openEntry(matches[activeIndex() - 1]));
nextSong.addEventListener('click', () => openEntry(matches[activeIndex() + 1]));
backToCatalog.addEventListener('click', () => {
  showCatalog(true);
  updateUrl();
});
document.querySelector('#find-song').addEventListener('click', event => {
  event.preventDefault();
  showCatalog();
  updateUrl();
  document.querySelector('#index').scrollIntoView({ block: 'start' });
  search.focus({ preventScroll: true });
});
history.scrollRestoration = 'manual';
window.addEventListener('popstate', () => restoreFromUrl(true));

new ResizeObserver(() => {
  document.documentElement.style.setProperty('--controls-height', controls.offsetHeight + 'px');
}).observe(controls);
restoreFromUrl();
