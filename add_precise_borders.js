const fs = require('fs');

const path = 'D:\\ETFCampus\\components\\etf-detail\\etf-compare-view.tsx';
let content = fs.readFileSync(path, 'utf8');

// First, revert the previous border-r border-line replacement to clean up.
content = content.replace(/snap-start border-b border-r border-line/g, 'snap-start border-b border-line');
content = content.replace(/snap-start border-r border-line/g, 'snap-start');

// Now, properly inject border-r border-neutral-200 to all ETF header and data cells.
// For the header cells:
// `<th key={etf.ticker} className={\`relative w-[190px] min-w-[190px] max-w-[190px] snap-start border-b border-line`
content = content.replace(/snap-start border-b border-line/g, 'snap-start border-b border-r border-neutral-200');

// For the body cells (td):
// They all start with `<td key={...} className={\`whitespace-nowrap `
content = content.replace(/<td key={etf\.ticker} className={`whitespace-nowrap /g, '<td key={etf.ticker} className={`whitespace-nowrap border-r border-neutral-200 ');
content = content.replace(/<td key={`\${etf\.ticker}-\${period}`} className={`whitespace-nowrap /g, '<td key={`${etf.ticker}-${period}`} className={`whitespace-nowrap border-r border-neutral-200 ');

fs.writeFileSync(path, content, 'utf8');
console.log('Precise borders added successfully');
