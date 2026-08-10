const fs = require('fs');
let code = fs.readFileSync('components/screener/screener.tsx', 'utf-8');

code = code.replace(
  /className=\{`inline-flex items-center rounded-full border px-3 py-1\.5 text-sm font-bold transition-colors \$\{\s*([^?]+)\? "border-brand-700 bg-brand-50 text-brand-700" : "border-line bg-surface text-muted hover:bg-neutral-50"\s*\}`\}/g,
  (match, p1) => {
    return `className={\`inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-bold transition-colors \${\n            ${p1.trim()} ? "border-brand-700 bg-brand-700 text-white shadow-sm" : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"\n          }\`}`;
  }
);

fs.writeFileSync('components/screener/screener.tsx', code);
console.log('Replaced');
