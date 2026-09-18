import { PLACES, FRIENDS, birthdayChapter } from './adventure.js';
import { icons } from './icons.js';

const $=id=>document.getElementById(id);
export class AdventureJournal {
  constructor(){
    this.tab='gifts';this.key='';
    document.querySelectorAll('[data-journal-tab]').forEach(button=>{
      button.addEventListener('click',()=>this.select(button.dataset.journalTab));
      button.addEventListener('keydown',event=>{
        const tabs=[...document.querySelectorAll('[data-journal-tab]')],index=tabs.indexOf(button);
        const next=event.key==='ArrowRight'?(index+1)%tabs.length:event.key==='ArrowLeft'?(index+tabs.length-1)%tabs.length:event.key==='Home'?0:event.key==='End'?tabs.length-1:null;
        if(next!==null){event.preventDefault();this.select(tabs[next].dataset.journalTab);tabs[next].focus();}
      });
    });
    this.select('gifts');
  }
  select(tab){
    this.tab=tab;
    document.querySelectorAll('[data-journal-tab]').forEach(button=>{
      const active=button.dataset.journalTab===tab;button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;
    });
    document.querySelectorAll('[data-journal-panel]').forEach(panel=>panel.hidden=panel.dataset.journalPanel!==tab);
  }
  render(game,adventure){
    const key=JSON.stringify([game.collected,game.bubuArrived,game.completed,game.departed,adventure]);if(key===this.key)return;this.key=key;
    const chapter=birthdayChapter(game);
    $('journal-chapter').textContent=`CHAPTER ${chapter.number} / 4`;
    $('journal-title').textContent=chapter.title;$('journal-description').textContent=chapter.detail;
    $('journal-progress').textContent=`${chapter.count} / 8 gifts · ${adventure.places.length} / 6 places · ${adventure.friends.length} / 4 friends`;
    $('journey-label').textContent=game.completed?'Together ♡':`${chapter.count} / 8 birthday gifts`;
    $('journey-status').setAttribute('aria-label',`Open adventure journal. ${chapter.count} of 8 gifts, ${adventure.places.length} places discovered.`);
    $('journey-dots').innerHTML=Array.from({length:8},(_,i)=>`<i class="${i<chapter.count?'filled':''}"></i>`).join('');
    $('journal-places').innerHTML=PLACES.map(place=>{
      const found=adventure.places.includes(place.id),locked=place.afterBirthday&&!game.completed;
      return `<article data-place="${place.id}" class="journal-place ${found?'visited':''}" style="--stamp:${place.color}"><div class="place-stamp" aria-hidden="true">${icons[place.icon]||icons.leaf}</div><span class="entry-status">${found?'DISCOVERED':locked?'AFTER THE BIRTHDAY':'A PLACE TO FIND'}</span><h3>${place.name}</h3><p>${found?place.memory:place.hint}</p></article>`;
    }).join('');
    $('journal-friends').innerHTML=FRIENDS.map(friend=>{
      const found=adventure.friends.includes(friend.kind);
      return `<article class="journal-friend ${found?'visited':''}"><span class="friend-stamp" aria-hidden="true">${icons.paw}</span><div><span class="entry-status">${found?'A NEW FRIEND':'SOMEONE TO MEET'}</span><h3>${friend.name}</h3><p>${found?friend.memory:friend.hint}</p></div><span class="friend-check" aria-label="${found?'Befriended':'Not yet met'}">${found?'♡':'·'}</span></article>`;
    }).join('');
    $('postcard-count').textContent=adventure.postcards?`${adventure.postcards} postcard${adventure.postcards===1?'':'s'} made on this adventure`:'Make a postcard to remember this little world.';
  }
}
