/**
 * Visual gameplay shell layout — v1 game-feel HTML fragments.
 * Used by web-renderer.js; no framework, pure string templates.
 */

import { escapeHtml, applyLenoGuard } from './html-utils.js';

export function renderGameTopBar(shell, world) {
  const t = shell?.topbar ?? {};
  return `<header class="wm-game-topbar" id="wm-topbar" data-visual-topbar>
  <div class="wm-topbar-brand">
    <img src="assets/ui/incident-alert.png" alt="" class="wm-topbar-logo" />
    <span class="wm-topbar-world" data-topbar-world>${escapeHtml(t.worldName ?? world?.name ?? 'WorldMind')}</span>
  </div>
  <div class="wm-topbar-stats">
    <span data-topbar-day><strong>Day</strong> ${escapeHtml(t.day ?? '?')}</span>
    <span data-topbar-time><strong>Time</strong> ${escapeHtml(t.time ?? '?')}</span>
    <span data-topbar-money><strong>Money</strong> ${escapeHtml(t.money ?? 0)}</span>
    <span data-topbar-reputation><strong>Rep</strong> ${escapeHtml(t.reputation ?? 0)}</span>
    <span data-topbar-energy><strong>Energy</strong> ${escapeHtml(t.energy ?? 0)}</span>
    <span data-topbar-leno><strong>Leno</strong> ${escapeHtml(t.lenoStatus ?? 'standby')}</span>
    <span data-topbar-branch><strong>Branch</strong> ${escapeHtml(t.branchName ?? 'main')}</span>
  </div>
</header>`;
}

export function renderHotspotCard(h) {
  const evidence = (h.possibleEvidence ?? []).map((e) => `<code>${escapeHtml(e)}</code>`).join(' ');
  return `<article class="wm-hotspot-card" data-hotspot-id="${escapeHtml(h.id)}">
    ${h.icon ? `<img src="${escapeHtml(h.icon)}" alt="" class="wm-hotspot-icon" />` : '<span class="wm-hotspot-pin">◎</span>'}
    <div class="wm-hotspot-body">
      <strong>${escapeHtml(h.label)}</strong>
      <p class="wm-hotspot-desc">${escapeHtml(h.description ?? h.preview ?? '')}</p>
      <p class="wm-hotspot-meta">risk ${escapeHtml(h.risk)} · ${escapeHtml(h.command)}</p>
      ${evidence ? `<p class="wm-hotspot-evidence">may reveal: ${evidence}</p>` : ''}
      <button type="button" class="wm-hotspot-run" data-run-command="${escapeHtml(h.command)}">Inspect / Run</button>
    </div>
  </article>`;
}

export function renderLocationPlay(shell, world) {
  const loc = shell?.location ?? {};
  const locName = loc.name ?? world?.locations?.[loc.id]?.name ?? loc.id ?? 'unknown';
  const scene = loc.scene;
  const hotspots = loc.hotspots ?? [];
  return `<section class="wm-section wm-location wm-game-location" id="wm-location">
  <h2 class="wm-visually-hidden">Current Location</h2>
  <p class="wm-location-name">${escapeHtml(locName)}</p>
  ${loc.mood ? `<p class="wm-location-mood">${escapeHtml(loc.mood)}</p>` : ''}
  <div class="wm-scene-stage" data-scene-stage>
    ${scene ? `<img src="${escapeHtml(scene)}" alt="${escapeHtml(locName)} scene" class="wm-scene-img" data-scene-img />` : '<div class="wm-scene-placeholder">No scene asset</div>'}
    <div class="wm-hotspot-overlay">${hotspots.map(renderHotspotCard).join('')}</div>
  </div>
  <h3>Hotspots</h3>
  <div class="wm-hotspot-list" data-hotspot-list>${hotspots.map(renderHotspotCard).join('') || '<p class="wm-empty">No hotspots configured.</p>'}</div>
</section>`;
}

