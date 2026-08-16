from pathlib import Path
p=Path(r'D:/ETFCampus/components/etf-detail/price-history-chart.tsx')
s=p.read_text(encoding='utf-8')
anchor='  const [isCapturing, setIsCapturing] = useState(false);\n'
handler='''  const [isCapturing, setIsCapturing] = useState(false);
  const handleDownload = async () => {
    if (!chartRef.current) return;
    setIsCapturing(true);
    try {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const dataUrl = await toPng(chartRef.current, { cacheBust: true, pixelRatio: 2 });
      const link = document.createElement("a");
      link.download = `${ticker}-price-history.png`;
      link.href = dataUrl;
      link.click();
    } finally {
      setIsCapturing(false);
    }
  };
'''
if anchor not in s: raise RuntimeError('capture state anchor not found')
if 'const handleDownload = async' not in s: s=s.replace(anchor,handler,1)
p.write_text(s,encoding='utf-8')
print('Patched price history download handler')
