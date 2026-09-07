import { get, put, entries, persistJourney, measure } from './storage/drafts.js';
import { installPack, packStatus } from './storage/pack.js';
import { createJourneyEngine } from './engine/journey.js';
import { createReplaySource } from './engine/replay.js';
import { createGpsSource } from './engine/gps.js';
const bootAt = performance.now();
const $ = s => document.querySelector(s);
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const main = $('#main');
let pack, hubs, route, sources, engine, positionSource, map, marker, latestFix, routeLayer, traversedLayer, hubMarkers = new Map(), attractionMarkers = new Map(), currentMode = 'manual', engineMode = 'gps', waiting = false, draftDirty = false, mapFollowing = true, journeyViewEngaged = false, lastMapFollowAt = 0;
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const say = text => { $('#message').textContent = text; };
const json = async url => { const r = await fetch(url); if (!r.ok) throw new Error(`${url} unavailable`); return r.json(); };
const bind = (selector, handler, event = 'click') => { const element = $(selector); if (element) element.addEventListener(event, async e => { try { await handler(e); } catch (error) { say(error.message || 'The action failed. Your saved work is preserved.'); } }); };
const chapterLink = c => `/stories/${encodeURIComponent(c.hubId)}`;
const chapterByHub = hubId => pack.chapters.find(c => c.hubId === hubId);
function sourceCards(ids = []) {
 return ids.map(id => { const s = sources.records.find(r => r.id === id); return s ? `<div class="source"><a target="_blank" rel="noopener noreferrer" href="${escape(s.url)}">${escape(s.institution || s.author || id)} ↗</a><p>${escape(s.passage)}</p><small>Source check: ${escape(s.reviewDate || 'pending')} · Human editorial approval pending</small></div>` : '<p>Source unavailable; do not treat this claim as reviewed.</p>'; }).join('');
}
function network() { $('#network').textContent = navigator.onLine ? 'Online' : 'Offline · local pack'; }
window.addEventListener('online', network); window.addEventListener('offline', network);
function setMode(mode) {
 currentMode = mode;
 $('#position-label').textContent = mode === 'replay' ? 'SIMULATED REPLAY · 120×' : mode === 'gps' ? 'LIVE GPS · foreground' : 'Manual exploration';
 $('#position-label').className = `badge ${mode}`;
 const stageMode = $('#journey-mode');
 if (stageMode) {
   stageMode.textContent = mode === 'replay' ? 'SIMULATED REPLAY' : mode === 'gps' ? 'LIVE GPS' : 'EXPLORE MAP';
   stageMode.className = `journey-mode ${mode}`;
 }
 const train = marker?.getElement?.()?.querySelector('.train-marker');
 if (train) train.className = `train-marker ${mode}`;
 const trainElement = marker?.getElement?.();
 if (trainElement) trainElement.setAttribute('aria-label', mode === 'replay' ? 'Simulated train position' : mode === 'gps' ? 'Current GPS position' : 'Last journey position');
}
function showJourneyStoryCard(hubId, { encountered = false } = {}) {
 const c = chapterByHub(hubId), station = hubs.stations.find(item => item.hubId === hubId), card = $('#map-story-card');
 if (!c || !station || !card) return;
 const body = Array.isArray(c.body) ? c.body.join(' ') : c.body;
 const summary = body.length > 230 ? `${body.slice(0, 227).trim()}…` : body;
 card.hidden = false;
 card.innerHTML = `<button id="close-story-preview" class="story-preview-close" type="button" aria-label="Close story preview">×</button><p class="eyebrow">${encountered ? 'Story unlocked' : 'Story stop'} · ${escape(station.name)}</p><h2>${escape(c.title)}</h2><p>${escape(summary)}</p><div class="story-preview-meta"><span>${c.depth === 'deep' ? 'Story + activity' : 'Short chapter'}</span><span>Text available offline</span></div><a class="button" data-nav href="${chapterLink(c)}">Open this chapter</a><p><small>${escape(c.locationNotice)}</small></p>`;
 $('#close-story-preview')?.addEventListener('click', () => { card.hidden = true; });
}
function showAttractionCard(attraction) {
 const c = chapterByHub(attraction.hubId), card = $('#map-story-card');
 if (!c || !card) return;
 card.hidden = false;
 card.innerHTML = `<button id="close-story-preview" class="story-preview-close" type="button" aria-label="Close attraction preview">×</button><p class="eyebrow">Nearby attraction · ${escape(c.title.split(':')[0])}</p><h2>${escape(attraction.name)}</h2><p>This place is associated with the story hub. Visibility from the train and rail access are not established.</p><div class="story-preview-meta"><span>Mapped attraction</span><span>Location not field verified</span></div><a class="button" data-nav href="${chapterLink(c)}">Open the hub chapter</a>${attraction.coordinateSourceUrl ? `<p><small><a href="${escape(attraction.coordinateSourceUrl)}" target="_blank" rel="noopener noreferrer">View coordinate source ↗</a></small></p>` : ''}`;
 $('#close-story-preview')?.addEventListener('click', () => { card.hidden = true; });
}
function routePrefixAt(distanceMetres) {
 const coordinates = route.geometry.coordinates;
 if (!coordinates.length) return [];
 const total = Number(route.properties?.lengthMetres) || 1;
 const target = Math.max(0, Math.min(total, Number(distanceMetres) || 0));
 const segmentLengths = [];
 let measuredTotal = 0;
 const haversine = (a, b) => {
   const rad = value => value * Math.PI / 180, radius = 6371008.8;
   const dLat = rad(b[1] - a[1]), dLon = rad(b[0] - a[0]);
   const value = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLon / 2) ** 2;
   return 2 * radius * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
 };
 for (let i = 1; i < coordinates.length; i++) { const length = haversine(coordinates[i - 1], coordinates[i]); segmentLengths.push(length); measuredTotal += length; }
 const measuredTarget = target / total * measuredTotal, result = [coordinates[0]];
 let cumulative = 0;
 for (let i = 1; i < coordinates.length; i++) {
   const length = segmentLengths[i - 1];
   if (cumulative + length <= measuredTarget) { result.push(coordinates[i]); cumulative += length; continue; }
   const fraction = length ? (measuredTarget - cumulative) / length : 0;
   const from = coordinates[i - 1], to = coordinates[i];
   result.push([from[0] + (to[0] - from[0]) * fraction, from[1] + (to[1] - from[1]) * fraction]);
   break;
 }
 return result.map(([lon, lat]) => [lat, lon]);
}
function updateJourneyMap(fix, snapshot) {
 if (!map || !fix) return;
 const latLng = [fix.lat, fix.lon];
 if (marker) marker.setLatLng(latLng);
 else {
   marker = L.marker(latLng, { keyboard: false, interactive: false, zIndexOffset: 1000, icon: L.divIcon({ className: 'train-marker-shell', html: `<span class="train-marker ${currentMode}" aria-hidden="true">🚆</span>`, iconSize: [42, 42], iconAnchor: [21, 21] }) }).addTo(map);
   marker.getElement?.()?.setAttribute('aria-label', currentMode === 'replay' ? 'Simulated train position' : 'Current GPS position');
 }
 const accepted = snapshot?.lastAccepted;
 if (accepted && accepted.t === fix.t) {
   traversedLayer?.setLatLngs(routePrefixAt(accepted.s));
   const total = Number(route.properties?.lengthMetres) || 1, percent = Math.max(0, Math.min(100, accepted.s / total * 100));
   if ($('#journey-progress')) $('#journey-progress').textContent = `${Math.round(percent)}% of the schematic corridor traversed`;
   if ($('#journey-progress-bar')) $('#journey-progress-bar').value = percent;
 }
 if (!mapFollowing || waiting) return;
 const now = performance.now();
 if (!journeyViewEngaged) {
   journeyViewEngaged = true;
   map.setView(latLng, Math.max(map.getZoom(), 7), { animate: !reducedMotion() });
   lastMapFollowAt = now;
 } else if (now - lastMapFollowAt > 800) {
   map.panTo(latLng, { animate: !reducedMotion(), duration: .65, easeLinearity: .35 });
   lastMapFollowAt = now;
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
 onEvent: event => { if (event.fired) { say(`New chapter queued: ${chapterByHub(event.hubId)?.title || event.hubId}. Your current activity stays open.`); showJourneyStoryCard(event.hubId, { encountered: true }); hubMarkers.get(event.hubId)?.getElement?.()?.querySelector('.hub-marker')?.classList.add('hub-marker--reached'); } renderChapterQueue(); },
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
 journeyViewEngaged = false;
 lastMapFollowAt = 0;
 setMode(mode);
 if (mode === 'replay') {
   const trace = await json('/data/traces/demo-corridor.json');
   positionSource = createReplaySource(trace, { rate: 120, onError: error => say(error.message) });
 } else positionSource = createGpsSource({ sampleIntervalMs: 5000, onError: error => say(`Location unavailable: ${error.message}. All stories remain available manually.`) });
 positionSource.start(consume);
 renderChapterQueue();
 say(mode === 'replay' ? 'Synthetic replay started. This is not a field test or a live train location.' : 'GPS started. Keep this page visible. Precise positions stay on this device.');
}
function stopJourney() { positionSource?.stop(); positionSource = null; waiting = false; journeyViewEngaged = false; $('#waiting').hidden = true; document.body.classList.remove('low-power'); setMode('manual'); say('Position updates stopped. Explore any story stop on the map.'); }
async function renderJourney() {
 const status = await packStatus();
 main.innerHTML = `<section class="journey-hero"><div><p class="eyebrow">Pretoria → Cape Town · Seven story stops</p><h1>Watch the landscape.<br>Meet its stories.</h1><p class="intro">Follow a live foreground position or preview the experience with clearly labelled synthetic coordinates. Select any numbered stop to explore manually.</p></div><div class="journey-compass" aria-hidden="true"><span>N</span><i></i><small>1,356 km schematic</small></div></section><section id="journey-stage" class="journey-stage" aria-label="Journey player"><div class="stage-bar"><div><span id="journey-mode" class="journey-mode manual">EXPLORE MAP</span><strong id="journey-progress">Choose a position source to begin</strong></div><div class="stage-tools"><label class="follow-control"><input id="follow-map" type="checkbox" checked> Follow train</label></div></div><div id="map" aria-label="Interactive schematic corridor with story stops and nearby attractions"></div><progress id="journey-progress-bar" class="journey-progress-bar" value="0" max="100" aria-label="Schematic journey progress"></progress><aside id="map-story-card" class="map-story-card" aria-live="polite" hidden></aside><p class="map-key"><span class="key-line schematic"></span>Unverified schematic corridor <span class="key-line travelled"></span>Traversed section <span class="key-stop">01</span>Story stop <span class="key-attraction" aria-hidden="true">◆</span>Nearby attraction. Attraction visibility and rail access are not established. No departure or safe-alighting advice.</p></section><div class="journey-controls"><section class="panel pack-panel"><p class="section-label">Before you board</p><h2>Take the stories with you.</h2><p>Download the chapters, map overview and activities for disconnected reading. AI is off by default.</p><button id="install">${status ? 'Check and install pack update' : 'Download offline pack'}</button><progress id="download-progress" value="0" max="1" hidden></progress><p id="pack-state" class="muted">${status ? `Ready · ${(status.installedBytes/1048576).toFixed(1)} MB · installed ${escape(status.installedAt)}` : 'No complete pack installed yet.'}</p></section><section class="panel position-panel"><p class="section-label">Choose your position source</p><h2>Travel with the map.</h2><p>Live GPS needs your permission and a visible page. Positions are processed locally. Replay uses synthetic coordinates.</p><div class="actions"><button id="gps">Start live GPS</button><button id="replay" class="secondary">Run labelled replay</button><button id="stop" class="secondary">Stop</button></div><p id="journey-state">Journey state: unknown</p></section></div><section class="panel chapter-panel"><div><p class="section-label">The corridor collection</p><h2>Seven places, ready when you are.</h2></div><ol class="route-list">${pack.chapters.map((c,index)=>`<li><span class="route-number">${String(index+1).padStart(2,'0')}</span><a data-nav href="${chapterLink(c)}">${escape(c.title)}</a><small>${c.depth === 'deep' ? 'Story + activity' : 'Short chapter'}</small></li>`).join('')}</ol></section>`;
 map = L.map('map', { zoomControl: true, attributionControl: true, preferCanvas: false });
 routeLayer = L.geoJSON(route, { style: { className:'route-schematic',color:'#c98d55',weight:4,dashArray:'3 10',lineCap:'round',opacity:.9 } }).addTo(map);
 map.fitBounds(routeLayer.getBounds(), {padding:[28,28], animate:false});
 const [firstLon, firstLat] = route.geometry.coordinates[0];
 traversedLayer = L.polyline([[firstLat, firstLon]], { className:'route-traversed',color:'#f7d26a',weight:6,lineCap:'round',opacity:1 }).addTo(map);
 map.attributionControl.addAttribution('Station anchors © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a> · schematic connectors unverified');
 hubMarkers = new Map();
 for (const [index, station] of hubs.stations.entries()) {
   const reached = engine.snapshot().fired.includes(station.hubId);
   const hubMarker = L.marker([station.lat,station.lon], { keyboard:true, riseOnHover:true, title:`${station.name}: open story preview`, alt:`Story stop ${index+1}, ${station.name}`, icon:L.divIcon({className:'hub-marker-shell',html:`<span class="hub-marker${reached?' hub-marker--reached':''}" data-hub="${escape(station.hubId)}"><span aria-hidden="true">${String(index+1).padStart(2,'0')}</span><span class="sr-only">Open ${escape(station.name)} story preview</span></span>`,iconSize:[36,36],iconAnchor:[18,18]}) }).addTo(map);
   hubMarker.bindTooltip(`${station.name} · ${chapterByHub(station.hubId)?.depth === 'deep' ? 'story + activity' : 'short chapter'}`, {direction:'top',offset:[0,-18]});
   hubMarker.on('click', () => showJourneyStoryCard(station.hubId));
   const hubElement = hubMarker.getElement?.();
   if (hubElement) {
     hubElement.setAttribute('role', 'button');
     hubElement.setAttribute('aria-label', `Open ${station.name} story preview`);
     hubElement.addEventListener('keydown', event => { if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); showJourneyStoryCard(station.hubId); } });
   }
   hubMarkers.set(station.hubId, hubMarker);
 }
 attractionMarkers = new Map();
 for (const attraction of hubs.attractions || []) {
   if (!Number.isFinite(attraction.lat) || !Number.isFinite(attraction.lon)) continue;
   const attractionMarker = L.marker([attraction.lat, attraction.lon], { keyboard:true, riseOnHover:true, title:`${attraction.name}: nearby attraction`, alt:`Nearby attraction, ${attraction.name}`, icon:L.divIcon({className:'attraction-marker-shell',html:`<span class="attraction-marker" data-attraction="${escape(attraction.id)}"><span aria-hidden="true">◆</span><span class="sr-only">Open ${escape(attraction.name)} attraction preview</span></span>`,iconSize:[30,30],iconAnchor:[15,15]}) }).addTo(map);
   attractionMarker.bindTooltip(`${attraction.name} · nearby attraction`, {direction:'top',offset:[0,-15]});
   attractionMarker.on('click', () => showAttractionCard(attraction));
   const attractionElement = attractionMarker.getElement?.();
   if (attractionElement) {
     attractionElement.setAttribute('role', 'button');
     attractionElement.setAttribute('aria-label', `Open ${attraction.name} attraction preview`);
     attractionElement.addEventListener('keydown', event => { if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); showAttractionCard(attraction); } });
   }
   attractionMarkers.set(attraction.id, attractionMarker);
 }
 if (latestFix && currentMode !== 'manual') updateJourneyMap(latestFix, engine.snapshot());
 bind('#install', async () => {
   $('#install').disabled = true; $('#download-progress').hidden = false;
   try { const status = await installPack({onProgress:(bytes,total)=>{ $('#download-progress').value = bytes/total; $('#pack-state').textContent=`${bytes.toLocaleString()} / ${total.toLocaleString()} bytes verified`; }}); $('#pack-state').textContent=`Ready · ${status.files} verified files · ${(status.installedBytes/1048576).toFixed(1)} MB`; say('Offline pack installed. Stories and saved postcards are available after reconnect-free reload.'); }
   finally { $('#install').disabled = false; }
 });
 bind('#gps',()=>startJourney('gps')); bind('#replay',()=>startJourney('replay')); bind('#stop',stopJourney);
 bind('#follow-map', e => { mapFollowing = e.currentTarget.checked; say(mapFollowing ? 'Map follow on.' : 'Map follow off. You can explore the corridor freely.'); }, 'change');
 renderChapterQueue();
}
async function renderStories(hubId) {
 if (!hubId) { main.innerHTML = `<section class="collection-hero"><p class="eyebrow">The corridor collection</p><h1>Seven places.<br>Different perspectives.</h1><p class="intro">Explore every chapter manually. These original source summaries await human editorial approval. Attractions are associated with towns; they are not promised views from the train.</p></section><div class="cards story-collection">${pack.chapters.map((c,i)=>`<article class="card story-tile"><div class="story-tile-art" aria-hidden="true"><span>0${i+1}</span></div><p class="eyebrow">${c.depth === 'deep' ? 'Story + challenge + postcard' : 'Short sourced chapter'}</p><h2>${escape(c.title)}</h2><p>${escape((Array.isArray(c.body)?c.body.join(' '):c.body).slice(0,140))}…</p><a data-nav href="${chapterLink(c)}">Open chapter →</a></article>`).join('')}</div>`; return; }
 const started = performance.now(); const c = chapterByHub(hubId); if (!c) throw new Error('Chapter not found');
 if (engine.snapshot().queue.includes(c.hubId)) await engine.acknowledgeChapter(c.hubId);
 renderChapterQueue();
 const progressKey = `challenge-${currentMode}-${c.id}`;
 const progress = await get('state', progressKey);
 main.innerHTML = `<article class="story"><a class="story-back" data-nav href="/stories">← All chapters</a><div class="story-hero-card"><div class="story-hero-art" aria-hidden="true"><span>${escape(c.title.split(':')[0])}</span></div><div class="story-hero-copy"><p class="eyebrow">${escape(c.depth)} chapter · ${escape(currentMode)}</p><h1>${escape(c.title)}</h1><div class="story-facts"><span>Text transcript</span><span>Offline ready</span><span>${c.sourceIds.length} ${c.sourceIds.length === 1 ? 'source' : 'sources'}</span></div><p><small>${escape(c.locationNotice)}</small></p></div></div><div class="story-body">${(Array.isArray(c.body)?c.body:[c.body]).map(p=>`<p>${escape(p)}</p>`).join('')}</div><details class="story-transcript"><summary>Reading transcript</summary><p>${escape(c.transcript)}</p><p class="muted">Recorded narration is not yet available.</p></details>${c.activity ? `<section class="panel"><p class="eyebrow">Adventure · sourced answers</p><h2>${escape(c.activity.question)}</h2><form id="challenge"><label for="answer">Your answer</label><input id="answer" required autocomplete="off"><div class="actions"><button>Check answer</button><button id="hint" class="secondary" type="button">Show a hint</button></div></form><p id="answer-result" role="status">${progress?.complete ? 'Completed on this device.' : ''}</p><p id="hint-text" class="hint" hidden></p></section><section class="panel"><h2>A moment to create</h2><p>${escape(c.creativePrompt)}</p><a class="button" data-nav href="/creative?hub=${encodeURIComponent(c.hubId)}">Make a postcard</a></section>` : '<p class="notice">This is a short chapter. Mode activities are available at Kimberley, Beaufort West and Matjiesfontein.</p>'}<section class="story-sources"><h2>Where this story comes from</h2>${sourceCards(c.sourceIds)}</section><section class="panel"><h2>Optional assistance</h2><p>AI generation is off until its grounding evaluation passes. The source passages above and prepared hints work offline.</p><button id="ai-check" class="secondary">Check assistive fallback</button><p id="ai-result" role="status"></p></section></article>`;
 let hint = 0;
 bind('#hint',()=>{ $('#hint-text').hidden=false; $('#hint-text').textContent=c.activity.hints[Math.min(hint++,2)]; $('#hint').textContent=`Hint ${Math.min(hint,3)} of 3`; });
 bind('#challenge',async e=>{ e.preventDefault(); const normalize=s=>s.trim().normalize('NFKC').toLocaleLowerCase('en').replace(/[.,!?]/g,''); const accepted=[c.activity.answer,...(c.activity.acceptedAnswers||[])].some(a=>normalize(String(a))===normalize($('#answer').value)); if(accepted)await put('state',progressKey,{complete:true,at:new Date().toISOString(),positionMode:currentMode}); $('#answer-result').textContent=accepted?`Correct. ${currentMode === 'replay' ? 'Replay' : currentMode === 'gps' ? 'Live-GPS journey' : 'Manual'} progress saved on this device.`:'Not quite. Try a prepared hint and read the source.'; },'submit');
 bind('#ai-check',async()=>{const t=performance.now();try{const result=await api('/api/ai',{action:'explain',question:`Explain ${c.title}`});$('#ai-result').textContent=result.answer||result.message||result.reason||'AI disabled. Read the source passages above.';}catch(error){$('#ai-result').textContent=`AI unavailable. Use the cached story and hints. ${error.message}`;}await measure('ai-fallback',performance.now()-t,{online:navigator.onLine});});
 await measure('chapter-open',performance.now()-started,{online:navigator.onLine,hubId});
}
async function renderCreative() {
 const selected = new URL(location.href).searchParams.get('hub') || pack.chapters.find(c=>c.depth==='deep').hubId;
 const c=chapterByHub(selected)||pack.chapters[0]; const saved=await get('drafts',c.hubId);
 main.innerHTML=`<p class="eyebrow">Your collection</p><h1>A postcard from<br>the in-between.</h1><div class="grid"><section class="panel"><form id="draft-form"><label for="draft-hub">Story inspiration</label><select id="draft-hub">${pack.chapters.filter(c=>c.depth==='deep').map(item=>`<option value="${item.hubId}" ${item.hubId===c.hubId?'selected':''}>${escape(item.title)}</option>`).join('')}</select><p>${escape(c.creativePrompt||'Write a reflection on your journey.')}</p><label for="draft-title">Postcard title</label><input id="draft-title" maxlength="100" value="${escape(saved?.title||c.title)}"><label for="draft-body">Your words</label><textarea id="draft-body" maxlength="1200" placeholder="What will you remember?">${escape(saved?.body||'')}</textarea><div class="actions"><button>Save postcard</button><button id="export-png" type="button" class="secondary">Export PNG</button></div><p id="draft-status" role="status">${saved?'Saved postcard reopened.':'Not saved yet. No AI edits.'}</p></form></section><div><article class="preview"><p class="eyebrow">ShosholozaTrail · Personal reflection</p><h2 id="preview-title"></h2><p id="preview-body"></p><small id="preview-credit"></small></article><p class="muted">Your writing stays on this device. Export a copy to keep or share.</p><section class="panel"><h2>Saved postcards</h2><div id="draft-list"></div></section></div></div>`;
 const credit=`Inspired by ${c.title}. Sources: ${c.sourceIds.join(', ')}. Personal writing, not a historical source.`;
 const update=()=>{ $('#preview-title').textContent=$('#draft-title').value; $('#preview-body').textContent=$('#draft-body').value; $('#preview-credit').textContent=credit; };
 const renderDraftList=async()=>{const drafts=await entries('drafts');$('#draft-list').innerHTML=drafts.length?drafts.sort((a,b)=>String(b.savedAt).localeCompare(String(a.savedAt))).map(d=>`<p><a data-nav href="/creative?hub=${encodeURIComponent(d.hubId)}">${escape(d.title||'Untitled postcard')}</a><br><small>${escape(d.savedAt||'Saved locally')}</small></p>`).join(''):'<p>No saved postcards yet.</p>';};
 update();
 for(const id of ['#draft-title','#draft-body'])bind(id,()=>{draftDirty=true;update();$('#draft-status').textContent='Unsaved changes';},'input');
 bind('#draft-form',async e=>{e.preventDefault();await put('drafts',c.hubId,{hubId:c.hubId,title:$('#draft-title').value,body:$('#draft-body').value,credit,sourceIds:c.sourceIds,savedAt:new Date().toISOString()});draftDirty=false;$('#draft-status').textContent='Saved on this device.';await renderDraftList();},'submit');
 bind('#draft-hub',()=>navigate(`/creative?hub=${$('#draft-hub').value}`),'change');
 await renderDraftList();
 bind('#export-png',async()=>{
   const canvas=document.createElement('canvas');canvas.width=1200;const measureCtx=canvas.getContext('2d');
   const lines=(text,font,maxWidth=1000)=>{measureCtx.font=font;const output=[];for(const paragraph of String(text).split('\n')){let line='';for(const word of paragraph.split(/\s+/).filter(Boolean)){const candidate=line?`${line} ${word}`:word;if(measureCtx.measureText(candidate).width<=maxWidth){line=candidate;continue;}if(line){output.push(line);line='';}if(measureCtx.measureText(word).width<=maxWidth){line=word;continue;}let fragment='';for(const character of word){const next=fragment+character;if(measureCtx.measureText(next).width>maxWidth&&fragment){output.push(fragment);fragment=character;}else fragment=next;}line=fragment;}output.push(line||' ');}return output;};
   const sections=[{text:'SHOSHOLOZA TRAIL · PERSONAL POSTCARD',font:'24px sans-serif',lineHeight:38,gap:35},{text:$('#draft-title').value,font:'42px Georgia',lineHeight:56,gap:30},{text:$('#draft-body').value,font:'28px Georgia',lineHeight:44,gap:30},{text:credit,font:'20px sans-serif',lineHeight:32,gap:0}].map(section=>({...section,lines:lines(section.text,section.font)}));
   canvas.height=Math.max(1500,100+sections.reduce((height,section)=>height+section.lines.length*section.lineHeight+section.gap,0)+100);const ctx=canvas.getContext('2d');ctx.fillStyle='#183e36';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#f3efe5';let y=100;
   for(const section of sections){ctx.font=section.font;for(const line of section.lines){ctx.fillText(line,100,y);y+=section.lineHeight;}y+=section.gap;}
   const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw new Error('PNG export failed');const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`shosholoza-${c.hubId}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);say('Postcard exported with source credit.');
 });
}
function session(){try{return JSON.parse(sessionStorage.getItem('trail-room')||'null');}catch{return null;}}
async function api(path,body,token=session()?.token){
 const response=await fetch(path,{method:body===undefined?'GET':'POST',headers:{...(body!==undefined?{'Content-Type':'application/json'}:{}),...(token?{Authorization:`Bearer ${token}`}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{}),cache:'no-store',signal:AbortSignal.timeout(18000)});
 const result=await response.json();if(!response.ok)throw new Error(result.error||result.message||`Service returned ${response.status}`);return result;
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
 const [status,metrics,events,r3,r10,endurance]=await Promise.all([packStatus(),entries('metrics'),entries('events'),json('/results/r3.json').catch(()=>null),json('/results/r10.json').catch(()=>null),get('state','endurance')]);
 main.innerHTML=`<p class="eyebrow">Evidence, not estimates</p><h1>What we have<br>actually measured.</h1><p class="notice"><strong>Not yet validated:</strong> verified corridor rail geometry; physical phones and carriage GPS; hosted integrations; reviewed narration and second language; six-person user trial; four-hour endurance; independent relevant-environment review. TRL 5 is not claimed.</p><div class="cards"><section class="card"><h2>R3 · Trigger replay</h2><p>Local synthetic harness. Not a corridor field test.</p><p class="score">${r3?`${escape(r3.correctHub)} / ${escape(r3.eligible)}`:'Not run'}</p><p>Correct / eligible encounters</p><details><summary>Profiles and failure classes</summary><pre>${escape(JSON.stringify(r3,null,2))}</pre></details></section><section class="card"><h2>R5 / R6 · Offline pack</h2><p>${status?'Complete verified install':'No complete pack installed'}</p><p class="metric">${status?`${status.installedBytes.toLocaleString()} / ${status.expectedBytes.toLocaleString()} bytes`: 'Bytes not measured'}</p><p>Last successful install: ${escape(status?.installedAt||'Never')}</p><p>Current network: ${navigator.onLine?'Online':'Offline'}</p><details><summary>Manifest SHA-256</summary><pre>${escape(status?.hash||'Not installed')}</pre></details><button id="storage-failure">Simulate storage failure</button><p id="failure-result" role="status"></p></section><section class="card"><h2>R10 · AI grounding</h2><p>AI generation disabled. Provider evaluation is not validated by a fallback-only test.</p><details><summary>Actual evaluation result</summary><pre>${escape(JSON.stringify(r10,null,2)||'Not run')}</pre></details></section></div><section class="panel"><h2>R12 · This browser's timings</h2><p>Recorded application render durations; not physical-device acceptance. Offline startup is a usable-screen metric, not browser first paint.</p><div class="table-wrap"><table><thead><tr><th>Measurement</th><th>Runs</th><th>p50</th><th>p95</th></tr></thead><tbody>${[['offline-usable','Offline usable screen'],['chapter-open','Cached chapter open (offline only)'],['ai-fallback','AI response or explicit fallback']].map(([name,label])=>{const values=metrics.filter(m=>m.name===name&&(name!=='chapter-open'||m.online===false)).map(m=>m.ms);return `<tr><td>${label}</td><td>${values.length}</td><td>${fmt(percentile(values,.5))}</td><td>${fmt(percentile(values,.95))}</td></tr>`;}).join('')}</tbody></table></div></section><section class="panel"><h2>R16 · Endurance log</h2><p>Start a defined-use run on a physical phone. Battery readings may be unavailable in this browser. A short run does not satisfy the four-hour gate.</p><label for="endurance-pattern">Brightness, network, audio and activity pattern</label><input id="endurance-pattern" value="${escape(endurance?.pattern||'')}" placeholder="Record your real test conditions"><div class="actions"><button id="endurance-start">Start run</button><button id="endurance-stop" class="secondary">End run</button></div><pre>${escape(JSON.stringify(endurance,null,2)||'No run recorded')}</pre></section><section class="panel"><h2>Live journey event log</h2><p>${events.length} stored events. Position source and trace ID distinguish synthetic replay from GPS.</p><details><summary>View events</summary><pre>${escape(JSON.stringify(events.slice(-100),null,2))}</pre></details><button id="evidence-export" class="secondary">Export real local evidence</button></section><section class="panel"><h2>Provenance register</h2><p>All factual chapters link to these source records. Human editorial review remains pending.</p>${sourceCards(sources.records.map(s=>s.id))}</section>`;
 main.querySelector('.notice').textContent='Not yet validated: physical-phone loading and carriage GPS; verified corridor rail geometry; MapTiler online layer; AI provider; reviewed narration and second language; six-person user trial; four-hour endurance; independent relevant-environment review. The hosted D1 room board has passed a two-room automated isolation smoke test. TRL 5 is not claimed.';
 bind('#storage-failure',async()=>{const before=await packStatus();const draftsBefore=JSON.stringify(await entries('drafts'));try{await installPack({failAfter:0});throw new Error('Failure injection unexpectedly completed');}catch(error){const after=await packStatus();const preserved=JSON.stringify(before)===JSON.stringify(after)&&draftsBefore===JSON.stringify(await entries('drafts'));const result={at:new Date().toISOString(),scenario:'storage-failure',preserved,error:error.message,hadInstalledPack:!!before};await put('metrics',crypto.randomUUID(),result);$('#failure-result').textContent=`${preserved?'Preserved':'FAILED'}: last pack pointer and drafts. ${before?'Existing complete pack retained.':'Install a complete pack first to validate rollback.'} ${error.message}`;}});
 const battery=async()=>{try{return (await navigator.getBattery?.())?.level??null;}catch{return null;}};
 bind('#endurance-start',async()=>{const existing=await get('state','endurance');if(existing&&!existing.endedAt)throw new Error('An endurance run is already active. End it before starting another.');if(!$('#endurance-pattern').value.trim())throw new Error('Describe the real test conditions first.');await put('state','endurance',{startedAt:new Date().toISOString(),pattern:$('#endurance-pattern').value,batteryStart:await battery(),restarts:0,device:navigator.userAgent});await renderEvidence();});
 bind('#endurance-stop',async()=>{const run=await get('state','endurance');if(!run||run.endedAt)throw new Error('No active endurance run');run.endedAt=new Date().toISOString();run.durationMs=Date.now()-Date.parse(run.startedAt);run.batteryEnd=await battery();run.batteryDelta=run.batteryStart!==null&&run.batteryEnd!==null?run.batteryStart-run.batteryEnd:null;await put('state','endurance',run);await renderEvidence();});
 bind('#evidence-export',async()=>{const blob=new Blob([JSON.stringify({exportedAt:new Date().toISOString(),r3,r10,status,metrics,events,endurance},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='shosholoza-evidence.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);});
}
async function navigate(path){if(draftDirty&&!confirm('Leave this postcard without saving your latest changes?'))return;draftDirty=false;history.pushState({},'',path);await render();}
async function render(){if(map){map.remove();map=null;marker=null;routeLayer=null;traversedLayer=null;hubMarkers=new Map();attractionMarkers=new Map();journeyViewEngaged=false;}for(const a of document.querySelectorAll('nav a')){if(a.pathname==='/'?location.pathname==='/':location.pathname.startsWith(a.pathname))a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');}const path=location.pathname;try{if(path.startsWith('/stories'))await renderStories(path.split('/')[2]);else if(path==='/creative')await renderCreative();else if(path==='/carriage')await renderCarriage();else if(path==='/contribute')await renderContribute();else if(path==='/evidence')await renderEvidence();else await renderJourney();}catch(error){main.innerHTML='<h1>This screen could not open.</h1><p id="screen-error"></p><a href="/">Return to journey</a>';$('#screen-error').textContent=error.message;} }
window.addEventListener('popstate',()=>{draftDirty=false;render();});document.addEventListener('click',e=>{const a=e.target.closest('a[data-nav]');if(a&&!e.ctrlKey&&!e.metaKey){e.preventDefault();navigate(a.href);}});window.addEventListener('beforeunload',e=>{if(draftDirty){e.preventDefault();e.returnValue='';}});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&currentMode==='gps'){positionSource?.stop();positionSource=null;waiting=false;$('#waiting').hidden=true;document.body.classList.remove('low-power');say('Live GPS paused while hidden. Restart it when ready.');setMode('manual');}});
try{
 network(); if('serviceWorker'in navigator){await navigator.serviceWorker.register('/sw.js');await navigator.serviceWorker.ready;}
 [pack,hubs,route,sources]=await Promise.all(['/data/pack.v1.json','/data/hubs.json','/data/route.geojson','/data/sources.json'].map(json));
 await initializeEngine();const run=await get('state','endurance');if(run&&!run.endedAt){run.restarts++;await put('state','endurance',run);}
 await render();await measure(navigator.onLine?'online-usable':'offline-usable',performance.now()-bootAt,{online:navigator.onLine,device:navigator.userAgent});
}catch(error){main.innerHTML='<h1>We could not open the journey.</h1><p id="startup-error"></p><p>Connect and reload to install your first complete pack. Previously saved drafts remain on this device.</p>';$('#startup-error').textContent=error.message;}
