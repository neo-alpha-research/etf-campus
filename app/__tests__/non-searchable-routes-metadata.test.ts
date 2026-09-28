import { describe, expect, it } from "vitest";

import { metadata as adminMetadata } from "../admin/layout";
import { metadata as loginMetadata } from "../login/layout";
import { metadata as registerMetadata } from "../register/layout";
import { metadata as forgotPasswordMetadata } from "../forgot-password/layout";
import { metadata as resetPasswordMetadata } from "../reset-password/page";
import { metadata as profileMetadata } from "../community/profile/layout";
import { metadata as writeMetadata } from "../community/write/page";
import { metadata as readMetadata } from "../community/read/page";

describe("Non-Searchable Routes Robots Metadata", () => {
  const cases = [
    { name: "관리자 레이아웃 (/admin)", metadata: adminMetadata },
    { name: "로그인 레이아웃 (/login)", metadata: loginMetadata },
    { name: "회원가입 레이아웃 (/register)", metadata: registerMetadata },
    { name: "비밀번호 찾기 레이아웃 (/forgot-password)", metadata: forgotPasswordMetadata },
    { name: "비밀번호 재설정 페이지 (/reset-password)", metadata: resetPasswordMetadata },
    { name: "개인 프로필 레이아웃 (/community/profile)", metadata: profileMetadata },
    { name: "커뮤니티 글 작성 (/community/write)", metadata: writeMetadata },
    { name: "커뮤니티 글 읽기 (/community/read)", metadata: readMetadata },
  ];

  for (const { name, metadata } of cases) {
    it(`${name}는 noindex, nofollow, nocache를 명시적으로 유지한다`, () => {
      expect(metadata).toBeDefined();
      expect(metadata.robots).toEqual({
        index: false,
        follow: false,
        nocache: true,
      });
    });
  }
});
