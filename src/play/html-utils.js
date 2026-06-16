/**
 * Shared HTML escape + Leno evidence guard for play UI renderers.
 */

const SOURCE_DEFINING = /\bnadia\s+is\s+the\s+source\b/i;

function hasNadiaEvidence(payload) {
  const pk = payload?.playerKnowledge ?? payload?.world?.playerKnowledge;
  return Boolean(pk?.evidenceIds?.includes?.('rumor_source_nadia'));
}

export function escapeHtml(text) {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function applyLenoGuard(text, payload) {
  if (typeof text !== 'string') return '';
  if (hasNadiaEvidence(payload)) return text;
  return text.replace(SOURCE_DEFINING, 'REDACTED — evidence required');
}
