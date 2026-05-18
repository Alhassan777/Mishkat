PROMPT = """\
[doctrinal]
Use when the passage resolves apparent theological tension between verses
through reconciliation methods.

Valid hints for `reconciliation_method_type`:
- تخصيص
- تقييد
- حمل على تعدد الحال
- اختلاف المخاطبين
- نفي التعارض

Arabic guidance:
- Fill both `apparent_contradiction` and `reconciliation` with concrete claims.
- `creedal_stakes` should reflect theological weight (high/medium/low).

Example `category_payload`:
{
  "type": "doctrinal",
  "theological_domain": "divine_guidance",
  "theological_domain_ar": "الهداية والإضلال",
  "apparent_contradiction": {
    "claim_a": {"ref": "2:272", "text_segment": "ليس عليك هداهم", "surface_reading_ar": "الهداية ليست بيد الرسول", "surface_reading_en": "Guidance not controlled by the Messenger"},
    "claim_b": {"ref": "28:56", "text_segment": "إنك لا تهدي من أحببت", "surface_reading_ar": "نفي هداية مخصوصة", "surface_reading_en": "Negation of specific guidance"},
    "tension_ar": "ظاهر اختلاف في نسبة الهداية",
    "tension_en": "Apparent attribution tension around guidance"
  },
  "reconciliation": {
    "method": "تمييز نوعي الهداية",
    "method_ar": "التفريق بين هداية الدلالة وهداية التوفيق",
    "explanation_ar": "يثبت للرسول هداية البيان وينفى عنه التوفيق",
    "explanation_en": "Messenger guides by explanation, not by granting tawfiq",
    "supporting_evidence": [],
    "scholarly_positions": []
  },
  "reconciliation_method_type": "نفي التعارض",
  "creedal_stakes": "high"
}

Category confidence anchors (doctrinal):
- 0.90: source explicitly states apparent tension and provides grounded reconciliation method.
- 0.60: tension and reconciliation are mostly grounded, but one doctrinal linkage is inferred.
- 0.35: weak evidence of genuine doctrinal tension; could be thematic overlap instead.
"""

