"""Rebuild the small, source-linked English editorial pack. No generated historical claims."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
VERSION = '1.0.0-editorial-draft'
REVIEW = '2026-09-08'

def source(id, title, url, institution, passage, publication=None):
    return dict(id=id, title=title, url=url, institution=institution, passage=passage,
                passageType='original-paraphrase', publicationDate=publication,
                reviewDate=REVIEW, reviewStatus='automated-source-review; human-review-pending',
                rights='Original factual paraphrase with attribution. No source images, recordings or full texts licensed for redistribution; none included.')

sources = [
    source('osm-stations', 'OpenStreetMap station anchor records', 'https://www.openstreetmap.org/copyright', 'OpenStreetMap contributors',
           'Seven mapped station or stop-position anchors were retrieved from the OpenStreetMap API. Their selected node IDs, versions and coordinates are recorded in data/provenance/osm-stations-selected.json. Connecting these points with straight lines produces an unresolved schematic, not sourced railway geometry.'),
    source('osm-attraction-coordinates', 'OpenStreetMap attraction coordinate records', 'https://www.openstreetmap.org/copyright', 'OpenStreetMap contributors',
           'Five attraction map positions were selected by exact OpenStreetMap feature ID. Nominatim supplied a representative point for each feature. IDs, coordinates and direct object URLs are recorded in data/provenance/attractions-selected.json. These mapped positions are not field verified and make no claim about rail access or visibility.'),
    source('freedom-park', 'Freedom Park', 'https://www.freedompark.co.za/', 'Freedom Park',
           'Freedom Park is in Salvokop, Pretoria. Its heritage spaces commemorate people who gave their lives for South Africa\'s freedom. The institution describes its purpose as remembering and celebrating South Africa\'s heritage and cultures.'),
    source('freedom-park-location', 'Freedom Park stakeholder magazine: visitor information', 'https://www.freedompark.co.za/wp-content/uploads/2024/04/stakeholder_magazine_2ND_term_2021-22Final_1.pdf', 'Freedom Park',
           'The official publication lists Freedom Park at Corner Koch and 7th Avenue, Salvokop, and publishes GPS coordinates S 25 45.846 and E 28 11.238. The map coordinate is the decimal conversion of that published pair.'),
    source('sol-plaatje', 'Sol Plaatje House: Who is Sol Plaatje?', 'https://www.education.gov.za/ContactUs/SolPlaatjeHouse.aspx', 'Department of Basic Education; page credits Sol Plaatje Educational Trust',
           'Sol Plaatje worked as a teacher, interpreter, journalist and writer. His English books include Native Life in South Africa (1916) and Mhudi (1930). He also wrote in Setswana and translated Shakespeare. The Sol Plaatje Educational Trust and Museum occupies his Kimberley home.'),
    source('schreiner-de-aar', 'Olive Schreiner to Edward Carpenter, 26 October 1913', 'https://www.oliveschreiner.org/vre?colid=39&letterid=17&view=collections', 'Olive Schreiner Letters Online; archival record credits National English Literary Museum',
           'The archive catalogues a letter from Olive Schreiner to Edward Carpenter, dated 26 October 1913 and sent from De Aar. In it she discusses plans to travel from Africa to England and the help offered by friends.', '1913-10-26'),
    source('sanparks-karoo', 'Karoo National Park: Hikes, Walks and Trails', 'https://www.sanparks.org/parks/karoo/what-to-do/activities/hikes-walks-trails', 'South African National Parks',
           'The Fossil Trail in Karoo National Park presents the geology and palaeontology of the Great Karoo. SANParks describes genuine fossils and petrified wood displayed along a paved walkway. This is a park attraction, not a view promised from a train.'),
    source('sanparks-karoo-waypoint', 'Karoo National Park GPS Waypoints', 'https://www.sanparks.org/parks/karoo/travel/gps-waypoints', 'South African National Parks',
           'SANParks publishes the entrance gate waypoint as 32°21\'48.2”S, 22°32\'28.4”E. This locates the park entrance only. It is not substituted for the Fossil Trail and does not establish access from the train.'),
    source('matjiesfontein-history', 'Matjiesfontein History', 'https://www.matjiesfontein.com/pages/history/', 'Matjiesfontein / Lord Milner Hotel',
           'Matjiesfontein\'s own history page identifies railway worker James Douglas Logan as its founder. It records Olive Schreiner\'s residency and says the Milner Hotel served as a military hospital during the South African War. David Rawdon later restored the village and reopened the hotel in 1970.'),
    source('worcester-heritage', 'Zwelethemba Heritage Route', 'https://worcestertourism.com/places/zwelethemba-route/', 'Worcester Tourism',
           'Worcester Tourism presents a Zwelethemba Heritage Route. It explains the settlement\'s history through the displacement of residents from Sakkiesdorp. Its linked route publication includes public memorials and artists\' histories, and distinguishes private residences from places open to visitors.', '2023-10-09'),
    source('worcester-heritage-map', 'Zwelethemba Heritage Route map', 'https://worcestertourism.com/wp-content/uploads/2023/10/BVM-Zwelenthema-Map-Final-260623.pdf', 'Worcester Tourism',
           'The published route map identifies public heritage stops, including Freedom Square and Worcester Museum, and explicitly labels several former homes as private residences not open to the public. This prototype maps Worcester Museum but leaves the multi-stop route ungeocoded.'),
    source('district-six', 'About District Six Museum', 'https://www.districtsix.co.za/', 'District Six Museum',
           'The District Six Museum Foundation formed in 1989 after the Hands Off District Six conference. The museum opened on 10 December 1994 with the exhibition Streets: Retracing District Six. Its work connects place, memory and the history of displacement.'),
    source('big-hole', 'The Big Hole: history', 'https://thebighole.com/the-big-hole/', 'The Big Hole museum and visitor attraction',
           'The Big Hole\'s official history dates the start of digging at the Kimberley diamond mine site to 1871. The visitor attraction interprets diamonds, mining and the stages between rough stones and polished gems.')
]

def chapter(id, title, depth, body, refs, activity=None, creative=None):
    value = dict(id=id, hubId=id, title=title, depth=depth, body=body, transcript=body,
                 sourceIds=refs, language='en', reviewStatus='human-review-pending',
                 narrationStatus='text-transcript-only; recorded-audio-not-yet-produced',
                 locationNotice='A story associated with this hub. The attraction is not necessarily visible or accessible from the train.')
    if activity:
        value['activity'] = dict(question=activity[0], answer=activity[1], hints=activity[2], sourceIds=refs)
    if creative:
        value['creativePrompt'] = creative
    return value

chapters = [
    chapter('pretoria', 'Pretoria: beginning with remembrance', 'short',
            'Freedom Park in Salvokop gives this departure chapter a theme of remembrance. The institution honours people who gave their lives for South Africa\'s freedom and creates space to remember the country\'s heritage and cultures. This short introduction invites a careful journey: the places ahead have histories beyond what any window can show. Read the linked institution\'s account for its own description of the site.', ['freedom-park']),
    chapter('kimberley', 'Kimberley: a city in words', 'deep',
            'Kimberley\'s stories extend beyond its mine. Sol Plaatje worked with language as a teacher, interpreter, journalist and author. His former Kimberley home houses the Sol Plaatje Educational Trust and Museum.\n\nThe Department of Basic Education lists Native Life in South Africa, published in 1916, and the novel Mhudi, published in 1930. It also describes his Setswana writing and Shakespeare translations. Language was part of his public work as well as his literary craft.\n\nThe Big Hole museum dates mining at its site to 1871. Read these two institutional accounts together: one foregrounds a writer\'s legacy, the other mining. Each offers a different starting point for understanding the city; neither is a complete history.', ['sol-plaatje', 'big-hole'],
            ('Which novel by Sol Plaatje does this chapter name?', 'Mhudi', ['Look in the paragraph about his published books.', 'Native Life in South Africa is the other title; the question asks for the novel.', 'The novel is Mhudi.']),
            'Create a fictional postcard about what a city might preserve in words. Use your own voice; do not invent a quotation from Sol Plaatje.'),
    chapter('de-aar', 'De Aar: a letter before departure', 'short',
            'An archival letter connects De Aar with a much wider world. Olive Schreiner Letters Online records her letter to Edward Carpenter from De Aar on 26 October 1913. She discusses travelling to England and friends helping with the journey. This brief chapter stays with what that single document can support: one writer, a named recipient, a place and a date. It is not an account of every resident\'s experience.', ['schreiner-de-aar']),
    chapter('beaufort-west', 'Beaufort West: reading the Karoo', 'deep',
            'This hub opens a window onto Karoo natural history through a source from SANParks. Its Fossil Trail in Karoo National Park presents the region\'s geology and palaeontology with fossils and petrified wood along a paved walkway.\n\nA fossil display and a living landscape invite different kinds of attention. The display brings selected evidence together for interpretation. Looking out of a train window is an observation in the present; it does not identify the age or species of something you cannot examine.\n\nThe activity below asks only about the material named by the source. This is an onboard reading activity associated with the Beaufort West hub. It does not promise entry to the park, a wildlife sighting or visibility of the trail from the railway.', ['sanparks-karoo'],
            ('Besides fossils, what material does SANParks say is displayed on the Fossil Trail?', 'petrified wood', ['The first paragraph names two kinds of display material.', 'It is wood preserved in mineral form.', 'The source names petrified wood.']),
            'Draw or describe an imagined museum label for a memory from your own journey. Label invented objects as imaginary; do not identify real fossils from a moving train.'),
    chapter('matjiesfontein', 'Matjiesfontein: railway, writing and memory', 'deep',
            'Matjiesfontein\'s history page names James Douglas Logan, a railway worker, as the village\'s founder. It also records writer Olive Schreiner\'s residency. These links place rail travel and writing beside one another in the village\'s published account.\n\nThe same source says the Milner Hotel served as a military hospital during the South African War. It later describes David Rawdon\'s restoration work and the hotel\'s reopening in 1970. A building can have several uses across a lifetime; its present appearance alone cannot tell them all.\n\nThis chapter is based on the property\'s published history, not a new interview with local residents. The linked source lets you inspect that perspective. Our challenge asks about a documented use of the hotel, while your postcard can imagine your own experience without pretending to be historical testimony.', ['matjiesfontein-history'],
            ('What wartime role did the Milner Hotel serve, according to the source?', 'military hospital', ['Find the second paragraph.', 'Its role involved caring for people during the war.', 'It served as a military hospital.']),
            'Make an imagined postcard from a railway pause. Describe light, sound or anticipation in your own words; keep your invention separate from the sourced history.'),
    chapter('worcester', 'Worcester / Zwelethemba: public memory', 'short',
            'Worcester Tourism\'s Zwelethemba Heritage Route connects local history with public memorials and artists\' lives. Its introduction places the settlement in the history of residents displaced from Sakkiesdorp. The route distinguishes public places from private homes. This onboard chapter is an introduction to the published heritage account, not an invitation to enter a residence or a claim that these places are visible from the station.', ['worcester-heritage']),
    chapter('cape-town', 'Cape Town: streets remembered', 'short',
            'At the end of this story corridor, the District Six Museum offers another way to think about place. Its foundation formed in 1989, and the museum opened on 10 December 1994 with Streets: Retracing District Six. That exhibition title connects streets with memory. This arrival chapter points to the museum\'s own account; it does not invent a former resident\'s voice or claim that a replay has taken you there.', ['district-six'])
]

def write(name, obj):
    (ROOT / name).write_text(json.dumps(obj, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

sources[0]['rights'] = 'OpenStreetMap data © OpenStreetMap contributors, licensed ODbL 1.0. Station extract and derivative schematic distributed under ODbL 1.0: https://opendatacommons.org/licenses/odbl/1-0/ . Source attribution must remain visible.'
next(record for record in sources if record['id'] == 'osm-attraction-coordinates')['rights'] = 'OpenStreetMap data © OpenStreetMap contributors, licensed ODbL 1.0. Selected feature positions are distributed under ODbL 1.0: https://opendatacommons.org/licenses/odbl/1-0/ . Source attribution must remain visible.'
write('sources.json', dict(version=VERSION, records=sources))
write('pack.v1.json', dict(version=VERSION, language='en', status='editorial-draft-human-review-pending',
                         reviewDate=REVIEW, chapters=chapters,
                         scope={'deepChapters':3,'shortChapters':4,'reviewedSecondLanguage':False,'recordedAudio':False}))
print(f'Wrote seven chapters (three deep) and {len(sources)} source records.')
