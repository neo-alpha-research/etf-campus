# Phase 0 — 연금 태그 운용사 공식 대조 시트 생성 (재사용)
# 입력: etf_master_draft.csv + issuer_*_pension.json 8종 / 출력: pension_verify_sheet.csv
import csv
import json
import re
import collections

norm = lambda s: re.sub(r"[\s()]+", "", s)


def load():
    j = lambda f: json.load(open(f, encoding="utf-8"))
    kodex = {k["ticker"]: (k["irp"] in ("70%", "100%")) for k in j("issuer_kodex_pension.json")}
    rise = {k["ticker"]: (k["irp"] in ("70%", "100%")) for k in j("issuer_rise_pension.json")}
    tiger = {k["ticker"]: ("퇴직연금" in k["badges"]) for k in j("issuer_tiger_pension.json")}
    ace = {a["isin"][3:9]: True for a in j("issuer_ace_pension.json") if a.get("isin")}
    plus_n = {norm(p["name"]): ("퇴직연금" in p.get("badges", [])) for p in j("issuer_plus_pension.json") if p.get("name")}
    sol_t, sol_n = {}, {}
    for s in j("issuer_sol_pension.json"):
        ok = "퇴직연금" in s.get("pension", [])
        if s.get("ticker"):
            sol_t[s["ticker"]] = ok
        sol_n[norm(s["name"])] = ok
    kiwoom = {k["ticker"]: k["irp"] for k in j("issuer_kiwoom_pension.json")}
    hanaro = {k["ticker"]: k["irp"] for k in j("issuer_hanaro_pension.json")}
    return kodex, rise, tiger, ace, plus_n, sol_t, sol_n, kiwoom, hanaro


def main():
    kodex, rise, tiger, ace, plus_n, sol_t, sol_n, kiwoom, hanaro = load()
    master = list(csv.DictReader(open("etf_master_draft.csv", encoding="utf-8-sig")))

    def lookup(r):
        b = r["name"].split()[0]
        t = r["ticker"]
        if b == "KODEX":
            return "KODEX", kodex.get(t, False)  # 리스트 미등재 = 불가 (검증됨)
        if b == "TIGER":
            return "TIGER", tiger.get(t)
        if b == "RISE":
            return "RISE", rise.get(t, False if r["risk_type"] != "normal" or "선물" in r["name"] else None)
        if b == "ACE":
            return "ACE", ace.get(t, False)
        if b == "PLUS":
            return "PLUS", plus_n.get(norm(r["name"]))
        if b == "SOL":
            v = sol_t.get(t)
            if v is None:
                v = sol_n.get(norm(r["name"]))
            if v is None and ("선물" in r["name"] or r["risk_type"] != "normal"):
                v = False
            return "SOL", v
        if b == "KIWOOM":
            return "KIWOOM", kiwoom.get(t)
        if b == "HANARO":
            return "HANARO", hanaro.get(t)
        return "", None

    out, stats = [], collections.Counter()
    for r in master:
        ours = r["pension_eligible"].startswith("가능")
        src, official = lookup(r)
        if not src:
            status = "미커버(소형 운용사)"
        elif official is None:
            status = "확인필요(공식 목록 미등재)"
        elif official == ours:
            status = "확인완료(일치)"
        else:
            status = "확인필요(불일치)"
        stats[status] += 1
        out.append({**r, "official_src": src,
                    "issuer_official": ("" if official is None else ("가능" if official else "불가")),
                    "verify_status": status})
    with open("pension_verify_sheet.csv", "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=list(out[0].keys()))
        w.writeheader()
        w.writerows(out)
    print(stats)


if __name__ == "__main__":
    main()
