// Downloads real favicon/logo icons for Austrian banks via Google's favicon service.
// Usage: node fetch-at-logos.js
const fs = require("fs");
const path = require("path");
const https = require("https");

const OUT_DIR = path.join(__dirname, "public", "bank-logos", "at");

const BANKS = [
  { slug: "bank-austria", domain: "bankaustria.at" },
  { slug: "erste-bank", domain: "erstebank.at" },
  { slug: "raiffeisen", domain: "raiffeisen.at" },
  { slug: "volksbank", domain: "volksbank.at" },
  { slug: "bawag", domain: "bawag.com" },
  { slug: "easybank", domain: "easybank.at" },
  { slug: "bank99", domain: "bank99.at" },
  { slug: "oberbank", domain: "oberbank.at" },
  { slug: "bks-bank", domain: "bks.at" },
  { slug: "btv", domain: "btv.at" },
  { slug: "hypo-noe", domain: "hyponoe.at" },
  { slug: "hypo-tirol", domain: "hypotirol.com" },
  { slug: "hypo-vorarlberg", domain: "hypovbg.at" },
  { slug: "hypo-burgenland", domain: "hypobg.at" },
  { slug: "hypo-ooe", domain: "hypo-ooe.at" },
  { slug: "aerztebank", domain: "aerztebank.at" },
  { slug: "spaengler", domain: "spaengler.at" },
  { slug: "schelhammer", domain: "schelhammer.at" },
  { slug: "schoellerbank", domain: "schoellerbank.at" },
  { slug: "schoellerbank-ag", domain: "schoellerbank.at" },
  { slug: "sparda-bank", domain: "sparda.at" },
  { slug: "vkb", domain: "vkb-bank.at" },
  { slug: "anadi-bank", domain: "anadibank.com" },
  { slug: "marchfelder", domain: "marchfelderbank.at" },
  { slug: "dolomitenbank", domain: "dolomitenbank.at" },
  { slug: "posojilnica", domain: "posojilnica.at" },
];

function fetch(url, redirects = 3) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects > 0) {
          res.resume();
          return resolve(fetch(new URL(res.headers.location, url).toString(), redirects - 1));
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`${res.statusCode} for ${url}`));
        }
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks)));
      })
      .on("error", reject);
  });
}

(async () => {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const bank of BANKS) {
    const out = path.join(OUT_DIR, `${bank.slug}.png`);
    try {
      const buf = await fetch(`https://www.google.com/s2/favicons?domain=${bank.domain}&sz=256`);
      // sanity: google returns png; ensure it's not the tiny default globe (<400 bytes)
      if (buf.length < 400) {
        console.log(`SKIP ${bank.slug} (${bank.domain}) - default icon only, ${buf.length}b`);
        continue;
      }
      fs.writeFileSync(out, buf);
      console.log(`OK ${bank.slug} <- ${bank.domain} (${buf.length}b)`);
    } catch (e) {
      console.log(`FAIL ${bank.slug}: ${e.message}`);
    }
  }
})();
