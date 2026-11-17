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
const category = document.querySelector('#song-category');
const sort = document.querySelector('#sort');
const filters = document.querySelectorAll('[data-writer]');
const compactScreen = matchMedia('(max-width: 760px)');
const badges = {'原曲':'original', '海外カバー':'cover', '別題・別歌詞':'self', 'ライブ客演':'duet', 'ライブ共演':'duet', '提供音源':'original', 'セルフカバー':'self', 'カバー':'cover', '共演再録':'duet', '客演':'duet', 'ライブカバー':'cover', 'インスト':'instrumental', 'カラオケ':'instrumental', '英語歌唱版':'cover', 'ライブ映像':'self', 'ライブ歌唱':'self', 'ライブ音源':'self', '映像収録':'self', 'アルバム収録':'original', 'リミックス':'original', 'クラブMIX':'cover', 'アルバム版':'cover', '放送歌唱映像':'self', 'ラジオ歌唱':'self', '再録':'original', '再収録':'original', 'ベスト盤収録':'original'};
const duoNamePattern = /\bchage\s*(?:[&＆]|and)\s*asu?ka\b|チャゲ\s*(?:[&＆]|と)\s*飛鳥/gi;
const recordingTypes = new Set([
  '原曲', '提供音源', 'スタジオ音源', 'スタジオ歌唱', 'セルフカバー', 'カバー',
  '海外カバー', '海外カバー再収録', '再録', '再録音源', '再収録', '共演再録',
  'LP収録', 'アルバム収録', 'アルバム版', 'オムニバス収録', 'サントラ収録',
  'シングル収録', 'シングル版', 'ベスト盤収録', 'ボックス収録', '海外ベスト盤収録',
  '海外盤収録', '配信収録', 'インスト', 'カラオケ', 'クラブMIX', 'リミックス',
  'ロングバージョン', '別アレンジ', '別バージョン', '別ミックス', '別題・別歌詞',
  '日本語版', '英語歌唱版',
]);
const isCover = ([type, , , work]) =>
  /^(?:海外|ライブ)?カバー(?:（形態未確認）|再収録)?$/.test(type)
  || (type === '配信収録' && work.endsWith('（いま歌うシリーズ）'));
// Match singing credits, including duo aliases and guest vocalists.
function isFamilyArtist(artist) {
  const names = normalizeArtistAliases(String(artist ?? ''))
    .replace(/（(?:ピアノ|演奏|伴奏|編曲|作品名義)[^）]*）|\((?:ピアノ|演奏|伴奏|編曲|作品名義)[^)]*\)/g, '');
  return /(?:^|[\s/／・＋+&＆:：()（）])(?:chageaska|chage|aska|multi\s*max|チャゲ|飛鳥涼)(?=$|[\s/／・＋+&＆:：()（）]|ほか|を含む|が参加)/i.test(names);
}

function coverDirections(song) {
  const originals = song.versions.filter(([type]) => type === '原曲' || type === '提供音源');
  const familySong = song.writers?.length > 0 || originals.some(([, , artist]) => isFamilyArtist(artist));
  const outsideOrigin = originals.length > 0
    && originals.every(([type, , artist]) => type === '原曲' && !isFamilyArtist(artist));
  return {
    byFamily: row => isFamilyArtist(row[2]) && ((isCover(row) && (row[0] !== '配信収録' || outsideOrigin))
      || (outsideOrigin && !familySong && /^(?:ライブ共演|ライブ客演|ライブ歌唱|ライブ映像|ライブ音源|放送歌唱映像)$/.test(row[0]))),
    ofFamily: row => familySong && isCover(row) && !isFamilyArtist(row[2]),
  };
}
const isLive = ([type, , , , , , meta]) =>
  /^(?:ライブ|放送)|^(?:イベント歌唱|テレビ放送|ラジオ歌唱|ミュージックビデオ|映像収録)$/.test(type)
  || Boolean(meta?.performanceYear || meta?.broadcastYear);

