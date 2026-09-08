import { useEffect, useState } from 'react';
import { SiteHeader } from './SiteHeader';
import { MobileTabBar } from './MobileTabBar';

type Photo = {
  id: string;
  file: string;
  title: string;
  author: string;
  licence: string;
  licenceUrl: string;
  source: string;
  retrieved: string;
};

// Every photograph here is used under a Creative Commons licence that requires
// attribution. This page is the attribution, so it ships with the pack rather
// than living in a document nobody opens.
export function Credits() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/assets/photo-credits.json')
      .then((r) => {
        if (!r.ok) throw new Error('Credits unavailable');
        return r.json();
      })
      .then((d) => setPhotos(d.photos ?? []))
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div className="page credits-page">
      <SiteHeader />
      <section className="credits-shell">
        <p className="eyebrow gold-dark">Attribution</p>
        <h1>Where these photographs come from.</h1>
        <p className="credits-intro">
          Every photograph on this site is a real image of the place it illustrates, used under a
          Creative Commons licence from Wikimedia Commons. No image is generated, and none is a stand-in
          for a different town. Each credit links to the original file and its licence.
        </p>

        {error && <p className="notice">{error}</p>}

        <ul className="credits-list">
          {photos.map((p) => (
            <li key={p.id}>
              <img src={p.file} alt={p.title} loading="lazy" />
              <div>
                <h2>{p.id.replace(/-/g, ' ')}</h2>
                <p className="credits-title">{p.title}</p>
                <p>
                  <strong>{p.author}</strong>
                  {' · '}
                  {p.licenceUrl ? (
                    <a href={p.licenceUrl} target="_blank" rel="noopener noreferrer">
                      {p.licence}
                    </a>
                  ) : (
                    p.licence
                  )}
                </p>
                <p>
                  <a href={p.source} target="_blank" rel="noopener noreferrer">
                    View original on Wikimedia Commons
                  </a>
                  <small> · retrieved {p.retrieved}</small>
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>
      <MobileTabBar />
    </div>
  );
}
