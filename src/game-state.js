export const WORLD_RADIUS = 39;
export const DUDU_NEST = { x: -6, z: 29 };
export const BUBU_NEST = { x: 6, z: -32 };
export const START = { x: -6, z: 33 };
export const BUBU = { x: 6, z: -27 };
export const DESTINATION = { x: 6, z: -25 };
export const MOON_NEST = { x:-16, z:-29, height:10.4, entry:{x:-16,z:-22.5} };
export const PONDS = [{x:-8.5,z:0,rx:4.9,rz:3.6},{x:21,z:16,rx:4.9,rz:3.6}];
export const TRAILS = [
  {width:2.1,points:[[1,14],[-6,11],[-12,7],[-15,-1],[-13,-7],[-7,-11],[-1,-13],[7,-12],[13,-7],[15,0],[13,6],[8,12],[1,14]]},
  {width:2.5,points:[[-6,33],[6,32],[20,26],[29,14],[33,0],[29,-14],[18,-25],[6,-27],[-8,-27],[-23,-20],[-31,-6],[-29,10],[-21,24],[-6,33]]},
  {width:1.8,points:[[-6,33],[-1,31],[0,25],[1,14]]},
  {width:1.8,points:[[-21,24],[-17,17],[-12,7]]},
  {width:1.8,points:[[29,14],[28,16],[21,16],[14,16],[8,12]]},
  {width:1.8,points:[[29,-14],[22,-8],[13,-7]]},
  {width:2,points:[[6,-27],[2,-20],[-1,-13]]},
  {width:1.8,points:[[-23,-20],[-17,-12],[-13,-7]]},
  {width:1.8,points:[[-31,-6],[-23,-4],[-15,0],[-9,0],[-3,1],[0,5],[1,12]]},
  {width:1.8,points:[[33,0],[24,0],[15,0]]},
  {width:1.4,points:[[12,-7],[14,-6],[16,-7]]},
  {width:1.5,points:[[-12,-25],[-14,-24],[-16,-22.5]]},
];
export const GIFTS = [
  { id:'flowers', name:'A pocketful of flowers', short:'Wildflowers', x:-9, z:8, color:0xd694a0, location:'The wildflower meadow', description:'A few wildflowers, a little sunshine, and every color of her smile.', note:'“She always stops to smell the flowers.”', hint:'Look for pink flowers in the meadow, southwest of the pond.' },
  { id:'honey', name:'Something sweet', short:'Honey jar', x:-14, z:-5, color:0xd6ad5c, location:'Honeybee hollow', description:'Golden forest honey. For the sweetest bear Dudu knows.', note:'“Just a little taste… okay, maybe two.”', hint:'The bees left something sweet by the little cottage, west of the pond.' },
  { id:'scarf', name:'A warm little hug', short:'Cozy scarf', x:-2, z:-12, color:0xbb8d9e, location:'The whispering pines', description:'A soft, rosy scarf for chilly evenings and walks that last a little longer.', note:'“For when I’m not there to keep you warm.”', hint:'A cozy surprise is tucked beside the tall pines on the northern trail.' },
  { id:'letter', name:'Words from the heart', short:'Love letter', x:13, z:-5, color:0x86a9a1, location:'The wishing tree', description:'A tiny envelope with a very big feeling. Dudu rewrote it three times.', note:'“Every little adventure is better with you.”', hint:'Find the old wishing tree on the eastern side of the forest.' },
  { id:'cake', name:'The birthday essential', short:'Birthday cake', x:10, z:9, color:0xd1a17c, location:'Buttercup clearing', description:'Strawberries, soft frosting, and one candle for a wish that might just come true.', note:'“I remembered the candle this time!”', hint:'Follow the southern path east to Buttercup clearing. There might be cake.' },
  { id:'chocolates', name:'A box of little joys', short:'Chocolates', x:-22, z:19, color:0xb78473, location:'Clover fields', description:'Heart-shaped chocolates, carefully saved for someone very special.', note:'“I only ate the one that looked lonely.”', hint:'The rabbits in the southwestern clover fields are keeping a sweet surprise safe.' },
  { id:'balloon', name:'Love, lighter than air', short:'Love balloon', x:28, z:6, color:0xd88f9b, location:'Heartwind meadow', description:'A pink heart balloon with a tiny promise tied to its ribbon.', note:'“Wherever the wind goes, I’ll find you.”', hint:'Follow the heart balloons to the eastern meadow, above the second pond.' },
  { id:'musicbox', name:'Our little melody', short:'Music box', x:-23, z:-18, color:0x9aaea8, location:'Moonflower grove', description:'A little wooden music box. Their favorite song, tucked into Dudu’s bag.', note:'“One more dance before we go home?”', hint:'A melody is hiding in Moonflower grove on the northwestern outer trail.' },
];
export const SAVE_KEY = 'dudu-bubu-birthday-v1';

