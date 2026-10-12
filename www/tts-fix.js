/* tts-fix.js: perbaikan "Lanjut otomatis" yang mati sendiri saat aplikasi di latar belakang.
   Dimuat setelah skrip utama (disisipkan otomatis oleh workflow build, atau tambahkan
   <script src="tts-fix.js"></script> sebelum </body> di index.html).

   Penyebab di kode asli:
   1. ttsEnd() memanggil loadMore(true) yang langsung keluar bila ada pemuatan lain (busy),
      lalu nx kosong dan TTS dihentikan (ttsStop). Satu gagal ambil bab = berhenti, tanpa percobaan ulang.
   2. Bab berikutnya baru dimuat saat bab habis. Di latar belakang scroll (requestAnimationFrame) tidak
      berjalan, jadi pemuatan lewat scroll tidak pernah terpicu dan semuanya bergantung pada jaringan
      tepat di akhir bab.
   3. Tidak ada pengaman bila mesin macet (fetch Edge menggantung, event "selesai" terlewat). */
(function(){
  if(typeof T === "undefined" || typeof S === "undefined" || typeof say !== "function" || typeof ttsEnd !== "function") return;

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const nextOf = sec => { const a = [...document.querySelectorAll(".ch")], i = a.indexOf(sec); return i >= 0 ? (a[i + 1] || null) : null; };
  const log = m => { try{ dlog(m); }catch(e){} };

  /* Muat bab berikutnya lebih awal, begitu pembacaan lewat ±30% bab */
  function ttsAhead(){
    try{
      if(!T.on || !S.ttsNext || !T.sec || T.ahead === T.sec || !T.list.length) return;
      if(T.i < Math.min(T.list.length - 1, Math.max(3, T.list.length * 0.3))) return;
      T.ahead = T.sec;
      if(nextOf(T.sec)) return;                      // bab berikutnya sudah ada
      const last = chs[chs.length - 1];
      if(!last || !last.next) return;
      log("muat bab berikutnya lebih awal");
      if(S.mode === "infinite"){ if(!busy){ failed = false; loadMore(true); } }
      else getChapter(last.next).catch(() => {});    // masuk cache, dibuka saat bab habis
    }catch(e){}
  }

  /* Akhir bab: tunggu pemuatan yang sedang jalan, coba ulang bila gagal, jangan berhenti diam-diam */
  let ending = false;
  ttsEnd = async function(){
    if(ending) return;
    ending = true;
    try{
      if(T.sleepCh){ ttsStop(); toast("Timer tidur: berhenti di akhir bab."); return; }
      if(!S.ttsNext){ ttsStop(); return; }
      const cur = T.sec;
      let nx = nextOf(cur);
      if(!nx){
        const last = chs[chs.length - 1];
        if(!last || !last.next){ ttsStop(); toast("Sudah di bab terakhir."); return; }
        const paged = S.mode !== "infinite";
        T.adv = true;
        try{
          for(let a = 0; a < 8 && T.on && !nx; a++){
            T.msg = a ? "Memuat bab berikutnya (percobaan " + (a + 1) + ")…" : "Memuat bab berikutnya…"; ttsInfo();
            if(a) await sleep(Math.min(10000, 1500 * a));
            for(let w = 0; busy && T.on && w < 100; w++) await sleep(300);   // tunggu pemuatan lain selesai
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
      if(!T.on) return;                                   // dijeda pengguna saat menunggu: biarkan, lanjut saat diputar lagi
      if(!nx){ ttsStop(); toast("Gagal memuat bab berikutnya. TTS berhenti."); return; }
      ungone(nx); T.sec = nx; T.list = sentencesOf(nx); T.i = 0; T.ahead = null;
      if(!T.list.length){ ttsStop(); return; }
      say();
    }catch(e){
      log("ttsEnd galat: " + ((e && e.message) || e));
      try{ ttsStop(); toast("TTS berhenti: " + ((e && e.message) || e)); }catch(_){}
    }finally{ ending = false; }
  };

  /* Catat aktivitas terakhir mesin + muat bab depan lebih awal */
  const say0 = say;
  say = function(){ T.act = Date.now(); ttsAhead(); return say0.apply(this, arguments); };
  if(typeof qAt === "function"){
    const qAt0 = qAt;
    qAt = function(){ T.act = Date.now(); const r = qAt0.apply(this, arguments); ttsAhead(); return r; };
  }

  /* Pengaman: bila tidak ada kemajuan terlalu lama padahal seharusnya membaca, mulai ulang dari kalimat ini */
  setInterval(() => {
    try{
      if(!T.on || ending || T.adv || !T.list.length || T.i >= T.list.length) return;
      const idle = Date.now() - (T.act || 0), limit = T.msg === "Edge memuat…" ? 25000 : 60000;
      if(idle < limit) return;
      log("pengaman: tidak ada kemajuan " + Math.round(idle / 1000) + " dtk, mulai ulang");
      T.act = Date.now();
      if(typeof EDGE !== "undefined" && EDGE.c) EDGE.c.clear();   // buang permintaan yang menggantung
      T.tok++; speechSynthesis.cancel(); T.on = true; say();
    }catch(e){}
  }, 5000);

  /* Saklar "Lanjut otomatis" selalu mengikuti nilai tersimpan saat panel dibuka / aplikasi kembali tampil */
  const syncAuto = () => { const el = document.getElementById("tauto"); if(el && el.checked !== !!S.ttsNext) el.checked = !!S.ttsNext; };
  document.addEventListener("visibilitychange", syncAuto);
  const tm = document.getElementById("tmore"); if(tm) tm.addEventListener("pointerdown", () => setTimeout(syncAuto, 0));
  log("tts-fix aktif");
})();
