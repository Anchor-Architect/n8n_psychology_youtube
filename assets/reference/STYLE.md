# 캐릭터 / 아트 스타일 레퍼런스

첨부 레퍼런스 5장(OVERTHINKING / COMPARISON / PEOPLE PLEASING / ANXIETY / SELF-KINDNESS)에서
추출한 공통 스타일. 모든 flux `visual_prompt`의 **공통 prefix(style token)** 로 사용한다.

## 스타일 시그니처
- **Character:** simple 2D stickman — round blank head, two small dot eyes, thin black line limbs.
  Emotion shown only through minimal posture and tiny mouth/brow.
- **Linework:** hand-drawn black outlines, slightly rough doodle feel.
- **Background:** warm off-white / cream solid background. Minimal, lots of negative space.
- **Color:** mostly grayscale. Selective accent color ONLY (red heart, yellow moon/stars,
  blue umbrella & raindrops, gold trophy).
- **Shadow:** faint elliptical shadow under the character's feet.

## flux 공통 프롬프트 prefix (확정 — 16:9)
> Minimalist 2D stick figure illustration, round blank head with two small dot eyes, thin
> hand-drawn black outlines, flat uniform warm cream background (solid pale beige #f4f1e8,
> filling the entire frame, no gradient, no vignette, no background shading), mostly grayscale
> with a single selective accent color, simple doodle style, lots of negative space, soft
> elliptical ground shadow, wide 16:9 composition, no text overlays.

이 문장은 `.claude/skills/script-reviewer/references/pipeline-json.md` 의 fixed style block 과
동일하게 유지한다 (둘 중 하나만 바꾸면 안 됨).

## 참고
- flux-schnell 은 text-to-image 라 레퍼런스 이미지를 직접 입력하지 않고
  위 텍스트 스타일 토큰으로 일관성을 잡는다.
- 부족하면 flux-dev + IP-Adapter / redux 계열(reference 지원)로 업그레이드 검토.

## 레퍼런스 이미지 파일
아래 5장을 이 폴더(`assets/reference/`)에 저장해주세요 (제안 파일명):
- `ref-01-overthinking.png`
- `ref-02-comparison.png`
- `ref-03-people-pleasing.png`
- `ref-04-anxiety.png`
- `ref-05-self-kindness.png`
