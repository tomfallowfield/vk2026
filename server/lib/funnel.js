/**
 * Conversion funnel segment definitions and evaluation.
 * Each segment is lit when any of its trigger event types have been recorded for a visitor.
 */

const FUNNEL_SEGMENTS = [
  {
    id: 1,
    label: 'Landed',
    triggers: ['page_view', 'click'] // any event really means they landed, but these are explicit
  },
  {
    id: 2,
    label: 'Engaged',
    triggers: ['scroll_50', 'time_60s', 'time_on_site']
  },
  {
    id: 3,
    label: 'Explored',
    triggers: ['service_open', 'scope_open', 'video_play', 'faq_open']
  },
  {
    id: 4,
    label: 'Interested',
    triggers: ['form_open', 'form_focus', 'cal_link_click']
  },
  {
    id: 5,
    label: 'Converted',
    triggers: ['form_submit']
  }
];

/**
 * Evaluate funnel progress from a set of event types.
 * @param {string[]|Set<string>} eventTypes — distinct event types for a visitor
 * @returns {{ segments: Array<{ id, label, completed }>, completed: number, total: number }}
 */
function evaluateFunnel(eventTypes) {
  const typeSet = eventTypes instanceof Set ? eventTypes : new Set(eventTypes || []);

  // Segment 1 (Landed) is always true if the visitor has any events at all
  const hasAnyEvent = typeSet.size > 0;

  const segments = FUNNEL_SEGMENTS.map(seg => {
    let completed;
    if (seg.id === 1) {
      completed = hasAnyEvent || seg.triggers.some(t => typeSet.has(t));
    } else {
      completed = seg.triggers.some(t => typeSet.has(t));
    }
    return { id: seg.id, label: seg.label, completed };
  });

  return {
    segments,
    completed: segments.filter(s => s.completed).length,
    total: FUNNEL_SEGMENTS.length
  };
}

module.exports = { FUNNEL_SEGMENTS, evaluateFunnel };
