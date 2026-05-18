from .cross_surah import CrossSurahRefrainPayload
from .doctrinal import DoctrinalPayload
from .lexical import LexicalPayload
from .narrative import NarrativePayload
from .semantic import SemanticPayload
from .structural import StructuralPayload
from .thematic import ThematicPayload

CategoryPayloadType = (
    LexicalPayload
    | SemanticPayload
    | ThematicPayload
    | NarrativePayload
    | StructuralPayload
    | CrossSurahRefrainPayload
    | DoctrinalPayload
)

