// Each destination is a playable little world: landmarks to remember, gift
// boxes to collect, animals that live there, and room to wander between them.
export const DESTINATIONS = [
  {id:'forest',name:'Sunnywood Forest',kind:'Forest',tag:'WHERE THE STORY BEGINS',icon:'leaf',color:'#6f8b60',sky:0xa7c7d2,ground:0x91a66a,description:'Two little homes. Eight birthday surprises. A whole lot of love.',detail:'Birthday gifts · Forest friends · Moonwatch nest',spawn:{x:-6,z:33},landmarks:[],gifts:[],friends:[]},
  {id:'village',name:'Honeybell Village',kind:'Village',tag:'SLOW MORNINGS & WARM WINDOWS',icon:'home',color:'#b48758',sky:0xb5d8d8,ground:0xa0b77b,description:'A bakery lane, flower stalls and a windmill turning in the breeze.',detail:'Market square · Windmill garden · Apple orchard',spawn:{x:0,z:20},landmarks:[
    {id:'market',name:'The little flower market',x:0,z:3,memory:'A bouquet, a warm loaf, and a village that feels like home.'},
    {id:'windmill',name:'Windmill garden',x:-13,z:-6,memory:'We watched the sails turn, with nowhere else to be.'},
    {id:'orchard',name:'Apple orchard',x:13,z:-9,memory:'One apple for Dudu. One apple for Bubu. One for the road.'},
  ],gifts:[
    {id:'loaf',name:'A warm little loaf',short:'Honey loaf',color:0xd8ab6d,x:7,z:10,note:'“Still warm. We should share it before it isn’t.”'},
    {id:'bouquet',name:'A jar of honeybells',short:'Honeybells',color:0xd4a0bb,x:-8,z:-2,note:'“The whole lane smells like this in the morning.”'},
    {id:'apple',name:'The reddest apple',short:'Orchard apple',color:0xc8705f,x:16,z:-13,note:'“Dudu climbed. Bubu caught. Nobody fell.”'},
    {id:'ribbon',name:'A ribbon from the market',short:'Market ribbon',color:0xcfa27e,x:-25,z:10,note:'“Honeybell yellow, of course.”'},
    {id:'lantern',name:'A paper lantern',short:'Paper lantern',color:0xe0c88c,x:23,z:19,note:'“For walking home when the windows go warm.”'},
  ],friends:[
    {kind:'sheep',x:-21,z:11},{kind:'sheep',x:-24,z:7},{kind:'rabbit',x:9,z:-6},{kind:'rabbit',x:12,z:-4},{kind:'deer',x:25,z:-7},
  ]},
  {id:'city',name:'Lumen City',kind:'City',tag:'LITTLE BEARS, BIG LIGHTS',icon:'city',color:'#788ba5',sky:0xafc6dd,ground:0xaaaeb1,description:'Pastel townhouses, a signalled avenue and a fountain beneath the clock tower.',detail:'Clock square · Tram stop · Pocket garden',spawn:{x:5.5,z:20},landmarks:[
    {id:'clock',name:'Clocktower square',x:-12,z:-1.5,memory:'In a city full of clocks, we forgot to check the time.'},
    {id:'tram',name:'The old tram stop',x:28.5,z:11.5,memory:'Ding, ding. A little journey through a very big day.'},
    {id:'garden',name:'The pocket garden',x:12,z:-18.5,memory:'Even between tall buildings, there is room for a little green.'},
  ],gifts:[
    {id:'ticket',name:'Two tram tickets',short:'Tram tickets',color:0xa9b6c6,x:27.5,z:19,note:'“One each. No idea where they go.”'},
    {id:'postcard',name:'A city postcard',short:'City postcard',color:0xd9c9a4,x:-9,z:-5.5,note:'“Wish you were here. You are here.”'},
    {id:'icecream',name:'Two scoops, one cone',short:'Ice cream',color:0xe2b6b0,x:11.5,z:12,note:'“It melted a little. It was still perfect.”'},
    {id:'key',name:'A little brass key',short:'Brass key',color:0xd4b473,x:-30,z:0,note:'“It doesn’t open anything. Dudu kept it anyway.”'},
    {id:'skyline',name:'A rooftop balloon',short:'Rooftop balloon',color:0xb0a2c4,x:21,z:-22.8,note:'“We let it go from the highest step we could find.”'},
  ],friends:[]},
  {id:'beach',name:'Seashell Bay',kind:'Beach',tag:'SALT AIR & SANDY PAWS',icon:'water',color:'#579eaa',sky:0x83cddf,ground:0xe8d39e,description:'Waves roll in beneath palms, pastel parasols and a sleepy lighthouse.',detail:'Shell shore · Lighthouse walk · Sunset picnic',spawn:{x:0,z:19},landmarks:[
    {id:'shell',name:'The shell shore',x:0,z:-6,memory:'We held a shell to our ears. The sea had a story to tell.'},
    {id:'lighthouse',name:'Lighthouse walk',x:-16,z:0,memory:'A little light to help every wanderer find their way home.'},
    {id:'picnic',name:'The sandy picnic',x:13,z:7,memory:'The sandwiches had a little sand. The afternoon was perfect.'},
  ],gifts:[
    {id:'conch',name:'A shell that sings',short:'Singing shell',color:0xe8c6b4,x:-5,z:-8,note:'“Hold it closer. There — did you hear the sea?”'},
    {id:'starfish',name:'A very sleepy starfish',short:'Starfish',color:0xd9906f,x:7,z:-8,note:'“We put it back. It waved. Probably.”'},
    {id:'bottle',name:'A message in a bottle',short:'Glass bottle',color:0x8fbfc4,x:-23,z:9,note:'“Somebody, somewhere, is having a lovely day too.”'},
    {id:'pail',name:'A bucket of sunshine',short:'Sand pail',color:0xe0b06a,x:16,z:4,note:'“Four castles. One moat. Zero survivors.”'},
    {id:'coral',name:'A piece of pink coral',short:'Pink coral',color:0xdc9ba4,x:25,z:-4,note:'“The sea left it right where we would find it.”'},
  ],friends:[
    {kind:'rabbit',x:-15,z:15},{kind:'rabbit',x:-12,z:18},{kind:'fox',x:23,z:15},{kind:'deer',x:-25,z:20},
  ]},
  {id:'mountains',name:'Cloudstep Mountains',kind:'Mountains',tag:'A LITTLE CLOSER TO THE SKY',icon:'mountain',color:'#8b8d9b',sky:0xb0cddd,ground:0x91a187,description:'Follow the rising trail past pine trees, a mountain camp and distant snowy peaks.',detail:'Summit lookout · Campfire clearing · Alpine flowers',spawn:{x:0,z:20},landmarks:[
    {id:'summit',name:'Cloudstep lookout',x:8,z:-7,memory:'The whole world looked smaller. Our little adventure felt bigger.'},
    {id:'camp',name:'The mountain camp',x:-12,z:1,memory:'Warm paws, a tiny campfire, and stories until the stars came out.'},
    {id:'alpine',name:'Alpine flower trail',x:13,z:10,memory:'The tiniest flowers were brave enough to grow up here.'},
  ],gifts:[
    {id:'pinecone',name:'The most perfect pinecone',short:'Pinecone',color:0x9c7d5a,x:-10,z:13,note:'“Dudu compared eleven of them. This one won.”'},
    {id:'cocoaflask',name:'A flask of hot cocoa',short:'Cocoa flask',color:0x9aa2ae,x:-14,z:-2,note:'“Two cups, one flask, and a very good view.”'},
    {id:'edelweiss',name:'One brave little flower',short:'Alpine flower',color:0xe3dcc4,x:17,z:14,note:'“It grows where nothing else dares to.”'},
    {id:'compass',name:'A small brass compass',short:'Brass compass',color:0xc9a96f,x:5,z:-15,note:'“It always points home. So does Bubu.”'},
    {id:'feather',name:'A feather from the wind',short:'Sky feather',color:0xb9b0a0,x:-26,z:-21,note:'“It fell from somewhere much higher than us.”'},
  ],friends:[
    {kind:'deer',x:-21,z:-6},{kind:'deer',x:-23,z:-2},{kind:'sheep',x:19,z:19},{kind:'sheep',x:22,z:16},{kind:'fox',x:-6,z:-21},
  ]},
  {id:'snowlands',name:'Starlight Snowlands',kind:'Snowlands',tag:'QUIET SNOW & COZY HEARTS',icon:'snow',color:'#819fb0',sky:0xbfcfdf,ground:0xe3ebeb,description:'Snowy firs, cozy cabins and a frozen pond. Stay until night for the northern lights.',detail:'Snowbear garden · Frozen lake · Lantern cabin',spawn:{x:0,z:20},landmarks:[
    {id:'snowbear',name:'The snowbear garden',x:0,z:4,memory:'We built a snowy friend with the warmest little smile.'},
    {id:'lake',name:'The frozen lake',x:12,z:-6,memory:'The lake kept the sky like a secret beneath the ice.'},
    {id:'cabin',name:'The lantern cabin',x:-13,z:-7,memory:'Outside, the snow kept falling. Inside, a little light waited.'},
  ],gifts:[
    {id:'mitten',name:'One very lost mitten',short:'Lost mitten',color:0xc98f92,x:-9,z:7,note:'“We looked everywhere. It was in the snow, obviously.”'},
    {id:'snowglobe',name:'A tiny snow globe',short:'Snow globe',color:0xa9c6d6,x:8,z:-3,note:'“A little winter you can hold in two paws.”'},
    {id:'bell',name:'A single sleigh bell',short:'Sleigh bell',color:0xd6b978,x:-16,z:-15,note:'“One ring, and the whole hill went quiet.”'},
    {id:'paperstar',name:'A folded paper star',short:'Paper star',color:0xe6dcc0,x:19,z:13,note:'“Bubu folded it. Dudu held the corners.”'},
    {id:'thermos',name:'A cup of something warm',short:'Warm cup',color:0xbf8f72,x:26,z:-21,note:'“Cold paws, warm cup, perfect evening.”'},
  ],friends:[
    {kind:'fox',x:-8,z:-19},{kind:'fox',x:-5,z:-22},{kind:'rabbit',x:20,z:9},{kind:'rabbit',x:23,z:6},{kind:'deer',x:-25,z:11},
  ]},
];
export const DESTINATION_RADIUS = 38;
export const destinationById=id=>DESTINATIONS.find(place=>place.id===id);
export const destinationHeight=(id,x,z)=>id==='mountains'
  ? .2+4.1*Math.exp(-((x-9)**2+(z+8)**2)/165)+2.3*Math.exp(-((x+19)**2+(z+18)**2)/190)
  : .2;
