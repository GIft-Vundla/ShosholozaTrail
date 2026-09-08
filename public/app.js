import { get, put, entries, persistJourney, measure } from './storage/drafts.js';
import { installPack, packStatus } from './storage/pack.js';
import { createJourneyEngine } from './engine/journey.js';
import { createReplaySource } from './engine/replay.js';
import { createGpsSource } from './engine/gps.js';
import { createImmersiveMap, sliceLineAtDistance } from './map/immersive-map.js';
import { mountLocalizedAnimation } from './animations/localized-scenes.js';
// The React front door owns '/'. The journey engine and its stories,
// creative, carriage, contribute and evidence screens live under this base.
const BASE = '/app';
const withBase = p => (p === '/' ? BASE : BASE + p);
const stripBase = p => (p === BASE ? '/' : p.startsWith(BASE + '/') ? p.slice(BASE.length) : p);
const bootAt = performance.now();
const $ = s => document.querySelector(s);
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const main = $('#main');
let pack, hubs, route, sources, engine, positionSource, map, latestFix, currentMode = 'manual', engineMode = 'gps', waiting = false, draftDirty = false, mapFollowing = true, mapPreviewStop = null, activeScene = null;
let remoteMapConfigPromise = null;
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const say = text => { $('#message').textContent = text; };
const json = async url => { const r = await fetch(url); if (!r.ok) throw new Error(`${url} unavailable`); return r.json(); };
const bind = (selector, handler, event = 'click') => { const element = $(selector); if (element) element.addEventListener(event, async e => { try { await handler(e); } catch (error) { say(error.message || 'The action failed. Your saved work is preserved.'); } }); };
const chapterLink = c => withBase(`/stories/${encodeURIComponent(c.hubId)}`);
const chapterByHub = hubId => pack.chapters.find(c => c.hubId === hubId);
function sourceCards(ids = []) {
 return ids.map(id => { const s = sources.records.find(r => r.id === id); return s ? `<div class="source"><a target="_blank" rel="noopener noreferrer" href="${escape(s.url)}">${escape(s.institution || s.author || id)} ↗</a><p>${escape(s.passage)}</p><small>Source check: ${escape(s.reviewDate || 'pending')} · Human editorial approval pending</small></div>` : '<p>Source unavailable; do not treat this claim as reviewed.</p>'; }).join('');
}
function network() { $('#network').textContent = navigator.onLine ? 'Online' : 'Offline · local pack'; }
window.addEventListener('online', network); window.addEventListener('offline', network);
const menuToggle = $('#menu-toggle'), mobileMenu = $('#mobile-menu');
menuToggle?.addEventListener('click', () => {
 const expanded = menuToggle.getAttribute('aria-expanded') !== 'true';
 menuToggle.setAttribute('aria-expanded', String(expanded));
 mobileMenu.hidden = !expanded;
});
function setMode(mode) {
 currentMode = mode;
 $('#position-label').textContent = mode === 'replay' ? 'SIMULATED REPLAY · 120×' : mode === 'gps' ? 'LIVE GPS · foreground' : 'Manual exploration';
 $('#position-label').className = `badge ${mode}`;
 const stageMode = $('#journey-mode');
 if (stageMode) {
   stageMode.textContent = mode === 'replay' ? 'SIMULATED REPLAY' : mode === 'gps' ? 'LIVE GPS' : 'EXPLORE MAP';
   stageMode.className = `journey-mode ${mode}`;
 }
}
function mountHubScene(target, hubId, options = {}) {
 activeScene?.destroy?.();
 const host = typeof target === 'string' ? $(target) : target;
 if (!host) return null;
 activeScene = mountLocalizedAnimation(host, hubId, { durationSeconds: 9, controls: true, ...options });
 return activeScene;
}
function showJourneyStoryCard(hubId, { encountered = false } = {}) {
 const c = chapterByHub(hubId), station = hubs.stations.find(item => item.hubId === hubId), card = $('#map-story-card');
 if (!c || !station || !card) return;
 const body = Array.isArray(c.body) ? c.body.join(' ') : c.body;
 const summary = body.length > 230 ? `${body.slice(0, 227).trim()}…` : body;
 card.hidden = false;
 card.innerHTML = `<button id="close-story-preview" class="story-preview-close" type="button" aria-label="Close story preview">×</button><div id="map-local-scene" class="map-local-scene"></div><p class="eyebrow">${encountered ? 'Story unlocked' : 'Story stop'} · ${escape(station.name)}</p><h2>${escape(c.title)}</h2><p>${escape(summary)}</p><div class="story-preview-meta"><span>Localized scene</span><span>${c.depth === 'deep' ? 'Story + activity' : 'Short chapter'}</span><span>Text available offline</span></div><a class="button" data-nav href="${chapterLink(c)}">Open this chapter</a><p><small>${escape(c.locationNotice)}</small></p>`;
 mountHubScene('#map-local-scene', hubId);
 if (!encountered) map?.flyToHub?.(hubId);
 $('#close-story-preview')?.addEventListener('click', () => { activeScene?.pause?.(); card.hidden = true; });
}
function showAttractionCard(attraction) {
 const c = chapterByHub(attraction.hubId), card = $('#map-story-card');
 if (!c || !card) return;
 card.hidden = false;
 card.innerHTML = `<button id="close-story-preview" class="story-preview-close" type="button" aria-label="Close attraction preview">×</button><div id="map-local-scene" class="map-local-scene"></div><p class="eyebrow">Nearby attraction · ${escape(c.title.split(':')[0])}</p><h2>${escape(attraction.name)}</h2><p>This place is associated with the story hub. Visibility from the train and rail access are not established.</p><div class="story-preview-meta"><span>Localized scene</span><span>Mapped attraction</span><span>Location not field verified</span></div><a class="button" data-nav href="${chapterLink(c)}">Open the hub chapter</a>${attraction.coordinateSourceUrl ? `<p><small><a href="${escape(attraction.coordinateSourceUrl)}" target="_blank" rel="noopener noreferrer">View coordinate source ↗</a></small></p>` : ''}`;
 mountHubScene('#map-local-scene', attraction.hubId);
 map?.flyToAttraction?.(attraction.id, { zoom: 12 });
 $('#close-story-preview')?.addEventListener('click', () => { activeScene?.pause?.(); card.hidden = true; });
}
function updateJourneyMap(fix, snapshot) {
 if (!map || !fix) return;
 const accepted = snapshot?.lastAccepted;
 const distanceMetres = accepted && accepted.t === fix.t ? accepted.s : fix.s;
 map.updatePosition({ ...fix, s: distanceMetres, source: currentMode }, { distanceMetres, pitch: waiting ? 0 : 58 });
 if (accepted && accepted.t === fix.t) {
   const total = Number(route.properties?.lengthMetres) || 1, percent = Math.max(0, Math.min(100, accepted.s / total * 100));
   if ($('#journey-progress')) $('#journey-progress').textContent = `${Math.round(percent)}% of the mapped rail candidate traversed`;
   if ($('#journey-progress-bar')) $('#journey-progress-bar').value = percent;
   $('#map')?.setAttribute('data-route-progress', String(percent));
 }
}
function renderChapterQueue() {
 const element = $('#chapter-queue');
 if (!element || !engine) return;
 const queued = engine.snapshot().queue.map(chapterByHub).filter(Boolean);
 element.hidden = queued.length === 0;
 element.innerHTML = queued.length ? `<strong>${queued.length === 1 ? 'A chapter is ready' : `${queued.length} chapters are ready`}.</strong> ${queued.map(c => `<a data-nav href="${chapterLink(c)}">${escape(c.title)}</a>`).join(' · ')} <small>Queued from ${escape(engineMode)} positioning; opening one clears it from this queue.</small>` : '';
}
async function loadEngine(mode) {
 const saved = await get('state', `journey-${mode}`);
 engineMode = mode;
 engine = createJourneyEngine({ route, zones: hubs.triggerZones, fired: saved?.fired || [], queue: saved?.queue || [],
 persist: (snapshot, events) => persistJourney(snapshot, events, `journey-${mode}`),
 onEvent: event => { if (event.fired) { say(`New chapter queued: ${chapterByHub(event.hubId)?.title || event.hubId}. Your current activity stays open.`); showJourneyStoryCard(event.hubId, { encountered: true }); document.querySelector(`.immersive-hub[data-hub="${CSS.escape(event.hubId)}"]`)?.classList.add('immersive-hub--reached'); } renderChapterQueue(); },
 onState: () => {} });
 renderChapterQueue();
}
async function initializeEngine() {
 const lastMode = await get('state', 'journey-last-mode');
 await loadEngine(lastMode === 'replay' ? 'replay' : 'gps');
}
async function consume(fix) {
 const snapshot = await engine.push(fix);
 latestFix = fix;
 updateJourneyMap(fix, snapshot);
 const state = typeof snapshot.state === 'object' ? snapshot.state.state : snapshot.state;
 if ($('#journey-state')) $('#journey-state').textContent = `Journey state: ${state || 'unknown'}`;
 waiting = state === 'waiting';
 activeScene?.setWaiting?.(waiting);
 document.body.classList.toggle('low-power', waiting);
 $('#waiting').hidden = !waiting;
 positionSource?.setSampleInterval?.(waiting ? 30000 : 5000);
 if (waiting) {
   const along = snapshot.lastAccepted?.s ?? 0;
   const zone = [...hubs.triggerZones].sort((a,b) => Math.abs((a.sEnter+a.sExit)/2-along)-Math.abs((b.sEnter+b.sExit)/2-along))[0];
   const c = chapterByHub(zone?.hubId) || pack.chapters[0];
   $('#waiting').innerHTML = `<p class="eyebrow">${currentMode === 'replay' ? 'Simulated wait · replay clock' : 'Waiting · low-power reading'}</p><h2>The train has not moved for more than 8 minutes.</h2><p>We don't have an official reason or a restart time. Here's what's around you, and something to do.</p><a href="${chapterLink(c)}" data-nav>Read ${escape(c.title)} →</a><p>${escape(c.creativePrompt || 'Write three things you notice from your seat.')}</p><p><small>Low-power reading · no board polling · foreground GPS delivery every 30 seconds. Battery savings not yet validated.</small></p>`;
 }
}
async function startJourney(mode) {
 positionSource?.stop();
 // A replay and a physical journey never share fired chapters or queues.
 if (engineMode !== mode) await loadEngine(mode);
 await put('state', 'journey-last-mode', mode);
 mapPreviewStop?.(); mapPreviewStop = null;
 setMode(mode);
 if (mode === 'replay') {
   const trace = await json('/data/traces/demo-corridor.json');
   positionSource = createReplaySource(trace, { rate: 120, onError: error => say(error.message) });
 } else positionSource = createGpsSource({ sampleIntervalMs: 5000, onError: error => say(`Location unavailable: ${error.message}. All stories remain available manually.`) });
 positionSource.start(consume);
 renderChapterQueue();
 say(mode === 'replay' ? 'Synthetic replay started. This is not a field test or a live train location.' : 'GPS started. Keep this page visible. Precise positions stay on this device.');
}
function stopJourney() { positionSource?.stop(); positionSource = null; mapPreviewStop?.(); mapPreviewStop = null; waiting = false; activeScene?.setWaiting?.(false); if ($('#waiting')) $('#waiting').hidden = true; document.body.classList.remove('low-power'); map?.setCinematic?.(!reducedMotion()); setMode('manual'); say('Position updates stopped. Explore any story stop on the map.'); }
function localMapConfig() {
 const browserKey = sessionStorage.getItem('shosholoza-maptiler-browser-key')?.trim();
 if (!browserKey) return {};
 const encoded = encodeURIComponent(browserKey);
 return {
   streetsTiles: [`https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${encoded}`],
   outdoorTiles: [`https://api.maptiler.com/maps/outdoor-v2/{z}/{x}/{y}.png?key=${encoded}`],
   darkTiles: [`https://api.maptiler.com/maps/dataviz-dark/{z}/{x}/{y}.png?key=${encoded}`],
   satelliteTiles: [`https://api.maptiler.com/tiles/satellite-v2/{z}/{x}/{y}.jpg?key=${encoded}`],
   hybridLabelTiles: [`https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${encoded}`],
   satelliteMaxZoom: 20,
   satelliteAttribution: 'MapTiler / OpenStreetMap contributors',
 };
}
function remoteMapConfig() {
 if (!remoteMapConfigPromise) remoteMapConfigPromise = fetch('/api/map-config', { cache: 'no-store', headers: { Accept: 'application/json' } })
  .then(async response => {
   const result = await response.json();
   if (!response.ok) throw new Error(result.reason || result.error || 'Map configuration unavailable');
   return result && typeof result === 'object' ? result : { provider: 'esri' };
  })
  .catch(() => ({ provider: 'esri' }));
 return remoteMapConfigPromise;
}
function setPreviewProgress(distanceMetres) {
 const total = Number(route.properties?.lengthMetres) || 1;
 const percent = Math.max(0, Math.min(100, Number(distanceMetres) / total * 100));
 if ($('#journey-progress')) $('#journey-progress').textContent = `${Math.round(percent)}% of the mapped rail candidate previewed`;
 if ($('#journey-progress-bar')) $('#journey-progress-bar').value = percent;
 if ($('#route-scrubber')) $('#route-scrubber').value = percent;
 $('#map')?.setAttribute('data-route-progress', String(percent));
}
async function renderJourney() {
 const [status, serverMapConfig] = await Promise.all([packStatus(), remoteMapConfig()]);
 const localConfig = localMapConfig();
 const hasLocalMapTiler = Boolean(sessionStorage.getItem('shosholoza-maptiler-browser-key'));
 const hasMapTiler = hasLocalMapTiler || serverMapConfig.provider === 'maptiler';
 const activeMapConfig = { ...serverMapConfig, ...localConfig };
 main.innerHTML = `<section class="journey-hero"><div><p class="eyebrow">Pretoria to Cape Town / Eight mapped stations / Seven sourced stories</p><h1>Watch the landscape.<br>Meet its stories.</h1><p class="intro">Explore a cinematic rail candidate, switch between street, terrain, night, satellite and hybrid views, then open a scene drawn for each sourced place.</p></div><div class="journey-compass" aria-hidden="true"><span>N</span><i></i><small>${Math.round(Number(route.properties?.lengthMetres || 0) / 1000).toLocaleString()} km mapped</small></div></section>
 <section id="journey-stage" class="journey-stage" aria-label="Interactive journey map">
  <div class="stage-bar"><div><span id="journey-mode" class="journey-mode manual">EXPLORE MAP</span><strong id="journey-progress">Move the route preview or choose a position source</strong></div><div class="stage-tools"><label class="follow-control"><input id="follow-map" type="checkbox" checked> Follow train</label><label class="follow-control"><input id="cinematic-camera" type="checkbox" ${reducedMotion() ? '' : 'checked'}> Cinematic camera</label></div></div>
  <div id="map" aria-label="Interactive corridor map with story stops and nearby attractions"></div>
  <div class="route-scrub"><label for="route-scrubber">Explore the route</label><input id="route-scrubber" type="range" min="0" max="100" value="0" step="0.25"><button id="cinematic-preview" class="secondary" type="button">Play cinematic preview</button><button id="fit-route" class="secondary" type="button">Fit whole route</button></div>
  <progress id="journey-progress-bar" class="journey-progress-bar" value="0" max="100" aria-label="Mapped journey progress"></progress>
  <aside id="map-story-card" class="map-story-card" aria-live="polite" hidden></aside>
  <p class="map-key"><span class="key-line mapped"></span>OSM-mapped rail candidate <span class="key-line travelled"></span>Previewed or traversed section <span class="key-stop">01</span>Mapped station <span class="key-attraction" aria-hidden="true">?</span>Nearby attraction. The geometry is source-mapped and graph-connected; the current passenger itinerary, train visibility and safe access still require human or organiser review.</p>
 </section>
 <div class="journey-controls">
  <section class="panel map-provider-panel"><p class="section-label">High-resolution map imagery</p><h2>${hasMapTiler ? 'MapTiler imagery is active.' : 'Esri World Imagery is active.'}</h2><p>Satellite and hybrid views load automatically. You can also use a free, origin-restricted MapTiler browser key for this tab; it is never committed or added to the offline pack.</p><label for="maptiler-key">Optional MapTiler browser key</label><input id="maptiler-key" type="password" autocomplete="off" placeholder="Paste a restricted browser key"><div class="actions"><button id="apply-maptiler" type="button">${hasLocalMapTiler ? 'Replace local key' : 'Use key for this tab'}</button><button id="clear-maptiler" class="secondary" type="button">Clear local key</button></div><p id="map-provider-state" class="muted">${hasMapTiler ? `MapTiler is configured ${hasLocalMapTiler ? 'for this tab' : 'by the Worker'}.` : 'Keyless OpenStreetMap streets and night, OpenTopoMap terrain, and Esri World Imagery satellite/hybrid views are active.'}</p></section>
  <section class="panel pack-panel"><p class="section-label">Before you board</p><h2>Take the stories with you.</h2><p>Download the chapters, local animations, route overview and activities for disconnected reading. External basemap tiles are not bulk-downloaded.</p><button id="install">${status ? 'Check and install pack update' : 'Download offline pack'}</button><progress id="download-progress" value="0" max="1" hidden></progress><p id="pack-state" class="muted">${status ? `Ready / ${(status.installedBytes/1048576).toFixed(1)} MB / installed ${escape(status.installedAt)}` : 'No complete pack installed yet.'}</p></section>
  <section class="panel position-panel"><p class="section-label">Choose your position source</p><h2>Travel with the map.</h2><p>Live GPS needs your permission and a visible page. Positions stay on this device. Replay uses synthetic coordinates and is not a field test.</p><div class="actions"><button id="gps">Start live GPS</button><button id="replay" class="secondary">Run labelled replay</button><button id="stop" class="secondary">Stop</button></div><p id="journey-state">Journey state: unknown</p></section>
 </div>
 <section class="panel chapter-panel"><div><p class="section-label">The corridor collection</p><h2>Seven places, ready when you are.</h2></div><ol class="route-list">${pack.chapters.map((c,index)=>`<li><span class="route-number">${String(index+1).padStart(2,'0')}</span><a data-nav href="${chapterLink(c)}">${escape(c.title)}</a><small>${c.depth === 'deep' ? 'Story + activity' : 'Short chapter'}</small></li>`).join('')}</ol></section>`;
 const stage = $('#journey-stage');
 map = createImmersiveMap({
   container: 'map', controlsContainer: $('#map'), route, hubs: hubs.stations, attractions: hubs.attractions,
   initialStyle: navigator.onLine ? 'streets' : 'offline', reducedMotion: reducedMotion(), cinematic: !reducedMotion(), mapConfig: activeMapConfig,
   onHubSelect: station => {
     if (chapterByHub(station.hubId)) showJourneyStoryCard(station.hubId);
     else say(`${station.name} is a mapped ride arrival. Its source-backed chapter is still pending editorial work.`);
   },
   onAttractionSelect: attraction => showAttractionCard(attraction),
   onProgress: ({ distanceMetres }) => setPreviewProgress(distanceMetres),
   onStatus: ({ status: mapStatus }) => { if (mapStatus === 'map-resource-error') $('#map-provider-state').textContent = 'A basemap resource did not load. Try another view; the route and stories remain available.'; },
 });
 map.addStyleControl();
 $('#map').dataset.userExploring = 'false';
 const markExploring = event => { if (!event.originalEvent) return; mapFollowing = false; map.setFollow(false); $('#follow-map').checked = false; $('#map').dataset.userExploring = 'true'; };
 map.map.on('dragstart', markExploring); map.map.on('rotatestart', markExploring); map.map.on('pitchstart', markExploring);
 if (latestFix && currentMode !== 'manual') updateJourneyMap(latestFix, engine.snapshot());
 bind('#route-scrubber', event => {
   positionSource?.stop(); positionSource = null; mapPreviewStop?.(); mapPreviewStop = null;
   const percent = Number(event.currentTarget.value), distanceMetres = Number(route.properties?.lengthMetres) * percent / 100;
   const point = sliceLineAtDistance(route, distanceMetres).at(-1);
   currentMode = 'preview'; $('#position-label').textContent = 'CINEMATIC PREVIEW / illustrative'; $('#position-label').className = 'badge replay';
   $('#journey-mode').textContent = 'ROUTE PREVIEW'; $('#journey-mode').className = 'journey-mode replay';
   map.setFollow(mapFollowing); map.updatePosition({ lon: point[0], lat: point[1], s: distanceMetres, source: 'replay' }, { duration: 350, zoom: 7.1 });
   setPreviewProgress(distanceMetres);
 }, 'input');
 bind('#cinematic-preview', () => {
   positionSource?.stop(); positionSource = null; mapPreviewStop?.(); mapFollowing = true; map.setFollow(true); $('#follow-map').checked = true; $('#map').dataset.userExploring = 'false';
   currentMode = 'preview'; $('#position-label').textContent = 'CINEMATIC PREVIEW / illustrative'; $('#position-label').className = 'badge replay'; $('#journey-mode').textContent = 'ROUTE PREVIEW'; $('#journey-mode').className = 'journey-mode replay';
   mapPreviewStop = map.playRoutePreview({ duration: reducedMotion() ? 1 : 16000, onComplete: () => { mapPreviewStop = null; say('Cinematic route preview complete. Choose a story stop or move the route control.'); } });
   say('Playing an illustrative route preview. This is not live positioning or field evidence.');
 });
 bind('#fit-route', () => { mapFollowing = false; map.setFollow(false); $('#follow-map').checked = false; $('#map').dataset.userExploring = 'true'; map.fitRoute(); });
 bind('#install', async () => {
   $('#install').disabled = true; $('#download-progress').hidden = false;
   try { const status = await installPack({onProgress:(bytes,total)=>{ $('#download-progress').value = bytes/total; $('#pack-state').textContent=`${bytes.toLocaleString()} / ${total.toLocaleString()} bytes verified`; }}); $('#pack-state').textContent=`Ready / ${status.files} verified files / ${(status.installedBytes/1048576).toFixed(1)} MB`; say('Offline pack installed. Stories, animations and the fallback route are available after a disconnected reload.'); }
   finally { $('#install').disabled = false; }
 });
 bind('#gps',()=>startJourney('gps')); bind('#replay',()=>startJourney('replay')); bind('#stop',stopJourney);
 bind('#follow-map', event => { mapFollowing = event.currentTarget.checked; map.setFollow(mapFollowing); $('#map').dataset.userExploring = String(!mapFollowing); say(mapFollowing ? 'Map follow on.' : 'Map follow off. You can explore the corridor freely.'); }, 'change');
 bind('#cinematic-camera', event => { map.setCinematic(event.currentTarget.checked); say(event.currentTarget.checked ? 'Cinematic camera on.' : 'Flat camera on.'); }, 'change');
 bind('#apply-maptiler', () => { const key = $('#maptiler-key').value.trim(); if (!key) throw new Error('Paste a MapTiler browser key first.'); sessionStorage.setItem('shosholoza-maptiler-browser-key', key); render(); say('MapTiler is active for this tab. The key was not written to the project.'); });
 bind('#clear-maptiler', () => { sessionStorage.removeItem('shosholoza-maptiler-browser-key'); render(); say('Local MapTiler key cleared. Keyless map views are active.'); });
 renderChapterQueue();
}
async function renderStories(hubId) {
 if (!hubId) {
  main.innerHTML = `<section class="collection-hero"><p class="eyebrow">The corridor collection</p><h1>Seven places.<br>Seven moving scenes.</h1><p class="intro">Each illustration is locally drawn from the chapter themes and source register. Explore every chapter manually; historical summaries still await human editorial approval.</p></section><div class="cards story-collection">${pack.chapters.map((c,i)=>`<article class="card story-tile"><div class="story-tile-art" data-localized-scene="${escape(c.hubId)}"></div><p class="eyebrow">0${i+1} / ${c.depth === 'deep' ? 'Story + challenge + postcard' : 'Short sourced chapter'}</p><h2>${escape(c.title)}</h2><p>${escape((Array.isArray(c.body)?c.body.join(' '):c.body).slice(0,140))}...</p><a data-nav href="${chapterLink(c)}">Open chapter</a></article>`).join('')}</div>`;
  for (const host of document.querySelectorAll('[data-localized-scene]')) mountLocalizedAnimation(host, host.dataset.localizedScene, { controls: false, durationSeconds: 11 });
  return;
 }
 const started = performance.now(); const c = chapterByHub(hubId); if (!c) throw new Error('Chapter not found');
 if (engine.snapshot().queue.includes(c.hubId)) await engine.acknowledgeChapter(c.hubId);
 renderChapterQueue();
 const progressKey = `challenge-${currentMode}-${c.id}`;
 const progress = await get('state', progressKey);
 main.innerHTML = `<article class="story"><a class="story-back" data-nav href="${withBase('/stories')}">← All chapters</a><div class="story-hero-card"><div id="story-local-scene" class="story-hero-art"></div><div class="story-hero-copy"><p class="eyebrow">${escape(c.depth)} chapter · ${escape(currentMode)}</p><h1>${escape(c.title)}</h1><div class="story-facts"><span>Text transcript</span><span>Offline ready</span><span>${c.sourceIds.length} ${c.sourceIds.length === 1 ? 'source' : 'sources'}</span></div><p><small>${escape(c.locationNotice)}</small></p></div></div><div class="story-body">${(Array.isArray(c.body)?c.body:[c.body]).map(p=>`<p>${escape(p)}</p>`).join('')}</div><details class="story-transcript"><summary>Reading transcript</summary><p>${escape(c.transcript)}</p><p class="muted">Recorded narration is not yet available.</p></details>${c.activity ? `<section class="panel"><p class="eyebrow">Adventure · sourced answers</p><h2>${escape(c.activity.question)}</h2><form id="challenge"><label for="answer">Your answer</label><input id="answer" required autocomplete="off"><div class="actions"><button>Check answer</button><button id="hint" class="secondary" type="button">Show a hint</button></div></form><p id="answer-result" role="status">${progress?.complete ? 'Completed on this device.' : ''}</p><p id="hint-text" class="hint" hidden></p></section><section class="panel"><h2>A moment to create</h2><p>${escape(c.creativePrompt)}</p><a class="button" data-nav href="${withBase(`/creative?hub=${encodeURIComponent(c.hubId)}`)}">Make a postcard</a></section>` : '<p class="notice">This is a short chapter. Mode activities are available at Kimberley, Beaufort West and Matjiesfontein.</p>'}<section class="story-sources"><h2>Where this story comes from</h2>${sourceCards(c.sourceIds)}</section><section class="panel"><h2>Optional AI source finder</h2><p>The experimental assistant can select an exact excerpt from the registered sources. These editorial drafts still await human review, and prepared stories and hints remain available offline.</p><button id="ai-check" class="secondary">Ask AI for a source excerpt</button><div id="ai-result" data-ai-result role="status" aria-live="polite"></div></section></article>`;
 mountHubScene('#story-local-scene', c.hubId, { durationSeconds: 12 });
 let hint = 0;
 bind('#hint',()=>{ $('#hint-text').hidden=false; $('#hint-text').textContent=c.activity.hints[Math.min(hint++,2)]; $('#hint').textContent=`Hint ${Math.min(hint,3)} of 3`; });
 bind('#challenge',async e=>{ e.preventDefault(); const normalize=s=>s.trim().normalize('NFKC').toLocaleLowerCase('en').replace(/[.,!?]/g,''); const accepted=[c.activity.answer,...(c.activity.acceptedAnswers||[])].some(a=>normalize(String(a))===normalize($('#answer').value)); if(accepted)await put('state',progressKey,{complete:true,at:new Date().toISOString(),positionMode:currentMode}); $('#answer-result').textContent=accepted?`Correct. ${currentMode === 'replay' ? 'Replay' : currentMode === 'gps' ? 'Live-GPS journey' : 'Manual'} progress saved on this device.`:'Not quite. Try a prepared hint and read the source.'; },'submit');
 bind('#ai-check',async()=>{const t=performance.now(),target=$('#ai-result');target.textContent='Finding a source excerpt…';try{const result=await api('/api/ai',{action:'explain',question:`Find a sourced excerpt about ${c.title}.`});target.replaceChildren();for(const text of [result.label,result.status==='fallback'?assistanceMessage(result.reason):result.answer]){if(!text)continue;const p=document.createElement('p');p.textContent=text;target.append(p);}if(result.sourceIds?.length){const source=document.createElement('small');source.textContent=`Source: ${result.sourceIds.join(', ')}${result.sourceReview==='editorial-draft-human-review-pending'?' · human review pending':''}`;target.append(source);}}catch(error){target.textContent=assistanceMessage(error.message);}await measure('ai-assistance',performance.now()-t,{online:navigator.onLine});});
 await measure('chapter-open',performance.now()-started,{online:navigator.onLine,hubId});
}
async function renderCreative() {
 const selected = new URL(location.href).searchParams.get('hub') || pack.chapters.find(c=>c.depth==='deep').hubId;
 const c=chapterByHub(selected)||pack.chapters[0]; const saved=await get('drafts',c.hubId);
 main.innerHTML=`<p class="eyebrow">Your collection</p><h1>A postcard from<br>the in-between.</h1><div class="grid"><section class="panel"><form id="draft-form"><label for="draft-hub">Story inspiration</label><select id="draft-hub">${pack.chapters.filter(c=>c.depth==='deep').map(item=>`<option value="${item.hubId}" ${item.hubId===c.hubId?'selected':''}>${escape(item.title)}</option>`).join('')}</select><p>${escape(c.creativePrompt||'Write a reflection on your journey.')}</p><label for="draft-title">Postcard title</label><input id="draft-title" maxlength="100" value="${escape(saved?.title||c.title)}"><label for="draft-body">Your words</label><textarea id="draft-body" maxlength="1200" placeholder="What will you remember?">${escape(saved?.body||'')}</textarea><div class="actions"><button>Save postcard</button><button id="export-png" type="button" class="secondary">Export PNG</button></div><p id="draft-status" role="status">${saved?'Saved postcard reopened.':'Not saved yet. No AI edits.'}</p></form></section><div><article class="preview"><p class="eyebrow">ShosholozaTrail · Personal reflection</p><h2 id="preview-title"></h2><p id="preview-body"></p><small id="preview-credit"></small></article><p class="muted">Your writing stays on this device. Export a copy to keep or share.</p><section class="panel"><h2>Saved postcards</h2><div id="draft-list"></div></section></div></div>`;
 const credit=`Inspired by ${c.title}. Sources: ${c.sourceIds.join(', ')}. Personal writing, not a historical source.`;
 const update=()=>{ $('#preview-title').textContent=$('#draft-title').value; $('#preview-body').textContent=$('#draft-body').value; $('#preview-credit').textContent=credit; };
 const renderDraftList=async()=>{const drafts=await entries('drafts');$('#draft-list').innerHTML=drafts.length?drafts.sort((a,b)=>String(b.savedAt).localeCompare(String(a.savedAt))).map(d=>`<p><a data-nav href="${withBase(`/creative?hub=${encodeURIComponent(d.hubId)}`)}">${escape(d.title||'Untitled postcard')}</a><br><small>${escape(d.savedAt||'Saved locally')}</small></p>`).join(''):'<p>No saved postcards yet.</p>';};
 update();
 for(const id of ['#draft-title','#draft-body'])bind(id,()=>{draftDirty=true;update();$('#draft-status').textContent='Unsaved changes';},'input');
 bind('#draft-form',async e=>{e.preventDefault();await put('drafts',c.hubId,{hubId:c.hubId,title:$('#draft-title').value,body:$('#draft-body').value,credit,sourceIds:c.sourceIds,savedAt:new Date().toISOString()});draftDirty=false;$('#draft-status').textContent='Saved on this device.';await renderDraftList();},'submit');
 bind('#draft-hub',()=>navigate(`/creative?hub=${$('#draft-hub').value}`),'change');
 await renderDraftList();
 bind('#export-png',async()=>{
   const canvas=document.createElement('canvas');canvas.width=1200;const measureCtx=canvas.getContext('2d');
   const lines=(text,font,maxWidth=1000)=>{measureCtx.font=font;const output=[];for(const paragraph of String(text).split('\n')){let line='';for(const word of paragraph.split(/\s+/).filter(Boolean)){const candidate=line?`${line} ${word}`:word;if(measureCtx.measureText(candidate).width<=maxWidth){line=candidate;continue;}if(line){output.push(line);line='';}if(measureCtx.measureText(word).width<=maxWidth){line=word;continue;}let fragment='';for(const character of word){const next=fragment+character;if(measureCtx.measureText(next).width>maxWidth&&fragment){output.push(fragment);fragment=character;}else fragment=next;}line=fragment;}output.push(line||' ');}return output;};
   const sections=[{text:'SHOSHOLOZA TRAIL · PERSONAL POSTCARD',font:'24px Outfit, sans-serif',lineHeight:38,gap:35},{text:$('#draft-title').value,font:'42px Fraunces, serif',lineHeight:56,gap:30},{text:$('#draft-body').value,font:'28px Fraunces, serif',lineHeight:44,gap:30},{text:credit,font:'20px Outfit, sans-serif',lineHeight:32,gap:0}].map(section=>({...section,lines:lines(section.text,section.font)}));
   const theme=getComputedStyle(document.documentElement),ink=theme.getPropertyValue('--ink').trim(),cream=theme.getPropertyValue('--cream').trim();
   canvas.height=Math.max(1500,100+sections.reduce((height,section)=>height+section.lines.length*section.lineHeight+section.gap,0)+100);const ctx=canvas.getContext('2d');ctx.fillStyle=ink;ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle=cream;let y=100;
   for(const section of sections){ctx.font=section.font;for(const line of section.lines){ctx.fillText(line,100,y);y+=section.lineHeight;}y+=section.gap;}
   const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw new Error('PNG export failed');const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`shosholoza-${c.hubId}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);say('Postcard exported with source credit.');
 });
}
function session(){try{return JSON.parse(sessionStorage.getItem('trail-room')||'null');}catch{return null;}}
async function api(path,body,token=session()?.token){
 const response=await fetch(path,{method:body===undefined?'GET':'POST',headers:{...(body!==undefined?{'Content-Type':'application/json'}:{}),...(token?{Authorization:`Bearer ${token}`}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{}),cache:'no-store',signal:AbortSignal.timeout(18000)});
 const result=await response.json();if(!response.ok)throw new Error(result.reason||result.error||result.message||`Service returned ${response.status}`);return result;
}
function assistanceMessage(reason) {
 const messages = {
  'preview-server-no-backend': 'This static preview has no AI backend. Run npm run dev to use the Worker-powered assistant.',
  'daily-assistance-budget-reached': "Today's free AI allowance has been used. The cached sourced chapter and local activities still work.",
  'challenge-hints-are-deterministic-and-stored-in-the-pack': 'Hints are built into this chapter so they stay available offline.',
  'provider-not-configured': 'The AI provider is not configured in this build. The sourced chapter remains available.',
  'provider-circuit-open': 'The AI provider is recovering from repeated failures. Try again shortly or use the sourced chapter.',
  'provider-failed-or-output-not-grounded': 'The provider did not return a grounded source excerpt, so the app withheld it.',
  'insufficient-source-evidence': 'The registered sources do not support that request, so the assistant declined to invent an answer.',
  'no-eligible-source-passages': 'No eligible source passages are available for AI selection in this build.',
 };
 return messages[reason] || `AI assistance is unavailable (${reason || 'unknown reason'}). Use the cached sourced chapter.`;
}
async function renderCarriage(){
 const room=session();main.innerHTML=`<p class="eyebrow">Shared carriage board</p><h1>A conversation<br>along the way.</h1><p class="intro">Share the private room code with your group. Messages require a server-validated session. This pilot has no automatic matching.</p><section class="panel">${room?`<h2>Carriage ${escape(room.code)}</h2><p>Online-only board. Refresh manually; no background polling.</p><div class="actions"><button id="refresh-room">Refresh messages</button><button id="leave-room" class="secondary">Leave and clear session</button></div><div id="messages"></div><form id="post-message"><label for="message-text">Message</label><input id="message-text" maxlength="500" required><button>Post to this carriage</button></form>`:`<div class="actions"><button id="create-room">Create a private carriage</button></div><form id="join-room"><label for="room-code">Or enter a carriage code</label><input id="room-code" required autocomplete="off"><button class="secondary">Join carriage</button></form>`}</section>`;
 bind('#create-room',async()=>{const room=await api('/api/rooms/create',{});sessionStorage.setItem('trail-room',JSON.stringify(room));await renderCarriage();});
 bind('#join-room',async e=>{e.preventDefault();const room=await api('/api/rooms/join',{code:$('#room-code').value.trim()});sessionStorage.setItem('trail-room',JSON.stringify(room));await renderCarriage();},'submit');
 const refresh=async()=>{if(waiting||document.hidden||!navigator.onLine){say('Board refresh paused while waiting, hidden or offline. Cached activities remain available.');return;}const data=await api('/api/rooms/messages');$('#messages').innerHTML=(data.messages||[]).map(m=>`<p class="source">${escape(m.text)}<br><small>${escape(m.createdAt||m.created_at||'')}</small></p>`).join('')||'<p>No messages yet.</p>';say(`Board refreshed at ${new Date().toLocaleTimeString()}.`);};
 bind('#refresh-room',refresh);bind('#post-message',async e=>{e.preventDefault();if(!navigator.onLine)throw new Error('Connect before posting. Your text remains in the form.');const form=e.currentTarget;const text=$('#message-text').value;const requestId=form.dataset.requestText===text&&form.dataset.requestId?form.dataset.requestId:crypto.randomUUID();form.dataset.requestId=requestId;form.dataset.requestText=text;await api('/api/rooms/messages',{text,requestId});delete form.dataset.requestId;delete form.dataset.requestText;$('#message-text').value='';await refresh();},'submit');
 bind('#leave-room',async()=>{try{await api('/api/rooms/leave',{});}finally{sessionStorage.removeItem('trail-room');await renderCarriage();}});
}
async function renderContribute(){
 main.innerHTML=`<p class="eyebrow">Community contributions</p><h1>A story with<br>someone behind it.</h1><p class="intro">Submit a source-backed story for review. Unmoderated stories are never shown to passengers. Join a carriage first to obtain an expiring submission session.</p><form id="contribution" class="panel"><label for="con-title">Story title</label><input id="con-title" maxlength="120" required><label for="con-text">Original story summary</label><textarea id="con-text" maxlength="4000" required></textarea><label for="con-source">Public HTTPS source URL</label><input id="con-source" type="url" pattern="https://.*" required><label for="con-credit">Author or custodian credit</label><input id="con-credit" maxlength="120" required><button>Submit for moderation</button></form><details class="panel"><summary>Moderator review</summary><p>Use the separately configured moderator token. It is kept in memory only. Every decision needs a review note; approval also needs explicit source and rights confirmation.</p><label for="moderator-token">Moderator token</label><input id="moderator-token" type="password" autocomplete="off"><button id="load-moderation">Load review queue</button><div id="moderation-list"></div><button id="publish-community" class="secondary">Publish approved community supplement</button></details>`;
 bind('#contribution',async e=>{e.preventDefault();await api('/api/contributions',{title:$('#con-title').value,text:$('#con-text').value,sourceUrl:$('#con-source').value,credit:$('#con-credit').value});say('Submitted for moderation. The story is not yet published.');$('#contribution').reset();},'submit');
 bind('#load-moderation',async()=>{const result=await api('/api/moderation',undefined,$('#moderator-token').value);$('#moderation-list').innerHTML=(result.contributions||result.items||[]).map(item=>`<article class="source moderation-item"><h3>${escape(item.title)}</h3><p>${escape(item.text)}</p><p><a href="${escape(item.sourceUrl||item.source_url)}" target="_blank" rel="noopener noreferrer">Open submitted source ↗</a> · ${escape(item.status)}</p><p>Credit: ${escape(item.credit)}</p><label>Review note <textarea class="review-note" minlength="10" maxlength="2000" required>${escape(item.reviewNote||item.review_note||'')}</textarea></label><label class="check"><input class="rights-confirmed" type="checkbox"> I verified the source and permission/rights for publication.</label><div class="actions"><button data-review="${escape(item.id)}" data-decision="approve">Approve</button><button data-review="${escape(item.id)}" data-decision="reject" class="secondary">Reject</button></div></article>`).join('')||'<p>No submissions.</p>';for(const button of document.querySelectorAll('[data-review]'))button.onclick=async()=>{const item=button.closest('.moderation-item');const reviewNote=item.querySelector('.review-note').value.trim();const rightsConfirmed=item.querySelector('.rights-confirmed').checked;if(reviewNote.length<10){say('Add a review note of at least 10 characters.');return;}if(button.dataset.decision==='approve'&&!rightsConfirmed){say('Confirm source verification and publication rights before approval.');return;}try{await api('/api/moderation/review',{id:button.dataset.review,decision:button.dataset.decision,reviewNote,rightsConfirmed},$('#moderator-token').value);button.closest('.moderation-item').remove();say('Review saved. Publication is a separate action.');}catch(e){say(e.message);}};});
 bind('#publish-community',async()=>{const data=await api('/api/moderation/publish',{},$('#moderator-token').value);say(`Approved supplement published: ${data.version||'new version'}. Base pack remains separately reviewed.`);});
}
const percentile=(values,p)=>values.length?[...values].sort((a,b)=>a-b)[Math.ceil(values.length*p)-1]:null;
const fmt=n=>n==null?'Not measured':`${n.toFixed(1)} ms`;
async function renderEvidence(){
 const [status,metrics,events,r3,r3Corridor,r10,endurance]=await Promise.all([packStatus(),entries('metrics'),entries('events'),json('/results/r3.json').catch(()=>null),json('/results/r3-corridor.json').catch(()=>null),json('/results/r10.json').catch(()=>null),get('state','endurance')]);
 const triggerResult=r3||r3Corridor;
 main.innerHTML=`<p class="eyebrow">Evidence, not estimates</p><h1>What we have<br>actually measured.</h1><p class="notice"></p><div class="cards"><section class="card"><h2>R3 · Trigger replay</h2><p>${triggerResult?.executionScope==='synthetic-traces-on-shipped-osm-rail-candidate'?'Synthetic movement sampled on the shipped OSM rail candidate.':'Analytic local synthetic harness.'} Not a corridor field test.</p><p class="score">${triggerResult?`${escape(triggerResult.correctHub)} / ${escape(triggerResult.eligible)}`:'Not run'}</p><p>Correct / eligible encounters</p><details><summary>Profiles and failure classes</summary><pre>${escape(JSON.stringify(triggerResult,null,2))}</pre></details></section><section class="card"><h2>R5 / R6 · Offline pack</h2><p>${status?'Complete verified install':'No complete pack installed'}</p><p class="metric">${status?`${status.installedBytes.toLocaleString()} / ${status.expectedBytes.toLocaleString()} bytes`: 'Bytes not measured'}</p><p>Last successful install: ${escape(status?.installedAt||'Never')}</p><p>Current network: ${navigator.onLine?'Online':'Offline'}</p><details><summary>Manifest SHA-256</summary><pre>${escape(status?.hash||'Not installed')}</pre></details><button id="storage-failure">Simulate storage failure</button><p id="failure-result" role="status"></p></section><section class="card"><h2>R10 · AI grounding</h2><p>Experimental source-locked AI is active. Its selected text must exactly match one registered source, and human review is still pending.</p><details><summary>Recorded evaluation result</summary><pre>${escape(JSON.stringify(r10,null,2)||'No fixed evaluation run recorded yet')}</pre></details></section></div><section class="panel"><h2>R12 · This browser's timings</h2><p>Recorded application render durations; not physical-device acceptance. Offline startup is a usable-screen metric, not browser first paint.</p><div class="table-wrap"><table><thead><tr><th>Measurement</th><th>Runs</th><th>p50</th><th>p95</th></tr></thead><tbody>${[['offline-usable','Offline usable screen'],['chapter-open','Cached chapter open (offline only)'],['ai-assistance','AI response or explicit fallback']].map(([name,label])=>{const values=metrics.filter(m=>m.name===name&&(name!=='chapter-open'||m.online===false)).map(m=>m.ms);return `<tr><td>${label}</td><td>${values.length}</td><td>${fmt(percentile(values,.5))}</td><td>${fmt(percentile(values,.95))}</td></tr>`;}).join('')}</tbody></table></div></section><section class="panel"><h2>R16 · Endurance log</h2><p>Start a defined-use run on a physical phone. Battery readings may be unavailable in this browser. A short run does not satisfy the four-hour gate.</p><label for="endurance-pattern">Brightness, network, audio and activity pattern</label><input id="endurance-pattern" value="${escape(endurance?.pattern||'')}" placeholder="Record your real test conditions"><div class="actions"><button id="endurance-start">Start run</button><button id="endurance-stop" class="secondary">End run</button></div><pre>${escape(JSON.stringify(endurance,null,2)||'No run recorded')}</pre></section><section class="panel"><h2>Live journey event log</h2><p>${events.length} stored events. Position source and trace ID distinguish synthetic replay from GPS.</p><details><summary>View events</summary><pre>${escape(JSON.stringify(events.slice(-100),null,2))}</pre></details><button id="evidence-export" class="secondary">Export real local evidence</button></section><section class="panel"><h2>Provenance register</h2><p>All factual chapters link to these source records. Human editorial review remains pending.</p>${sourceCards(sources.records.map(s=>s.id))}</section>`;
 main.querySelector('.notice').textContent='Not yet validated: physical-phone loading and carriage GPS; human or organiser review of the mapped rail itinerary; fixed AI provider evaluation; reviewed narration and second language; six-person user trial; four-hour endurance; independent relevant-environment review. The current AI mode is an experimental source-locked smoke test, and the hosted D1 room board has passed a two-room automated isolation smoke test. TRL 5 is not claimed.';
 bind('#storage-failure',async()=>{const before=await packStatus();const draftsBefore=JSON.stringify(await entries('drafts'));try{await installPack({failAfter:0});throw new Error('Failure injection unexpectedly completed');}catch(error){const after=await packStatus();const preserved=JSON.stringify(before)===JSON.stringify(after)&&draftsBefore===JSON.stringify(await entries('drafts'));const result={at:new Date().toISOString(),scenario:'storage-failure',preserved,error:error.message,hadInstalledPack:!!before};await put('metrics',crypto.randomUUID(),result);$('#failure-result').textContent=`${preserved?'Preserved':'FAILED'}: last pack pointer and drafts. ${before?'Existing complete pack retained.':'Install a complete pack first to validate rollback.'} ${error.message}`;}});
 const battery=async()=>{try{return (await navigator.getBattery?.())?.level??null;}catch{return null;}};
 bind('#endurance-start',async()=>{const existing=await get('state','endurance');if(existing&&!existing.endedAt)throw new Error('An endurance run is already active. End it before starting another.');if(!$('#endurance-pattern').value.trim())throw new Error('Describe the real test conditions first.');await put('state','endurance',{startedAt:new Date().toISOString(),pattern:$('#endurance-pattern').value,batteryStart:await battery(),restarts:0,device:navigator.userAgent});await renderEvidence();});
 bind('#endurance-stop',async()=>{const run=await get('state','endurance');if(!run||run.endedAt)throw new Error('No active endurance run');run.endedAt=new Date().toISOString();run.durationMs=Date.now()-Date.parse(run.startedAt);run.batteryEnd=await battery();run.batteryDelta=run.batteryStart!==null&&run.batteryEnd!==null?run.batteryStart-run.batteryEnd:null;await put('state','endurance',run);await renderEvidence();});
 bind('#evidence-export',async()=>{const blob=new Blob([JSON.stringify({exportedAt:new Date().toISOString(),r3,r3Corridor,r10,status,metrics,events,endurance},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='shosholoza-evidence.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);});
}
async function navigate(path){if(draftDirty&&!confirm('Leave this postcard without saving your latest changes?'))return;draftDirty=false;history.pushState({},'',path);await render();}
async function render(){if(map){mapPreviewStop?.();mapPreviewStop=null;map.destroy?.();map=null;}activeScene?.destroy?.();activeScene=null;const path=stripBase(location.pathname);for(const a of document.querySelectorAll('.engine-tabs a[data-nav],.mobile-tabs a[data-nav]')){const t=stripBase(a.pathname);if(t==='/'?path==='/':path.startsWith(t))a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');}if(menuToggle&&mobileMenu){menuToggle.setAttribute('aria-expanded','false');mobileMenu.hidden=true;}try{if(path.startsWith('/stories'))await renderStories(path.split('/')[2]);else if(path==='/creative')await renderCreative();else if(path==='/carriage')await renderCarriage();else if(path==='/contribute')await renderContribute();else if(path==='/evidence')await renderEvidence();else await renderJourney();}catch(error){main.innerHTML='<h1>This screen could not open.</h1><p id="screen-error"></p><a href="/app">Return to journey</a>';$('#screen-error').textContent=error.message;} }
window.addEventListener('popstate',()=>{draftDirty=false;render();});document.addEventListener('click',e=>{const a=e.target.closest('a[data-nav]');if(a&&!e.ctrlKey&&!e.metaKey){e.preventDefault();navigate(a.href);}});window.addEventListener('beforeunload',e=>{if(draftDirty){e.preventDefault();e.returnValue='';}});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&currentMode==='gps'){positionSource?.stop();positionSource=null;waiting=false;$('#waiting').hidden=true;document.body.classList.remove('low-power');say('Live GPS paused while hidden. Restart it when ready.');setMode('manual');}});
try{
 network(); if('serviceWorker'in navigator){await navigator.serviceWorker.register('/sw.js');await navigator.serviceWorker.ready;}
 [pack,hubs,route,sources]=await Promise.all(['/data/pack.v1.json','/data/hubs.json','/data/route.geojson','/data/sources.json'].map(json));
 await initializeEngine();const run=await get('state','endurance');if(run&&!run.endedAt){run.restarts++;await put('state','endurance',run);}
 await render();await measure(navigator.onLine?'online-usable':'offline-usable',performance.now()-bootAt,{online:navigator.onLine,device:navigator.userAgent});
}catch(error){main.innerHTML='<h1>We could not open the journey.</h1><p id="startup-error"></p><p>Connect and reload to install your first complete pack. Previously saved drafts remain on this device.</p>';$('#startup-error').textContent=error.message;}
