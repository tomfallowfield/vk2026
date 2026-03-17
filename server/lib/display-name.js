/**
 * Build visitor display names from device/browser/location context.
 * Enriched visitors (with name or email) show their real identity instead.
 */

/**
 * Build a display name for a single visitor.
 * @param {object} visitor — { name?, email?, enriched_at?, browser_display?, device_display?, location_display? }
 * @returns {string}
 */
function buildDisplayName(visitor) {
  // If converted, show real name or email
  if (visitor.enriched_at || visitor.email) {
    if (visitor.name && visitor.name.trim()) return visitor.name.trim();
    if (visitor.email && visitor.email.trim()) return visitor.email.trim();
  }

  // Anonymous: Browser · OS · City
  const parts = [];
  // browser_display is typically "Mac/Chrome" — extract browser part
  const browser = visitor.browser_display || '';
  const device = visitor.device_display || '';

  // If browser_display contains both (e.g. "Mac/Chrome"), split it
  if (browser.includes('/')) {
    const [dev, br] = browser.split('/');
    if (br) parts.push(br);
    if (dev) parts.push(dev);
  } else {
    if (browser) parts.push(browser);
    if (device && device !== browser) parts.push(device);
  }

  if (visitor.location_display) parts.push(visitor.location_display);

  return parts.length > 0 ? parts.join(' · ') : 'Unknown visitor';
}

/**
 * Disambiguate visitors with identical display names by appending -2, -3 suffixes.
 * Modifies visitors in place, adding a `display_name` property.
 * @param {object[]} visitors — array of visitor objects (must already have browser_display, device_display, location_display, name, email, enriched_at)
 * @returns {object[]} same array with `display_name` set
 */
function disambiguateDisplayNames(visitors) {
  const counts = {};
  const indices = {};

  for (const v of visitors) {
    v.display_name = buildDisplayName(v);
    const key = v.display_name;
    counts[key] = (counts[key] || 0) + 1;
  }

  for (const v of visitors) {
    const key = v.display_name;
    if (counts[key] > 1) {
      indices[key] = (indices[key] || 0) + 1;
      if (indices[key] > 1) {
        v.display_name = key + '-' + indices[key];
      }
    }
  }

  return visitors;
}

module.exports = { buildDisplayName, disambiguateDisplayNames };
