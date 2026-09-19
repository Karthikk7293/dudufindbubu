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
| Honeybell Village | Cottages, flower market, apple orchard, turning windmill, outer lanes | Sheep, rabbits, a deer | A produce cart round the market lane, a loaded hay wagon |
| Lumen City | Pastel towers, glowing windows, clock square, pocket garden, signalled crossroads | Nobody yet — the city needs its own residents | Seven cars obeying the signals, the tram on its own line, parked cars |
| Seashell Bay | Palms, surf, shells, parasols, lighthouse, beach hut | Dune rabbits and a coastal fox | A sailing boat and a ship on their own water lanes, a beached rowboat |
| Cloudstep Mountains | Rising trails, snowy peaks, alpine flowers, camp, boulders | Deer, sheep, a fox | A cable car shuttling between two pylons |
| Starlight Snowlands | Snowbear, frosted pines, lantern cabins, frozen lake, aurora at night | Foxes, rabbits, a deer | A sleigh gliding the snow track, one waiting by a cabin |

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
   paths, with gift boxes out there too. Watch the boats in the bay, the cable
   car and the windmill keep moving while you explore.
5. **Everything that travels keeps to its own lane.** The village cart and the
   snow sleigh run on tracks drawn from the same points they follow, the two
   boats stay in open water beyond the tide line, and the cable car eases into
   each station rather than bouncing between them. Nothing should ever clip a
   cottage, a lamp post, a bench or a tree.
6. **City traffic.** Stand on a pavement at one of the two signalled crossroads
   and watch a full cycle: north-south runs, everything holds, then east-west.
   Cars brake for the stop line, queue behind each other, steer into their turns
   with the front wheels, and will U-turn or turn off at a junction. Step onto a
   crossing and the nearest car should stop for you. Nothing should ever drive
   over a pavement or through a building.
7. Turn on reduced motion. Every travelling thing should stop where it is —
   cars, the cart, the boats, the cable car, the sleigh, the tram, the windmill
   and the surf — while the animals keep wandering, as they do in the forest.
8. Pause, then change day/night or weather. Snowlands uses snowfall instead of
   rain. City windows and village lamps light up at night.
9. Use **X** to make a postcard. The scene pauses, and the destination appears
   on the card and in its download filename.
10. Travel before the birthday: Bubu should still come along and follow you.
   After the birthday she behaves the same way. In the forest she remains behind
   her own door until all eight gifts are collected.
11. Return to the forest and try the Moonwatch ladder. Travel is unavailable
   during departure, arrival, birthday and ladder scenes.
12. Restart while away, then refresh. Both should start a fresh forest adventure,
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
disposal, failed-load recovery and frozen/reduced-motion animation.
`tests/city-traffic.test.js` samples every driving lane across the width of a
car and drives the whole fleet for forty simulated seconds, asserting no car
ever reaches a building; it also checks that the signals never show green both
ways, that a car holds behind the stop line and crosses on green, that a
follower keeps its distance, that cars wait for a bear in the road, and that
every junction offers a way on including a U-turn.
`tests/destination-layout.test.js` covers all five places: nothing is built
inside anything else or hangs off the island, you can stand where you arrive,
and every travelled route is sampled along its length — land routes must stay on
open ground and clear of every prop, boats must stay in open water — before the
whole scene is run for a minute to check each travelling prop actually goes
somewhere and keeps its place. A further check confirms reduced motion stops
every travelling prop and the scene clock with them, while the animals keep
moving.

Ground scatter and flower beds use four- and thirty-six-triangle shapes rather
than full spheres, and anything that moves merges its own rigid parts by
material the way the animals do. Together those halved the triangles drawn in
the village and the mountains and cut the city from 248 draw calls to 182, at
phone detail settings and a third-person camera. Physical phone
performance and haptic feel still need device testing.

Only one additional destination scene exists at a time. Its GPU resources are
disposed when leaving, while the original forest is retained for return trips.
New scenery is procedural; it does not download external 3D models or textures.