const versionFilters = [
  { id: 'recording', label: '音源・再収録', matches: ([type, , , , , , meta]) =>
    recordingTypes.has(type) && !meta?.performanceYear && !meta?.broadcastYear },
  { id: 'live', label: 'ライブ・映像・放送', matches: isLive },
  { id: 'cover-by-family', label: 'C&A・Chage・ASKA・MULTI MAXが歌ったカバー', matches: (row, covers) => covers.byFamily(row) },
  { id: 'cover-of-family', label: '他の歌手が歌ったC&A関連曲', matches: (row, covers) => covers.ofFamily(row) },
];

const catalogCategoryTests = {
  provided: ([type]) => type === '提供音源',
  cover: (row, covers) => isCover(row) || covers.byFamily(row),
  'cover-by-family': (row, covers) => covers.byFamily(row),
  'cover-of-family': (row, covers) => covers.ofFamily(row),
  'self-cover': ([type]) => type === 'セルフカバー',
  guest: ([type]) => /^(?:ライブ客演|ライブ共演|客演|共演再録|共作・デュエット)$/.test(type),
  live: isLive,
};

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

function versionDate(row) {
  const [type, year, , , , , meta] = row;
  if (meta?.performanceYear) {
    return { year: meta.performanceYear, label: meta.performanceYear.includes('–') ? '公演期間' : '公演' };
  }
  if (meta?.broadcastYear) return { year: meta.broadcastYear, label: '放送' };
  if (meta?.releaseYear) return { year: meta.releaseYear, label: meta.releaseLabel || '発売' };
  if (!/^\d{4}$/.test(year)) return { year: '', label: year };
  if (meta?.dateBasis) return { year, label: meta.dateBasis };
  if (type === '受賞記録') return { year, label: '受賞' };
  if (/^(?:ライブ歌唱|ライブ客演|ライブ共演|ライブカバー|イベント歌唱)$/.test(type)) return { year, label: '公演' };
  if (type === '配信収録') return { year, label: '配信' };
  if (/^ライブ(?:映像|音源)|スタジオ歌唱|形態未確認|ミュージックビデオ/.test(type)) {
    return { year, label: '資料記載' };
  }
  return { year, label: '発売・配信' };
}

function dateSortKey(date, fallback = '9999') {
  return date.year.slice(0, 4) || fallback;
}

function yearText(year) {
  return year.replace('–', '〜') + '年';
}

function versionYearLabels(row, date) {
  const meta = row[6];
  const labels = [];
  if (date.label === '公演' || date.label === '公演期間') {
    if (meta?.broadcastYear) labels.push(`放送 ${yearText(meta.broadcastYear)}`);
  }
  if (meta?.releaseYear && (meta.performanceYear || meta.broadcastYear)) {
    labels.push(`${meta.releaseLabel || '発売'} ${yearText(meta.releaseYear)}`);
  }
  return labels;
}

const collator = new Intl.Collator('ja', { numeric: true, sensitivity: 'base' });
const catalogSongs = songs.flatMap((song, index) => {
  if (song.redirectTo) return [];
  const versions = song.versions.map(row => ({ row, date: versionDate(row) }))
    .sort((a, b) => dateSortKey(a.date).localeCompare(dateSortKey(b.date)));
  const first = versions.find(({ date }) => date.year && !date.year.includes('–') && date.label !== '資料記載');
  const firstYear = first?.date.year || '';
  const firstVersion = first?.row || song.versions[0];
  const fields = [song.title, song.lyrics, song.music, ...song.versions.flatMap(
    ([type, year, artist, work, , , meta]) => [type, year, artist, work, meta?.track, meta?.note, meta?.creditedAs, meta?.reissue?.note, meta?.performanceYear, meta?.broadcastYear, meta?.releaseYear]
  )].filter(Boolean).join(' ');
  const covers = coverDirections(song);
  const categories = Object.keys(catalogCategoryTests).filter(key => song.versions.some(row => catalogCategoryTests[key](row, covers)));
  return [{ song, categories, number: index + 1, firstYear, firstVersion, versions, text: normalize(fields + ' ' + normalizeArtistAliases(fields)) }];
});
const entries = new Map(catalogSongs.map(entry => [entry.song.id, entry]));
const redirects = new Map(songs.filter(song => song.redirectTo).map(song => [song.id, song.redirectTo]));
const sorters = {
  oldest: (a, b) => (a.firstYear || '9999').localeCompare(b.firstYear || '9999') || a.number - b.number,
  newest: (a, b) => b.firstYear.localeCompare(a.firstYear) || a.number - b.number,
  title: (a, b) => collator.compare(a.song.title, b.song.title) || a.number - b.number,
  added: (a, b) => b.number - a.number,
};
let matches = [];
let writer = '';
let selected = null;
let listScroll = 0;
let compactScroll = 0;

