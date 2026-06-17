/**
 * Episode selector UI (v1.0-rc13).
 *
 * Pure renderer + client-side integration for the live play server.
 * Reads /api/episodes and renders an episode chooser; clicking an
 * episode POSTs to /api/episode/switch and refreshes the UI.
 */

const EPISODE_SELECTOR_CSS = `/* wm-episode-selector-marker-css */
.wm-episode-selector {
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 8px;
  padding: 10px 12px;
  margin-bottom: 12px;
}
.wm-episode-selector h3 {
  margin: 0 0 8px;
  font-size: 0.85rem;
  color: #58a6ff;
}
.wm-episode-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 8px;
}
.wm-episode-card {
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 6px;
  padding: 8px 10px;
  cursor: pointer;
  transition: border-color 0.15s ease;
}
.wm-episode-card:hover { border-color: #58a6ff; }
.wm-episode-card[data-active="true"] { border-color: #f0883e; background: #1c1410; }
.wm-episode-title { font-weight: bold; font-size: 0.9rem; margin-bottom: 4px; }
.wm-episode-description { color: #8b95a1; font-size: 0.8rem; margin-bottom: 4px; }
.wm-episode-meta { color: #6e7681; font-size: 0.7rem; }
.wm-episode-switch { background: #1f6feb; color: white; border: none; border-radius: 4px; padding: 4px 8px; cursor: pointer; font-size: 0.75rem; margin-top: 6px; }
`;

const EPISODE_SELECTOR_JS = `/* wm-episode-selector-marker-js */
(function() {
  var HOST = window.location.origin;
  var listEl = null;
  function renderEpisodeList(episodes, currentEpisode) {
    if (!listEl) return;
    listEl.innerHTML = '';
    for (var i = 0; i < episodes.length; i++) {
      var ep = episodes[i];
      var card = document.createElement('div');
      card.className = 'wm-episode-card';
      card.setAttribute('data-episode-id', ep.id);
      card.setAttribute('data-active', String(ep.id === currentEpisode));
      card.innerHTML =
        '<div class="wm-episode-title">' + esc(ep.title) + '</div>' +
        '<div class="wm-episode-description">' + esc(ep.description || '') + '</div>' +
        '<div class="wm-episode-meta">incident: ' + esc(ep.incident) + '</div>' +
        '<button class="wm-episode-switch" data-episode-switch="' + esc(ep.id) + '">Switch to this episode</button>';
      listEl.appendChild(card);
    }
    listEl.querySelectorAll('.wm-episode-switch').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var episodeId = btn.getAttribute('data-episode-switch');
        fetch(HOST + '/api/episode/switch', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ episode: episodeId })
        }).then(function(r) { return r.json(); }).then(function(j) {
          if (j && j.ok) {
            window.location.reload();
          }
        });
      });
    });
  }
  function esc(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, function(c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function init() {
    var sel = document.querySelector('.wm-episode-selector');
    if (!sel) return;
    listEl = sel.querySelector('.wm-episode-list');
    fetch(HOST + '/api/episodes')
      .then(function(r) { return r.json(); })
      .then(function(j) {
        if (j && j.ok) renderEpisodeList(j.episodes, j.currentEpisode);
      });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
`;

export function renderEpisodeSelector() {
  return `<aside class="wm-episode-selector">
  <h3>Choose your episode</h3>
  <div class="wm-episode-list"></div>
</aside>`;
}

export function episodeSelectorAssets() {
  return { css: EPISODE_SELECTOR_CSS, js: EPISODE_SELECTOR_JS };
}

export function injectEpisodeSelectorInto(html, position = 'topbar-after') {
  // Inject the selector HTML into the page and append the CSS/JS once.
  const css = `<style>${EPISODE_SELECTOR_CSS}</style>`;
  const js = `<script>${EPISODE_SELECTOR_JS}</script>`;
  const selector = renderEpisodeSelector();
  let result = html;
  // Dedup CSS/JS BEFORE injecting the HTML (because the HTML contains
  // the dedup-anchor strings "class=\"wm-episode-card\"" and "/api/episodes").
  if (!result.includes('wm-episode-selector-marker-css')) {
    result = result.replace('</head>', `${css}</head>`);
  }
  if (!result.includes('wm-episode-selector-marker-js')) {
    result = result.replace('</body>', `${js}</body>`);
  }
  // Dedup: check for the unique aside tag, not just the class name.
  if (!result.includes('<aside class="wm-episode-selector">')) {
    if (position === 'topbar-after' && result.includes('</header>')) {
      result = result.replace('</header>', `</header>${selector}`);
    } else {
      result = result.replace('<body>', `<body>${selector}`);
    }
  }
  return result;
}