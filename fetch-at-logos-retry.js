const fs = require("fs");
const path = require("path");
const https = require("https");

const OUT_DIR = path.join(__dirname, "public", "bank-logos", "at");

const BANKS = [
  { slug: "volksbank", domains: ["volksbank.at", "www.volksbank.at"] },
  { slug: "bawag", domains: ["bawag.com", "www.bawag.com", "bawag.at", "bawagpsk.com"] },
  { slug: "easybank", domains: ["easybank.at", "www.easybank.at"] },
  { slug: "oberbank", domains: ["oberbank.at", "www.oberbank.at"] },
  { slug: "btv", domains: ["btv.at", "www.btv.at"] },
  { slug: "hypo-burgenland", domains: ["hypobg.at", "www.hypobg.at", "hypo-burgenland.at"] },
  { slug: "schelhammer", domains: ["schelhammer.at", "www.schelhammer.at", "schelhammercapital.com"] },
  { slug: "posojilnica", domains: ["posojilnica.at", "www.posojilnica.at"] },
  { slug: "aerztebank", domains: ["aerztebank.at", "www.aerztebank.at", "aerztebank.com"] },
];

function fetch(url, redirects = 4) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith("https") ? https : require("http");
    mod
      .get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects > 0) {
          res.resume();
          return resolve(fetch(new URL(res.headers.location, url).toString(), redirects - 1));
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`${res.statusCode}`));
        }
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks)));
      })
      .on("error", reject);
  });
}

function isPng(b) { return b.length > 4 && b[0] === 0x89 && b[1] === 0x50; }
function isIco(b) { return b.length > 4 && b[0] === 0x00 && b[1] === 0x00 && b[2] === 0x01 && b[3] === 0x00; }

(async () => {
  for (const bank of BANKS) {
    const out = path.join(OUT_DIR, `${bank.slug}.png`);
    let done = false;
    for (const domain of bank.domains) {
      const urls = [
        `https://icons.duckduckgo.com/ip3/${domain}.ico`,
        `https://www.google.com/s2/favicons?domain=${domain}&sz=128`,
        `https://${domain}/favicon.ico`,
      ];
      for (const url of urls) {
        try {
          const buf = await fetch(url);
          if (buf.length < 400) continue;
          if (!isPng(buf) && !isIco(buf) && buf.length < 4000) continue;
          fs.writeFileSync(out, buf);
          console.log(`OK ${bank.slug} <- ${url} (${buf.length}b)`);
          done = true;
          break;
        } catch (e) { /* next */ }
      }
      if (done) break;
    }
    if (!done) console.log(`STILL-MISSING ${bank.slug}`);
  }
})();
