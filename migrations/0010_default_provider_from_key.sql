-- Repair provider preferences for instances that configured an OpenCode
-- gateway API key before task providers could be saved:
--
--   * only sets a provider when that gateway's API key is present, and
--   * INSERT OR IGNORE never overwrites an explicit user choice.
--
-- Fresh installs and instances without an OpenCode key are untouched, so this
-- is safe to ship as a one-time, additive data migration and cannot clobber a
-- provider the user picks later (the migration row is recorded once).
--
-- OpenCode Go is preferred over Zen when both keys exist because the Go rows
-- are inserted first and the Zen statements are then ignored by the existing
-- primary key.

INSERT OR IGNORE INTO settings (key, value)
SELECT 'chat.provider', 'opencode-go'
WHERE EXISTS (SELECT 1 FROM settings WHERE key = 'api_key.opencode_go');

INSERT OR IGNORE INTO settings (key, value)
SELECT 'summary.provider', 'opencode-go'
WHERE EXISTS (SELECT 1 FROM settings WHERE key = 'api_key.opencode_go');

INSERT OR IGNORE INTO settings (key, value)
SELECT 'translate.provider', 'opencode-go'
WHERE EXISTS (SELECT 1 FROM settings WHERE key = 'api_key.opencode_go');

INSERT OR IGNORE INTO settings (key, value)
SELECT 'chat.provider', 'opencode-zen'
WHERE EXISTS (SELECT 1 FROM settings WHERE key = 'api_key.opencode_zen');

INSERT OR IGNORE INTO settings (key, value)
SELECT 'summary.provider', 'opencode-zen'
WHERE EXISTS (SELECT 1 FROM settings WHERE key = 'api_key.opencode_zen');

INSERT OR IGNORE INTO settings (key, value)
SELECT 'translate.provider', 'opencode-zen'
WHERE EXISTS (SELECT 1 FROM settings WHERE key = 'api_key.opencode_zen');

-- Also seed a model that exists on the gateway, so a migration-only upgrade
-- (no Settings visit) uses a valid model id instead of the Anthropic default.
INSERT OR IGNORE INTO settings (key, value)
SELECT 'chat.model', 'glm-5'
WHERE EXISTS (SELECT 1 FROM settings WHERE key = 'api_key.opencode_go');

INSERT OR IGNORE INTO settings (key, value)
SELECT 'summary.model', 'glm-5'
WHERE EXISTS (SELECT 1 FROM settings WHERE key = 'api_key.opencode_go');

INSERT OR IGNORE INTO settings (key, value)
SELECT 'translate.model', 'glm-5'
WHERE EXISTS (SELECT 1 FROM settings WHERE key = 'api_key.opencode_go');

INSERT OR IGNORE INTO settings (key, value)
SELECT 'chat.model', 'glm-5'
WHERE EXISTS (SELECT 1 FROM settings WHERE key = 'api_key.opencode_zen');

INSERT OR IGNORE INTO settings (key, value)
SELECT 'summary.model', 'glm-5'
WHERE EXISTS (SELECT 1 FROM settings WHERE key = 'api_key.opencode_zen');

INSERT OR IGNORE INTO settings (key, value)
SELECT 'translate.model', 'glm-5'
WHERE EXISTS (SELECT 1 FROM settings WHERE key = 'api_key.opencode_zen');
