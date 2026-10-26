# IMPOSTOR KIM? — updated project

## Deploy without coding

1. Extract `impostor-kim-updated.zip` on your computer.
2. Open https://github.com/djabdusamad/impostor-kim and sign in with an account allowed to edit it.
3. Choose **Add file → Upload files**. Upload the extracted files and the `test` folder into the repository root, replacing matching files. Do not upload the ZIP itself or put everything inside an extra folder. The root must contain `package.json`, `server.js`, `index.html` and `online.html`.
4. Enter a message such as “Add host settings and player moderation”. Prefer a new branch and pull request, then merge it after review.
5. If Render already hosts this repository, open that existing service. It should deploy the connected branch automatically. Otherwise use **Manual Deploy → Deploy latest commit** after merging.
6. If creating the Render service for the first time: choose **New → Web Service**, connect this repository, choose the updated branch, select **Node**, use build command `npm ci`, start command `npm start`, and health check `/health`. Leave the root directory empty. Keep one service instance because rooms are held in memory.
7. Wait until Render reports **Live**, open its HTTPS address, and refresh every game device. The offline cache has a new version; close and reopen older installed app windows if necessary. Create a new room after deploying.

GitHub uploads: https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository
Render setup: https://render.com/docs/deploy-node-express-app
Render existing-service deployment: https://render.com/docs/deploys

## What changed

- Host selects any whole number from 1 to 60 discussion minutes. Server validates the range. All devices use one server deadline, including after reconnecting. When time expires, voting opens automatically; the host can open voting earlier.
- Host can remove any other player from the lobby or during play. Server rejects non-host moderation. Removing someone during roles, discussion or voting cancels that round and returns everyone else to the lobby. A fresh round avoids stale votes and role imbalance.
- Removed players lose their resume token. The server blocks their persistent browser identity from joining the same room, even with a new name. This is a casual-game block: clearing browser storage or using another browser/device can bypass it. Rooms and blocks disappear on server restart or expiry. Stronger bans require authenticated accounts.
- “Impostorga ishora” gives only the selected topic/category on the private role screen, before discussion. The actual secret word is never included in an impostor's role message. When the host explicitly selects a topic, that topic is already visible in lobby settings; choose “Tasodifiy” if the topic should be a useful optional hint.
- “Impostorlar bir-birini bilsin” displays partner names only to impostors when there are at least two. The control is disabled for one impostor. Civilians never receive partner lists or hints.
- Both toggles default off. Settings cannot change mid-round. At least two civilians are required; reduce impostor count if there are too few players.
- Offline single-phone mode has the same duration and role toggles. Roles are hidden between handoffs. Offline mode shares one device, so its local data is not protected from someone inspecting the browser.
- Black/white/red styling and Uzbek UI remain. Service worker cache is upgraded to v3.

## Reconnection and game rules

Reload in the same tab to resume using its session token. Reconnecting replaces the previous connection and restores only that player's role and the remaining discussion time. The host stays host while disconnected; another player cannot take over. A host may kick disconnected players. Votes remain private until results, cannot target yourself online, and count once per player. Ties favor impostors; catching one impostor wins the round, preserving the existing rules. Host may end voting early.

Rooms are held in server memory, expire after three hours without player activity and do not survive restarts/deployments. Complete games before deploying. Use the Render address for online play; opening online.html as a local file will not provide a server.

## Validation

Run `npm ci` then `npm test` to repeat the automated multiplayer integration test. It checks five clients, invalid settings, host-only actions, two-impostor private roles, toggle-off privacy, discussion deadline restoration, socket replacement, voting, repeat rounds, active-round kick cancellation, blocked rejoin/resume, health and source-file protection.

Both HTML scripts were syntax checked and their setup/role/game screens exercised in a simulated browser environment. No full visual browser or production deployment test was performed in this session. After deploying, use several real devices to confirm layout, offline caching, and voting on your network.

## Quick acceptance check (no code)

Create a room with 5 players. Choose 12 minutes and 2 impostors, enable both toggles, and start. Check privately that civilians see only the word and impostors see only the category plus the other impostor. Start discussion; reload one tab and confirm the timer has not restarted. Vote, finish, then reset with both toggles off and check the new roles. Remove a player during a round: everyone else should return to the lobby, and the removed browser should be refused entry to the same room. Also play an offline round with both toggles enabled, passing the phone only after hiding each role.

## Reference-inspired Uzbek redesign

The setup screen now uses a red title banner, two mode cards, compact settings rows and blue switches inspired by imposter.app. Player names, impostor count, topics and duration each have their own editor. Offline custom word lists (3–100 words, 50 characters per word) are saved on the device. Timer is optional in both modes; timed online rounds still use one server deadline. Uzbek labels and existing host moderation, private roles, reconnections and voting are retained. New cache version: v4.

## Voice chat
Online rooms now include optional Uzbek voice controls. See VOICE-SETUP.md for usage, host moderation, tests and optional TURN configuration. Default direct connections may fail on restrictive networks; no paid relay has been provisioned.

## Room text chat
Every online room has Xona suhbati in Uzbek. All room players can send plain-text messages (up to 500 characters; Enter sends, Shift+Enter adds a line). The last 100 messages are restored on reconnect, retained between rounds, and lost when the room expires or the server restarts. Names and timestamps come from the server; messages are escaped, never rendered as HTML. Sending is limited to five messages per ten seconds and at least 800 ms apart. The host can delete messages. Removed players cannot post; there are no messages between different rooms or private role-based chat channels. The text chat needs no microphone or additional service. Drafts survive game-state updates; unacknowledged retries are deduplicated.
