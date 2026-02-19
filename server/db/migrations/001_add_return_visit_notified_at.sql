-- Run this on existing DBs to add return-visit notification tracking.
-- If you get "Duplicate column name", the column already exists.
ALTER TABLE visitors ADD COLUMN return_visit_notified_at DATETIME DEFAULT NULL;