export function renderNpcInteractionCards(shell) {
  const list = shell?.npcCards ?? [];
  return `<section class="wm-section wm-agents wm-game-npcs" id="wm-agents">
  <h2>Visible Agents</h2>
  <div class="wm-npc-grid" data-npc-grid>${list.map((a) => {
    const topics = (a.topics ?? []).map((t) => `<span class="wm-topic-chip">${escapeHtml(t)}</span>`).join('');
    return `<article class="wm-npc-card" data-agent-id="${escapeHtml(a.id)}">
      <img src="${escapeHtml(a.portrait ?? a.avatar)}" alt="${escapeHtml(a.name)} portrait" class="wm-npc-portrait" data-npc-portrait />
      <div class="wm-npc-body">
        <strong>${escapeHtml(a.name)}</strong>
        <span class="wm-agent-role">${escapeHtml(a.role)}</span>
        <span class="wm-agent-loc">@ ${escapeHtml(a.locationName)}</span>
        <span class="wm-npc-mood" data-npc-mood>mood: ${escapeHtml(a.mood ?? 'neutral')}</span>
        <span class="wm-agent-stats">trust ${escapeHtml(a.trust)} · suspicion ${escapeHtml(a.suspicion)} · fear ${escapeHtml(a.fear)}</span>
        ${topics ? `<div class="wm-npc-topics">${topics}</div>` : ''}
        <div class="wm-agent-actions">${(a.actions ?? []).map((act) =>
    `<button type="button" data-run-command="${escapeHtml(act.command)}">${escapeHtml(act.label)}</button>`
  ).join('')}</div>
      </div>
    </article>`;
  }).join('')}</div>
</section>`;
}

export function renderCaseBoardGameplay(caseBoard, assets = {}) {
  const evIcon = assets.evidenceIcon ?? 'assets/ui/evidence-card.png';
  const ruIcon = assets.rumorIcon ?? 'assets/ui/rumor-card.png';

  const evidenceCards = (caseBoard?.evidenceCards ?? []).map((c) => {
    const card = typeof c === 'string' ? { id: c, label: c } : c;
    return `<li class="wm-case-card ${card.locked ? 'wm-locked' : ''}" data-case-card-id="${escapeHtml(card.id)}">
      <img src="${escapeHtml(evIcon)}" alt="Evidence" />
      <div>
        <strong>${escapeHtml(card.label ?? card.id)}</strong>
        ${card.locationId ? `<span class="wm-case-meta">@ ${escapeHtml(card.locationId)}</span>` : ''}
        ${card.inspectCommand ? `<button type="button" data-run-command="${escapeHtml(card.inspectCommand)}">Inspect</button>` : ''}
      </div>
    </li>`;
  }).join('');

  const rumorCards = (caseBoard?.rumorCards ?? []).map((c) => {
    const card = typeof c === 'string' ? { id: c, label: c } : c;
    return `<li class="wm-case-card ${card.sourceRedacted ? 'wm-redacted' : ''}" data-case-card-id="${escapeHtml(card.id)}">
      <img src="${escapeHtml(ruIcon)}" alt="Rumor" />
      <div>
        <strong>${escapeHtml(card.label ?? card.id)}</strong>
        ${card.sourceRedacted ? '<span class="wm-lock-badge">Source locked</span>' : ''}
        <div class="wm-case-actions">
          <button type="button" data-run-command="${escapeHtml(card.traceCommand)}">Trace</button>
          <button type="button" data-run-command="${escapeHtml(card.counterCommand)}">Counter</button>
        </div>
      </div>
    </li>`;
  }).join('');

  const suspects = (caseBoard?.suspectCards ?? []).map((s) =>
    `<li class="wm-suspect-card ${s.redacted ? 'wm-redacted' : ''}" data-suspect-id="${escapeHtml(s.id)}">
      <strong>${s.redacted ? 'REDACTED' : escapeHtml(s.label)}</strong>
      <span class="wm-case-meta">${escapeHtml(s.role)}</span>
      ${s.inspectCommand ? `<button type="button" data-run-command="${escapeHtml(s.inspectCommand)}">Investigate</button>` : '<span class="wm-lock-badge">Evidence required</span>'}
    </li>`
  ).join('');

  const links = (caseBoard?.links ?? []).map((link) =>
    `<li class="wm-case-link" data-link-from="${escapeHtml(link.from)}" data-link-to="${escapeHtml(link.to)}">
      <code>${escapeHtml(link.from)}</code> → <code>${escapeHtml(link.to)}</code>
      <span class="wm-case-meta">${escapeHtml(link.relation)}${link.redacted ? ' · REDACTED' : ''}</span>
    </li>`
  ).join('');

  const questions = (caseBoard?.unresolvedQuestions ?? []).map((q) => `<li>${escapeHtml(q)}</li>`).join('');

  return `<section class="wm-section wm-evidence wm-case-board-panel" id="wm-evidence">
  <h2>Evidence</h2>
  <div class="wm-case-tabs" data-case-tabs>
    <button type="button" class="wm-case-tab active" data-case-tab="evidence">Evidence</button>
    <button type="button" class="wm-case-tab" data-case-tab="rumors">Rumors</button>
    <button type="button" class="wm-case-tab" data-case-tab="suspects">Suspects</button>
    <button type="button" class="wm-case-tab" data-case-tab="links">Links</button>
  </div>
  <div class="wm-case-board" data-case-board>
    <div class="wm-case-pane active" data-case-pane="evidence"><ul>${evidenceCards || '<li class="wm-empty">No evidence cards yet.</li>'}</ul></div>
    <div class="wm-case-pane" data-case-pane="rumors"><ul>${rumorCards || '<li class="wm-empty">No rumor cards yet.</li>'}</ul></div>
    <div class="wm-case-pane" data-case-pane="suspects"><ul>${suspects || '<li class="wm-empty">No suspects profiled.</li>'}</ul></div>
    <div class="wm-case-pane" data-case-pane="links"><ul class="wm-case-links">${links || '<li class="wm-empty">Collect more cards to reveal links.</li>'}</ul></div>
  </div>
  ${questions ? `<h3>Unresolved questions</h3><ul>${questions}</ul>` : ''}
  <button type="button" class="wm-leno-ask-btn" data-run-command="ask_leno">Ask Leno about case</button>
</section>`;
}