export const destinationLayout=id=>({radius:DESTINATION_RADIUS,ponds:[],blocked:id==='beach'?(_x,z)=>z< -9.2:id==='snowlands'?(x,z)=>((x-13)/6)**2+((z+11)/4)**2<1:undefined});
export const destinationTotals=()=>DESTINATIONS.reduce((totals,place)=>({
  memories:totals.memories+place.landmarks.length,gifts:totals.gifts+place.gifts.length,
}),{memories:0,gifts:0});
export function freshTravel(){return {visited:['forest'],memories:[],gifts:[],positions:{}};}
export function rememberLandmark(log,id,landmarkId,position){
  const place=destinationById(id),landmark=place?.landmarks.find(item=>item.id===landmarkId),key=`${id}/${landmarkId}`;
  if(!landmark||log.memories.includes(key)||Math.hypot(position.x-landmark.x,position.z-landmark.z)>3)return false;
  log.memories.push(key);return true;
}
// Gift boxes are resolved to a clear patch of ground when a destination is
// built, so the reach test uses that resolved site rather than the authored one.
export function collectTravelGift(log,id,site,position){
  const key=`${id}/${site?.item.id}`;
  if(!site||log.gifts.includes(key)||Math.hypot(position.x-site.x,position.z-site.z)>2.6)return false;
  log.gifts.push(key);return true;
}
export const travelGiftCount=(log,id)=>log.gifts.filter(key=>key.startsWith(id+'/')).length;
