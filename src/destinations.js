export const DESTINATIONS = [
  {id:'forest',name:'Sunnywood Forest',kind:'Forest',tag:'WHERE THE STORY BEGINS',icon:'leaf',color:'#6f8b60',sky:0xa7c7d2,ground:0x91a66a,description:'Two little homes. Eight birthday surprises. A whole lot of love.',detail:'Birthday gifts · Forest friends · Moonwatch nest',spawn:{x:-6,z:33},landmarks:[]},
  {id:'village',name:'Honeybell Village',kind:'Village',tag:'SLOW MORNINGS & WARM WINDOWS',icon:'home',color:'#b48758',sky:0xb5d8d8,ground:0xa0b77b,description:'A bakery lane, flower stalls and a windmill turning in the breeze.',detail:'Market square · Windmill garden · Apple orchard',spawn:{x:0,z:20},landmarks:[
    {id:'market',name:'The little flower market',x:0,z:3,memory:'A bouquet, a warm loaf, and a village that feels like home.'},
    {id:'windmill',name:'Windmill garden',x:-13,z:-6,memory:'We watched the sails turn, with nowhere else to be.'},
    {id:'orchard',name:'Apple orchard',x:13,z:-9,memory:'One apple for Dudu. One apple for Bubu. One for the road.'},
  ]},
  {id:'city',name:'Lumen City',kind:'City',tag:'LITTLE BEARS, BIG LIGHTS',icon:'city',color:'#788ba5',sky:0xafc6dd,ground:0xaaaeb1,description:'Pastel townhouses, a tram avenue and a fountain beneath the clock tower.',detail:'Clock square · Tram stop · Pocket garden',spawn:{x:0,z:21},landmarks:[
    {id:'clock',name:'Clocktower square',x:0,z:2,memory:'In a city full of clocks, we forgot to check the time.'},
    {id:'tram',name:'The old tram stop',x:14,z:8,memory:'Ding, ding. A little journey through a very big day.'},
    {id:'garden',name:'The pocket garden',x:-13,z:-11,memory:'Even between tall buildings, there is room for a little green.'},
  ]},
  {id:'beach',name:'Seashell Bay',kind:'Beach',tag:'SALT AIR & SANDY PAWS',icon:'water',color:'#579eaa',sky:0x83cddf,ground:0xe8d39e,description:'Waves roll in beneath palms, pastel parasols and a sleepy lighthouse.',detail:'Shell shore · Lighthouse walk · Sunset picnic',spawn:{x:0,z:19},landmarks:[
    {id:'shell',name:'The shell shore',x:0,z:-6,memory:'We held a shell to our ears. The sea had a story to tell.'},
    {id:'lighthouse',name:'Lighthouse walk',x:-16,z:0,memory:'A little light to help every wanderer find their way home.'},
    {id:'picnic',name:'The sandy picnic',x:13,z:7,memory:'The sandwiches had a little sand. The afternoon was perfect.'},
  ]},
  {id:'mountains',name:'Cloudstep Mountains',kind:'Mountains',tag:'A LITTLE CLOSER TO THE SKY',icon:'mountain',color:'#8b8d9b',sky:0xb0cddd,ground:0x91a187,description:'Follow the rising trail past pine trees, a mountain camp and distant snowy peaks.',detail:'Summit lookout · Campfire clearing · Alpine flowers',spawn:{x:0,z:20},landmarks:[
    {id:'summit',name:'Cloudstep lookout',x:8,z:-7,memory:'The whole world looked smaller. Our little adventure felt bigger.'},
    {id:'camp',name:'The mountain camp',x:-12,z:1,memory:'Warm paws, a tiny campfire, and stories until the stars came out.'},
    {id:'alpine',name:'Alpine flower trail',x:13,z:10,memory:'The tiniest flowers were brave enough to grow up here.'},
  ]},
  {id:'snowlands',name:'Starlight Snowlands',kind:'Snowlands',tag:'QUIET SNOW & COZY HEARTS',icon:'snow',color:'#819fb0',sky:0xbfcfdf,ground:0xe3ebeb,description:'Snowy firs, cozy cabins and a frozen pond. Stay until night for the northern lights.',detail:'Snowbear garden · Frozen lake · Lantern cabin',spawn:{x:0,z:20},landmarks:[
    {id:'snowbear',name:'The snowbear garden',x:0,z:4,memory:'We built a snowy friend with the warmest little smile.'},
    {id:'lake',name:'The frozen lake',x:12,z:-6,memory:'The lake kept the sky like a secret beneath the ice.'},
    {id:'cabin',name:'The lantern cabin',x:-13,z:-7,memory:'Outside, the snow kept falling. Inside, a little light waited.'},
  ]},
];
export const destinationById=id=>DESTINATIONS.find(place=>place.id===id);
export const destinationHeight=(id,x,z)=>id==='mountains'?.2+3.4*Math.exp(-((x-8)**2+(z+7)**2)/105):.2;
export const destinationLayout=id=>({radius:27,ponds:[],blocked:id==='beach'?(_x,z)=>z< -9.2:id==='snowlands'?(x,z)=>((x-13)/6)**2+((z+11)/4)**2<1:undefined});
export function freshTravel(){return {visited:['forest'],memories:[],positions:{}};}
export function rememberLandmark(log,id,landmarkId,position){
  const place=destinationById(id),landmark=place?.landmarks.find(item=>item.id===landmarkId),key=`${id}/${landmarkId}`;
  if(!landmark||log.memories.includes(key)||Math.hypot(position.x-landmark.x,position.z-landmark.z)>3)return false;
  log.memories.push(key);return true;
}
