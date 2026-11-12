// Spotify iFrame Embed: keep official player visible for playback and authentication.
(()=>{
'use strict';
const $=id=>document.getElementById(id);
let panelOpen=false,api=null,player=null,ready=false;
const allowed=()=>Boolean(new URLSearchParams(location.hash.slice(1)).get('key'))&&(/iPad/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1));
const note=s=>{$('ipadAudioStatus').textContent=s};
function sync(){const yes=allowed();$('ipadSwitch').hidden=!yes;$('ipadPanel').hidden=!(yes&&panelOpen)}
function mount(){
 if(!api)return;
 const uri=$('spotifyPlaylistSelect').value;
 localStorage.setItem('padelSpotifyPlaylist',uri);
 if(player){player.loadEntity(uri);note('Playlist geladen. Wiedergabe im Spotify-Player starten.');return}
 api.createController($('spotifyMount'),{uri,width:'100%',height:152},controller=>{
  player=controller;
  controller.addListener('ready',()=>{
   ready=true;
   const frame=$('spotifyMount').querySelector('iframe');
   if(frame){
    const permissions=new Set((frame.getAttribute('allow')||'').split(';').map(x=>x.trim()).filter(Boolean));
    ['autoplay','clipboard-write','encrypted-media','fullscreen','picture-in-picture'].forEach(x=>permissions.add(x));
    frame.setAttribute('allow',[...permissions].join('; '));
    frame.setAttribute('title','Spotify Playlist Player');
   }
   note('Spotify-Player bereit. Falls nur 30 Sekunden: Spotify-Anmeldung und Browser-Medienfreigabe prüfen.');
  });
  controller.addListener('playback_update',e=>{if(e?.data?.isPaused===false)note('Spotify spielt.');});
 });
}
function speech(t){
 const synth=window.speechSynthesis;if(!synth)return note('Keine Sprachausgabe verfügbar.');
 synth.cancel();const u=new SpeechSynthesisUtterance(t);
 const voices=synth.getVoices().filter(v=>/^de/i.test(v.lang));
 u.voice=voices.find(v=>/anna|petra|helena|katja|marlene|vicki/i.test(v.name))||voices[0]||null;
 u.lang=u.voice?.lang||'de-DE';u.rate=.94;u.pitch=1.13;
 u.onend=()=>note('Jingle beendet.');
 synth.speak(u);note('Jingle: '+t);
}
function init(){
 $('ipadSwitch').addEventListener('click',()=>{panelOpen=!panelOpen;sync()});
 $('ipadExit').addEventListener('click',()=>{panelOpen=false;sync()});
 $('spotifyStartPlaylist').addEventListener('click',mount);
 $('spotifyPlaylistSelect').addEventListener('change',mount);
 const saved=localStorage.getItem('padelSpotifyPlaylist');
 if(saved&&[...$('spotifyPlaylistSelect').options].some(x=>x.value===saved))$('spotifyPlaylistSelect').value=saved;
 ['Halbzeit ist!','Auf geht’s, Padel Hirsch!','Starker Punkt!','Match Point!'].forEach(t=>{
  const b=document.createElement('button');b.type='button';b.textContent=t;b.addEventListener('click',()=>speech(t));$('jingleButtons').append(b);
 });
 window.onSpotifyIframeApiReady=a=>{api=a;mount()};
 const script=document.createElement('script');script.src='https://open.spotify.com/embed/iframe-api/v1';script.async=true;script.onerror=()=>note('Spotify iFrame API konnte nicht geladen werden.');document.body.appendChild(script);
 window.addEventListener('hashchange',sync);setInterval(sync,1000);sync();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();