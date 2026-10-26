# IMPOSTOR KIM? — Telegram Mini App

The deployed app URL is https://impostor-kim.onrender.com/online.html . Telegram and website players use the same rooms, Uzbek game, text chat and server permissions. No second hosting service or bot token is required to launch the Mini App.

## One-time setup (no code)

1. Open the verified @BotFather account: https://t.me/BotFather . Send `/newbot`, choose the name `IMPOSTOR KIM?`, then an available username ending in `bot`.
2. Keep the token private. This integration does not need it; do not put it in chat, GitHub, or a website file.
3. In @BotFather send `/mybots`, select your bot, then **Bot Settings → Configure Mini App** (Main Mini App). Enable it and set its URL to `https://impostor-kim.onrender.com/online.html`.
4. Send `/setmenubutton`, select that bot, enter `O‘ynash` for the button text and the same HTTPS URL.
5. Optional but recommended: in Render, open the game service → Environment. Add `TELEGRAM_BOT_USERNAME` with the username from step 1, without `@`. Save and deploy. The in-game Telegram invitation button will then share `https://t.me/YOUR_BOT?startapp=ROOMCODE`, opening the correct room inside Telegram. Until this is set, invitations open the website room link.
6. Open your bot in Telegram, tap **Launch app / O‘ynash**, create a room and invite a second person. Test once on Android and iPhone. Ask microphone permission if you use voice chat; support depends on the Telegram client. Text chat works without microphone access.

## Behavior and privacy

- Telegram's back arrow closes the name/category screen or asks before leaving a room. Closing confirmation protects active room sessions.
- Existing room resume tokens and server-side host/role rules remain authoritative. Telegram's name is only an editable suggestion, not a verified account or administrator identity. No Telegram IDs, initData or bot tokens are sent to the game server.
- Room invitations include only the room code, never a resume token, role, secret word or hint. Joining still requires confirming your name and server validation.
- Existing website and offline game remain available. Telegram browser storage and an external browser have separate sessions; return in the same Telegram client to resume.
- Tests simulate the Telegram bridge and exercise real room joins/leaves. Final device testing requires creating your bot in BotFather; it cannot be completed before that step.

Official setup reference: https://core.telegram.org/bots/webapps#launching-the-main-mini-app and https://core.telegram.org/bots/webapps#launching-mini-apps-from-the-menu-button .
