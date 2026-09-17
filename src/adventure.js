import { GIFTS, MOON_NEST } from './game-state.js';

export const PLACES = [
  { id:'clover', name:'Clover fields', x:-22, z:21, radius:5, icon:'leaf', color:'#819a68', hint:'Follow the southern loop to the rabbits and little fences.', memory:'The rabbits made room for one more friend in the clover.' },
  { id:'bridge', name:'Willow bridge', x:-8.5, z:0, radius:4, icon:'water', color:'#729c9a', hint:'Listen for the ducks beside the wooden bridge.', memory:'A tiny bridge, a quiet pond, and absolutely nowhere to hurry.' },
  { id:'hollow', name:'Honeybee hollow', x:-14, z:-5, radius:4, icon:'sun', color:'#bc9552', hint:'The little cottage west of the pond smells like honey.', memory:'Dudu decided that a forest can smell like a warm hug.' },
  { id:'heartwind', name:'Heartwind meadow', x:28, z:6, radius:4, icon:'heart', color:'#bc8190', hint:'Pink heart balloons mark the eastern meadow.', memory:'Even the breeze had brought something for Bubu’s birthday.' },
  { id:'moonflowers', name:'Moonflower grove', x:-23, z:-18, radius:4, icon:'flower', color:'#9691b7', hint:'Find the blue flowers along the northwestern loop.', memory:'A little melody was hiding among the moonflowers.' },
  { id:'moonwatch', name:'Moonwatch nest', ...MOON_NEST.entry, radius:5, icon:'moon', color:'#7f91aa', afterBirthday:true, hint:'After the birthday, climb the tall tree together.', memory:'The best seat in the forest had room for exactly two bears.' },
];
export const FRIENDS = [
  {kind:'rabbit',name:'The clover rabbits',hint:'Tiny hops in the southwestern fields.',memory:'A little nose twitch. A very big hello.'},
  {kind:'sheep',name:'The meadow sheep',hint:'Look for fluffy wool near the southern fence.',memory:'Soft wool, warm sunshine, and a friend who likes the quiet.'},
  {kind:'deer',name:'The woodland deer',hint:'Walk gently through the northeastern trees.',memory:'For a moment, even the shyest friend stayed to say hello.'},
  {kind:'fox',name:'The curious foxes',hint:'Rust-coloured tails along the western trails.',memory:'A curious look, a happy tail, and a new forest friend.'},
];

export function freshAdventure(){return {places:[],friends:[],postcards:0};}

export function discoverPlaces(adventure,game,position){
  if(!game.departed)return [];
  const discovered=PLACES.filter(place=>{
    if(adventure.places.includes(place.id))return false;
    if(place.afterBirthday)return game.completed&&position.y>=MOON_NEST.height-.35&&Math.hypot(position.x-MOON_NEST.x,position.z-(MOON_NEST.z+2.8))<4;
    return Math.hypot(position.x-place.x,position.z-place.z)<=place.radius;
  });
  adventure.places.push(...discovered.map(place=>place.id));return discovered;
}

export function befriend(adventure,kind){
  if(!FRIENDS.some(friend=>friend.kind===kind)||adventure.friends.includes(kind))return false;
  adventure.friends.push(kind);return true;
}

export function birthdayChapter(game){
  const count=game.collected.length;
  if(game.completed)return {number:4,title:'A little longer, together',detail:'Follow the moon trail. There’s a nest for two.',count};
  if(game.bubuArrived)return {number:3,title:'Make a birthday wish',detail:'Join Bubu at the picnic and celebrate.',count};
  if(count===GIFTS.length)return {number:2,title:'Someone’s waiting for you',detail:'All eight gifts are ready. Visit Bubu’s nest.',count};
  return {number:1,title:'A bag full of love',detail:game.departed?'Eight little surprises, at your own pace.':'Your adventure begins at Dudu’s nest.',count};
}

export function placeDestination(place){
  // Arrive at the cottage doorstep or bridge rather than inside scenery.
  if(place.id==='hollow')return {...place,x:-13,z:-4,short:place.name,place:true};
  return {...place,short:place.name,place:true};
}
