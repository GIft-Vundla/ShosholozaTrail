import { useState } from 'react';
import { X, Headphones, Bookmark, Send, MapPin } from 'lucide-react';
import { STOPS, type Stop } from '../data';
import { AiAssistant } from './AiAssistant';
import { LocalizedScene } from './LocalizedScene';

export function DestinationPanel({ stop, index, onClose, onJump }: {
  stop: Stop;
  index: number;
  onClose: () => void;
  onJump: (index: number) => void;
}) {
  const [tab, setTab] = useState('Highlights');
  const tabs = ['Highlights', 'Culture', 'Experiences', 'Gallery'];

  return <div className="panel-layer">
    <button className="panel-backdrop" onClick={onClose} aria-label="Close destination" />
    <section className="destination-panel">
      <div className="panel-hero">
        <img src={stop.image} alt="" />
        <div />
        <button className="panel-close" onClick={onClose} aria-label="Close destination"><X /></button>
        <div className="panel-title">
          <p className="eyebrow gold">Stop {index + 1} of {STOPS.length} · {stop.province}</p>
          <h2>{stop.name}</h2><p>{stop.tagline}</p>
        </div>
      </div>
      <LocalizedScene hubId={stop.id} />
      <div className="panel-actions">
        <button className="primary-btn"><Headphones />Listen · {stop.audioLength}</button>
        <button><Bookmark />Save place</button><button><Send />Postcard</button>
      </div>
      <nav className="panel-tabs" aria-label="Destination information">
        {tabs.map(item => <button className={tab === item ? 'active' : ''} onClick={() => setTab(item)} key={item}>{item}</button>)}
      </nav>
      <div className="panel-body">
        {tab === 'Highlights' && <>
          <p className="eyebrow">{stop.audioTitle}</p><p className="story-copy">{stop.story}</p>
          <div className="attraction-list">{stop.attractions.map(attraction => <article key={attraction.name}>
            <p className="eyebrow gold-dark">{attraction.kind}</p><h3>{attraction.name}</h3><p>{attraction.blurb}</p>
          </article>)}</div>
          <AiAssistant place={stop.name} />
        </>}
        {tab === 'Culture' && <><p className="story-copy">{stop.culture}</p><h3>Taste of the place</h3>{stop.food.map(food => <div className="food-row" key={food}>{food}</div>)}</>}
        {tab === 'Experiences' && stop.attractions.map(attraction => <article className="experience" key={attraction.name}><MapPin /><div><h3>{attraction.name}</h3><p>{attraction.blurb}</p></div></article>)}
        {tab === 'Gallery' && <div className="gallery"><img src={stop.image} alt={stop.name} /><div>{stop.name}</div><div>{stop.province}</div></div>}
      </div>
      <footer className="route-list"><p className="eyebrow">Where you are on the trail</p>{STOPS.map((item, itemIndex) => <button key={item.id} className={itemIndex === index ? 'active' : ''} onClick={() => onJump(itemIndex)}><span>{itemIndex + 1}</span>{item.name}<small>{item.km} km</small></button>)}</footer>
    </section>
  </div>;
}
