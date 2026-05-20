# Pipeline Iterations & Lessons Learned

## Overview
Building a robust data extraction pipeline for unstructured Arabic text using Large Language Models (LLMs) presented several unique challenges. To demonstrate our technical rigor, this document chronicles the iterative journey of our pipeline's development. It highlights the specific obstacles we faced with LLM extraction and the engineering solutions we implemented to overcome them.

## The Iteration Journey

### Iteration 1: The Profiling Bottleneck
* **Problem:** Our initial approach involved a single, massive profiling prompt asking Gemini Flash for 15+ JSON fields to understand a book's structure. The model consistently truncated its responses, resulting in critical fields like `entry_count_estimate` and `extraction_difficulty` being omitted entirely.
* **Solution:** We split the profiling step into two focused, sequential calls:
  1. **Structural Call:** Extracts core fields needed for chunking (e.g., `entry_delimiter`, `organization_type`, `verse_citation_format`).
  2. **Contextual Call:** Extracts enrichment fields for the system prompt (e.g., `muqaddimah_summary`, `example_entries`, `methodology_note`).
* **Outcome:** 100% success rate in generating complete, schema-compliant profiles for all books.

### Iteration 2: Schema Rejection (`additionalProperties`)
* **Problem:** The Gemini Developer API rejected our strict JSON schemas because the `SimpleRecord` model contained `dict[str, Any]` fields. When Pydantic generated the JSON schema, it emitted `additionalProperties: true`, which the API does not support in Developer mode.
* **Solution:** We removed the strict `response_schema` constraint from the API call. Instead, we relied on `response_mime_type: application/json` combined with explicit prompt instructions, and implemented a fallback mechanism to retry without the schema constraint if the initial call failed.

### Iteration 3: JSON Parsing Catastrophe
* **Problem:** During our first full multi-book run, 80-100% of chunks failed. The root cause was malformed JSON returned by the LLM (unterminated strings, missing commas, truncated output), particularly when handling long Arabic text with special characters.
* **Solution:** We implemented a multi-layered defense:
  1. Replaced all `dict[str, Any]` fields with strict, explicitly typed Pydantic models.
  2. Integrated the `json-repair` library to automatically salvage broken or truncated JSON responses.
  3. Increased the retry logic from 1 to 3 attempts per chunk.

### Iteration 4: The Core Discovery (Prompt Compliance vs. Chunk Density)
* **Problem:** Even with JSON parsing fixed, extraction recall was abysmal (e.g., extracting only 1 record from a chunk containing ~30 entries). The fixed-window chunker (2,400 words) packed too many entries into a single prompt. The LLM suffered from "laziness," consistently extracting only the first or most prominent record and ignoring the rest.
* **Solution: Hybrid Entry-Aware Chunking.** We fundamentally changed our chunking strategy. Instead of arbitrary word counts, we utilized the `entry_delimiter` discovered during the profiling phase to split the text exactly at entry boundaries. We then grouped exactly 3 entries per chunk with a ~600-token cap. If a book lacked a clear delimiter, the system gracefully fell back to the fixed-window approach.
* **Outcome:** Extraction recall skyrocketed. A single chunk could now reliably produce multiple records, and the error rate dropped to near zero.

## Key Takeaways

1. **LLMs are "Lazy" with Dense Lists:** Asking an LLM to extract 30 complex items from a massive text block reliably fails. Micro-chunking (e.g., 3 items per chunk) is absolutely required for high recall in data extraction tasks.
2. **Data Profiling is a Prerequisite:** You cannot chunk text effectively without first understanding the structural markers of the specific document. Automated profiling to discover delimiters is a critical first step.
3. **Resilience over Perfection:** When dealing with LLM JSON outputs—especially in right-to-left languages with complex formatting—expect malformed data. Integrating tools like `json-repair` and robust fallback mechanisms is essential for a production-grade pipeline.
