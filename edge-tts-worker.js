// Cloudflare Worker: jembatan ke suara Microsoft Edge (Read Aloud).
// Layanan tidak resmi; bisa berubah sewaktu-waktu. Pakai untuk keperluan pribadi.
const TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0";
const CORS = {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,OPTIONS", "Access-Control-Allow-Headers": "*"};
const esc = s => s.replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"}[c]));
async function gec(){
  let t = Math.floor(Date.now() / 1000) + 11644473600; t -= t % 300;
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode((BigInt(t) * 10000000n).toString() + TOKEN));
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}
export default {
  async fetch(req){
    if(req.method === "OPTIONS") return new Response(null, {headers: CORS});
    const q = new URL(req.url).searchParams, text = (q.get("text") || "").slice(0, 3000);
    if(!text) return new Response("Edge TTS aktif. Coba: ?text=Halo&voice=id-ID-ArdiNeural", {headers: CORS});
    const v = q.get("voice") || "", voice = /^[a-z]{2,3}-[A-Za-z]{2,4}-\w+Neural$/.test(v) ? v : "id-ID-ArdiNeural";
    const rate = Math.max(-50, Math.min(100, parseInt(q.get("rate")) || 0)), id = crypto.randomUUID().replace(/-/g, "");
    try{
      const resp = await fetch("https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=" + TOKEN +
        "&Sec-MS-GEC=" + await gec() + "&Sec-MS-GEC-Version=1-130.0.2849.68&ConnectionId=" + id,
        {headers: {Upgrade: "websocket", Origin: "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold", "User-Agent": UA, Pragma: "no-cache", "Cache-Control": "no-cache"}});
      const ws = resp.webSocket; if(!ws) return new Response("Gagal terhubung ke Edge TTS (" + resp.status + ")", {status: 502, headers: CORS});
      ws.accept();
      const chunks = [];
      await new Promise((ok, no) => {
        const to = setTimeout(() => no(new Error("waktu habis")), 20000);
        ws.addEventListener("message", ev => {
          if(typeof ev.data === "string"){ if(ev.data.includes("Path:turn.end")){ clearTimeout(to); ws.close(); ok(); } return; }
          const b = new Uint8Array(ev.data), hl = (b[0] << 8) | b[1];
          if(new TextDecoder().decode(b.subarray(2, 2 + hl)).includes("Path:audio")) chunks.push(b.subarray(2 + hl));
        });
        ws.addEventListener("error", () => no(new Error("koneksi terputus")));
        ws.addEventListener("close", () => ok());
        const ts = new Date().toISOString();
        ws.send("X-Timestamp:" + ts + "\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n" +
          JSON.stringify({context: {synthesis: {audio: {metadataoptions: {sentenceBoundaryEnabled: "false", wordBoundaryEnabled: "false"}, outputFormat: "audio-24khz-48kbitrate-mono-mp3"}}}}));
        ws.send("X-RequestId:" + id + "\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:" + ts + "Z\r\nPath:ssml\r\n\r\n" +
          "<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='" + voice.split("-").slice(0, 2).join("-") + "'><voice name='" + voice +
          "'><prosody pitch='+0Hz' rate='" + (rate >= 0 ? "+" : "") + rate + "%' volume='+0%'>" + esc(text) + "</prosody></voice></speak>");
      });
      if(!chunks.length) return new Response("Tidak ada audio dari Edge TTS", {status: 502, headers: CORS});
      return new Response(new Blob(chunks, {type: "audio/mpeg"}), {headers: {...CORS, "Content-Type": "audio/mpeg", "Cache-Control": "public, max-age=86400"}});
    }catch(e){ return new Response("Galat: " + e.message, {status: 502, headers: CORS}); }
  }
};
