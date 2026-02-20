-- If visitors is empty but events exist (e.g. table was recreated or data migrated),
-- create one visitor row per distinct visitor_id from events.
-- Device/browser/location will stay NULL until that visitor sends a new event.
-- Safe to run multiple times (ON DUPLICATE KEY just updates last_seen_at).

INSERT INTO visitors (visitor_id, first_seen_at, last_seen_at)
SELECT visitor_id, MIN(occurred_at), MAX(occurred_at)
FROM events
GROUP BY visitor_id
ON DUPLICATE KEY UPDATE last_seen_at = GREATEST(visitors.last_seen_at, VALUES(last_seen_at));
