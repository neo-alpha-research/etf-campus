import { describe, expect, it } from "vitest";
import { getSeriesUrl, getCompareRequestKey, type SeriesManifest } from "../compare-client";

describe("CompareClient Dynamic Cache Versioning & URL Generation", () => {
  it("manifest가 제공되면 asOf 버전이 URL의 ?v= 파라미터로 동적 부착된다", () => {
    const manifest: SeriesManifest = {
      asOf: "20260918",
      tickers: {},
    };

    const urlRecent = getSeriesUrl("069500", true, manifest);
    expect(urlRecent).toBe("/data/series/v2/069500.recent.json?v=20260918");

    const urlFull = getSeriesUrl("069500", false, manifest);
    expect(urlFull).toBe("/data/series/v2/069500.json?v=20260918");
  });

  it("manifest에 특정 종목의 tickers 버전이 존재하면 asOf보다 종목별 버전이 우선 적용된다", () => {
    const manifest: SeriesManifest = {
      asOf: "20260918",
      tickers: {
        "069500": "20260920_custom",
      },
    };

    const urlOverridden = getSeriesUrl("069500", true, manifest);
    expect(urlOverridden).toBe("/data/series/v2/069500.recent.json?v=20260920_custom");

    const urlDefault = getSeriesUrl("122630", true, manifest);
    expect(urlDefault).toBe("/data/series/v2/122630.recent.json?v=20260918");
  });

  it("manifest 로드 실패 또는 null일 때 ?v 쿼리 파라미터가 생략된 기본 URL을 반환한다", () => {
    const url = getSeriesUrl("069500", true, null);
    expect(url).toBe("/data/series/v2/069500.recent.json");
  });

  it("manifest asOf가 변경되면 요청 URL이 실제로 달라진다 (Gate Verification)", () => {
    const manifestV1: SeriesManifest = { asOf: "20260916" };
    const manifestV2: SeriesManifest = { asOf: "20260917" };

    const url1 = getSeriesUrl("069500", true, manifestV1);
    const url2 = getSeriesUrl("069500", true, manifestV2);

    expect(url1).not.toEqual(url2);
    expect(url1).toContain("?v=20260916");
    expect(url2).toContain("?v=20260917");
  });

  it("getCompareRequestKey가 basket 티커, period, manifest asOf를 단일 규칙으로 결합한다 (Gate Verification)", () => {
    const basket = [{ ticker: "069500" }, { ticker: "379800" }];
    const keyWithManifest = getCompareRequestKey(basket, "1Y", "20260918");
    expect(keyWithManifest).toBe("069500,379800_1Y_20260918");

    const keyWithoutManifest = getCompareRequestKey(basket, "1Y", undefined);
    expect(keyWithoutManifest).toBe("069500,379800_1Y_default");
  });
});
