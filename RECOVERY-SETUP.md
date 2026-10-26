# Room recovery and free hosting

The game supports encrypted room recovery through Upstash Redis REST. The connected deployment uses a claimed Free database; no Render upgrade or paid resource is needed.

Render environment variables:
- UPSTASH_REDIS_REST_URL: database HTTPS endpoint.
- UPSTASH_REDIS_REST_TOKEN: private write token. Keep it in Render only.
- ROOM_STORE_KEY: private 64-character hex AES-256 key. Preserve this key across deployments; changing it makes existing snapshots unreadable.
- TELEGRAM_BOT_ID: public numeric bot ID used for signature validation.

Snapshots contain the room roster, private roles/word, resume tokens, settings, bans, chat, votes, eliminated players and timers. They are encrypted with AES-256-GCM before leaving the server. Microphone sessions and sockets are never restored. On reconnection audio starts muted; spectators can only listen. Timers resume from their saved remaining time rather than expiring during server downtime. Writes are buffered briefly and flushed on graceful shutdown; a sudden crash can lose the most recent unsaved action.

The service remains single-instance. A storage lease prevents an older deployment overwriting snapshots from a newer one. Recovery refuses to overwrite an unreadable encrypted snapshot. Temporary storage failures show a warning and are retried. Inactive rooms expire after three hours; the encrypted storage snapshot expires after four hours without writes. This is game-session recovery, not permanent account or message history.

For local development/tests, ROOM_STORE_FILE can point to a private writable JSON file. That option alone does not persist on Render Free. Never commit state files, encryption keys, database credentials, or Telegram initData.

Free-plan limits apply. Keep the Free plan and do not add a payment card or enable automatic upgrades. Monitor usage in Upstash if player numbers grow. Official references:
- https://upstash.com/pricing/redis
- https://upstash.com/docs/redis/features/restapi
- https://core.telegram.org/bots/webapps#validating-data-for-third-party-use

Verified-only Telegram rooms give account-based bans. Anonymous browser rooms intentionally cannot promise a ban follows someone who clears their browser identity or switches devices.
