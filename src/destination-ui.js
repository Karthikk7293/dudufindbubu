import { DESTINATIONS, destinationTotals, travelGiftCount } from './destinations.js';

export function destinationArt(place){
  const sky=`#${place.sky.toString(16).padStart(6,'0')}`,ground=`#${place.ground.toString(16).padStart(6,'0')}`;
  const pine=(x,y,s=1)=>`<g transform="translate(${x} ${y}) scale(${s})"><path d="M0 0V-38" stroke="#8b795e" stroke-width="5"/><path d="M-19-6 0-52 19-6Z" fill="#668777"/><path d="M-13-29 0-58 13-29Z" fill="${place.id==='snowlands'?'#edf2ed':'#80a18a'}"/></g>`;
  const house=(x,y,c='#d0ac89')=>`<g transform="translate(${x} ${y})"><path d="M-22 0V-34H22V0" fill="${c}"/><path d="M-29-33 0-59 29-33Z" fill="${place.id==='snowlands'?'#f1f3e8':'#9c7660'}"/><path d="M-6 0V-18H6V0" fill="#927d69"/><path d="M-16-24H-8V-15H-16ZM8-24H16V-15H8Z" fill="#fff0bd"/></g>`;
  let shapes='';
  if(place.id==='forest')shapes=pine(50,124,1.3)+pine(235,129,1.8)+pine(185,119)+house(118,121,'#a1af82');
  if(place.id==='village')shapes=house(54,128)+house(235,120,'#c5b798')+`<path d="M148 126H120L126 64H142Z" fill="#ede3c5"/><path d="M116 67 134 45 153 67" fill="#a18467"/><g stroke="#fbf4de" stroke-width="7"><path d="M134 87 106 60M134 87 163 59M134 87 105 116M134 87 162 116"/></g>`;
  if(place.id==='city')shapes=[35,90,162,229].map((x,i)=>`<rect x="${x}" y="${40+i%2*24}" width="40" height="${90-i%2*24}" rx="2" fill="${['#a3b8ba','#d4b3a2','#a1afc3','#c6bba0'][i]}"/>${[0,1,2].map(j=>`<path d="M${x+8} ${57+j*23+i%2*12}h8v10h-8ZM${x+24} ${57+j*23+i%2*12}h8v10h-8Z" fill="#f4e6bd"/>`).join('')}`).join('');
  if(place.id==='beach')shapes=`<path d="M0 99Q90 77 175 108T300 95V155H0" fill="#7fbac1"/><path d="M0 110Q90 87 175 118T300 108" fill="none" stroke="#e6efe0" stroke-width="3"/><path d="M66 124 72 55" stroke="#ae916f" stroke-width="6"/><path d="M72 57Q39 32 29 72Q49 56 72 57M72 57Q101 25 123 65Q98 55 72 57M72 57Q62 28 53 39" fill="#739879"/><path d="M216 133V97" stroke="#aa8e6b" stroke-width="3"/><path d="M187 99Q215 56 245 99Z" fill="#e4b49a"/>`;
  if(place.id==='mountains')shapes=`<path d="M9 131 83 34 153 133M118 131 199 16 291 135" fill="#94a3a5"/><path d="M59 65 83 34 107 65 87 58 80 65 70 57M170 50 199 16 230 55 209 46 196 53 186 42" fill="#e9eddf"/>${pine(50,140,.85)}${pine(250,145,1.1)}`;
  if(place.id==='snowlands')shapes=pine(39,137,1.4)+house(128,133,'#b9a187')+pine(235,135,1.65)+`<g fill="#fffaf0"><circle cx="199" cy="116" r="12"/><circle cx="199" cy="98" r="8"/><circle cx="195" cy="87" r="3"/><circle cx="204" cy="87" r="3"/></g>`;
  return `<svg viewBox="0 0 300 155" aria-hidden="true"><rect width="300" height="155" fill="${sky}"/><circle cx="244" cy="31" r="15" fill="#fff0c1"/><path d="M0 113Q70 88 157 116T300 103V155H0" fill="${ground}"/>${shapes}<path d="M146 155Q129 139 157 126" fill="none" stroke="#f2e9d3" stroke-width="9" opacity=".65"/></svg>`;
}

export function renderDestinations(travel,canTravel){
  const total=travel.log.memories.length,gifts=travel.log.gifts.length,totals=destinationTotals();
  document.getElementById('travel-progress').textContent=`${travel.log.visited.length} / ${DESTINATIONS.length} destinations · ${gifts} / ${totals.gifts} gift boxes · ${total} / ${totals.memories} little memories`;
  document.getElementById('travel-cards').innerHTML=DESTINATIONS.map(place=>{
    const current=travel.current.id===place.id,visited=travel.log.visited.includes(place.id),count=travel.log.memories.filter(key=>key.startsWith(place.id+'/')).length,found=travelGiftCount(travel.log,place.id);
    return `<article class="destination-card ${current?'is-current':''}" style="--destination-accent:${place.color}"><div class="destination-art">${destinationArt(place)}<span>${current?'YOU ARE HERE':visited?'A FAMILIAR PLACE':place.kind.toUpperCase()}</span></div><div class="destination-copy"><small>${place.tag}</small><h3>${place.name}</h3><p>${place.description}</p><span class="destination-stamps">${place.id==='forest'?'The birthday adventure':`${found} / ${place.gifts.length} gifts · ${count} / ${place.landmarks.length} memories`}</span><button data-destination="${place.id}" ${current||!canTravel?'disabled':''}>${current?'Enjoy this little place':place.id==='forest'?'Return to the birthday trail ↗':`Visit ${place.kind.toLowerCase()} ↗`}</button></div></article>`;
  }).join('');
  document.getElementById('travel-note').textContent=canTravel?'Your birthday gifts stay safe in Sunnywood. Bubu comes along to every destination, and every place has its own gift boxes, landmarks and little friends.':'Travel is ready once Dudu has left home and the current scene has finished.';
  const kept=DESTINATIONS.flatMap(place=>[
    ...place.landmarks.filter(item=>travel.log.memories.includes(`${place.id}/${item.id}`)).map(item=>`<article><small>${place.name}</small><h3>${item.name}</h3><p>${item.memory}</p></article>`),
    ...place.gifts.filter(item=>travel.log.gifts.includes(`${place.id}/${item.id}`)).map(item=>`<article><small>${place.name} · gift box</small><h3>${item.name}</h3><p>${item.note}</p></article>`),
  ]).join('');
  document.getElementById('travel-memories').innerHTML=kept||'<p>Every destination hides gift boxes with ribbons and little golden diamonds. Get close and tap the heart, or press E, to keep one.</p>';
}
