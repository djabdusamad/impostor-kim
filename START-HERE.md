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
- Host can remove any other player from the lobby or during play. Server rejects non-host moderation. An active departure is treated as elimination and the remaining players continue; spectator departures do not change the game. Win conditions are rechecked after departures.
- Removed players lose their resume token. The server blocks their persistent browser identity from joining the same room, even with a new name. This is a casual-game block: clearing browser storage or using another browser/device can bypass it. Rooms and blocks disappear on server restart or expiry. Stronger bans require authenticated accounts.
- “Impostorga ishora” gives an Uzbek clue related to the selected secret word on the private role screen, before discussion. The actual secret word is never included in an impostor's role message. Clues describe the particular word rather than repeating the category. Ambiguous words use category-specific meanings.
- “Impostorlar bir-birini bilsin” displays partner names only to impostors when there are at least two. The control is disabled for one impostor. Civilians never receive partner lists or hints.
- Both toggles default off. Settings cannot change mid-round. At least two civilians are required; reduce impostor count if there are too few players.
- Offline single-phone mode has the same duration and role toggles. Roles are hidden between handoffs. Offline mode shares one device, so its local data is not protected from someone inspecting the browser.
- Black/white/red styling and Uzbek UI remain. Service worker cache is upgraded to v3.

## Reconnection and game rules

Reload in the same tab to resume using its session token. Reconnecting replaces the previous connection and restores only that player's role and the remaining discussion time. A disconnected host has 30 seconds to reconnect. After that the server hands control to a connected player, preferring a surviving player. The old host returns as a normal player. A host may kick disconnected players. Votes remain private until results, cannot target yourself online, and count once per player. A tied or empty vote removes nobody and restarts discussion. A unique vote leader is eliminated. Civilians win only after all impostors are eliminated; impostors win when they equal or outnumber remaining civilians. Otherwise the same secret word and roles continue, the host’s discussion timer restarts, and only surviving players vote. Eliminated players cannot vote, send text, or speak, but can join receive-only audio without microphone permission. Final vote counts add up across all voting cycles. Voting lasts 15–180 seconds (45 by default); abstention is available. The host can end voting early with OVOZ BERISHNI YAKUNLASH; only votes already cast count and remaining players abstain. Automatic voting completion requires non-abstaining ballots from at least half of surviving players; an explicit host finish counts the ballots already cast even below that threshold.

Rooms are held in server memory, expire after three hours without player activity and do not survive restarts/deployments. Complete games before deploying. Use the Render address for online play; opening online.html as a local file will not provide a server.

## Validation

Run `npm ci` then `npm test` to repeat the automated multiplayer integration test. It checks five clients, invalid settings, host-only actions, two-impostor private roles, toggle-off privacy, discussion deadline restoration, socket replacement, voting, repeat rounds, active-round kick cancellation, blocked rejoin/resume, health and source-file protection.

Automated server and browser tests cover online/offline voting cycles, role privacy, reconnection, timers, elimination permissions, ties, and both win conditions. Device-specific microphone support still depends on the browser or Telegram client.

## Quick acceptance check (no code)

Create a room with 5 players. Choose 12 minutes and 2 impostors, enable both toggles, and start. Check privately that civilians see only the word and impostors see only the category plus the other impostor. Start discussion; reload one tab and confirm the timer has not restarted. Vote, finish, then reset with both toggles off and check the new roles. Remove a player during a round: everyone else should return to the lobby, and the removed browser should be refused entry to the same room. Also play an offline round with both toggles enabled, passing the phone only after hiding each role.

## Reference-inspired Uzbek redesign

The setup screen now uses a red title banner, two mode cards, compact settings rows and blue switches inspired by imposter.app. Player names, impostor count, topics and duration each have their own editor. Offline custom word lists (3–100 words, 50 characters per word) are saved on the device. Timer is optional in both modes; timed online rounds still use one server deadline. Uzbek labels and existing host moderation, private roles, reconnections and voting are retained. The service worker refreshes versioned offline assets.

