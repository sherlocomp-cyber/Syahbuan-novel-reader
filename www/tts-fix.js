/* tts-fix.js v2: bacaan tetap jalan di latar belakang, lanjut antar bab, saklar "Lanjut otomatis" tidak berubah sendiri.
   Dimuat setelah skrip utama (disisipkan otomatis oleh native/apply.sh saat build).

   Ringkasan perbaikan:
   1. ttsEnd: tunggu pemuatan lain, coba ulang bila gagal, tidak berhenti diam-diam.
   2. Bab berikutnya dimuat lebih awal (tidak menunggu akhir bab / scroll yang mati di latar belakang).
   3. Suara perangkat: kalimat bab berikutnya langsung dirantai ke antrean mesin HP, jadi pindah bab tanpa JavaScript.
   4. Suara Edge: unduh 3 kalimat ke depan agar tahan gangguan jaringan sesaat.
   5. Audio penjaga memakai level di atas ambang senyap Chromium agar halaman dianggap "sedang memutar audio"
      dan timer tidak dibatasi saat layar mati.
   6. Saklar "Lanjut otomatis" hanya berubah oleh sentuhan langsung pada saklar; nilainya disimpan terpisah.
   7. Log diagnostik terlihat di panel pengaturan suara (dan bertahan walau aplikasi dimatikan sistem). */
