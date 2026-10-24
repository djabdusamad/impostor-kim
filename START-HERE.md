# IMPOSTOR KIM? — Public online deployment

This folder is ready to deploy as a Node.js web service on Render. No code edits required.

## Simple instructions (browser only)

1. Extract the ZIP file. Open the inner `impostor-kim-deploy` folder. You should see `server.js`, `package.json`, `render.yaml`, `index.html`, and `online.html`.
2. Create or sign in to your GitHub account at https://github.com/.
3. In GitHub, choose **+ > New repository**. Name it `impostor-kim`, select **Private** (or Public if you prefer), and choose **Create repository**.
4. Choose **uploading an existing file**. Drag **all files inside** the extracted `impostor-kim-deploy` folder into the GitHub upload area (not the enclosing folder). Include `render.yaml` and `server.js`. GitHub browser uploads may not include hidden files such as `.gitignore`; that's okay. Click **Commit changes**.
5. Go to https://dashboard.render.com/ and sign in. Choose **New > Blueprint** (if available), connect GitHub and select your `impostor-kim` repository. Render will read `render.yaml`. Confirm the proposed web service and deploy. If Blueprint is unavailable, choose **New > Web Service**, connect the same repo, choose Node, set **Build Command** to `npm install` and **Start Command** to `npm start`, and select the Free instance type if offered.
6. Wait for Render to show the service is live. Open the public `.onrender.com` address Render gives you. Open `/online.html` if necessary.
7. Create a room, then send your friends the **public website URL** and the room code. Friends can use different Wi-Fi networks or mobile data.

## Important notes

- `localhost` and `192.168.x.x` links are local only. Share the **Render public URL**, not a local IP address.
- The free Render service may sleep after inactivity, delaying the first visit. Pricing and free availability can change.
- Game rooms are stored only in server memory. A restart, deployment, or sleep clears rooms; create a new room after that.
- This is a prototype: test with multiple devices before sharing widely.
- The offline single-device game can be used once the PWA's assets have been cached on a supported browser. Online rooms require internet.
- The server doesn't need a database for basic live rooms, but persistence and scalability would need more work.
- Don't upload passwords, API keys, or your `node_modules` folder to GitHub.
