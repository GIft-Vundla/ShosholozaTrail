# Free services and data review for the immersive map

Reviewed against primary provider documentation on 2026-09-08. “Free” below means the documented service or data can be used without a paid plan for the stated pilot use. It does not imply an uptime guarantee, unlimited use, or permission to cache another provider's hosted tiles.

## Conservative recommendation

Use **MapLibre GL JS** as the renderer and **OpenFreeMap** as the default online vector basemap. This combination needs no account, key, or payment card and supports the light, street, dark, and 3D-style views needed by the local experiment. Keep the existing first-party route and story assets as the guaranteed offline fallback.

Add **NASA GIBS** only as a clearly named “Earth observation” layer for country and regional views. It is public, keyless imagery, but it is time-dependent scientific imagery and does not provide the high-detail, cloud-free experience people associate with Google satellite maps.

For a later, bounded offline corridor pack, generate and host our own tiles from **Sentinel-2 COGs** and **Copernicus DEM GLO-90**. Both can be read from AWS Open Data without an AWS account. This needs a build pipeline and storage budget, but avoids a third-party tile cache that can be suspended or prohibited. Use GLO-90 initially; current Copernicus documentation says access to the GLO-30 view service changed in July 2026 and now requires registration for an authorised user category.

Use **Open-Meteo** only for the non-commercial pilot and cache the last successful response in the app for graceful failure. Use **Wikimedia Commons** as a discovery source for archival material, then download each approved file into the content pack with its own author, source URL, license, and modification notice. Do not treat “hosted on Commons” as a single blanket license.

MapTiler is useful for a quick local comparison of satellite, hybrid, streets, and terrain. Its free plan is suitable for testing and non-commercial use, needs an account and API key but no billing information, and has hard quotas. Its hosted map content must not become the offline pack.

## Account, key, card, and usage matrix

| Option | Account | Key | Payment card | Commercial use | Attribution | Offline / caching constraint |
| --- | --- | --- | --- | --- | --- | --- |
| MapLibre GL JS | No | No | No | Yes under its BSD-style license | Retain software license notices. Data-source attribution is separate. | Renderer only; it supplies no map data. Bundle the library locally for offline startup. |
| OpenFreeMap public instance | No | No | No | Yes | Required: OpenMapTiles and OpenStreetMap data credit; OpenFreeMap credit is encouraged. | No SLA. Its terms prohibit automated data collection without permission. Do not scrape/prefetch the public tile endpoint; use its published planet downloads/self-hosting path to make an offline extract. |
| MapTiler Cloud Free | Yes | Yes, intended for browser use | No billing information for Free | Free plan is limited to testing, personal/non-commercial use and R&D for commercial products | MapTiler attribution/logo and underlying data credit must remain visible. | Temporary single-end-user device cache is allowed. Bulk download, server-side caching/proxying, export, and redistributing hosted map content require a custom agreement. Free quota currently includes 5,000 map sessions, 2,000 3D sessions, and 100,000 API requests per month; service pauses when exhausted. |
| NASA GIBS | No account documented for the public WMTS/WMS/TWMS/XYZ endpoints | No key documented | No | NASA-led mission data is generally open; verify each layer if it contains third-party material | Acknowledge NASA and cite the specific dataset/layer. Do not imply NASA endorsement. | NASA documents programmatic download. More than 1,000,000 imagery tiles in 24 hours is a bulk download and should be coordinated 48 hours in advance. Resolution and dates vary by layer. |
| Open-Meteo Free API | No | No | No | No; free endpoint is non-commercial only | Required under CC BY 4.0, including indication of modifications | 600 calls/minute, 5,000/hour, 10,000/day, 300,000/month; no SLA. Self-hosting is possible under AGPLv3, with source-sharing duties for modified network deployments. |
| Wikimedia Commons read/API use | No for ordinary public reads | No for ordinary public reads | No | Usually, but file-specific rights control reuse | Every file must carry its creator, source, license, and any required modification/share-alike notice | Download approved media rather than hotlinking. Follow API rate/backoff instructions and identify automated clients with a descriptive User-Agent. Verify every file's rights and non-copyright restrictions. |
| Sentinel-2 L2A COGs on AWS Open Data | No AWS account | No signed request | No | Yes under the Copernicus free, full and open policy | Use the applicable “Copernicus Sentinel data [year]” or modified-data notice and record AWS/collection provenance | Raw scenes are large and are not ready-made slippy-map tiles. Select, composite, resize, and tile only the bounded corridor needed by the pilot. |
| Copernicus DEM GLO-90 on AWS Open Data | No AWS account | No signed request | No | Free for the general public under its data license | Cite Copernicus DEM and access date; preserve required license notices | Static elevation COGs must be converted to a MapLibre-compatible raster-dem/terrain source. Prefer GLO-90 until GLO-30 access and redistribution are reviewed for this project. |