## Voice chat
Online rooms now include optional Uzbek voice controls. See VOICE-SETUP.md for usage, host moderation, tests and optional TURN configuration. Default direct connections may fail on restrictive networks; no paid relay has been provisioned.

## Room text chat
Every online room has Xona suhbati in Uzbek. All room players can send plain-text messages (up to 500 characters; Enter sends, Shift+Enter adds a line). The last 100 messages are restored on reconnect, retained between rounds, and lost when the room expires or the server restarts. Names and timestamps come from the server; messages are escaped, never rendered as HTML. Sending is limited to five messages per ten seconds and at least 800 ms apart. The host can delete messages. Removed players cannot post; there are no messages between different rooms or private role-based chat channels. The text chat needs no microphone or additional service. Drafts survive game-state updates; unacknowledged retries are deduplicated.

## Uzbek categories and pictures
Mavzular now supports multiple selected categories and a select-all control in both modes. The host selects online categories; settings are validated server-side and restored on reconnect. Offline custom words remain editable and selectable. The curated bank has 19 categories and 534 entries across Uzbek food, traditions, holidays, places, celebrities, creators, arts, sport, history and daily life. See WORD-SOURCES.md for editorial references. Twenty original local SVG illustrations cover 21 noun prompts; other words remain text-only. Pictures appear only with a revealed civilian word and never in an impostor role payload. The offline app caches the word bank and artwork. No external image API or paid image service is used.

## Room membership and host handover
The waiting-card summary now names the actual host and shows impostor count and hint status for everyone. Host badges follow server hostId rather than roster order. The crown button passes host control to a connected player, including through player management during active rounds. Xonadan chiqish removes the player, invalidates the old resume token and closes their voice session. Leaving no longer resets the game for other players; the last departure deletes the room. A departing host automatically hands over to another remaining player, preferring one online. Temporary disconnection retains the player's place for reconnection. Saved room tokens now persist in the same browser across tabs/restarts; a second tab resumes the same identity and tells the replaced tab to stop reconnecting. Same-device duplicate joins are rejected unless authenticated with the saved token. Explicit leaving clears saved room credentials. Encrypted snapshots recover rooms after server restarts when the free recovery store is connected. See RECOVERY-SETUP.md.

## Civilian victory screen
Civilian wins now show a green victory banner, the secret word and a role-reveal roster in Uzbek. The roster displays actual votes, the host and your-player badges, and every eliminated player. It appears only after all impostors have been caught. Replay stays available; returning online leaves the room through the normal leave flow. Voice and text controls remain accessible in an expandable section.


## Reliability and fair play
Discussion is followed by timed voting with abstention and a majority quorum. Host failover happens after 30 seconds. Departures preserve the current game. Telegram-created rooms require cryptographically verified Telegram identities by default; bans follow those identities across browsers. Anonymous website rooms remain available. The optional final-guess setting grants the last caught impostor one 20-second attempt; a correct answer gives impostors the win. Offline mode includes abstention, per-player voting deadlines, and the optional final guess.

## Play again with the same players
After either team wins, the host can select Shu o‘yinchilar bilan yana o‘ynash to start directly in the same room. Names, player identities and settings are retained; eliminated players return for the new game. Guests wait in that room without re-entering a code or name. Sozlamalarga qaytish remains available to the host to edit settings first. Offline mode offers the same replay action with the existing names and settings. Xonadan chiqish is a separate explicit action.



## Word-specific hints
All 534 built-in category entries have curated Uzbek clues in hints.js (499 distinct words, with category-specific clues for ambiguous names such as Rayhon and Paxtakor). The server sends a clue only to an impostor when hints are enabled; it still withholds the word and picture. Hint-off sends null, including after reconnection. Offline custom words support the format word | hint. Existing word-only lists still work; unknown custom words without a hint show that no clue was provided, rather than falling back to their category. Custom clues containing their answer are rejected.
