import re

with open('scripts/build_classification_review.py', 'r', encoding='utf-8') as f:
    content = f.read()

old_block = '''
    score = min(score, 100)
    if blockers:
        decision = "검수필요"
        reason_code = "|".join(dict.fromkeys(blockers))
    elif score >= 85:
        decision = "자동확정"
        reason_code = "RULES_AGREE"
    else:
        decision = "표본검수"
'''

new_block = '''
    score = min(score, 100)
    # 강제 자동 확정 처리 (사용자 요청에 따라 미분류 방지)
    decision = "자동확정"
    if blockers:
        reason_code = "FORCED_AUTO|" + "|".join(dict.fromkeys(blockers))
    elif score >= 85:
        reason_code = "RULES_AGREE"
    else:
        reason_code = "FORCED_AUTO|LOW_CONFIDENCE"
'''

content = content.replace(old_block.strip(), new_block.strip())

with open('scripts/build_classification_review.py', 'w', encoding='utf-8') as f:
    f.write(content)
