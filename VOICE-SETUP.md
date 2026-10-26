# Ovozli suhbat / Voice chat

## Playing

Open the HTTPS online game and enter a room. Choose **Ovozli suhbatga qo‘shilish** and allow the microphone when your browser asks. Joining starts muted; use **Mikrofonni yoqish** to speak. Use **Mikrofonni o‘chirish** to mute and **Chiqish** to stop all microphone tracks and leave voice. Game participation does not require voice.

Green dots show speech detected locally from the audio stream. Headphones help prevent echo. If the browser blocks sound playback, tap **Ovozni eshitishga ruxsat**. If a peer fails to connect, tap **Ovozni qayta ulash**. A temporary game connection loss stops capture immediately, then attempts voice rejoin when the game session resumes, with the microphone muted.

The host can select **Ovozini bloklash** beside a voice participant. The server removes that voice session, other clients close its audio connection, and rejoin/signaling is refused until the host selects **Ruxsat berish**. Removing a player from the game also removes them from voice. A host cannot enable someone else's microphone.

Audio uses browser WebRTC with room-only authenticated signaling over the game's existing WebSocket. It is audio only: the app never requests a camera and does not record audio. Participants and any configured relay receive connection metadata. Do not share a room code with people you do not want in the conversation. Microphone access stays under the player's browser controls.

## Network reliability: optional TURN relay

The default deployment uses Google public STUN servers to discover direct connection candidates. Direct audio can fail on some mobile, corporate or otherwise restrictive networks. Full cross-network reliability requires a TURN relay. No paid relay account is created by this update.

Configure a trusted coturn-compatible service supporting the TURN REST shared-secret scheme. In the existing Render service's **Environment** section, add:

- `TURN_URLS`: comma-separated TURN URLs, for example `turn:your-relay.example:3478,turns:your-relay.example:5349`. Include the transports offered by your provider; TCP/TLS on port 443 can help on restricted networks if the provider supports it.
- `TURN_SECRET`: the provider's TURN REST HMAC shared secret (coturn `static-auth-secret`). Enter it only in Render's secret environment fields. Never upload it to GitHub or paste it into chat.

Save and deploy. The server creates expiring, per-player credentials and provides those only to authenticated room players who join voice. The shared secret itself is never sent to browsers. Credentials last 24 hours; rooms expire after three inactive hours. This setup does not accept a provider's arbitrary API key or static password: it specifically expects the coturn-compatible HMAC secret. TURN is an external relay, not a second HTTP web service on the existing Render port.

The interface provides a direct-network limitation note when no TURN configuration is present. No recording, transcription, account system or billing changes are included.

## Tests

`npm test` checks multiplayer regressions, audio-only room signaling, cross-room rejection, forged/stale sessions, host moderation, TURN credential generation, reconnection, permission denial, cancellation, mute and track cleanup.

`npm run test:voice-browser` runs the two-context Chromium test after `npx playwright install chromium`. It uses a generated synthetic audio tone and fake microphone devices, never real recordings. The test verifies audio packets, speech indicators, muting, reconnection, host blocks and leaving. GitHub Actions runs both suites. Real-device microphone UX and restricted-network/TURN behavior should still be checked with two phones on different networks.
