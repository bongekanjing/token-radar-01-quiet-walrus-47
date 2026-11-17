// Token Radar's dashboard. Reads window.RADAR (written beside dashboard/ by
// main.ts) and renders the ranked board, filters, a per-protocol detail panel
// with the model's own inputs and the protocol's farm plan, a live-token
// section, and the methodology. No network: every byte shown is in data.js.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  var state = { q: '', category: 'all', chain: 'all', tab: 'all', sort: 'implied', dir: -1, selected: null };

  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return '$' + Math.round(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  function fmtRatio(r) { return r === null || r === undefined ? 'n/a' : 'x' + r.toFixed(2); }
  function fmtProb(p) { return p === null || p === undefined ? 'n/a' : Math.round(p * 100) + '%'; }
  function fmtShare(s) { return s === null || s === undefined ? 'n/a' : (s * 100).toFixed(0) + '%'; }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }

  // The model, recomputed in the page from the snapshot figures, so the page's
  // arithmetic and the board's numbers are visibly the same function.
  function impliedOf(row, model) {
    var ratio = row.category_ratio;
    var fdv = row.tvl_usd * ratio;
    var share = row.airdrop_share;
    var prob = row.launch_probability;
    return Math.max(1, Math.round(fdv * share * prob));
  }

  function readHash() {
    var hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    var params = new URLSearchParams(hash);
    if (params.get('q')) state.q = params.get('q');
    if (params.get('category')) state.category = params.get('category');
    if (params.get('chain')) state.chain = params.get('chain');
    if (params.get('tab')) state.tab = params.get('tab');
    if (params.get('p')) state.selected = params.get('p');
  }
  function writeHash() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.chain !== 'all') params.set('chain', state.chain);
    if (state.tab !== 'all') params.set('tab', state.tab);
    if (state.selected) params.set('p', state.selected);
    var next = params.toString();
    if (next) window.history.replaceState(null, '', '#' + next);
    else window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  function isWatchlist(slug) { return DATA.watchlist && DATA.watchlist.indexOf(slug) >= 0; }

  function rows() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.tab === 'watchlist' && !isWatchlist(r.slug)) return false;
      if (state.category !== 'all' && (r.category || 'Other') !== state.category) return false;
      if (state.chain !== 'all' && !(r.chains || []).some(function (c) { return c === state.chain; })) return false;
      if (!q) return true;
      var hay = [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }
  function sortedRows(list) {
    var key = state.sort;
    return list.slice().sort(function (a, b) {
      var av, bv;
      if (key === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (key === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (key === 'growth') { av = a.change_7d === null ? -Infinity : a.change_7d; bv = b.change_7d === null ? -Infinity : b.change_7d; }
      else if (key === 'age') { av = a.age_days === null ? Infinity : a.age_days; bv = b.age_days === null ? Infinity : b.age_days; }
      else { av = a.implied_value_usd; bv = b.implied_value_usd; }
      if (av < bv) return -state.dir;
      if (av > bv) return state.dir;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
  }

  function header() {
    return el('header', { class: 'top' },
      el('div', { class: 'brand' }, el('span', { class: 'ring', 'aria-hidden': 'true' }),
        el('div', null, el('b', { text: 'TOKEN RADAR' }), el('span', { text: 'Pre-token protocol radar' }))),
      el('div', { class: 'top-meta' },
        el('span', null, 'Snapshot ', el('b', { text: DATA.as_of })),
        el('span', null, 'Source ', el('b', { text: 'DefiLlama protocol index' })),
        el('span', null, 'Model ', el('b', { text: DATA.model_version }))
      )
    );
  }

  function hero() {
    return el('section', { class: 'hero' },
      el('div', null,
        el('h1', { text: 'Which tokenless protocol is worth farming next?' }),
        el('p', null,
          'The watchlist is the floor: every protocol with at least ',
          el('b', { text: '$' + Math.round(DATA.floor_usd / 1e6) + 'M of TVL' }),
          ' and no token on record. The early radar adds ',
          el('b', { text: DATA.early_size + ' pre-token protocols' }),
          ' below that floor, ranked by the same model. Implied value is an estimate of what a farm could be worth if a token launched at a market multiple — not a promise, and never a price.')),
      el('div', { class: 'facts' },
        el('div', { class: 'fact' }, el('span', { text: 'Watchlist covered' }), el('b', { text: DATA.watchlist_size + ' / ' + DATA.watchlist_size })),
        el('div', { class: 'fact' }, el('span', { text: 'Pre-token rows ranked' }), el('b', { text: String(DATA.board_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'Early rows below the floor' }), el('b', { text: String(DATA.early_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'Top implied value' }), el('b', { text: fmtUsd(DATA.rows[0] ? DATA.rows[0].implied_value_usd : 0) })),
        el('div', { class: 'fact' }, el('span', { text: 'Live-token protocols set aside' }), el('b', { class: 'warn', text: String(DATA.live_size) }))
      )
    );
  }

  function controls() {
    var categories = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    var chains = Array.from(new Set(DATA.rows.reduce(function (acc, r) { return acc.concat(r.chains || []); }, []))).sort();
    var search = el('input', { type: 'search', id: 'q', placeholder: 'Search name, slug, category or chain', value: state.q, 'aria-label': 'Search the board' });
    search.addEventListener('input', function () { state.q = search.value; writeHash(); render(); });
    var catSel = el('select', { id: 'category', 'aria-label': 'Filter by category' },
      el('option', { value: 'all', text: 'All categories' }),
      categories.map(function (c) { return el('option', { value: c, text: c, selected: c === state.category ? 'selected' : null }); })
    );
    catSel.addEventListener('change', function () { state.category = catSel.value; writeHash(); render(); });
    var chainSel = el('select', { id: 'chain', 'aria-label': 'Filter by chain' },
      el('option', { value: 'all', text: 'All chains' }),
      chains.map(function (c) { return el('option', { value: c, text: c, selected: c === state.chain ? 'selected' : null }); })
    );
    chainSel.addEventListener('change', function () { state.chain = chainSel.value; writeHash(); render(); });
    function tabBtn(tab, label) {
      return el('button', { type: 'button', 'aria-pressed': state.tab === tab ? 'true' : 'false', text: label,
        onclick: function () { state.tab = tab; writeHash(); render(); } });
    }
    return el('div', { class: 'controls' },
      el('div', { class: 'field' }, el('label', { for: 'q', text: 'Search' }), search),
      el('div', { class: 'field' }, el('label', { for: 'category', text: 'Category' }), catSel),
      el('div', { class: 'field' }, el('label', { for: 'chain', text: 'Chain' }), chainSel),
      el('div', { class: 'field' }, el('span', { class: 'lab', text: 'Board' }),
        el('div', { class: 'tabs' }, tabBtn('all', 'All pre-token'), tabBtn('watchlist', 'Watchlist'), tabBtn('live', 'Live tokens'))),
      el('span', { class: 'count', text: state.tab === 'live' ? DATA.live.length + ' live-token protocols' : rows().length + ' rows shown' })
    );
  }

  function sortHeader(key, label) {
    return el('th', { scope: 'col' },
      el('button', { type: 'button', onclick: function () { if (state.sort === key) state.dir = -state.dir; else { state.sort = key; state.dir = -1; } render(); } },
        label,
        state.sort === key ? el('span', { 'aria-hidden': 'true', text: state.dir < 0 ? ' v' : ' ^' }) : null
      )
    );
  }

  function boardTable() {
    var list = sortedRows(rows());
    if (list.length === 0) {
      return el('div', { class: 'panel' }, el('div', { class: 'empty' },
        el('h2', { text: 'No protocol matches that filter' }),
        el('p', { text: 'Clear the search or pick another category or chain to see the board again.' }),
        el('button', { class: 'button primary', type: 'button', text: 'Clear filters', onclick: function () { state.q = ''; state.category = 'all'; state.chain = 'all'; writeHash(); render(); } })
      ));
    }
    var max = list[0].implied_value_usd || 1;
    var tbody = el('tbody');
    list.forEach(function (r) {
      var growth = r.change_7d === null ? 'n/a' : fmtPct(r.change_7d);
      var growthClass = r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg';
      var tr = el('tr', {
        class: r.rank <= 3 ? 'top3' : null,
        'data-selected': state.selected === r.slug ? 'true' : 'false',
        tabindex: '0',
        onclick: function () { openDetail(r.slug); },
        onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug); } }
      },
        el('td', null, el('span', { class: 'rank-badge num', text: String(r.rank) })),
        el('td', null, el('div', { class: 'name' },
          el('b', { text: r.name }),
          el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') + (isWatchlist(r.slug) ? ' · watchlist' : '') })
        )),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + growthClass, text: growth }),
        el('td', { class: 'num', text: fmtAge(r.age_days) }),
        el('td', null, el('div', { class: 'implied' },
          el('div', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(3, Math.round((r.implied_value_usd / max) * 100)) + '%' })),
          el('span', { class: 'num', text: fmtUsd(r.implied_value_usd) })
        )),
        el('td', null, el('span', { class: 'pill', text: 'no token' }))
      );
      tbody.appendChild(tr);
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { text: 'Pre-token protocols, strongest implied value first. Select a row for its model breakdown and farm plan.' }),
          el('thead', null, el('tr', null,
            sortHeader('implied', 'Rank'),
            sortHeader('name', 'Protocol'),
            sortHeader('tvl', 'TVL'),
            sortHeader('growth', '7d'),
            sortHeader('age', 'Age'),
            sortHeader('implied', 'Implied value'),
            el('th', { scope: 'col', text: 'Token' })
          )),
          tbody
        )
      )
    );
  }

  function liveTable() {
    var tbody = el('tbody');
    DATA.live.forEach(function (r) {
      tbody.appendChild(el('tr', null,
        el('td', null, el('span', { class: 'pill live', text: 'live' })),
        el('td', null, el('div', { class: 'name' }, el('b', { text: r.name }), el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') }))),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + (r.change_7d !== null && r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) }),
        el('td', { class: 'num', text: fmtUsd(r.mcap_usd) }),
        el('td', { class: 'num', text: r.mcap_usd && r.tvl_usd ? fmtRatio(r.mcap_usd / r.tvl_usd) : 'n/a' })
      ));
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { text: 'Already trading: these protocols have a token, so their market cap is a fact, not a model. They are set aside from the pre-token ranking — and their mcap/TVL ratios are what price the pre-token board.' }),
          el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Status' }), el('th', { scope: 'col', text: 'Protocol' }), el('th', { scope: 'col', text: 'TVL' }), el('th', { scope: 'col', text: '7d' }), el('th', { scope: 'col', text: 'Market cap' }), el('th', { scope: 'col', text: 'Mcap / TVL' }))),
          tbody
        )
      )
    );
  }

  function detailPanel() {
    var row = null;
    if (state.selected) {
      for (var i = 0; i < DATA.rows.length; i++) if (DATA.rows[i].slug === state.selected) { row = DATA.rows[i]; break; }
    }
    if (!row) {
      return el('aside', { class: 'detail', id: 'detail' },
        el('div', { class: 'detail-head' }, el('div', null,
          el('span', { class: 'sub', text: 'Protocol detail' }),
          el('h2', { text: 'Select a protocol' }))),
        el('p', { class: 'sub', text: 'Click any row in the board to see its model breakdown — implied FDV, category multiple, airdrop share, launch probability — and its six-step farm plan with costs and time.' })
      );
    }
    var recomputed = impliedOf(row, DATA.model);
    // The stored ratio/probability are rounded to 4dp, so a recompute from
    // them lands within ~0.03% of the stored value. Treat anything within
    // 0.1% as agreement; only a larger gap means the data is stale.
    var agrees = Math.abs(recomputed - row.implied_value_usd) <= Math.max(1, 0.001 * row.implied_value_usd);
    var steps = (row.farm_steps || []).map(function (s) {
      var at = s.indexOf(' Cost: ');
      var action = at >= 0 ? s.slice(0, at) : s;
      var tail = at >= 0 ? s.slice(at + 1) : '';
      return el('li', null, el('b', { text: action }), el('span', { class: 'cost', text: tail }));
    });
    return el('aside', { class: 'detail', id: 'detail' },
      el('div', { class: 'detail-head' },
        el('div', null,
          el('span', { class: 'sub', text: 'Rank ' + row.rank + ' of ' + DATA.board_size + (isWatchlist(row.slug) ? ' · watchlist' : ' · early radar') }),
          el('h2', { text: row.name }),
          el('p', { class: 'sub', text: (row.category || 'Other') + ' on ' + (row.chains && row.chains.length ? row.chains.join(', ') : 'an unnamed chain') + ' · listed ' + (row.listed_at || 'unknown') })
        ),
        el('button', { class: 'close', type: 'button', 'aria-label': 'Close details', text: 'Close', onclick: function () { state.selected = null; writeHash(); render(); } })
      ),
      el('section', { class: 'detail-section' },
        el('h3', { text: 'Implied value — the model, line by line' }),
        el('div', { class: 'equation' },
          el('div', null, el('span', { text: 'TVL' }), el('b', { class: 'num', text: fmtUsd(row.tvl_usd) })),
          el('div', null, el('span', { text: 'Category multiple (mcap/TVL)' }), el('b', { class: 'num', text: fmtRatio(row.category_ratio) })),
          el('div', null, el('span', { text: 'Implied FDV' }), el('b', { class: 'num', text: fmtUsd(row.implied_fdv_usd) })),
          el('div', null, el('span', { text: 'Airdrop share' }), el('b', { class: 'num', text: fmtShare(row.airdrop_share) })),
          el('div', null, el('span', { text: 'Launch probability' }), el('b', { class: 'num', text: fmtProb(row.launch_probability) })),
          el('div', null, el('span', { text: 'Age with no token' }), el('b', { class: 'num', text: fmtAge(row.age_days) })),
          el('div', null, el('span', { text: 'Seven-day TVL change' }), el('b', { class: 'num', text: fmtPct(row.change_7d) })),
          el('div', { class: 'total' }, el('span', { text: 'Implied value' }), el('b', { class: 'num', text: fmtUsd(row.implied_value_usd) }))
        ),
        el('p', { class: 'sub', text: 'The page recomputes this row as ' + fmtUsd(recomputed) + (agrees ? ', the same number the board carries.' : ', which differs from the board — the data would be stale.') + ' An estimate, not a price: the protocol records no token, and a token may never launch.' })
      ),
      el('section', { class: 'detail-section' },
        el('h3', { text: 'Farm plan' }),
        el('ol', { class: 'steps' }, steps)
      )
    );
  }

  function methodPanel() {
    var m = DATA.model;
    return el('section', { class: 'panel method' },
      el('h2', { text: 'How implied value is computed — model ' + DATA.model_version }),
      el('p', { class: 'sub', text: 'One function scores every row, from the snapshot alone. No protocol name is special-cased and no row is hand-picked. The snapshot is DefiLlama data as of ' + DATA.as_of + '; it records no token for the ranked protocols, which is not proof they have none.' }),
      el('div', { class: 'formula' },
        el('div', null, el('b', { text: 'implied FDV' }), ' = tvl_usd x category multiple'),
        el('div', null, el('b', { text: 'implied value' }), ' = implied FDV x airdrop share x launch probability')
      ),
      el('ul', null,
        el('li', null, el('b', { text: 'Category multiple. ' }), 'Median mcap/TVL of the live-token protocols in the same category (at least ' + m.ratio_min_category_n + ' of them, else the global median ' + fmtRatio(DATA.global_ratio) + '), clamped to ' + fmtRatio(m.ratio_min) + '–' + fmtRatio(m.ratio_max) + ' so one outlier cannot set the price for a whole category.'),
        el('li', null, el('b', { text: 'Airdrop share. ' }), 'TVL at or above $1B takes ' + fmtShare(m.share_tier_big) + ', $100M–$1B takes ' + fmtShare(m.share_tier_mid) + ', below $100M takes ' + fmtShare(m.share_tier_small) + ': bigger protocols spread a launch over more users.'),
        el('li', null, el('b', { text: 'Launch probability. ' }), 'Base ' + fmtProb(m.prob_base) + ', plus up to ' + fmtProb(m.prob_age_weight) + ' for age (capped at ' + m.prob_age_days + ' days), up to ' + fmtProb(m.prob_size_weight) + ' for size (log scale from $5M), up to ' + fmtProb(m.prob_growth_weight) + ' for 7-day growth clamped to ' + m.growth_floor + '%–' + m.growth_cap + '%, clamped in total to ' + fmtProb(m.prob_min) + '–' + fmtProb(m.prob_max) + '. Unknown age counts as ' + m.unknown_age_days + ' days; unknown growth counts as 0%.'),
        el('li', null, el('b', { text: 'Farm plans. ' }), 'Six steps per protocol, derived from its category, chains, TVL and age: the core action, a weekly recurring action, a hold window, and the costs and gas for each. Capital is sized by TVL ($50–$500); gas is priced by chain.'),
        el('li', null, el('b', { text: 'Live tokens. ' }), 'Protocols that already trade are set aside with their market caps, never ranked — but their mcap/TVL ratios are the multiples that price the pre-token board.')
      )
    );
  }

  function render() {
    app.textContent = '';
    var shell = el('div', { class: 'shell' });
    shell.appendChild(header());
    shell.appendChild(hero());
    shell.appendChild(controls());
    var layout = el('div', { class: 'layout' });
    layout.appendChild(state.tab === 'live' ? liveTable() : boardTable());
    layout.appendChild(detailPanel());
    shell.appendChild(layout);
    shell.appendChild(methodPanel());
    shell.appendChild(el('p', { class: 'foot', text: 'Token Radar, model ' + DATA.model_version + '. Data: DefiLlama protocol index, snapshot ' + DATA.as_of + '. Implied values are the entry\u2019s own estimates, never a promise of a launch or a price. Farming costs gas and carries risk; never pay anyone to claim an airdrop.' }));
    app.appendChild(shell);
    app.setAttribute('aria-busy', 'false');
  }

  function openDetail(slug) {
    state.selected = slug;
    writeHash();
    render();
    var d = document.getElementById('detail');
    if (d && d.scrollIntoView) d.scrollIntoView({ block: 'nearest' });
  }

  readHash();
  render();
})();
