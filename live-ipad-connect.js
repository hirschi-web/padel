// Spotify Connect controller: audio plays in the native Spotify app, never in the page.
(()=>{
'use strict';
const $=id=>document.getElementById(id), auth=()=>window.padelSpotifyAuth;
const key='padelSpotifyPlaylist';
let panelOpen=false,device=null,playback=null,busy=false;
const allowed=()=>Boolean(new URLSearchParams(location.hash.slice(1)).get('key'))&&(/iPad/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1));
const note=t=>{$('ipadAudioStatus').textContent=t};
const uri=()=>$('spotifyPlaylistSelect').value;
const deviceParam=()=>'?device_id='+encodeURIComponent(device.id);
const error=e=>{const msg=e?.message||String(e);note(msg.includes('404')?'Spotify-Gerät nicht erreichbar (404). Spotify-App öffnen, Musik starten und dann „Gerät prüfen“ tippen.':msg)};
async function refresh(){
 if(!auth().connected()){$('spotifyConnectionState').textContent='Nicht verbunden';$('spotifyLogin').hidden=false;device=null;return}
 $('spotifyLogin').hidden=true;
 try{
  const [state,devices]=await Promise.all([auth().api('GET','me/player'),auth().api('GET','me/player/devices')]);
  const all=devices?.devices||[];
  // Never transfer playback to a browser or a different device automatically.
  device=state?.device&&!state.device.is_restricted?state.device:null;
  if(!device){device=all.find(d=>d.is_active&&!d.is_restricted)||null}
  playback=state||null;
  $('spotifyConnectionState').textContent=device?'Aktiv: '+device.name:'Verbunden · kein aktives Gerät';
  $('spotifyPlay').textContent=state?.is_playing?'⏸ Pause':'▶ Play';
  $('spotifyShuffle').textContent=state?.shuffle_state?'⇄ Shuffle an':'⇄ Shuffle';
  $('spotifyShuffle').setAttribute('aria-pressed',String(!!state?.shuffle_state));
  if(!device)note('Bitte Spotify-App auf dem iPad öffnen, einen Song starten und danach hier „Gerät prüfen“ tippen.');
 }catch(e){error(e)}
}
async function command(method,path,body){
 if(busy)return;
 if(!device){note('Kein aktives Spotify-Gerät. Spotify-App starten und „Gerät prüfen“ tippen.');return}
 busy=true;
 try{await auth().api(method,path+deviceParam(),body);await new Promise(r=>setTimeout(r,350));await refresh()}
 catch(e){error(e)}
 finally{busy=false}
}
function speech(t){
 if(!window.speechSynthesis)return note('Sprachausgabe nicht verfügbar');
 const s=speechSynthesis;s.cancel();const u=new SpeechSynthesisUtterance(t);
 const voices=s.getVoices().filter(v=>/^de/i.test(v.lang));
 u.voice=voices.find(v=>/anna|petra|helena|katja|marlene|vicki/i.test(v.name))||voices[0]||null;
 u.lang=u.voice?.lang||'de-DE';u.rate=.94;u.pitch=1.13;
 u.onend=()=>note('Jingle beendet. Spotify-Wiedergabe bitte kontrollieren.');
 s.speak(u);note('Jingle: '+t);
}
function sync(){
 const ok=allowed();$('ipadSwitch').hidden=!ok;
 $('ipadPanel').hidden=!(ok&&panelOpen);
}
function init(){
 $('ipadSwitch').addEventListener('click',()=>{panelOpen=!panelOpen;sync();if(panelOpen)refresh()});
 $('ipadExit').addEventListener('click',()=>{panelOpen=false;sync()});
 $('spotifyLogin').addEventListener('click',()=>auth().login());
 $('spotifyRefresh').addEventListener('click',refresh);
 $('spotifyPlaylistSelect').addEventListener('change',()=>{localStorage.setItem(key,uri());note('Playlist gewählt. „Playlist starten“ tippen.')});
 const saved=localStorage.getItem(key);if(saved&&[...$('spotifyPlaylistSelect').options].some(o=>o.value===saved))$('spotifyPlaylistSelect').value=saved;
 $('spotifyStartPlaylist').addEventListener('click',()=>command('PUT','me/player/play',{context_uri:uri()}));
 $('spotifyPlay').addEventListener('click',()=>playback?.is_playing?command('PUT','me/player/pause'):command('PUT','me/player/play'));
 $('spotifyPrevious').addEventListener('click',()=>command('POST','me/player/previous'));
 $('spotifyNext').addEventListener('click',()=>command('POST','me/player/next'));
 $('spotifyShuffle').addEventListener('click',()=>command('PUT','me/player/shuffle?state='+(!playback?.shuffle_state)+'&device_id='+encodeURIComponent(device?.id||'')));
 // Smart Shuffle is not supported by the Spotify Web API. Do not provide a misleading working control.
 $('spotifySmartShuffle').disabled=true;
 const jingles=['Halbzeit ist!','Auf geht’s, Padel Hirsch!','Starker Punkt!','Match Point!'];
 jingles.forEach(t=>{const b=document.createElement('button');b.type='button';b.textContent=t;b.addEventListener('click',()=>speech(t));$('jingleButtons').append(b)});
 window.addEventListener('hashchange',sync);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&panelOpen)refresh()});
 setInterval(sync,1000);sync();
 if(auth().connected())refresh();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();