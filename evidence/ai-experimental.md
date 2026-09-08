# Experimental grounded AI

Record date: 2026-09-08 (Africa/Johannesburg). This is local component evidence for the immersive experiment branch, not a deployed-provider evaluation or a TRL 5 claim.

## Provider path

The experiment uses the Cloudflare Workers AI binding in `wrangler.toml`. It does not need a Gemini, Groq, or browser API key. Cloudflare documents the `[ai]` binding and `env.AI.run()` in its [Workers AI binding guide](https://developers.cloudflare.com/workers-ai/configuration/bindings/). Cloudflare currently includes 10,000 Neurons per day with the Workers Free plan; local inference also uses the remote allocation. See [Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/) and [Wrangler binding behavior](https://developers.cloudflare.com/workers/wrangler/configuration/#workers-ai).

The selected `@cf/zai-org/glm-4.7-flash` model is active, optimized for fast multilingual instruction following, and its model schema accepts a structured response format. See Cloudflare's [GLM-4.7-Flash model page](https://developers.cloudflare.com/workers-ai/models/glm-4.7-flash/) and [JSON Mode documentation](https://developers.cloudflare.com/workers-ai/features/json-mode/).

## Safety and grounding behavior

- The browser never receives a provider credential. The Worker binding performs inference.
- The model receives a strict named JSON schema and can return one source ID and an exact contiguous excerpt from that source. Server code still rejects added prose, unknown citations, multiple citations, malformed output, and excerpts shorter than 12 characters.
- Existing source records are automated editorial drafts awaiting human review. Experimental responses expose `sourceReview: editorial-draft-human-review-pending`, and their label says human review is pending.
- `AI_VALIDATED` stays `false`. `AI_EXPERIMENTAL=true` is a separate, visible runtime mode and does not satisfy the release validation gate.
- Guests do not need a carriage room. A daily rotating hash of Cloudflare's connection IP receives 100 requests per day. Valid carriage sessions also receive 100 requests per day. The global application budget is 1,000 requests per day; all three limits are deployment variables.
- Prepared stories, deterministic hints, activities, and saved work still operate without the AI service.

## Local smoke result

Wrangler started with local D1/assets and the remote Workers AI binding. A request asking where Freedom Park is returned HTTP 200 with:

- `status: source-excerpt`
- one registered source ID
- `mode: experimental-source-locked`
- `sourceReview: editorial-draft-human-review-pending`
- a 233-character answer that passed the server's exact-excerpt check

The final strict-schema GLM-4.7-Flash provider call completed in approximately 4.4 seconds. This single smoke proves the configured path can produce a grounded response. It does not replace the fixed 30/10/10 evaluation, human source review, failure testing against the deployed build, or phone acceptance.

No Worker secrets were present or required for this path. Future deployments obtain the AI binding from `wrangler.toml`; no secret should be added to the client or repository.
