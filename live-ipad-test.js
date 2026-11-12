// Isolated iPad test features; no changes to the normal live page.
(function(){
'use strict';
const $=id=>document.getElementById(id);
let spotify=null, spotifyApi=null, lastPaused=false, panelOpen=false;
const status=message=>{if($('ipadAudioStatus'))$('ipadAudioStatus').textContent=message};
// The private edit URL, not the unlocked editing state, controls visibility.\nconst isEdit=()=>Boolean(new URLSearchParams(location.hash.replace(/^#/, '')).get('key'));
const isIpad=()=>/iPad/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
function sync(){
 const allowed=isEdit()&&isIpad();
 $('ipadSwitch').hidden=!allowed;
 if(!allowed){$('ipadPanel').hidden=true;panelOpen=false;}
 else $('ipadPanel').hidden=!panelOpen;
}
function validSpotify(raw){
 try{const u=new URL(raw);if(u.protocol!=='https:'||u.hostname!=='open.spotify.com')return null;
 const m=u.pathname.match(/^\/(playlist|album|track)\/([A-Za-z0-9]+)\/?$/);return m?('spotify:'+m[1]+':'+m[2]):null;}catch{return null;}
}
function mount(){
 if(!spotifyApi)return status('Spotify wird geladen. Bitte nochmals tippen.');
 const uri=validSpotify($('spotifyPlaylistUrl').value.trim());
 if(!uri)return status('Bitte einen gültigen Spotify-Playlist-, Album- oder Titel-Link eingeben.');
 localStorage.setItem('padelSpotifyPlaylist', $('spotifyPlaylistUrl').value.trim());
 if(spotify){spotify.loadEntity(uri);return status('Spotify-Inhalt geladen. Play im Player antippen.');}
 spotifyApi.createController($('spotifyMount'),{uri,width:'100%',height:352},controller=>{
  spotify=controller;
  controller.addListener('playback_update',e=>{if(e?.data)lastPaused=!!e.data.isPaused});
  status('Spotify bereit. Zum Starten im Player Play antippen.');
 });
}
function resume(){
 if(!spotify)return status('Spotify-Player noch nicht bereit.');
 try{spotify.resume();status('Fortsetzen angefordert. Falls iPadOS blockiert: Play im Spotify-Player tippen.');}catch{status('Fortsetzen blockiert. Bitte Play im Spotify-Player tippen.');}
}
function attemptResume(){
 if(!$('autoResumeMusic').checked||!spotify)return;
 // iOS may reject playback without a fresh user gesture.
 resume();
}
function say(text){
 const synth=window.speechSynthesis;
 if(!synth)return status('Keine Sprachausgabe verfügbar.');
 synth.cancel();
 const u=new SpeechSynthesisUtterance(text);
 const voices=synth.getVoices().filter(v=>/^de/i.test(v.lang));
 u.voice=voices.find(v=>/anna|petra|helena|katja|marlene|vicki/i.test(v.name))||voices[0]||null;
 u.lang=u.voice?.lang||'de-DE';u.rate=.94;u.pitch=1.13;
 u.onend=()=>{status('Jingle beendet.');attemptResume()};
 u.onerror=()=>status('Jingle konnte nicht abgespielt werden.');
 synth.speak(u);status('Jingle: '+text);
}
function init(){
 $('ipadSwitch').addEventListener('click',()=>{if(!isEdit())return;panelOpen=!panelOpen;sync()});
 $('ipadExit').addEventListener('click',()=>{panelOpen=false;sync()});
 $('spotifyLoad').addEventListener('click',mount);
 $('spotifyResume').addEventListener('click',resume);
 $('spotifyPlaylistUrl').value=localStorage.getItem('padelSpotifyPlaylist')||'';
 const jingles=['Go, go, go, go!','Nice Shot!','Halbzeit ist!','Auf geht’s, Padel Hirsch!','Starker Punkt!','Match Point!'];
 jingles.forEach(t=>{const b=document.createElement('button');b.type='button';b.textContent=t;b.addEventListener('click',()=>say(t));$('jingleButtons').append(b)});
 const old=window.announceRound;
 if(typeof old==='function')window.announceRound=function(){old.apply(this,arguments);if(isEdit()&&panelOpen){const s=window.speechSynthesis;const check=()=>{if(s?.speaking||s?.pending){setTimeout(check,300);return;}attemptResume()};setTimeout(check,500)}};
 window.onSpotifyIframeApiReady=api=>{spotifyApi=api;if($('spotifyPlaylistUrl').value)mount()};
 const script=document.createElement('script');script.src='https://open.spotify.com/embed/iframe-api/v1';script.async=true;document.body.appendChild(script);
 setInterval(sync,800);sync();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();