import sys
import os
import json
import base64
import urllib.request
import urllib.error
import time

API_BASE = 'https://etf-campus.pages.dev'

def fetch_with_retry(url):
    for i in range(3):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req) as response:
                return response.read().decode('utf-8')
        except urllib.error.URLError as e:
            if i == 2:
                raise e
            time.sleep(1)

def main():
    target_date = sys.argv[1] if len(sys.argv) > 1 else None

    if not target_date:
        print('Fetching latest briefing date...')
        data_str = fetch_with_retry(f"{API_BASE}/api/briefings/latest")
        data = json.loads(data_str)
        target_date = data['briefing']['asOfDate']

    print(f"Generating local preview for date: {target_date}")

    slides = []
    print('Fetching Instagram slides...')
    for i in range(1, 7):
        svg = fetch_with_retry(f"{API_BASE}/api/preview/instagram?date={target_date}&slide={i}")
        slides.append({
            'slideNumber': i,
            'title': 'Cover' if i == 1 else f'Slide {i}',
            'subtitle': '',
            'svgContent': svg
        })

    print('Fetching Threads preview...')
    threads_data_str = fetch_with_retry(f"{API_BASE}/api/preview/threads?date={target_date}")
    
    print('Fetching Newsletter HTML...')
    news_html = fetch_with_retry(f"{API_BASE}/api/preview/newsletter?date={target_date}")

    # Base64 encode to safely embed in JS
    slides_b64 = base64.b64encode(json.dumps(slides).encode('utf-8')).decode('utf-8')
    threads_b64 = base64.b64encode(threads_data_str.encode('utf-8')).decode('utf-8')
    news_b64 = base64.b64encode(news_html.encode('utf-8')).decode('utf-8')

    html_template = f"""<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ETF Campus - OSMU Multi-Channel Local Preview ({target_date})</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css">
  <style>
    * {{ font-family: 'Pretendard', sans-serif; }}
    .slide-svg svg {{ width: 100%; height: auto; display: block; border-radius: 1.25rem; }}
  </style>
</head>
<body class="bg-slate-900 text-slate-100 min-h-screen p-4 md:p-8">
  <div class="max-w-7xl mx-auto space-y-8">
    <header class="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
      <div>
        <div class="flex items-center gap-2 mb-1">
          <span class="inline-flex items-center gap-1.5 rounded-full bg-emerald-950 px-3 py-1 text-xs font-bold text-emerald-400 border border-emerald-800">
            <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            LOCAL FAST PREVIEW
          </span>
          <span class="text-sm font-semibold text-slate-400">{target_date} 장마감 기준</span>
        </div>
        <h1 class="text-2xl md:text-3xl font-extrabold text-white">
          ETF Campus OSMU 자동 배포 통합 프리뷰 대시보드
        </h1>
      </div>
      <div>
        <button onclick="window.location.reload()" class="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-bold border border-slate-700 transition">
          🔄 새로고침
        </button>
      </div>
    </header>

    <!-- 3-Channel Tabs -->
    <div class="flex border-b border-slate-800 gap-2" id="channelTabs">
      <button onclick="switchTab('instagram')" id="tab-instagram" class="px-6 py-3 font-bold text-sm border-b-2 border-emerald-500 text-emerald-400 flex items-center gap-2">
        📷 인스타그램 6-Slide 카드뉴스 & 캡션
      </button>
      <button onclick="switchTab('threads')" id="tab-threads" class="px-6 py-3 font-bold text-sm border-b-2 border-transparent text-slate-400 hover:text-slate-200 flex items-center gap-2">
        🧵 Threads 모닝 브리핑 & 이미지
      </button>
      <button onclick="switchTab('newsletter')" id="tab-newsletter" class="px-6 py-3 font-bold text-sm border-b-2 border-transparent text-slate-400 hover:text-slate-200 flex items-center gap-2">
        📧 이메일 뉴스레터
      </button>
    </div>

    <!-- TAB 1: Instagram Carousel -->
    <section id="panel-instagram" class="space-y-6">
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div class="lg:col-span-7 bg-slate-950 p-6 rounded-3xl border border-slate-800 shadow-2xl flex flex-col items-center">
          <div class="flex items-center justify-between w-full mb-3 text-xs text-slate-400 font-bold px-2">
            <span id="activeSlideTitle">Slide 1 / 6</span>
            <div class="flex gap-2">
              <button onclick="prevSlide()" class="px-3 py-1 bg-slate-800 hover:bg-slate-700 rounded-lg text-white font-bold">◀ 이전</button>
              <button onclick="nextSlide()" class="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-white font-bold">다음 ▶</button>
            </div>
          </div>
          <div id="focusedSlideContainer" class="w-full max-w-[500px] slide-svg shadow-2xl rounded-2xl overflow-hidden border border-slate-700/50"></div>
        </div>

        <div class="lg:col-span-5 space-y-4">
          <h3 class="text-sm font-extrabold text-slate-300 uppercase tracking-wider">전체 6장 슬라이드 썸네일</h3>
          <div class="grid grid-cols-3 gap-2" id="thumbnailsContainer"></div>
        </div>
      </div>
    </section>

    <!-- TAB 2: Threads Thread -->
    <section id="panel-threads" class="hidden space-y-6">
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div class="lg:col-span-6 space-y-4" id="threadsContainer"></div>
        <div class="lg:col-span-6 bg-slate-950 p-6 rounded-2xl border border-slate-800 flex flex-col items-center">
          <h3 class="text-sm font-bold text-slate-300 mb-4 self-start">🖼️ 스레드 첨부 이미지는 인스타그램 2페이지(테마) 활용</h3>
        </div>
      </div>
    </section>

    <!-- TAB 3: Newsletter HTML -->
    <section id="panel-newsletter" class="hidden space-y-6">
      <div class="bg-slate-800 p-4 rounded-2xl flex items-center justify-between">
        <div>
          <span class="text-xs text-slate-400">제목:</span>
          <span class="font-bold text-white text-sm ml-2">[마켓 브리핑] {target_date.replace('-', '.')} ETF 시장 핵심 요약</span>
        </div>
      </div>
      <div class="bg-[#0F172A] rounded-2xl overflow-hidden shadow-2xl border border-slate-700 flex flex-col items-center relative">
        <iframe class="w-full h-[800px] border-0 bg-white rounded-2xl"></iframe>
      </div>
    </section>
  </div>

  <script>
    const b64DecodeUnicode = str => decodeURIComponent(Array.prototype.map.call(atob(str), c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
    
    const slides = JSON.parse(b64DecodeUnicode('{slides_b64}'));
    const threadsData = JSON.parse(b64DecodeUnicode('{threads_b64}'));
    const newsHtml = b64DecodeUnicode('{news_b64}');
    
    let currentIdx = 0;

    function renderSlides() {{
      const container = document.getElementById('focusedSlideContainer');
      const thumbs = document.getElementById('thumbnailsContainer');
      const title = document.getElementById('activeSlideTitle');

      container.innerHTML = slides[currentIdx].svgContent;
      title.textContent = `Slide ${{currentIdx + 1}} / ${{slides.length}} - ${{slides[currentIdx].title}}`;

      thumbs.innerHTML = slides.map((s, idx) => `
        <div onclick="goToSlide(${{idx}})" class="cursor-pointer rounded-xl overflow-hidden border-2 transition-all ${{idx === currentIdx ? 'border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)] scale-105' : 'border-slate-800 opacity-60 hover:opacity-100'}}">
          <div class="slide-svg w-full pointer-events-none">${{s.svgContent}}</div>
        </div>
      `).join('');
    }}

    function renderThreads() {{
      const container = document.getElementById('threadsContainer');
      container.innerHTML = threadsData.map((post, idx) => `
        <div class="bg-slate-950 p-6 rounded-2xl border border-slate-800 relative">
          ${{idx > 0 ? '<div class="absolute -top-4 left-8 w-0.5 h-4 bg-slate-700"></div>' : ''}}
          <div class="flex items-start gap-4">
            <div class="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center font-bold text-slate-400 shrink-0 border border-slate-700">${{post.sequence}}</div>
            <div class="flex-1">
              <div class="font-bold text-sm text-slate-300 mb-1">etf_campus</div>
              <pre class="text-[15px] leading-relaxed text-slate-200 whitespace-pre-wrap font-sans">${{post.content}}</pre>
            </div>
          </div>
        </div>
      `).join('');
      
      const iframeContainer = document.querySelector('iframe');
      if(iframeContainer) iframeContainer.srcdoc = newsHtml;
    }}

    function goToSlide(idx) {{ currentIdx = idx; renderSlides(); localStorage.setItem('osmu_active_slide', idx); }}
    function prevSlide() {{ if (currentIdx > 0) goToSlide(currentIdx - 1); }}
    function nextSlide() {{ if (currentIdx < slides.length - 1) goToSlide(currentIdx + 1); }}

    function switchTab(tab) {{
      ['instagram', 'threads', 'newsletter'].forEach(t => {{
        const btn = document.getElementById('tab-' + t);
        const p = document.getElementById('panel-' + t);
        if (t === tab) {{
          btn.className = 'px-6 py-3 font-bold text-sm border-b-2 border-emerald-500 text-emerald-400 flex items-center gap-2';
          p.classList.remove('hidden');
        }} else {{
          btn.className = 'px-6 py-3 font-bold text-sm border-b-2 border-transparent text-slate-400 hover:text-slate-200 flex items-center gap-2';
          p.classList.add('hidden');
        }}
      }});
      localStorage.setItem('osmu_active_tab', tab);
      if (history.replaceState) {{
        history.replaceState(null, '', '#' + tab);
      }} else {{
        location.hash = tab;
      }}
    }}

    const savedSlide = parseInt(localStorage.getItem('osmu_active_slide') || '0', 10);
    if (!isNaN(savedSlide) && savedSlide >= 0 && savedSlide < slides.length) currentIdx = savedSlide;

    renderSlides();
    renderThreads();

    const hashTab = location.hash ? location.hash.replace('#', '') : null;
    const savedTab = hashTab || localStorage.getItem('osmu_active_tab') || 'instagram';
    switchTab(savedTab);
  </script>
</body>
</html>"""

    out_path = os.path.join(os.getcwd(), 'workers', 'market-briefing-distributor', 'distributor-preview', 'index.html')
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write(html_template)
    
    print(f"Successfully updated {out_path} with data for {target_date}")

if __name__ == '__main__':
    main()
