# Wilo model comparison — 2026-10-25

This is a shortlist for Arabic/English/Hebrew website commands, not a claim to have tested every published model. A free chat website is not a free embeddable API. Open weights do not include free compute. No model has yet passed the 618 live acceptance cases.

## Cloud candidates (official sources checked)

| Service | Offer | Material restriction / current verification |
| --- | --- | --- |
| Z.ai GLM-4.7-Flash | Input, cached input and output listed Free | Best zero-token-cost candidate found. Native tool calls and JSON supported. No verified unlimited guarantee or account-specific capacity; user has no account/key yet. Adapter prepared, live inference NOT tested. https://docs.z.ai/guides/overview/pricing and https://docs.z.ai/guides/llm/glm-4.7 |
| BigModel GLM-4.7-Flash | Official China-facing free model | Separate account/endpoint and account limits; cannot assume an international key works. https://www.zhipuai.cn/zh/news/148 and https://docs.bigmodel.cn/cn/guide/models/free/glm-4.7-flash |
| SiliconFlow | Models explicitly priced zero | Free models have fixed rate limits and real-name verification. Exact model availability/limits need the account model catalog. https://siliconflow.cn/pricing and https://api-docs.siliconflow.cn/docs/userguide/faqs/rate-limit-and-upgradation |
| OpenRouter | Free model variants | Free plan lists 50 requests/day; not a production unlimited offering. https://openrouter.ai/pricing |
| Groq | Free tier | Organization-level request/token limits; exact account settings govern. https://console.groq.com/docs/rate-limits |
| Gemini API | Free tier | Per-project RPM/TPM/RPD, account/model dependent. https://ai.google.dev/gemini-api/docs/rate-limits |
| Cerebras | Free tier | Lower rate limits; the public pricing page is old, so do not promise its historical numeric limits. https://inference-docs.cerebras.ai/support/pricing |
| NVIDIA NIM hosted endpoints | Free developer prototyping | Official FAQ limits developer access to prototyping/research/testing; not an unrestricted free public-site backend. https://docs.api.nvidia.com/nim/docs/product |
| Hugging Face Inference Providers | Monthly trial credits | Free users currently receive $0.10/month, subject to change. https://huggingface.co/docs/inference-providers/main/pricing |
| Alibaba Model Studio | New-user quota | Finite quota, generally 90-day validity; region/account conditions apply. https://www.alibabacloud.com/help/en/model-studio/new-free-quota-validity-adjustment |
| DeepSeek API | Metered API | Official API prices per token; free consumer chat is a separate product. https://api-docs.deepseek.com/quick_start/pricing/ |
| Cloudflare existing deployment | Free allocation | Actual synthetic live request here was blocked with ai-provider-limit before inference. This is not a comprehension result. |

Additional advertised "unlimited" services were checked:

- Puter: free to the developer, but each visitor uses their own account/allowance and pays after it. Not free unlimited usage for site visitors. https://docs.puter.com/user-pays-model/ and https://docs.puter.com/rate-limits-and-quotas/
- Pollinations: generation requires an authorized key and a budget/Pollen; no-RPM-cap secret keys do not mean zero-cost unlimited compute. https://gen.pollinations.ai/

## Local candidates

Weights below are sums of nbytes from official mlc-ai ndarray-cache.json manifests; tokenizer/WASM/runtime downloads and RAM are additional. All live probes use the same synthetic cases and existing domain validation/oracle; they do not write to production Firebase.

| Candidate | Weight bytes | Initial result |
| --- | ---: | --- |
| Qwen3 0.6B q4f16 | 335,372,288 | Loaded; greeting 2.7s. Two command cases failed. Simplifying the envelope alone did not fix semantic correctness. |
| Qwen2.5 1.5B Instruct q4f16 | 868,547,584 | Loaded; greeting 5.5s. Actual command probe in progress at initial documentation. |
| Qwen3 1.7B q4f16 | 968,001,536 | Loaded; greeting 3.4s. First edit timed out at 120s; its first output understood the new name but used an example placeholder as ID. Subsequent case was blocked because the worker had been disposed, not a semantic failure. |
| Qwen2.5 3B Instruct | Not yet measured | Supported by installed WebLLM; not yet tested. |
| Qwen3 4B q4f16 | 2,262,920,192 | Earlier configuration loaded, but first edit took minutes and failed; not certified. Cached weights can be reused for revised-contract comparisons. |
| Qwen3 8B | Not yet measured | Supported but larger memory/download burden; test only if smaller candidates fail. |
| LFM2.5 1.2B / 350M | Not measured | Official model cards include Arabic; ONNX/GGUF formats exist. Not present in the installed WebLLM model list; needs a different validated runtime before website testing. https://huggingface.co/LiquidAI/LFM2.5-1.2B-Instruct and https://www.liquid.ai/models |
| Qwen3.5 0.8B / 2B; Gemma3 1B | Not measured | MLC models exist, but not registered in the installed runtime. Do not assume downloadable weights imply compatible browser execution. https://huggingface.co/mlc-ai/models |

## Protocol corrections being compared

- Model selects operations and values. App builds review task indexes and unused arrays.
- Authorized compact record names/IDs are preloaded when the whole catalog fits; larger catalogs remain explicitly available through paged reads. Notes and full bodies use read tools.
- Follow-up commands are sent to the model with confirmed saved references. Fixed-phrase follow-up and purge shortcuts are removed from the widget.
- Natural-language regex no longer inserts extra section mutations in workspace validation.
- Existing domain validators, account scopes, user review, persistence checks and Firestore rules remain responsible for execution.
- Test-only model overrides live in the browser probe. No production deployment or provider switch has been made.

A greeting is only an initialization check. Mock/fixture test passes are not model-quality evidence. The first two cases screen candidates; a candidate must then pass a varied sample and the full 618 suite plus persistence checks before release.