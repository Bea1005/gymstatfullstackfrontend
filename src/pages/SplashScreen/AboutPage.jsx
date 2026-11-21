import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Building2,
  Image as ImageIcon,
  Users,
  Waves,
  X,
} from 'lucide-react';
import directorPhotograph from '../../assets/about page/Director photograph.jpg';
import indoorSportsFacilities from '../../assets/about page/Indoor Sports Facilities.jpg';
import mainGymnasium from '../../assets/about page/Main Gymnasium.jpg';
import outdoorFacilities from '../../assets/about page/OUTDOOR FACILITIE.jpg';
import sportsUnitActivities from '../../assets/about page/SPORT UNIT ACTIVITIES.jpg';
import sportsEvent from '../../assets/about page/SPORTS EVENT.jpg';
import universityAthletes from '../../assets/about page/UNIVERSITY ATHLETES.jpg';
import universityGymnasium from '../../assets/about page/University Gymnasium.jpg';
import './AboutPage.css';

const milestones = [
  {
    period: 'Early Sports Unit period',
    title: 'Mrs. Felomina M. Sapallo',
    summary: 'Established leadership of the Sports Unit as Director for Sports, Physical Education, and Recreation (SPEAR).',
  },
  {
    period: '2000–2005',
    title: 'Mr. Jorge M. Mandia',
    summary: 'Served as Sports Director for five years.',
  },
  {
    period: '2005–2024',
    title: 'Dr. Diomenes L. Motaron',
    summary: 'Designated Sports Director during the presidency of Dr. Romulo H. Malvar, serving until his retirement in 2024.',
  },
  {
    period: '2007',
    title: 'PASUC Regional Olympics',
    summary: 'MSC hosted the Philippine Association of State Universities and Colleges Regional Olympics and placed 5th overall among eleven competing SUCs from Regions IVA and IVB.',
  },
  {
    period: '2024 onwards',
    title: 'Asst. Professor Gerald M. Pajanustan',
    summary: 'Current Director of the Marinduque State University Sports Unit.',
  },
];

const galleryItems = [
  { title: 'Main Gymnasium', category: 'Gymnasium', imageSrc: mainGymnasium },
  { title: 'Indoor Sports Facilities', category: 'Sports Facilities', imageSrc: indoorSportsFacilities },
  { title: 'Outdoor Sports Facilities', category: 'Sports Facilities', imageSrc: outdoorFacilities },
  { title: 'Sports Events', category: 'Sports Events', imageSrc: sportsEvent },
  { title: 'University Athletes', category: 'University Athletes', imageSrc: universityAthletes },
  { title: 'Sports Unit Activities', category: 'Sports Unit Activities', imageSrc: sportsUnitActivities },
];

const galleryCategories = [
  'All',
  'Gymnasium',
  'Sports Facilities',
  'Sports Events',
  'University Athletes',
  'Sports Unit Activities',
];

function PhotoFrame({ label, className = '', imageSrc }) {
  return (
    <div className={`about-photo-frame ${className}`} role="img" aria-label={`${label} photo`}>
      {imageSrc ? (
        <img src={imageSrc} alt={label} />
      ) : (
        <div className="about-photo-placeholder" aria-hidden="true">
          <ImageIcon size={34} strokeWidth={1.4} />
          <span>{label}</span>
          <small>Photo coming soon</small>
        </div>
      )}
    </div>
  );
}

