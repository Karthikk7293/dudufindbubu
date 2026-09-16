# Character look reference

- Supplied by the user on 2026-09-09: https://www.instagram.com/reel/Dar3t6FNPJT/
- Retrieved from the public Instagram embed credited to `bubududukingdom78`.
- `look-reference-Dar3t6FNPJT.mp4`: the 39.75-second reference video.
- `look-reference-Dar3t6FNPJT.jpg`: its poster.
- `reel-frames.png`: eight sampled frames for comparing both characters.
- Frames can be re-extracted with `node scripts/extract-character-reference.mjs` while the dev server runs on port 3000. This needs the installed Chrome and Playwright.

Observed details used in the models: oversized rounded plush heads, much smaller round bodies, short arms and feet, tiny low-set button eyes and w-shaped smiles; caramel Dudu with honey-yellow cheeks, inset brown ears and a small blue-banded tuft; white Bubu with a plain white face, pink cheeks, small brown ears and paw tips, a dark bow tie and a white tuft with a red band. Dudu's reference includes a small white-bear keepsake, adapted as a charm on his game's gift bag.

These files are references outside `public/`. They are not included in the production build. The game renders its own animated Three.js models. This is a look reference; its audio has not replaced the game soundtrack.

## Movement and expression reference

The user supplied https://www.instagram.com/reel/DdTewNJTGyj/ on 2026-09-16 as the primary reference for hand/leg motion and expressions. Observed key poses in the public 45-second reel include a happy, closed-eye run at the beginning; raised arms, wide eyes and an open mouth during surprise; and both bears bending in to inspect something together. These inform the game's running stride, articulated elbows, curious head tilts, and gift reactions. The public reel https://www.instagram.com/reel/DdQjknbt66F/ also shows paws held near the chest, gentle glances, and a shared walk. Their city scenes and plot are not added to the forest.

The models retain custom code-built geometry. The game does not download or play either reel; sampled review frames stay in the ignored `test-results/` folder.