for (const value of [...new Set(catalogSongs.filter(({ firstYear }) => firstYear).map(({ firstYear }) => firstYear.slice(0, 3) + '0'))].sort()) {
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

function highlightCategoryMatches() {
  const selectedCategory = category?.value || '';
  category?.classList.toggle('category-active', Boolean(selectedCategory));
  if (!selected) return;
  const test = catalogCategoryTests[selectedCategory];
  const covers = coverDirections(selected.song);
  const rows = detailContent.querySelectorAll('#version-timeline > li');
  rows.forEach((item, index) => {
    item.classList.toggle('category-match', Boolean(test?.(selected.versions[index].row, covers)));
  });
}

function showDetail() {
  detail.hidden = !selected;
  if (!selected) {
    detailContent.replaceChildren();
    return;
  }

  const { song, number, firstYear, versions } = selected;
  const covers = coverDirections(song);
  const filterOptions = versionFilters.map(filter => ({
    ...filter, count: versions.filter(({ row }) => filter.matches(row, covers)).length,
  })).filter(filter => filter.count > 0 && filter.count < versions.length);
  detailContent.innerHTML = `
    <p class="eyebrow">No. ${String(number).padStart(2,'0')}</p>
    <h3>${song.title}</h3>
    <p class="credit">初出年　${firstYear ? yearText(firstYear) : "未確認"}</p>
    <p class="credit">作詞　${song.lyrics}　／　作曲　${song.music}</p>
    ${song.note ? `<p class="note">${song.note}</p>` : ''}
    <div class="version-toolbar">
      <h4 class="version-heading">収録・公演記録 <span id="version-count" role="status">${versions.length}件</span></h4>
      ${filterOptions.length ? `<label class="select-label version-filter">記録の種類
        <select aria-controls="version-timeline">
          <option value="">すべて</option>
          ${filterOptions.map(({ id, label, count }) => `<option value="${id}">${label}（${count}件）</option>`).join('')}
        </select>
      </label>` : ''}
    </div>
    <ol class="timeline" id="version-timeline">${versions.map(({ row, date }) => {
      const [type, year, artist, release, url, source, meta] = row;
      const relatedYears = versionYearLabels(row, date);
      return `
      <li><details class="version">
        <summary>
          <span class="version-date">${/^\d{4}$/.test(date.year) ? `<time datetime="${date.year}">${date.year}</time>` : date.year}<small>${date.label}</small></span>
          <span class="version-title"><strong>${displayArtist(year, artist, release)}</strong> <span class="badge ${badges[type]}">${type}</span></span>
          <span class="version-work">
            <span class="version-release">${meta?.track ? `「${meta.track}」 · ` : ''}『${release}』</span>
            ${relatedYears.length ? `<span class="version-release">${relatedYears.join(' ／ ')}</span>` : ''}
          </span>
        </summary>
        <div class="version-info">
          ${meta?.note ? `<p>${meta.note}</p>` : ''}
          ${meta?.reissue ? `<p>${meta.reissue.note} <a class="source" style="display:inline" href="${meta.reissue.url}" target="_blank" rel="noopener">ヤマハ公式・再発CD ↗</a></p>` : ''}
          ${meta?.reissue?.reference ? `<a class="source" href="${meta.reissue.reference[0]}" target="_blank" rel="noopener">${meta.reissue.reference[1]} ↗</a>` : ''}
          ${meta?.creditedAs ? `<p>資料上の名義　${meta.creditedAs}</p>` : ''}
          <a class="source" href="${url}" target="_blank" rel="noopener">${source} ↗</a>
          ${meta?.reference ? `<a class="source" href="${meta.reference[0]}" target="_blank" rel="noopener">${meta.reference[1]} ↗</a>` : ''}
          ${meta?.creditSource ? `<a class="source" href="${meta.creditSource}" target="_blank" rel="noopener">名義の確認資料 ↗</a>` : ''}
        </div>
      </details></li>`;
    }).join('')}</ol>`;
  highlightCategoryMatches();
  const filterControl = detailContent.querySelector('.version-filter select');
  filterControl?.addEventListener('change', () => {
    const filter = filterOptions.find(({ id }) => id === filterControl.value);
    const timeline = detailContent.querySelector('#version-timeline');
    versions.forEach(({ row }, index) => {
      timeline.children[index].hidden = Boolean(filter && !filter.matches(row, covers));
    });
    detailContent.querySelector('#version-count').textContent = filter
      ? `${filter.count}件 / 全${versions.length}件`
      : `${versions.length}件`;
  });
}

function renderCatalog() {
  const query = search.value.trim();
  const selectedCategory = category?.value || '';
  const terms = normalizeArtistAliases(query).split(/\s+/).map(normalize).filter(Boolean);
  const number = query.normalize('NFKC').match(/^(?:#|no\.?\s*)?(\d{1,3})$/i)?.[1];
  matches = catalogSongs.filter(entry =>
    (!writer || entry.song.writers.includes(writer)) &&
    (!selectedCategory || entry.categories.includes(selectedCategory)) &&
    (!decade.value || entry.firstYear.startsWith(decade.value.slice(0, 3))) &&
    (Number(number) === entry.number || terms.every(term => entry.text.includes(term)))
  ).sort(sorters[sort.value]);
  count.textContent = query || writer || selectedCategory || decade.value
    ? `${matches.length}件 / 全${catalogSongs.length}曲`
    : `${catalogSongs.length}曲`;
  clearSearch.hidden = !query && !writer && !selectedCategory && !decade.value && sort.value === 'oldest';
  const groupByDecade = sort.value === 'oldest' || sort.value === 'newest';
  let previousDecade = null;
  results.innerHTML = matches.length ? matches.map(({ song, number, firstYear, firstVersion }) => {
    const [, year, artist, work] = firstVersion;
    const decadeLabel = firstYear ? `${firstYear.slice(0, 3)}0年代` : '初出年未確認';
    const heading = groupByDecade && decadeLabel !== previousDecade
      ? `<h3 class="catalog-decade">${decadeLabel}</h3>`
      : '';
    previousDecade = decadeLabel;
    return `${heading}<button type="button" class="song" data-song="${song.id}" aria-controls="detail">
      <span class="song-index"><span class="year">${firstYear || "未確認"}</span><small>No. ${number}</small></span>
      <span><strong>${song.title}</strong><small>${displayArtist(year, artist, work)} · ${song.versions.length}件</small></span>
      <span class="arrow" aria-hidden="true">›</span>
    </button>`;
  }).join('') : '<p class="empty">該当する曲がありません。検索語や絞り込みを変えてみてください。</p>';
  syncSelection();
  highlightCategoryMatches();
}

function updateUrl(push = false) {
  const url = new URL(location.href);
  const params = { q: search.value.trim(), writer, category: category?.value, decade: decade.value,
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
  const categoryParam = params.get('category') ?? '';
  const nextCategory = Object.hasOwn(catalogCategoryTests, categoryParam) ? categoryParam : '';
  const nextDecade = params.get('decade') ?? '';
  const nextSort = params.get('sort') ?? 'oldest';
  const sameFilters = search.value === query && writer === nextWriter && (category?.value || '') === nextCategory && decade.value === nextDecade && sort.value === nextSort;
  search.value = query;
  setWriter(['ASKA', 'Chage'].includes(nextWriter) ? nextWriter : '');
  if (category) category.value = nextCategory;
  decade.value = [...decade.options].some(option => option.value === nextDecade) ? nextDecade : '';
  sort.value = Object.hasOwn(sorters, nextSort) ? nextSort : 'oldest';
  if (!sameFilters || !restorePosition) renderCatalog();
  if (entry) openEntry(entry, false);
  else showCatalog(restorePosition);
}

search.addEventListener('input', filterChanged);
category?.addEventListener('change', filterChanged);
decade.addEventListener('change', filterChanged);
sort.addEventListener('change', filterChanged);
for (const item of filters) item.addEventListener('click', () => {
  setWriter(item.dataset.writer);
  filterChanged();
});
clearSearch.addEventListener('click', () => {
  search.value = '';
  setWriter('');
  if (category) category.value = '';
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
