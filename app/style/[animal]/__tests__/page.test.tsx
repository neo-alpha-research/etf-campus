import { describe, expect, it } from "vitest";

import StyleAnimalPage, { generateMetadata, generateStaticParams } from "../page";

describe("StyleAnimalPage Static Generation & Metadata", () => {
  it("10가지 동물 유형에 대해 generateStaticParams를 반환한다", () => {
    const params = generateStaticParams();
    expect(params).toHaveLength(10);
    expect(params.map((p) => p.animal)).toContain("turtle");
    expect(params.map((p) => p.animal)).toContain("fox");
    expect(params.map((p) => p.animal)).toContain("owl");
  });

  it("유효한 메타데이터(제목, punchline 설명, canonical)를 생성한다", async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ animal: "turtle" }) });
    expect(meta.title).toBe("원칙을 지키는 거북이 | ETF 투자 스타일 | ETF Campus");
    expect(meta.description).toContain("숫자가 춤을 춰도");
    expect(meta.alternates?.canonical).toBe("/style/turtle");
  });
});