function AboutPage() {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState('All');
  const [activeImageIndex, setActiveImageIndex] = useState(null);
  const filteredGallery = galleryItems
    .map((item, index) => ({ ...item, originalIndex: index }))
    .filter((item) => activeCategory === 'All' || item.category === activeCategory);
  const activeImage = activeImageIndex === null ? null : galleryItems[activeImageIndex];

  const showPreviousImage = useCallback(() => {
    setActiveImageIndex((current) => (current === null ? 0 : (current - 1 + galleryItems.length) % galleryItems.length));
  }, []);

  const showNextImage = useCallback(() => {
    setActiveImageIndex((current) => (current === null ? 0 : (current + 1) % galleryItems.length));
  }, []);

  useEffect(() => {
    if (activeImageIndex === null) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setActiveImageIndex(null);
      if (event.key === 'ArrowLeft') showPreviousImage();
      if (event.key === 'ArrowRight') showNextImage();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeImageIndex, showNextImage, showPreviousImage]);

  useEffect(() => {
    document.body.classList.toggle('about-lightbox-open', activeImageIndex !== null);
    return () => document.body.classList.remove('about-lightbox-open');
  }, [activeImageIndex]);

  return (
    <div className="about-page">
      <main id="about-top">
        <div className="about-page-top">
          <button className="about-back-button" type="button" onClick={() => navigate('/landingpage')}>
            <ArrowLeft size={17} />
            Back to Landing Page
          </button>
        </div>
        <section className="about-hero">
          <div className="about-hero-inner">
            <div className="about-hero-copy">
              <span className="about-eyebrow">MARINDUQUE STATE UNIVERSITY</span>
              <h1>About Marinduque State University Gymnasium</h1>
              <p className="about-hero-subtitle">Empowering Student-Athletes Through Sports, Leadership, and Excellence.</p>
              <p className="about-hero-intro">
                The University Gymnasium and Sports Unit support sports, physical education, and athlete development at Marinduque State University. Explore the Unit&apos;s leadership, history, facilities, and organization.
              </p>
              <a className="about-primary-link" href="#sports-unit">
                Discover the Sports Unit <ArrowRight size={17} />
              </a>
            </div>
            <PhotoFrame label="University Gymnasium" className="about-hero-photo" imageSrc={universityGymnasium} />
          </div>
          <a className="about-scroll-cue" href="#sports-unit">Scroll to explore</a>
        </section>

        <section id="sports-unit" className="about-section about-history-section">
          <div className="about-section-heading">
            <span className="about-eyebrow">OUR BACKGROUND</span>
            <h2>About the Sports Unit</h2>
            <p>
              The Sports Unit was established during the tenure of Mrs. Felomina M. Sapallo, Director for Sports, Physical Education, and Recreation (SPEAR). Leadership then passed to Mr. Jorge M. Mandia (2000–2005), followed by Dr. Diomenes L. Motaron, who served from 2005 until his retirement in 2024.
            </p>
          </div>

          <div className="about-timeline">
            {milestones.map((milestone, index) => (
              <details className="about-timeline-item" key={milestone.period} open={index === milestones.length - 1}>
                <summary>
                  <span className="about-timeline-marker">{String(index + 1).padStart(2, '0')}</span>
                  <span className="about-timeline-heading">
                    <span className="about-timeline-period">{milestone.period}</span>
                    <strong>{milestone.title}</strong>
                  </span>
                  <span className="about-timeline-toggle" aria-hidden="true">+</span>
                </summary>
                <p>{milestone.summary}</p>
              </details>
            ))}
          </div>
          <p className="about-history-note">
            Historical milestones retain the MSC name used in the original records; the institution is now Marinduque State University (MarSU).
          </p>
        </section>

        <section className="about-director-section">
          <div className="about-director-card">
            <div className="about-director-photo-wrap">
              <PhotoFrame label="Sports Director" className="about-director-photo" imageSrc={directorPhotograph} />
            </div>
            <div className="about-director-copy">
              <span className="about-eyebrow">SPORTS UNIT LEADERSHIP</span>
              <h2>Asst. Professor Gerald M. Pajanustan</h2>
              <p className="about-director-role">Director</p>
              <p>Marinduque State University Sports Unit</p>
              <a href="https://marsu.edu.ph/sports/" target="_blank" rel="noreferrer">
                Official Sports Unit reference <ArrowUpRight size={15} />
              </a>
            </div>
          </div>
        </section>

 

        <section className="about-organization-section">
          <div className="about-organization-copy">
            <span className="about-eyebrow">HOW WE ARE ORGANIZED</span>
            <h2>A team supporting university sports</h2>
            <p>The Sports Unit is composed of a Sports Director and four (4) support staff. Its Sports Manual has been approved by the MSC Board of Trustees for implementation.</p>
          </div>
          <div className="about-organization-visual">
            <div className="about-org-card about-org-director">
              <Users size={21} />
              <span>Sports Director</span>
            </div>
            <div className="about-org-connector" aria-hidden="true" />
            <div className="about-org-card about-org-staff">
              <Users size={21} />
              <span>Four (4) Support Staff</span>
            </div>
            <div className="about-manual-note">
              <BookOpen size={19} />
              <span>Sports Manual approved for implementation</span>
            </div>
          </div>
        </section>

        <section id="gallery" className="about-section about-gallery-section">
          <div className="about-section-heading">
            <span className="about-eyebrow">CAMPUS LIFE</span>
            <h2>Sports Photo Gallery</h2>
            <p>Gallery frames are ready for future University photographs.</p>
          </div>
          <div className="about-gallery-filters" role="group" aria-label="Filter gallery by category">
            {galleryCategories.map((category) => (
              <button
                type="button"
                key={category}
                className={activeCategory === category ? 'is-active' : ''}
                aria-pressed={activeCategory === category}
                onClick={() => setActiveCategory(category)}
              >
                {category}
              </button>
            ))}
          </div>
          <div className="about-gallery-grid">
            {filteredGallery.map((item) => (
              <button
                className="about-gallery-item"
                type="button"
                key={item.title}
                onClick={() => setActiveImageIndex(item.originalIndex)}
                aria-label={`Preview ${item.title}`}
              >
                <PhotoFrame label={item.title} className="about-gallery-photo" imageSrc={item.imageSrc} />
                <span className="about-gallery-caption">
                  <span>{item.title}<small>{item.category}</small></span>
                  <ArrowUpRight size={18} />
                </span>
              </button>
            ))}
          </div>
        </section>
      </main>

      {activeImage && (
        <div
          className="about-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={`Photo preview: ${activeImage.title}`}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setActiveImageIndex(null);
          }}
        >
          <button className="about-lightbox-close" type="button" onClick={() => setActiveImageIndex(null)} aria-label="Close preview">
            <X size={23} />
          </button>
          <button className="about-lightbox-arrow about-lightbox-previous" type="button" onClick={showPreviousImage} aria-label="Previous image">
            <ArrowLeft size={21} />
          </button>
          <div className="about-lightbox-content">
            <PhotoFrame label={activeImage.title} className="about-lightbox-photo" imageSrc={activeImage.imageSrc} />
            <div className="about-lightbox-caption">
              <strong>{activeImage.title}</strong>
              <span>{activeImageIndex + 1} of {galleryItems.length} · {activeImage.category}</span>
            </div>
          </div>
          <button className="about-lightbox-arrow about-lightbox-next" type="button" onClick={showNextImage} aria-label="Next image">
            <ArrowRight size={21} />
          </button>
        </div>

        
      )}
    </div>
  );
}

export default AboutPage;