export function renderRumorTrailGameplay(shell) {
  const rumors = shell?.rumorTrail ?? [];
  return `<section class="wm-section wm-rumors wm-rumor-trail-panel" id="wm-rumor-trail">
  <h2>Rumor Trail</h2>
  <div class="wm-rumor-trail-list" data-rumor-trail>${rumors.map((r) => `
    <article class="wm-rumor-trail-card" data-rumor-id="${escapeHtml(r.id)}">
      <img src="assets/ui/rumor-card.png" alt="" class="wm-rumor-icon" />
      <div>
        <p class="wm-rumor-claim">${escapeHtml(r.claim ?? r.id)}</p>
        <p class="wm-rumor-meta">spread: ${escapeHtml(r.spreadRisk)} · distortion: ${escapeHtml(r.distortion ?? 'unknown')} · trace: ${escapeHtml(r.traceState ?? 'untraced')}</p>
        <p class="wm-rumor-meta">confidence: ${escapeHtml(r.trustConfidence ?? 'low')}</p>
        ${r.backfireWarning ? '<p class="wm-rumor-warning">⚠ Counter-rumor without source evidence can backfire.</p>' : ''}
        <div class="wm-case-actions">
          <button type="button" data-run-command="${escapeHtml(r.traceCommand)}">Trace</button>
          <button type="button" data-run-command="${escapeHtml(r.counterCommand)}">Counter</button>
        </div>
      </div>
    </article>`).join('') || '<p class="wm-empty">No known rumors yet.</p>'}</div>
</section>`;
}

export function renderLenoGameplayPanel(payload, shell) {
  const leno = payload?.leno;
  const guarded = applyLenoGuard(leno?.summary ?? '', payload);
  const suggestions = (leno?.suggestions ?? []).map((s) => `<li>${escapeHtml(s)}</li>`).join('');
  const overlay = shell?.assets?.lenoOverlay ?? 'assets/ui/leno-overlay.png';
  return `<section class="wm-section wm-leno wm-leno-panel" id="wm-leno">
  <h2>Leno</h2>
  <div class="wm-leno-wrap">
    <img src="${escapeHtml(overlay)}" alt="Leno companion" class="wm-leno-avatar" data-leno-avatar />
    <div class="wm-leno-content" data-leno-content>
      ${guarded ? `<pre class="wm-leno-summary" data-leno-summary>${escapeHtml(guarded)}</pre>` : '<p class="wm-empty">Ask Leno for guarded interpretation.</p>'}
      ${suggestions ? `<ol data-leno-suggestions>${suggestions}</ol>` : ''}
      <button type="button" data-run-command="ask_leno">Ask Leno</button>
    </div>
  </div>
</section>`;
}

