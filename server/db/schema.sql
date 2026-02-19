-- Analytics: visitors (one row per cookie visitor_id)
CREATE TABLE IF NOT EXISTS visitors (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  visitor_id VARCHAR(64) NOT NULL,
  first_seen_at DATETIME NOT NULL,
  last_seen_at DATETIME NOT NULL,
  referrer VARCHAR(512) DEFAULT NULL,
  utm_source VARCHAR(128) DEFAULT NULL,
  utm_medium VARCHAR(128) DEFAULT NULL,
  utm_campaign VARCHAR(256) DEFAULT NULL,
  utm_term VARCHAR(256) DEFAULT NULL,
  utm_content VARCHAR(256) DEFAULT NULL,
  email VARCHAR(255) DEFAULT NULL,
  name VARCHAR(255) DEFAULT NULL,
  enriched_at DATETIME DEFAULT NULL,
  return_visit_notified_at DATETIME DEFAULT NULL,
  UNIQUE KEY uk_visitor_id (visitor_id),
  KEY idx_last_seen (last_seen_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Analytics: events (one row per event)
CREATE TABLE IF NOT EXISTS events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  visitor_id VARCHAR(64) NOT NULL,
  event_type VARCHAR(64) NOT NULL,
  occurred_at DATETIME NOT NULL,
  page_url VARCHAR(512) DEFAULT NULL,
  referrer VARCHAR(512) DEFAULT NULL,
  utm_source VARCHAR(128) DEFAULT NULL,
  utm_medium VARCHAR(128) DEFAULT NULL,
  utm_campaign VARCHAR(256) DEFAULT NULL,
  utm_term VARCHAR(256) DEFAULT NULL,
  utm_content VARCHAR(256) DEFAULT NULL,
  metadata JSON DEFAULT NULL,
  KEY idx_visitor_occurred (visitor_id, occurred_at),
  KEY idx_event_type (event_type),
  KEY idx_occurred (occurred_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
