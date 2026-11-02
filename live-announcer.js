// Round announcements: schedule first, scores only when schedule times are unavailable.
(function () {
    let activeUtterance = null;
    function selectRound(rounds, minute) {
        if (!rounds.length) return null;
        const starts = rounds.map(r => {
            const m = String(r.time || '').match(/^(\d{1,2}):(\d{2})(?:\b)/);
            return m && +m[1] < 24 && +m[2] < 60 ? +m[1] * 60 + +m[2] : null;
        });
        const timed = starts.every(t => t !== null) && starts.every((t, i) => !i || t > starts[i - 1]);
        if (timed) {
            if (minute < starts[0]) return {round: rounds[0], current: false};
            let i = starts.length - 1;
            while (i > 0 && minute < starts[i]) i--;
            const current = minute - starts[i] < 3;
            return current ? {round: rounds[i], current: true} : rounds[i + 1] ? {round: rounds[i + 1], current: false} : null;
        }
        const open = rounds.findIndex(r => r.matches?.some(m => !m.score || m.score.length < 2 || m.score.some(s => s === '' || s === null || s === undefined)));
        return open >= 0 && rounds[open + 1] ? {round: rounds[open + 1], current: false} : null;
    }
    function announcement(data, minute) {
        const choice = selectRound(data.s_new || [], minute);
        if (!choice) return 'Keine weitere Runde geplant.';
        const names = ids => ids.map(id => typeof id === 'number' ? data.p?.[id] : null);
        const matches = choice.round.matches || [];
        if (!matches.length) return 'Die Paarung steht noch nicht fest.';
        const pairs = [];
        for (const match of matches) {
            const a = names(match.team1 || []), b = names(match.team2 || []);
            if (a.length !== 2 || b.length !== 2 || [...a, ...b].some(n => !n)) return 'Die Paarung steht noch nicht fest.';
            pairs.push(`${a.join(' und ')} gegen ${b.join(' und ')}`);
        }
        return `${choice.current ? 'Aktuelle Runde' : 'Nächste Runde'}: ${pairs.join('. ')}.`;
    }
    window.padelAnnouncement = {selectRound, announcement};
    window.announceRound = function () {
        const status = document.getElementById('announcementStatus');
        const btn = document.getElementById('announceBtn');
        const report = text => {status.textContent = text;status.hidden = false;};
        if (typeof tournamentData === 'undefined' || !tournamentData?.s_new?.length) {report('Bitte zuerst ein Turnier laden.');return;}
        const synth = window.speechSynthesis;
        if (!synth || !window.SpeechSynthesisUtterance) {report('Dieses Gerät unterstützt keine Sprachausgabe.');return;}
        if (synth.speaking || synth.pending) {synth.cancel();activeUtterance = null;btn.setAttribute('aria-pressed','false');report('Ansage gestoppt. Für eine neue Ansage nochmals tippen.');return;}
        // Tournament times are Austrian local times, independent of device timezone.
        const parts = new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Vienna',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date());
        const part = type => Number(parts.find(p => p.type === type).value);
        const text = announcement(tournamentData, part('hour') * 60 + part('minute') + part('second') / 60);
        const u = new SpeechSynthesisUtterance(text);
        const voices = synth.getVoices().filter(v => /^de(?:-|_)/i.test(v.lang));
        const voice = voices.find(v => /anna|petra|helena|katja|marlene|vicki/i.test(v.name)) || voices[0];
        if (voice) u.voice = voice;
        u.lang = voice?.lang || 'de-DE';u.rate = 0.86;u.pitch = 1.15;u.volume = 1;
        activeUtterance = u;report(text);btn.setAttribute('aria-pressed','true');
        const finish = () => {if(activeUtterance === u){activeUtterance = null;btn.setAttribute('aria-pressed','false');}};
        u.onend = finish;
        u.onerror = e => {if(activeUtterance === u){finish();if(e.error !== 'canceled' && e.error !== 'interrupted')report('Ansage nicht möglich. Bitte erneut tippen und den Geräteton prüfen.');}};
        try {if(synth.paused)synth.resume();synth.speak(u);} catch (_) {finish();report('Sprachausgabe konnte nicht gestartet werden.');}
    };
    window.addEventListener('pagehide', () => {if(activeUtterance)window.speechSynthesis?.cancel();activeUtterance=null;});
})();
