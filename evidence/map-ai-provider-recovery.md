# Map and AI provider recovery record

Reviewed and reproduced on 2026-09-08. This record distinguishes live provider observations from mocked browser-interface checks. It does not claim physical-phone, deployed-release, or TRL 5 acceptance.

## Reproduced defects

The Night view requested unauthenticated CARTO raster tiles such as `https://b.basemaps.cartocdn.com/dark_all/...@2x.png`. The requests returned HTTP 200 PNGs, but the image itself contained the repeated message **API KEY REQUIRED**. CARTO's current official page confirms that its basemaps now require a key and that the raster service is being retired. A successful HTTP status is therefore insufficient acceptance for this provider.

The Satellite view requested the NASA GIBS layer `VIIRS_SNPP_CorrectedReflectance_TrueColor` with URLs ending in `.jpg`. At route-view zooms, the observed requests returned HTTP 404 and MapLibre displayed only its dark background. The live GIBS WMTS capabilities document advertises this layer as `image/jpeg` and its REST tile templates end in `.jpeg`. `GoogleMapsCompatible_Level9` and the `default` time form are valid. The wrong filename extension caused the blank view.

Reproduction screenshots are stored as `map-defect-night.png` and `map-defect-satellite.png` in this directory.

## Repair decisions

- Reuse the standard OpenStreetMap raster tiles for Night and apply a restrained MapLibre raster treatment. This avoids CARTO entirely and retains OpenStreetMap attribution. The Night acceptance test rejects any request to `cartocdn.com` and requires successful OpenStreetMap image responses.
- Use EOxCloudless 2025 for the keyless Satellite view and EOX's bright overlay for Hybrid, capped at the documented EPSG:3857 zoom level 14. EOX documents direct WMTS/WMS integration and 10-metre Sentinel-2 cloudless mosaics. The 2018–2025 public layers are free for non-commercial use under CC BY-NC-SA 4.0 and require the year-specific EOxCloudless/EOX/modified-Copernicus attribution in the map interface.
- Keep MapTiler as the optional sharper satellite provider. Its Free plan requires an account and browser API key; the public key should be restricted to the application's origins. Do not commit the key or copy MapTiler-hosted tiles into the offline pack.
- Browser acceptance must reject every CARTO request, require successful OpenStreetMap resources for Night, and require multiple successful `image/jpeg` EOxCloudless tiles with no 4xx responses for Satellite. `browser-tests/provider-recovery.spec.js` enforces that contract.

## AI provider decision and acceptance boundary

Cloudflare Workers AI is already bound as `env.AI` in `wrangler.toml`; no separate provider secret is needed for this binding. Cloudflare documents that Workers AI is available on both Free and Paid Workers plans with a daily free allocation of 10,000 Neurons. Usage above that allocation is unavailable on the Free plan and billable on a Paid plan. Cloudflare also states that local Workers AI calls reach the account and consume usage, so local development is not an offline model run.

The configured model is `@cf/zai-org/glm-4.7-flash`. Its output must still pass application-side schema, citation, exact-excerpt, timeout, rate-budget, and circuit-breaker checks. A configuration value is not a live availability probe, and structured-output requests must still be validated by the application.

`browser-tests/provider-recovery.spec.js` checks the interface contract with deterministic HTTP fixtures:

- a guest can send the intended question without first joining a carriage;
- a successful answer is visibly labelled as an experimental, source-locked AI excerpt, identifies its source, and says that human review remains pending;
- a provider failure leaves the cached chapter and source links usable.

Those fixtures verify browser rendering and request wiring only. A real provider claim additionally requires a successful request to the Worker and the fixed provider evaluation in `harness/ai-eval.js`; secrets and session tokens must stay out of command arguments, screenshots, logs, and result files.

## Final local acceptance result

On 2026-09-08, the frozen local build passed all 21 Playwright checks in 54.5 seconds. The provider-specific checks observed successful live image responses for OpenStreetMap Night, EOxCloudless Satellite, and the EOX Hybrid overlay; no CARTO request or provider HTTP error was observed. React route remount cleanup, narrow-phone control sizing, animated route progress, offline fallback, localized scenes, the labelled AI success interface, and the AI fallback interface also passed.

The AI browser checks use deterministic responses so they can prove interface behavior without spending provider quota. A separate live Workers AI probe returned a source-locked excerpt through `@cf/zai-org/glm-4.7-flash`; this remains experimental provider evidence rather than a completed grounding evaluation or TRL 5 gate.

## Official sources

- [CARTO basemap API-key requirement and raster retirement notice](https://carto.com/basemaps/apikey/)
- [NASA GIBS access basics and REST templates](https://nasa-gibs.github.io/gibs-api-docs/access-basics/)
- [NASA GIBS Web Mercator WMTS capabilities](https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/1.0.0/WMTSCapabilities.xml)
- [EOxCloudless pricing and public-service conditions](https://cloudless.eox.at/pricing)
- [EOxCloudless non-commercial licence and attribution strings](https://cloudless.eox.at/license-non-commercial)
- [EOxCloudless service integration and WMTS endpoints](https://cloudless.eox.at/documentation/usage)
- [Cloudflare Workers AI bindings](https://developers.cloudflare.com/workers-ai/configuration/bindings/)
- [Cloudflare Workers AI pricing and free allocation](https://developers.cloudflare.com/workers-ai/platform/pricing/)
- [Cloudflare Workers AI model catalogue](https://developers.cloudflare.com/workers-ai/models/)
- [Cloudflare Workers AI GLM-4.7-Flash model page](https://developers.cloudflare.com/workers-ai/models/glm-4.7-flash/)
- [Cloudflare Workers AI JSON Mode limits](https://developers.cloudflare.com/workers-ai/features/json-mode/)
