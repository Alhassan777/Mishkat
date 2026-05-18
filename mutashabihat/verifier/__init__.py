from .dictionary import connect as connect_dictionary
from .dictionary import get_verse, load_from_hf_dataset
from .dictionary import load_from_alquran_cloud_api
from .fuzzy_match import infer_reference_from_snippet, similarity_score, verify_extracted_verse
from .normalizer import normalize_arabic

