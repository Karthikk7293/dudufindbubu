# A wider world — playtest

Branch: `feature/world-destinations`, created from `main` with the completed
game-only cleanup carried over.

Run `npm run dev` (port 3000), or `npm run dev -- --port 3002` if another project
uses that port. Turn a phone sideways. This session uses port 3002.

## Places to visit

After Dudu leaves home, press **G**, use the destination badge below the journal,
or choose **Visit another destination** in the pause menu or local map.

| Destination | Things to see | Who lives there | Moving about |
| --- | --- | --- | --- |
| Sunnywood Forest | The original birthday hunt, picnic and Moonwatch nest | Rabbits, sheep, deer, foxes | Birds, butterflies |
| Honeybell Village | Cottages, flower market, apple orchard, turning windmill, outer lanes | Sheep, rabbits, a deer | A loaded hay wagon |
| Lumen City | Pastel towers, glowing windows, clock tower, pocket garden, wider blocks | Garden rabbits, city foxes | Four cars on the avenues, the tram, parked cars |
| Seashell Bay | Palms, waves, shells, parasols, lighthouse, beach hut | Rabbits, a fox, a deer | A sailing boat, a ship offshore, a beached rowboat |
| Cloudstep Mountains | Rising trails, snowy peaks, alpine flowers, camp, boulders | Deer, sheep, a fox | A cable car crossing the valley |
| Starlight Snowlands | Snowbear, frosted pines, lantern cabins, frozen lake, aurora at night | Foxes, rabbits, a deer | A wooden sleigh |

Each of the five destinations is now as playable as the forest, on an island of
the same size. Every place holds:

- **Five gift boxes** with ribbons and a golden ring. Explore to find them, get
  close, then press **E** or tap the heart. They are recorded in your travel
  journal and are completely separate from the eight birthday gifts.
- **Three golden memory markers**, collected the same way.
- **Its own animals.** Walk up to one and say hello, exactly as in the forest.
- **Bubu**, who now travels with you whether or not the birthday has happened.

The map records gift boxes and memories after you collect them; it does not
reveal their locations in advance. Read everything you have kept in the
destination menu's **Your travel memories** section.

## Checks to try

1. Collect a forest gift, travel, then return. The gift bag, birthday stage and
   Dudu's forest position should be preserved. Collecting destination gift boxes
   never reveals Bubu early or adds to the birthday bag.
2. Walk, tap a route, orbit and zoom in each place. Open **M** for that place's
   map. The ocean and frozen lake are boundaries; mountains have a rising trail.
3. Find a memory twice: the second visit should not create a duplicate. The same
   applies to gift boxes — a collected box disappears and cannot be taken again.
4. Wander the outer ring of each place: more houses, towers, palms, pines and
   paths, with gift boxes out there too. Watch the city traffic, the boats in the
   bay, the cable car and the windmill keep moving while you explore.
5. Pause, then change day/night or weather. Snowlands uses snowfall instead of
   rain. City windows and village lamps light up at night.
6. Use **X** to make a postcard. The scene pauses, and the destination appears
   on the card and in its download filename.
7. Travel before the birthday: Bubu should still come along and follow you.
   After the birthday she behaves the same way. In the forest she remains behind
   her own door until all eight gifts are collected.
8. Return to the forest and try the Moonwatch ladder. Travel is unavailable
   during departure, arrival, birthday and ladder scenes.
9. Restart while away, then refresh. Both should start a fresh forest adventure,
   with an empty bag and no destination gifts or memories.

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
They test real travel controls, manual exploration, a memory and a gift box in each destination, maps,
photo export, companion movement, restoration, restart and refresh. Unit tests
check routes to all 15 landmarks and all 25 gift boxes, that every gift box and
animal starts on open ground, navigation boundaries, deduplication, scene
disposal, failed-load recovery and frozen/reduced-motion animation. Physical phone
performance and haptic feel still need device testing.

Only one additional destination scene exists at a time. Its GPU resources are
disposed when leaving, while the original forest is retained for return trips.
New scenery is procedural; it does not download external 3D models or textures.