export function renderFounderGameplay(shell) {
  const f = shell?.founder ?? {};
  const unlocked = Boolean(f.unlocked);
  const contractRows = (f.contracts ?? []).map((c) => {
    const cmd = c.status === 'available'
      ? `start_delivery_workflow ${c.id}`
      : c.status === 'active'
        ? 'run_delivery_contract'
        : '';
    const disabled = !unlocked || c.status === 'locked' || (c.status === 'available' && f.activeContract);
    return `<li class="wm-founder-contract wm-contract-${escapeHtml(c.status)}" data-contract-id="${escapeHtml(c.id)}">
      <strong>${escapeHtml(c.label)}</strong> — ${escapeHtml(c.customer)} (${escapeHtml(c.payout)} payout)
      <span class="wm-contract-status">${escapeHtml(c.status)}</span>
      ${cmd && !disabled ? `<button type="button" data-run-command="${escapeHtml(cmd)}">${c.status === 'active' ? 'Run' : 'Start'}</button>` : ''}
    </li>`;
  }).join('');
  return `<section class="wm-section wm-founder wm-founder-panel" id="wm-founder" data-founder-panel>
  <h2>Founder / Base</h2>
  <div class="wm-founder-status ${unlocked ? 'wm-unlocked' : 'wm-locked'}" data-founder-status>
    ${unlocked ? '<span class="wm-founder-badge">UNLOCKED</span>' : '<span class="wm-founder-badge wm-locked-badge">LOCKED</span>'}
    <p>${escapeHtml(f.unlockText ?? '')}</p>
    <p class="wm-founder-tier" data-founder-tier>${escapeHtml(f.tierLabel ?? 'Starter runner')}</p>
  </div>
  <ul class="wm-founder-stats">
    <li>Contracts: <strong data-founder-contracts>${escapeHtml(f.contractsCompleted ?? 0)}</strong></li>
    <li>Base level: <strong data-founder-base-level>${escapeHtml(f.baseLevel ?? 0)}</strong></li>
    <li>Reputation: <strong data-founder-reputation>${escapeHtml(f.reputation ?? 0)}</strong></li>
    <li>Money: <strong data-founder-money>${escapeHtml(f.money ?? 0)}</strong></li>
    <li>Active contract: <strong data-founder-active-contract>${escapeHtml(f.activeContract?.templateId ?? f.activeContract?.id ?? 'none')}</strong></li>
  </ul>
  <ul class="wm-founder-contracts" data-founder-contract-list>${contractRows || '<li class="wm-empty">No contracts listed.</li>'}</ul>
  <div class="wm-founder-actions">
    <button type="button" data-run-command="list_contracts" ${unlocked ? '' : 'disabled'}>List contracts</button>
    <button type="button" data-run-command="start_delivery_workflow" ${unlocked ? '' : 'disabled'}>Start delivery workflow</button>
    <button type="button" data-run-command="run_delivery_contract" ${unlocked ? '' : 'disabled'}>Run delivery contract</button>
  </div>
</section>`;
}

export function renderActionCenter(dialogue, consequence) {
  return `<section class="wm-section wm-action-center" id="wm-action-center" data-action-center>
  <div id="wm-dialogue-wrap">${dialogue ?? ''}</div>
  <div id="wm-consequence-wrap">${consequence ?? ''}</div>
</section>`;
}

export function renderMajorDecisionModal() {
  return `<div class="wm-modal hidden" id="wm-major-decision-modal" data-major-decision-modal role="dialog" aria-modal="true">
  <div class="wm-modal-backdrop" data-modal-close></div>
  <div class="wm-modal-card">
    <h3 data-modal-title>Major decision</h3>
    <p data-modal-body>Create a branch before this decision?</p>
    <div class="wm-modal-actions">
      <button type="button" data-modal-branch>Save branch &amp; continue</button>
      <button type="button" data-modal-continue>Continue without branch</button>
      <button type="button" data-modal-cancel>Cancel</button>
    </div>
  </div>
</div>`;
}

export function renderGameBottomBar(eventFeedHtml, commandFallbackHtml) {
  return `<footer class="wm-game-bottom" data-game-bottom>
  ${eventFeedHtml}
  <div class="wm-consequence-ticker-live" data-consequence-ticker></div>
  ${commandFallbackHtml}
</footer>`;
}
