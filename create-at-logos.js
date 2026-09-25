const fs = require('fs');
const path = require('path');

const atBanks = [
  'bank-austria',
  'erste-bank', 
  'raiffeisen',
  'volksbank',
  'posojilnica',
  'bank99',
  'btv',
  'bks-bank',
  'oberbank',
  'hypo-noe',
  'hypo-tirol',
  'hypo-vorarlberg',
  'hypo-burgenland',
  'hypo-ooe',
  'aerztebank',
  'spaengler',
  'schelhammer',
  'easybank',
  'schoellerbank-ag',
  'schoellerbank',
  'sparda-bank',
  'vkb',
  'anadi-bank',
  'marchfelder',
  'dolomitenbank',
  'bawag'
];

const atDir = path.join(__dirname, 'public', 'bank-logos', 'at');

// Create simple SVG placeholders
atBanks.forEach(bank => {
  const bankName = bank.replace(/-/g, ' ').toUpperCase();
  const svg = `<svg width="200" height="80" xmlns="http://www.w3.org/2000/svg">
    <rect width="200" height="80" fill="#e30613"/>
    <text x="10" y="50" font-size="16" font-weight="bold" fill="white">${bankName}</text>
  </svg>`;
  
  const filePath = path.join(atDir, `${bank}.svg`);
  fs.writeFileSync(filePath, svg);
  console.log(`Created ${bank}.svg`);
});

console.log('All Austrian bank placeholder logos created!');