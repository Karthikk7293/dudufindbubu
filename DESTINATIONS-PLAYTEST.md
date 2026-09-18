# A wider world — playtest

Branch: `feature/world-destinations`, created from `main` with the completed
game-only cleanup carried over.

Run `npm run dev` (port 3000), or `npm run dev -- --port 3002` if another project
uses that port. Turn a phone sideways. This session uses port 3002.

## Places to visit

After Dudu leaves home, press **G**, use the destination badge below the journal,
or choose **Visit another destination** in the pause menu or local map.

| Destination | Things to see |
| --- | --- |
| Sunnywood Forest | The original birthday hunt, animals, picnic and Moonwatch nest |
| Honeybell Village | Cottages, flower market, apple orchard and turning windmill |
| Lumen City | Pastel buildings, glowing windows, clock tower, pocket garden and moving tram |
| Seashell Bay | Palms, waves, shells, parasols, lighthouse and beach picnic |
| Cloudstep Mountains | Rising trails, snowy peaks, alpine flowers and a mountain camp |
| Starlight Snowlands | Snowbear, frosted pines, lantern cabins, frozen lake and northern lights at night |

The five new destinations are optional exploration trips. The birthday gifts
and celebration remain in Sunnywood. Each new place has three golden memory
markers: explore to find them, get close, then press **E** or tap the heart. Read
your collected memories in the destination menu's **Your travel memories**
section, also reachable from the journal. The map records memories after you
collect them; it does not reveal their locations in advance.

## Checks to try

1. Collect a forest gift, travel, then return. The gift bag, birthday stage and
   Dudu's forest position should be preserved. Visiting landmarks never reveals
   Bubu early or awards birthday gifts.
2. Walk, tap a route, orbit and zoom in each place. Open **M** for that place's
   map. The ocean and frozen lake are boundaries; mountains have a rising trail.
3. Find a memory twice: the second visit should not create a duplicate.
4. Pause, then change day/night or weather. Snowlands uses snowfall instead of
   rain. City windows and village lamps light up at night.
5. Use **X** to make a postcard. The scene pauses, and the destination appears
   on the card and in its download filename.
6. Finish Bubu's birthday in the forest, then travel. Both bears should move
   together in every destination. Before the birthday, Bubu stays home.
7. Return to the forest and try the Moonwatch ladder. Travel is unavailable
   during departure, arrival, birthday and ladder scenes.
8. Restart while away, then refresh. Both should start a fresh forest adventure,
   with an empty bag and no destination memories.

## Automated checks

```sh
npm test
npm run build
GAME_URL=http://localhost:3002 node tests/destinations.browser.mjs
GAME_URL=http://localhost:3002 node tests/destinations.browser.mjs --together --desktop
# For a focused trip, append --places=mountains,snowlands
# In a second terminal, after building:
npm run preview -- --port 4174 --strictPort
# With that preview running:
PREVIEW_URL=http://localhost:4174 npm run test:deployment
```

The browser scripts use local Chrome and software-rendering synchronization.
They test real travel controls, manual exploration and a memory in each destination, maps, photo export,
companion movement, restoration, restart and refresh. Unit tests check routes
to all 15 landmarks, navigation boundaries, deduplication, scene disposal,
failed-load recovery and frozen/reduced-motion animation. Physical phone
performance and haptic feel still need device testing.

Only one additional destination scene exists at a time. Its GPU resources are
disposed when leaving, while the original forest is retained for return trips.
New scenery is procedural; it does not download external 3D models or textures.
