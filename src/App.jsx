import { useEffect, useRef, useState } from 'react';
import { locales, localeCodes } from './marketing/locales.js';
import FeatureArt from './marketing/FeatureArt.jsx';

const Arrow = () => <span aria-hidden="true">↗</span>;
const sections = ['story', 'features', 'guide', 'support'];

export default function App({ locale = 'ko' }) {
  const c = locales[locale];
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef(null);
  const menuPanel = useRef(null);
  const languageSelect = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') { setMenuOpen(false); menuButton.current?.focus(); }
    };
    const onOutside = (e) => {
      if (!menuPanel.current?.contains(e.target) && !menuButton.current?.contains(e.target)) setMenuOpen(false);
    };
    const onResize = () => { if (window.innerWidth > 900) setMenuOpen(false); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onOutside);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onOutside);
      window.removeEventListener('resize', onResize);
    };
  }, [menuOpen]);

  const closeOnNavigate = (id) => {
    setMenuOpen(false);
    requestAnimationFrame(() => document.getElementById(id)?.focus({ preventScroll: true }));
  };

  return <>
    <a className="skip-link" href="#main">{c.skip}</a>
    <div className="night-opening">
      <header className="site-header shell">
        <a href={`/app/${locale}`} className="wordmark" aria-label="TAERYNEX">TAERYNEX</a>
        <nav className="desktop-nav" aria-label={c.navigation}>{c.nav.map((name, i) => <a key={name} href={`#${sections[i]}`}>{name}</a>)}</nav>
        <div className="header-actions">
          <label className="language-picker"><span aria-hidden="true">◎</span><span className="sr-only">{c.language}</span>
            <select ref={languageSelect} value={locale} aria-label={c.language} onChange={(e) => window.location.assign(`/app/${e.target.value}${window.location.hash}`)}>{localeCodes.map(code => <option key={code} value={code} lang={code}>{locales[code].name}</option>)}</select>
          </label>
          <a className="button button-gold header-cta" href="#join">{c.discover}<Arrow /></a>
          <button ref={menuButton} type="button" className={`menu-toggle${menuOpen ? ' is-open' : ''}`} aria-expanded={menuOpen} aria-controls="mobile-navigation" aria-label={menuOpen ? c.close : c.menu} onClick={() => setMenuOpen(!menuOpen)}><span /><span /></button>
        </div>
        <nav ref={menuPanel} id="mobile-navigation" className="mobile-nav" aria-label={c.navigation} hidden={!menuOpen}>
          {c.nav.map((name, i) => <a key={name} href={`#${sections[i]}`} onClick={() => closeOnNavigate(sections[i])}>{name}<Arrow /></a>)}
          <a href="#join" onClick={() => closeOnNavigate('join')}>{c.cta}<Arrow /></a>
        </nav>
      </header>
      <main id="main" tabIndex="-1">
        <section className="hero shell" aria-labelledby="hero-title">
          <svg className="hero-thread" viewBox="0 0 1280 300" preserveAspectRatio="none" fill="none" aria-hidden="true" focusable="false"><path d="M-30 207c105-35 151 30 246 45 128 22 123-64 261-68 100-3 109-111 197-135 106-30 132 47 248 49 137 2 181-85 388-59" stroke="#d8b675" strokeWidth="1.2"/></svg>
          <div className="hero-copy"><p className="eyebrow hero-eyebrow"><span />{c.eyebrow}</p>
            <h1 id="hero-title">{c.headline.map(line => <span key={line}>{line}</span>)}</h1><p className="hero-description">{c.subhead}</p>
            <div className="hero-buttons"><a className="button button-gold" href="#join">{c.cta}<Arrow /></a><a className="text-link light-link" href="#features">{c.explore}<span aria-hidden="true">↓</span></a></div>
            <p className="hero-availability"><span className="status-dot" aria-hidden="true" />{c.status}</p>
          </div>
          <figure className="hero-device"><div className="device-frame"><img src={`/brand/app-home-${locale}.webp`} alt={c.homeAlt} width="480" height="1040" fetchPriority="high" /></div><figcaption>{c.screenNote}</figcaption></figure>
          <a href="#story" className="hero-scroll"><span aria-hidden="true">↓</span>{c.scroll}</a>
        </section>
        <div className="paper">
          <section id="story" className="story-section shell section" tabIndex="-1" aria-labelledby="story-title"><p className="eyebrow">{c.storyLabel}</p><div className="story-grid"><h2 id="story-title">{c.storyTitle}</h2><div className="story-body"><p>{c.story[0]}</p><p>{c.story[1]}</p><span className="story-signature">TAERYNEX <span aria-hidden="true">·</span> 四柱</span></div></div></section>
          <section id="features" className="features-section shell section" tabIndex="-1" aria-labelledby="features-title">
            <div className="section-heading centered"><p className="eyebrow">{c.featuresLabel}</p><h2 id="features-title">{c.featuresTitle}</h2><p>{c.featuresIntro}</p></div>
            <div className="feature-grid">{c.features.map((feature, i) => <article className="feature-card" key={feature.name}><FeatureArt kind={i}/><p className="feature-index">0{i + 1} <span aria-hidden="true">/</span> {['四柱', '日運', '緣', '大運'][i]}</p><h3>{feature.name}</h3><p className="feature-summary">{feature.summary}</p>
              <details className="feature-details"><summary><span className="sr-only">{feature.name}{' '}</span><span className="when-closed">{c.more}</span><span className="when-open">{c.less}</span><span className="detail-plus" aria-hidden="true"><span>+</span></span></summary><div className="feature-expanded"><p>{feature.detail}</p>{i < 2 && <><img src={`/brand/app-${i === 0 ? 'saju' : 'calendar'}-${locale}.webp`} alt={`${feature.name} — ${c.screenNote}`} width="480" height="1040" loading="lazy" decoding="async"/><p className="capture-note">{c.screenNote}</p></>}</div></details>
            </article>)}</div>
          </section>
          <section className="relationships-section section" aria-labelledby="relationships-title"><div className="shell relationship-layout"><div className="relationship-intro"><p className="eyebrow">{c.relationsLabel}</p><h2 id="relationships-title">{c.relationshipTitle}</h2><p>{c.relationshipIntro}</p><div className="relationship-orbits" aria-hidden="true"><span/><span/><i>緣</i></div></div><div className="relationship-list">{c.relationships.map(([name, description], i) => <article key={name}><span className="relationship-number">0{i + 1}</span><div><h3>{name}</h3><p>{description}</p></div><span className="relationship-mark" aria-hidden="true">{['♡', '⌂', '❋', '◇'][i]}</span></article>)}</div></div></section>
          <section id="guide" className="guide-section shell section" tabIndex="-1" aria-labelledby="guide-title"><div className="section-heading centered"><p className="eyebrow">{c.guideLabel}</p><h2 id="guide-title">{c.guideTitle}</h2><p>{c.guideIntro}</p></div><ol className="guide-steps">{c.steps.map(([title, text], i) => <li key={title}><span className="step-number">0{i + 1}</span><h3>{title}</h3><p>{text}</p></li>)}</ol><div className="privacy-note"><span className="privacy-symbol" aria-hidden="true">◇</span><p><strong>{c.privacyTitle}</strong> {c.privacyNote}</p></div></section>
          <section id="support" className="faq-section shell section" tabIndex="-1" aria-labelledby="faq-title"><div className="faq-heading"><p className="eyebrow">{c.faqLabel}</p><h2 id="faq-title">{c.faqTitle}</h2><p>{c.faqIntro}</p><a className="text-link" href="mailto:taerynex@gmail.com">taerynex@gmail.com<Arrow /></a></div><div className="faq-list">{c.faq.map(([question, answer]) => <details key={question}><summary><span className="summary-text">{question}</span><span className="detail-plus" aria-hidden="true"><span>+</span></span></summary><p>{answer}</p></details>)}</div></section>
        </div>
        <section id="join" className="join-section section" tabIndex="-1" aria-labelledby="join-title"><div className="join-moon" aria-hidden="true"/><div className="shell join-content"><img src="/brand/app-icon.webp" alt="TAERYNEX" className="app-icon" width="72" height="72" loading="lazy"/><p className="eyebrow">TAERYNEX</p><h2 id="join-title">{c.closingTitle}</h2><p>{c.closingText}</p><a className="button button-gold" href="mailto:taerynex@gmail.com">{c.mail}<Arrow /></a><div className="platform-status"><p>{c.status}</p><p>{c.ios}</p></div><p className="join-note">{c.joinNote}</p></div></section>
      </main>
    </div>
    <footer className="site-footer"><div className="shell"><div className="footer-top"><a className="wordmark" href={`/app/${locale}`}>TAERYNEX</a><p>{c.footer}</p><a className="back-top" href="#main" aria-label={c.backTop}>↑</a></div><div className="footer-bottom"><p>© {new Date().getUTCFullYear()} TAERYNEX · Lee Sungjun</p><nav aria-label={c.legalNavigation}><a href={`/${locale}.html`}>{c.privacy}</a><a href={`/terms/${locale}.html`}>{c.terms}</a><a href="mailto:taerynex@gmail.com">{c.contact}</a><button type="button" onClick={() => { window.scrollTo({ top: 0, behavior: 'instant' }); languageSelect.current?.focus(); }}>{c.language}</button></nav></div><p className="legal-note">{c.notice}</p></div></footer>
  </>;
}
