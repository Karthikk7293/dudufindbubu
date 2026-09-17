# Sunnywood adventure playtest

Branch: `feature/sunnywood-adventure`, based on `main`.

Run `npm install` if dependencies are missing, then `npm run dev` and open
http://localhost:3000. On a phone, use the development server's network address
while connected to the same Wi-Fi and turn the phone sideways.

## Things to try

1. Start at Dudu's nest. The small journal button below the gift guide shows
   how many birthday gifts you have collected.
2. Open the journal with **B**, the bag, or the progress button. The **Places**
   tab has six destinations. Choose **Follow this trail** to take a detour.
   Tap the guide again or **Walking · Stop** to stop; **Back to birthday trail**
   restores gift guidance. You can also take over with the movement controls.
3. Visit Clover fields, Willow bridge, Honeybee hollow, Heartwind meadow and
   Moonflower grove. Each discovery adds a stamp and a little memory.
4. Walk close to a rabbit, sheep, deer or fox during the day. Press **E** or tap
   the heart to say hello. Nearby gifts take priority. Friends look at Dudu,
   show hearts and appear in the **Friends** tab. Give them a few seconds
   between greetings; let them rest at night.
5. Press **X**, or choose **Make a postcard** from the journal or pause menu.
   The adventure pauses. Drag or use arrow keys to orbit; scroll, pinch or use **+ / −** to zoom. Try
   **Face Dudu**, add a message, and save a PNG. **Original view** restores the
   initial composition; **Back to adventure** restores the gameplay camera.
6. Complete the birthday as usual: collect all eight gifts, visit Bubu, then
   celebrate. Places and friends are optional. Afterward, climb together to
   discover the Moonwatch nest. You can make postcards while stargazing, too.
7. Restart from the pause menu or refresh. Gifts, journal discoveries, friends
   and the postcard counter should reset. Downloaded pictures remain yours.

## Checks

```sh
npm test
npm run build
npm run test:adventure
npm run test:adventure -- --mobile
npm run test:story
node tests/moon-nest.mjs --postcard
```

Browser checks use the running development server and local Chrome, with
`GAME_URL` and `CHROME_PATH` overrides. For slow software-rendered headless
environments, set `SOFTWARE_RENDERING_SYNC=1`. The adventure checks cover
reachable destinations, discovery and greeting records, gift priority, detour
cancellation, photo pause/orbit/export/restore, responsive layout and restart.
Phone checks emulate touch; testing on a physical phone is still valuable.
The Moonwatch check covers the climb, discovery, paused photo controls,
keyboard shortcuts, PNG export, resizing and descent.
