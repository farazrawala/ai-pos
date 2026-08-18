import { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, Menu, X } from 'lucide-react';
import Logo from '../Logo.jsx';
import Button from '../Button/Button.jsx';
import { navLinks } from '../../data/nav.js';
import { site } from '../../config.js';

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(null);
  const navId = useId();
  const wrapRef = useRef(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
        setMenu(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const onClick = (event) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) setMenu(null);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const closeAll = () => {
    setOpen(false);
    setMenu(null);
  };

  return (
    <header className={`oh-nav${scrolled ? ' is-scrolled' : ''}${open ? ' is-open' : ''}`}>
      <div className="oh-nav__inner" ref={wrapRef}>
        <a href="#top" className="oh-nav__brand" onClick={closeAll}>
          <Logo />
        </a>

        <nav className="oh-nav__links" aria-label="Primary">
          {navLinks.map((link) =>
            link.items ? (
              <div
                key={link.id}
                className={`oh-nav__item${menu === link.id ? ' is-open' : ''}`}
                onMouseEnter={() => setMenu(link.id)}
                onMouseLeave={() => setMenu(null)}
              >
                <button
                  type="button"
                  className="oh-nav__link"
                  aria-expanded={menu === link.id}
                  aria-haspopup="true"
                  aria-controls={`${navId}-${link.id}`}
                  onClick={() => setMenu((prev) => (prev === link.id ? null : link.id))}
                >
                  {link.label}
                  <ChevronDown size={16} aria-hidden="true" />
                </button>
                <div id={`${navId}-${link.id}`} className="oh-nav__dropdown" role="menu">
                  {link.items.map((item) => (
                    <a key={item.label} href={item.href} role="menuitem" onClick={closeAll}>
                      {item.label}
                    </a>
                  ))}
                </div>
              </div>
            ) : (
              <a key={link.id} className="oh-nav__link" href={link.href}>
                {link.label}
              </a>
            )
          )}
        </nav>

        <div className="oh-nav__actions">
          <a className="oh-nav__login" href={site.urls.login}>
            Login
          </a>
          <Button href={site.urls.signup} size="sm">
            Start Free
          </Button>
          <button
            type="button"
            className="oh-nav__burger"
            aria-expanded={open}
            aria-controls={`${navId}-drawer`}
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      <div id={`${navId}-drawer`} className="oh-nav__drawer" hidden={!open}>
        <nav aria-label="Mobile">
          {navLinks.map((link) => (
            <div key={link.id} className="oh-nav__drawer-group">
              {link.href ? (
                <a href={link.href} onClick={closeAll}>
                  {link.label}
                </a>
              ) : (
                <>
                  <p>{link.label}</p>
                  {link.items.map((item) => (
                    <a key={item.label} href={item.href} onClick={closeAll}>
                      {item.label}
                    </a>
                  ))}
                </>
              )}
            </div>
          ))}
          <div className="oh-nav__drawer-cta">
            <Button href={site.urls.login} variant="secondary">
              Login
            </Button>
            <Button href={site.urls.signup}>Get Started</Button>
          </div>
        </nav>
      </div>
    </header>
  );
}
