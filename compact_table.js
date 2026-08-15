const fs = require('fs');
const file = 'D:/ETFCampus/components/etf-detail/etf-compare-view.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Change row height limit
content = content.replace(/h-\[44px\]/g, 'h-[36px]');

// 2. Change py-2 to py-1.5 in tbody
// Since we only want to change py-2 in the tbody, we can regex it carefully
// Actually, it's safer to just replace all `py-2` in the whole file except if it's in a header or something. 
// Wait, py-2 is used for all table cells right now. Let's replace 'py-2 ' with 'py-1 ' and 'py-2"' with 'py-1"'.
content = content.replace(/py-2 /g, 'py-1.5 ');
content = content.replace(/py-2"/g, 'py-1.5"');
content = content.replace(/py-2\}/g, 'py-1.5}');

// 3. Fix Base Index (기초 지수) wrapping
content = content.replace(/<span className="text-xs font-semibold text-strong leading-tight block break-keep">\{etf\.baseIndex \|\| "-"\}<\/span>/g,
  '<span className="text-[11.5px] font-semibold text-strong block truncate" title={etf.baseIndex || ""}>{etf.baseIndex || "-"}</span>');

// 4. Fix Classification wrapping (투자 분류)
content = content.replace(/className="flex flex-wrap justify-center gap-1 items-center /g,
  'className="flex justify-center gap-1 items-center whitespace-nowrap overflow-hidden ');

// 5. Change gap-1.5 to gap-1 everywhere in the table data to be more compact
content = content.replace(/gap-1.5/g, 'gap-1');

// 6. Ensure whitespace-nowrap for table cells to prevent 2 lines
// We can add whitespace-nowrap to all td elements in the tbody.
// Let's replace 'text-center ' with 'text-center whitespace-nowrap '
// wait, easier to just add it to the td class strings.
content = content.replace(/<td key=\{etf\.ticker\} className=\{`/g, '<td key={etf.ticker} className={`whitespace-nowrap ');
content = content.replace(/<td key=\{`\$\{etf\.ticker\}-\$\{period\}`\} className=\{`/g, '<td key={`${etf.ticker}-${period}`} className={`whitespace-nowrap ');

fs.writeFileSync(file, content, 'utf8');
console.log('Replaced successfully');