## Service notes and official sources

### MapLibre GL JS

MapLibre is the map renderer, not a basemap provider. Its official project page documents WebGL rendering, camera animation, 3D terrain, globe, raster/satellite sources, and custom layers. The repository license permits source and binary redistribution with notice preservation. A visible MapLibre logo is not required by the renderer, but every map-data provider can impose its own attribution.

- [MapLibre GL JS project and capabilities](https://maplibre.org/projects/gl-js/)
- [MapLibre GL JS documentation](https://maplibre.org/maplibre-gl-js/docs/)
- [MapLibre GL JS license](https://github.com/maplibre/maplibre-gl-js/blob/main/LICENSE.txt)
- [MapLibre camera, terrain, satellite, and interaction examples](https://maplibre.org/maplibre-gl-js/docs/examples/)

### OpenFreeMap

The official site states that the hosted public instance has no registration, API key, cookie, or request/view limit, allows commercial use, and provides several vector styles plus a 3D style. Attribution is required. The service is provided as-is without an SLA and can be discontinued. The site also publishes weekly planet downloads and the full self-hosting stack. Because the terms prohibit automated collection without permission, offline packaging should use the documented download/self-host route rather than crawling public tiles.

- [OpenFreeMap service, styles, license, attribution, and hosting description](https://openfreemap.org/)
- [OpenFreeMap terms of service](https://openfreemap.org/tos/)
- [OpenFreeMap privacy and account/payment facts](https://openfreemap.org/privacy/)

### MapTiler Cloud

The current free plan needs a MapTiler account and public browser API key but no billing information. The key should be restricted by allowed origin and separated per application; MapTiler describes browser API keys as read-only credentials whose misuse consumes quota. The free plan is restricted to testing, personal/non-commercial use and commercial-product R&D. Current free limits are 5,000 sessions/month, 2,000 3D sessions/month, 100,000 API requests/month, five custom styles, and 5 GB storage with a one-file limit. The service pauses for the month after a free quota is exhausted.

MapTiler permits only temporary personal device caching for one user. It prohibits server-side caching, proxying without agreement, bulk tile download, export, and redistribution of hosted map content. Therefore it can demonstrate live visual styles but cannot be the source for the app's guaranteed offline pack.

- [MapTiler Cloud pricing and current free limits](https://www.maptiler.com/cloud/pricing/)
- [MapTiler Cloud terms, including cache and bulk-download rules](https://www.maptiler.com/terms/cloud/)
- [MapTiler API key requirements and protection](https://docs.maptiler.com/cloud/api/authentication-key/)
- [MapTiler authentication options](https://docs.maptiler.com/cloud/api/authentication/)

### NASA GIBS

GIBS publishes imagery through public standards-compliant WMTS, WMS, TWMS, and XYZ-compatible endpoints in geographic, Web Mercator, and polar projections. The official examples use URLs without credentials. Layers are tied to a date or time and have predetermined resolutions. Common true-colour layers are useful at route and regional scale; they are not a drop-in source of street-level aerial detail.

NASA permits programmatic imagery downloading and defines a coordinated bulk-download process. NASA Earthdata says NASA-led mission data is generally open and, unless marked otherwise, CC0; NASA should be acknowledged, third-party layer restrictions must be checked, and use must not imply endorsement.

- [GIBS access basics and service endpoints](https://nasa-gibs.github.io/gibs-api-docs/access-basics/)
- [GIBS map-library and bulk-download guidance](https://nasa-gibs.github.io/gibs-api-docs/map-library-usage/)
- [NASA Earthdata use and citation guidance](https://www.earthdata.nasa.gov/engage/open-data-services-software/data-use-policy)

### Open-Meteo

Open-Meteo's free hosted API requires no account, key, or card, but is explicitly non-commercial and has no uptime guarantee. Current limits are 600 calls/minute, 5,000/hour, 10,000/day, and 300,000/month. Displayed data needs Open-Meteo attribution under CC BY 4.0. The open-source server can be self-hosted, but its AGPLv3 terms need separate review before a modified hosted version is used.

- [Open-Meteo pricing and limits](https://open-meteo.com/en/pricing)
- [Open-Meteo terms](https://open-meteo.com/en/terms)
- [Open-Meteo API documentation](https://open-meteo.com/en/docs)

### Wikimedia Commons

Wikimedia Commons files are reusable under the license shown on each file page, and that license may require attribution, a license link, modification disclosure, or share-alike treatment. Wikimedia warns reusers to verify each file's copyright status and non-copyright restrictions such as personality rights. It recommends downloading selected files instead of hotlinking them.

For automated API use, identify the client with a descriptive User-Agent or `Api-User-Agent`, obey rate-limit/backoff responses, and do not hide the Wikimedia service behind a white-label API. Ordinary public read access does not need a token; modifying actions do.

- [Commons reuse requirements](https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia/en)
- [Commons technical reuse guidance](https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia/technical)
- [Wikimedia API usage guidelines](https://foundation.wikimedia.org/wiki/Policy:Wikimedia_Foundation_API_Usage_Guidelines)
- [Wikimedia User-Agent policy](https://foundation.wikimedia.org/wiki/Policy:Wikimedia_Foundation_User-Agent_Policy/en)
- [MediaWiki API token FAQ](https://www.mediawiki.org/wiki/API:FAQ/en)

### Offline terrain and detailed satellite data

AWS Open Data exposes Copernicus DEM GLO-90 and public GLO-30 COGs using unsigned S3 requests, so an AWS account is not required. The GLO-90 license is explicitly free and open. Because Copernicus changed GLO-30 view-service access in July 2026, use GLO-90 for the first terrain prototype and review the exact GLO-30 source/license before shipping it.

Sentinel-2 L2A COGs are also available through unsigned S3 and a public STAC search endpoint. Copernicus grants free, full, and open rights to reproduce, distribute, communicate, adapt, and combine Sentinel data, subject to source notices. These products are source data rather than hosted visual map tiles. A cloud-free mosaic and tile-generation step is required before they are appropriate for smooth mobile viewing.

- [Copernicus DEM on AWS Open Data](https://registry.opendata.aws/copernicus-dem/)
- [Copernicus DEM access documentation](https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Data/DEM.html)
- [2026 GLO-30 access change](https://dataspace.copernicus.eu/news/2026-7-17-copernicus-dem-30m-view-service-license-acceptance)
- [Sentinel-2 COGs on AWS Open Data](https://registry.opendata.aws/sentinel-2-l2a-cogs/)
- [Copernicus Sentinel legal notice](https://sentinels.copernicus.eu/documents/247904/690755/Sentinel_Data_Legal_Notice)

## Options deliberately excluded from the no-paid-service stack

Google's Map Tiles API provides roadmap, satellite, terrain, Street View, and photorealistic 3D themes, but it requires a Google Cloud project/API key and its policy prohibits offline use and unauthorised caching. That conflicts with the pilot's no-paid-service and offline requirements. The visual interaction patterns can be reproduced with MapLibre and appropriately licensed sources; Google map content must not be copied, traced, or mixed into that implementation.

- [Google Map Tiles API policies](https://developers.google.com/maps/documentation/tile/policies)
- [Google Map Tiles API overview](https://developers.google.com/maps/documentation/tile/overview)

## Accounts or keys the user needs now

None are required for the recommended local implementation. MapLibre, OpenFreeMap, NASA GIBS, public Wikimedia reads, Open-Meteo's non-commercial endpoint, and the selected AWS Open Data buckets work without an account or key.

If the team wants the optional MapTiler comparison styles, use the existing MapTiler account and create a new browser API key restricted to the local development origin. Do not place a service token or any write-capable credential in `public/`, source control, a style JSON document, or the browser bundle.