export function freshState() { return { version:2, position: { ...START }, collected: [], completed: false, departed:false, bubuArrived:false, companionPosition:null }; }
export function restoreState(raw) {
  try {
    const value = JSON.parse(raw);
    if (!value || !Array.isArray(value.collected)) return freshState();
    const collected = [...new Set(value.collected)].filter(id => GIFTS.some(g => g.id === id));
    const position = value.position;
    const validPosition = position && Number.isFinite(position.x) && Number.isFinite(position.z) && Math.hypot(position.x, position.z) < WORLD_RADIUS;
    const current=value.version===2;
    const completed=current&&value.completed===true&&collected.length===GIFTS.length;
    const companion=value.companionPosition;
    const companionPosition=completed&&companion&&Number.isFinite(companion.x)&&Number.isFinite(companion.z)&&isWalkable(companion.x,companion.z)?{x:companion.x,z:companion.z}:null;
    return { version:2, position: current&&validPosition ? { x:position.x, z:position.z } : { ...START }, collected, completed, departed:current&&(value.departed===true||completed), bubuArrived:current&&collected.length===GIFTS.length&&(value.bubuArrived===true||completed), companionPosition };
  } catch { return freshState(); }
}
export function collectGift(state, id) {
  const gift = GIFTS.find(g => g.id === id);
  if (!gift || state.collected.includes(id) || Math.hypot(state.position.x - gift.x, state.position.z - gift.z) > 2.5) return false;
  state.collected.push(id);
  return true;
}
export function canCelebrate(state) {
  return !state.completed && state.bubuArrived && state.collected.length === GIFTS.length && Math.hypot(state.position.x - BUBU.x, state.position.z - BUBU.z) <= 3.2;
}
export function shouldRevealBubu(state) { return state.departed&&state.collected.length===GIFTS.length&&!state.bubuArrived&&Math.hypot(state.position.x-DESTINATION.x,state.position.z-DESTINATION.z)<=4; }
export function guidanceTarget(state, preferredId) {
  if(state.completed)return {...MOON_NEST.entry,id:'moon-nest',short:'Moonwatch nest'};
  const missing=GIFTS.filter(g=>!state.collected.includes(g.id));
  return missing.find(g=>g.id===preferredId)||missing.sort((a,b)=>Math.hypot(a.x-state.position.x,a.z-state.position.z)-Math.hypot(b.x-state.position.x,b.z-state.position.z))[0]||{...(state.bubuArrived?BUBU:DESTINATION),id:'bubu',short:state.bubuArrived?'Birthday picnic':'Bubu’s nest'};
}
export function clampZoom(view) { return Math.min(108,Math.max(14,view)); }
export function isWalkable(x, z, obstacles = [], layout) {
  if (Math.hypot(x, z) > (layout?.radius ?? WORLD_RADIUS)) return false;
  if(layout?.blocked?.(x,z))return false;
  // A wooden bridge crosses the middle of the pond.
  for(const pond of layout?.ponds ?? PONDS)if(((x-pond.x)/pond.rx)**2+((z-pond.z)/pond.rz)**2<1&&Math.abs(z-pond.z)>.85)return false;
  for (const obstacle of obstacles) if (Math.hypot(x - obstacle.x, z - obstacle.z) < obstacle.radius + .38) return false;
  return true;
}
export function moveWithCollisions(position, dx, dz, obstacles, layout) {
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / .2));
  for (let step = 0; step < steps; step++) {
    if (isWalkable(position.x + dx / steps, position.z, obstacles, layout)) position.x += dx / steps;
    if (isWalkable(position.x, position.z + dz / steps, obstacles, layout)) position.z += dz / steps;
  }
  return position;
}

// Small A* grid keeps click-to-walk routes around trees and water.
export function findPath(start, goal, obstacles, layout) {
  if (!isWalkable(goal.x, goal.z, obstacles, layout)) return [];
  const snap = n => Math.round(n), key = (x,z) => `${x},${z}`;
  const sx = snap(start.x), sz = snap(start.z), gx = snap(goal.x), gz = snap(goal.z);
  const open = [{ x:sx, z:sz, g:0, f:0 }], seen = new Map([[key(sx,sz),0]]), parents = new Map();
  const directions = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
  for (let iterations = 0; open.length && iterations < 6500; iterations++) {
    open.sort((a,b) => a.f - b.f);
    const current = open.shift();
    if (current.x === gx && current.z === gz) {
      const path = [{...goal}];
      let cursor = current;
      while (cursor) { path.unshift({x:cursor.x,z:cursor.z}); cursor = parents.get(key(cursor.x,cursor.z)); }
      path.shift();
      return path;
    }
    for (const [dx,dz] of directions) {
      const x=current.x+dx, z=current.z+dz;
      if (!isWalkable(x,z,obstacles,layout) || !isWalkable(current.x+dx/2,current.z+dz/2,obstacles,layout)) continue;
      if (dx && dz && (!isWalkable(current.x+dx,current.z,obstacles,layout) || !isWalkable(current.x,current.z+dz,obstacles,layout))) continue;
      const cost=current.g+Math.hypot(dx,dz), id=key(x,z);
      if (cost >= (seen.get(id) ?? Infinity)) continue;
      seen.set(id,cost); parents.set(id,current);
      open.push({x,z,g:cost,f:cost+Math.hypot(gx-x,gz-z)});
    }
  }
  return [];
}
