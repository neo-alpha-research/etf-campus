const fs = require('fs');

const path = 'D:\\ETFCampus\\components\\etf-detail\\etf-compare-view.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. For the header columns (th):
// find: min-w-[190px] max-w-[190px] snap-start border-b border-line px-4
// replace: min-w-[190px] max-w-[190px] snap-start border-b border-r border-line px-4
content = content.replace(/snap-start border-b border-line px-4/g, 'snap-start border-b border-r border-line px-4');

// 2. For the body columns (td):
// find: px-4 py-1.5 snap-start transition-colors
// replace: px-4 py-1.5 snap-start border-r border-line transition-colors
content = content.replace(/px-4 py-1.5 snap-start transition-colors/g, 'px-4 py-1.5 snap-start border-r border-line transition-colors');

fs.writeFileSync(path, content, 'utf8');
console.log('Borders added successfully');
