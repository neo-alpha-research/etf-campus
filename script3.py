import re

with open('scripts/build_classification_review.py', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('        reason_code = "FORCED_AUTO|LOW_CONFIDENCE"\n        reason_code = "CONFIDENCE_BELOW_85"', '        reason_code = "FORCED_AUTO|CONFIDENCE_BELOW_85"')

with open('scripts/build_classification_review.py', 'w', encoding='utf-8') as f:
    f.write(content)
