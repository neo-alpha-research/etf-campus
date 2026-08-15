const fs = require('fs');
const file = 'D:/ETFCampus/components/etf-detail/etf-compare-view.tsx';
let content = fs.readFileSync(file, 'utf8');

const oldClass = 'absolute left-[calc(100%+8px)] top-1/2 -translate-y-1/2 w-48 bg-neutral-800 text-white text-[11px] font-medium p-2.5 rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-[100] shadow-lg whitespace-normal leading-snug';

const newClass = 'absolute left-[calc(100%+12px)] top-1/2 -translate-y-1/2 w-60 bg-neutral-800/95 backdrop-blur-sm text-white text-[12.5px] font-medium p-3.5 rounded-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 z-[100] shadow-xl whitespace-normal leading-relaxed text-left border border-neutral-700/50';

const caret = '<div className="absolute top-1/2 -left-2 -translate-y-1/2 border-[4px] border-transparent border-r-neutral-800/95" />\n                      ';

// First, find all instances and replace the className
content = content.replaceAll(oldClass, newClass);

// Then insert the caret inside the div
const tooltipPattern = /<div className="absolute left-\[calc\(100%\+12px\)\] [^"]+">\n\s+/g;
content = content.replace(tooltipPattern, (match) => {
  return match + caret;
});

fs.writeFileSync(file, content, 'utf8');
console.log('Replaced');
