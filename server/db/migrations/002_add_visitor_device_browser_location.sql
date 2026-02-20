-- Run this on existing DBs before deploying code that uses device/browser/location.
-- Adds device_display, browser_display, location_display to visitors for event viewer labels (e.g. "Mac/Chrome nr Bristol via LinkedIn").
-- If you get "Duplicate column name", the column already exists.
ALTER TABLE visitors ADD COLUMN device_display VARCHAR(128) DEFAULT NULL;
ALTER TABLE visitors ADD COLUMN browser_display VARCHAR(128) DEFAULT NULL;
ALTER TABLE visitors ADD COLUMN location_display VARCHAR(128) DEFAULT NULL;