(function(){
  if(typeof T === "undefined" || typeof S === "undefined" || typeof say !== "function" || typeof ttsEnd !== "function") return;

  const $$ = id => document.getElementById(id);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const secsNow = () => [...document.querySelectorAll(".ch")];
  const nextOf = sec => { const a = secsNow(), i = a.indexOf(sec); return i >= 0 ? (a[i + 1] || null) : null; };
  const lastSec = () => { const l = T.list[T.list.length - 1]; return (l && l.sec) || T.sec; };

  /* ---- Log diagnostik: tampil di panel pengaturan suara, disimpan agar bertahan ---- */
  try{
    const prev = JSON.parse(localStorage.getItem("dlogSaved") || "[]");
    if(Array.isArray(prev) && prev.length){ DL.length = 0; prev.slice(-8).forEach(x => DL.push(String(x))); DL.push("--- sesi baru ---"); }
  }catch(e){}
  dlog = function(m){
    DL.push(new Date().toTimeString().slice(0, 8) + " " + m);
    while(DL.length > 14) DL.shift();
    const e = $$("tlog"); if(e){ e.textContent = DL.join("\n"); e.scrollTop = e.scrollHeight; }
    try{ localStorage.setItem("dlogSaved", JSON.stringify(DL)); }catch(_){}
  };
  const log = m => { try{ dlog(m); }catch(e){} };
  const lg = $$("tlog"), setBox = $$("tset");
  if(lg){ if(setBox) setBox.appendChild(lg); lg.hidden = false; lg.style.maxHeight = "150px"; lg.textContent = DL.join("\n"); }

  /* ---- Saklar "Lanjut otomatis": nilai disimpan terpisah, hanya sentuhan langsung yang boleh mengubahnya ---- */
  const KEY = "ttsNextUser";
  let want = true;
  try{ const sv = JSON.parse(localStorage.getItem(KEY)); want = typeof sv === "boolean" ? sv : true; }catch(e){}
  try{ localStorage.setItem(KEY, JSON.stringify(want)); }catch(e){}
  if(S.ttsNext !== want){ S.ttsNext = want; try{ applySettings(); }catch(e){} }
  const auto = $$("tauto");
  const showAuto = () => { if(auto && auto.checked !== want) auto.checked = want; };
  showAuto();
  if(auto){
    auto.addEventListener("change", e => {
      if(e.isTrusted){ want = auto.checked; try{ localStorage.setItem(KEY, JSON.stringify(want)); }catch(_){} log("saklar lanjut otomatis: " + (want ? "ON" : "OFF")); }
      else{ e.stopImmediatePropagation(); showAuto(); log("perubahan saklar dari kode diabaikan"); }
    }, true);
    const lab = auto.closest("label");
    if(lab) lab.addEventListener("click", e => { if(!e.target.closest(".switch")) e.preventDefault(); }, true);   // ketukan di teks tidak mengubah saklar
  }
  setInterval(() => { if(S.ttsNext !== want){ log("nilai Lanjut otomatis dikembalikan ke " + (want ? "ON" : "OFF")); S.ttsNext = want; try{ applySettings(); }catch(e){} } showAuto(); }, 3000);
  document.addEventListener("visibilitychange", showAuto);
  const tm = $$("tmore"); if(tm) tm.addEventListener("pointerdown", () => setTimeout(showAuto, 0));

  /* ---- Catat setiap penghentian TTS beserta pemanggilnya ---- */
  const stop0 = ttsStop;
  ttsStop = function(){
    let who = "";
    try{ who = ((new Error().stack || "").split("\n")[2] || "").trim().replace(/https?:\/\/[^\s)]*/g, "").replace(/[()]/g, "").slice(0, 60); }catch(e){}
    log("TTS berhenti oleh " + (who || "?") + " (lanjut=" + S.ttsNext + ")");
    return stop0.apply(this, arguments);
  };

  /* ---- Audio penjaga di atas ambang senyap Chromium (-72 dBFS): halaman dihitung sedang memutar audio ---- */
  silentWav = function(){
    const rate = 8000, n = rate, b = new DataView(new ArrayBuffer(44 + n * 2));
    const w = (o, t) => [...t].forEach((c, i) => b.setUint8(o + i, c.charCodeAt(0)));
    w(0, "RIFF"); b.setUint32(4, 36 + n * 2, true); w(8, "WAVEfmt "); b.setUint32(16, 16, true);
    b.setUint16(20, 1, true); b.setUint16(22, 1, true); b.setUint32(24, rate, true); b.setUint32(28, rate * 2, true);
    b.setUint16(32, 2, true); b.setUint16(34, 16, true); w(36, "data"); b.setUint32(40, n * 2, true);
    for(let i = 0; i < n; i++) b.setInt16(44 + i * 2, Math.round(50 * Math.sin(2 * Math.PI * 80 * i / rate)), true);   // 80 Hz, ±50: tak terdengar
    return URL.createObjectURL(new Blob([b], {type:"audio/wav"}));
  };
  try{ if(typeof kaEl !== "undefined" && kaEl) kaEl.src = silentWav(); }catch(e){}

  /* ---- Muat bab berikutnya lebih awal ---- */
  function ttsAhead(){
    try{
      if(!T.on || !S.ttsNext || !T.sec || T.ahead === T.sec || !T.list.length) return;
      if(T.i < Math.min(T.list.length - 1, Math.max(3, T.list.length * 0.3))) return;
      T.ahead = T.sec;
      if(nextOf(lastSec())) return;                  // bab berikutnya sudah ada
      const last = chs[chs.length - 1];
      if(!last || !last.next){ log("tidak ada tautan bab berikutnya"); return; }
      log("muat bab berikutnya lebih awal");
      if(S.mode === "infinite"){ if(!busy){ failed = false; loadMore(true); } }
      else getChapter(last.next).catch(() => {});    // masuk cache, dibuka saat bab habis
    }catch(e){}
  }

  /* ---- Suara perangkat: rantai kalimat bab berikutnya ke antrean mesin HP (tanpa JavaScript saat pindah bab) ---- */
  const isNative = () => typeof NM !== "undefined" && !!NM && !(S.edgeOn && S.edgeUrl && !T.edgeOff);
  function nativeChain(){
    try{
      if(!isNative() || !T.on || !S.ttsNext || T.sleepCh || !T.q || T.q.tok !== T.tok || T.q.end < T.list.length) return;
      const cur = lastSec(), nx = cur && nextOf(cur);
      if(!nx || T.list.some(s => s.sec === nx)) return;
      ungone(nx);
      const add = sentencesOf(nx); if(!add.length) return;
      T.list.forEach(s => { if(!s.sec) s.sec = cur; }); add.forEach(s => { s.sec = nx; });
      const a = T.list.length; T.list = T.list.concat(add);
      const b = Math.min(T.list.length, a + 100); T.q.end = b;
      NM.speakQueue({items:qItems(a, b), lang:"", rate:S.rate, flush:false}).catch(() => {});
      log("rantai bab berikutnya: +" + add.length + " kalimat");
    }catch(e){ log("rantai gagal: " + ((e && e.message) || e)); }
  }

  /* ---- Akhir bab: tunggu pemuatan, coba ulang, jangan berhenti diam-diam ---- */
  let ending = false;
  ttsEnd = async function(){
    if(ending) return;
    ending = true;
    try{
      if(T.sleepCh){ ttsStop(); toast("Timer tidur: berhenti di akhir bab."); return; }
      if(!S.ttsNext){ log("akhir bab: Lanjut otomatis mati"); ttsStop(); return; }
      const cur = lastSec();
      let nx = nextOf(cur);
      if(!nx){
        const last = chs[chs.length - 1];
        if(!last || !last.next){ log("akhir bab: tidak ada tautan bab berikutnya"); ttsStop(); toast("Tidak ada bab berikutnya."); return; }
        const paged = S.mode !== "infinite";
        T.adv = true;
        try{
          for(let a = 0; a < 8 && T.on && !nx; a++){
            T.msg = a ? "Memuat bab berikutnya (percobaan " + (a + 1) + ")…" : "Memuat bab berikutnya…"; ttsInfo();
            if(a) await sleep(Math.min(10000, 1500 * a));
            for(let w = 0; busy && T.on && w < 100; w++) await sleep(300);
            if(!T.on) break;
            nx = paged ? null : nextOf(cur);
            if(nx) break;
            try{
              if(paged){ const ch = await getChapter(last.next); if(!T.on) break; trail.push(last.next); mountFirst(ch); nx = document.querySelector(".ch"); }
              else{ failed = false; await loadMore(true); nx = nextOf(cur); }
            }catch(e){ log("lanjut gagal: " + ((e && e.message) || e)); }
          }
        }finally{ T.adv = false; T.msg = ""; }
      }
      if(!T.on) return;                                   // dijeda pengguna saat menunggu: lanjut saat diputar lagi
      if(!nx){ log("gagal memuat bab berikutnya setelah 8 percobaan"); ttsStop(); toast("Gagal memuat bab berikutnya. TTS berhenti."); return; }
      ungone(nx); T.sec = nx; T.list = sentencesOf(nx); T.i = 0; T.ahead = null;
      if(!T.list.length){ ttsStop(); return; }
      log("lanjut ke bab berikutnya");
      say();
    }catch(e){
      log("ttsEnd galat: " + ((e && e.message) || e));
      try{ ttsStop(); toast("TTS berhenti: " + ((e && e.message) || e)); }catch(_){}
    }finally{ ending = false; }
  };

  /* ---- Pembungkus: catat aktivitas, muat bab depan, rantai antrean, ikuti pergantian bab ---- */
  const say0 = say;
  say = function(){ T.act = Date.now(); ttsAhead(); return say0.apply(this, arguments); };
  if(typeof qAt === "function"){
    const qAt0 = qAt;
    qAt = function(){
      T.act = Date.now();
      const r = qAt0.apply(this, arguments);
      const s = T.list[T.i];
      if(s && s.sec && s.sec !== T.sec){ T.sec = s.sec; T.ahead = null; try{ ttsInfo(); mediaChk(); }catch(e){} log("pindah bab (antrean mesin)"); }
      ttsAhead(); nativeChain();
      return r;
    };
  }
  if(typeof edgeSay === "function" && typeof edgeGet === "function"){
    const e0 = edgeSay;
    edgeSay = function(){
      const r = e0.apply(this, arguments);
      try{ for(let k = 2; k <= 3; k++){ const x = T.list[T.i + k]; if(x) edgeGet(x.text).catch(() => {}); } }catch(e){}
      return r;
    };
  }

  /* ---- Pengaman macet: tidak ada kemajuan terlalu lama padahal seharusnya membaca ---- */
  setInterval(() => {
    try{
      if(!T.on || ending || T.adv || !T.list.length || T.i >= T.list.length) return;
      const idle = Date.now() - (T.act || 0), limit = T.msg === "Edge memuat…" ? 25000 : 60000;
      if(idle < limit) return;
      log("pengaman: tidak ada kemajuan " + Math.round(idle / 1000) + " dtk, mulai ulang");
      T.act = Date.now();
      if(typeof EDGE !== "undefined" && EDGE.c) EDGE.c.clear();
      T.tok++; speechSynthesis.cancel(); T.on = true; say();
    }catch(e){}
  }, 5000);

  log("tts-fix v2 aktif");
})();
