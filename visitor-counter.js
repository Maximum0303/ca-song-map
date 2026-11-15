(() => {
  const counter = document.querySelector('#visitor-counter');
  if (!counter) return;

  const endpoint = 'https://rwskpgzkuzarklxjbles.supabase.co/rest/v1/rpc/ca_song_map_visit';
  const apiKey = 'sb_publishable_sbCfBYe5T7fhtc0a7vJBvQ_urjiYS2-';
  const storageKey = 'ca-song-map.browser-id';
  const idPattern = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i;
  const cells = [...counter.querySelectorAll('[data-count]')];
  const numberFormat = new Intl.NumberFormat('ja-JP');
  let browserId = crypto.randomUUID();

  try {
    const savedId = localStorage.getItem(storageKey);
    if (savedId && idPattern.test(savedId)) browserId = savedId;
    else localStorage.setItem(storageKey, browserId);
  } catch {
    // The in-memory ID still deduplicates heartbeats from this page.
  }

  let pending = false;
  async function refresh() {
    if (pending || document.hidden) return;
    pending = true;
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { apikey: apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_browser: browserId }),
        signal: AbortSignal.timeout(8000)
      });
      if (!response.ok) throw new Error('Counter unavailable');
      const totals = await response.json();
      if (!cells.every(cell => Number.isSafeInteger(totals?.[cell.dataset.count]))) {
        throw new Error('Invalid counter response');
      }
      for (const cell of cells) {
        cell.textContent = numberFormat.format(totals[cell.dataset.count]) + '人';
      }
      counter.hidden = false;
    } catch {
      for (const cell of cells) cell.textContent = '—';
    } finally {
      pending = false;
    }
  }

  document.addEventListener('visibilitychange', refresh);
  window.setInterval(refresh, 25_000);
  refresh();
})();
