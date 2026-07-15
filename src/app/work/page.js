"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import styles from "./work.module.css";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

export default function Work() {
  const pageRef = useRef(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Hero text reveal
      gsap.from(".hero-word", {
        y: "110%",
        opacity: 0,
        duration: 1.2,
        stagger: 0.06,
        ease: "power4.out",
        delay: 0.2,
      });

      gsap.from(".hero-sub", {
        opacity: 0,
        y: 30,
        duration: 1,
        ease: "power3.out",
        delay: 0.8,
      });

      gsap.from(".hero-stats-item", {
        opacity: 0,
        y: 20,
        duration: 0.8,
        stagger: 0.1,
        ease: "power3.out",
        delay: 1.2,
      });

      gsap.from(".hero-right-content", {
        opacity: 0,
        x: 30,
        duration: 1,
        ease: "power3.out",
        delay: 1.2,
      });

      // Horizontal rule reveals
      gsap.utils.toArray(".hr-reveal").forEach((el) => {
        gsap.from(el, {
          scaleX: 0,
          transformOrigin: "left",
          duration: 1.5,
          ease: "power3.inOut",
          scrollTrigger: { trigger: el, start: "top 90%" },
        });
      });

      // Privacy Notice Reveal
      gsap.from(".privacy-notice", {
        opacity: 0,
        y: 40,
        duration: 1,
        ease: "power3.out",
        scrollTrigger: { trigger: ".privacy-notice", start: "top 85%" }
      });

      // Process steps
      gsap.utils.toArray(".process-step").forEach((el, i) => {
        gsap.from(el, {
          opacity: 0,
          x: -30,
          duration: 0.8,
          ease: "power3.out",
          delay: i * 0.1,
          scrollTrigger: { trigger: el, start: "top 85%" },
        });
      });

      // Service cards
      gsap.utils.toArray(".service-card").forEach((el, i) => {
        gsap.from(el, {
          opacity: 0,
          y: 40,
          duration: 0.8,
          ease: "power3.out",
          delay: i * 0.08,
          scrollTrigger: { trigger: el, start: "top 85%" },
        });
      });

      // Testimonial cards
      gsap.utils.toArray(".testimonial-card").forEach((el, i) => {
        gsap.from(el, {
          opacity: 0,
          y: 50,
          duration: 0.9,
          ease: "power3.out",
          delay: i * 0.12,
          scrollTrigger: { trigger: el, start: "top 85%" },
        });
      });
    }, pageRef);

    return () => ctx.revert();
  }, []);

  return (
    <main className={styles.page} ref={pageRef}>

      {/* ── HERO ────────────────────────────────────────────────────────── */}
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.heroBadge}>
            <span className={styles.heroBadgeDot} />
            Independent Freelancer
          </div>

          <h1 className={styles.heroTitle}>
            {["UI/UX", "Developer."].map((word, i) => (
              <span key={i} className={styles.wordMask}>
                <span className="hero-word">{word}</span>
              </span>
            ))}
          </h1>

          <p className={`${styles.heroDesc} hero-sub`}>
            I help small vendors, local shops, and independent business owners bring their ideas into the digital world with clean, accessible, and high-converting interfaces.
          </p>

          <div className={styles.heroStats}>
            {[
              { n: "5+", l: "Projects Shipped" },
              { n: "2 Yrs", l: "Experience" },
              { n: "100%", l: "Client Privacy" },
              { n: "Local", l: "Businesses" },
            ].map((s) => (
              <div key={s.n} className={`${styles.statItem} hero-stats-item`}>
                <span className={styles.statNum}>{s.n}</span>
                <span className={styles.statLabel}>{s.l}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.heroRight}>
          <div className={`${styles.heroRightContent} hero-right-content`}>
            <p className={styles.heroRightEyebrow}>CORE FOCUS</p>
            <ul className={styles.heroRightList}>
              <li><span className={styles.listBullet}>◆</span> Minimalist UI/UX</li>
              <li><span className={styles.listBullet}>◆</span> Performant React Apps</li>
              <li><span className={styles.listBullet}>◆</span> Small Vendor Storefronts</li>
              <li><span className={styles.listBullet}>◆</span> Web Accessibility</li>
            </ul>
          </div>
        </div>
      </section>

      {/* ── PRIVACY NOTICE ────────────────────────────────────────────── */}
      <section className={styles.privacySection}>
        <div className={`${styles.privacyNotice} privacy-notice`}>
          <div className={styles.privacyIcon}>🔒</div>
          <h2 className={styles.privacyTitle}>A Note on Client Privacy</h2>
          <p className={styles.privacyDesc}>
            My clients are small business owners, local vendors, and independent shops. I build internal dashboards, custom storefronts, and digital tools that handle their daily operations and livelihoods. 
            <br/><br/>
            Because these tools are proprietary and highly sensitive, my clients do not grant permission for their internal platforms or websites to be publicly showcased in a portfolio. 
            <br/><br/>
            I adhere strictly to these NDAs to protect my clients. While you won't see glossy screenshots of their data here, my methodology, services, and the words of my clients below speak to the quality and impact of my work.
          </p>
        </div>
        <div className={`${styles.hr} hr-reveal`} />
      </section>

      {/* ── DESIGN PROCESS ─────────────────────────────────────────────── */}
      <section className={styles.processSection}>
        <div className={styles.processSplit}>
          <div className={styles.processLeft}>
            <div className={styles.sectionEyebrow}>HOW I WORK</div>
            <h2 className={styles.sectionHeadline}>A proven process — tailored for small business.</h2>
            <p className={styles.sectionSubtext}>
              I don't use overwhelming agency jargon. I use a straightforward, collaborative process to understand your shop's unique needs and build digital tools that actually help your business grow.
            </p>
          </div>
          <div className={styles.processRight}>
            {[
              { num: "01", title: "Listen & Understand", desc: "We sit down (virtually or locally) and discuss your business. I learn about your customers, your pain points, and what you actually need an app or website to do." },
              { num: "02", title: "Map & Wireframe", desc: "Before any coding happens, I create simple blueprints of the screens. This ensures we are perfectly aligned on how the tool will work before making it look pretty." },
              { num: "03", title: "Design & Review", desc: "I craft clean, modern, and accessible interfaces that represent your brand. We review the prototypes together and make adjustments based on your feedback." },
              { num: "04", title: "Develop & Handover", desc: "I write clean, fast Next.js/React code to bring the designs to life, ensuring everything works perfectly on mobile phones and desktop computers." },
            ].map((step) => (
              <div key={step.num} className={`${styles.processStep} process-step`}>
                <span className={styles.processNum}>{step.num}</span>
                <div>
                  <h3 className={styles.processTitle}>{step.title}</h3>
                  <p className={styles.processDesc}>{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SERVICES ───────────────────────────────────────────────────── */}
      <section className={styles.servicesSection}>
        <div className={styles.sectionEyebrow}>WHAT I DO</div>
        <h2 className={styles.sectionHeadline} style={{ marginBottom: "4rem", maxWidth: "700px" }}>
          End-to-end design &amp; development for independent vendors.
        </h2>
        <div className={styles.servicesGrid}>
          {[
            { icon: "✦", title: "UI Design", items: ["Custom Storefronts", "Brand Identity", "Mobile App UI", "Dark/Light Modes", "Accessible Layouts"] },
            { icon: "◈", title: "UX Research", items: ["Customer Interviews", "Competitor Research", "Easy Navigation", "Store Architecture", "Checkout Optimization"] },
            { icon: "⬡", title: "Prototyping", items: ["Figma Mockups", "Interactive Flows", "Clickable Prototypes", "Micro-animations", "Client Presentations"] },
            { icon: "</>", title: "Web Development", items: ["React / Next.js", "Fast Load Times", "Responsive Design", "SEO Best Practices", "Clean Code Architecture"] },
          ].map((service) => (
            <div key={service.title} className={`${styles.serviceCard} service-card`}>
              <span className={styles.serviceIcon}>{service.icon}</span>
              <h3 className={styles.serviceTitle}>{service.title}</h3>
              <ul className={styles.serviceList}>
                {service.items.map((item) => (
                  <li key={item} className={styles.serviceItem}>
                    <span className={styles.serviceCheck}>—</span> {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* ── TESTIMONIALS ───────────────────────────────────────────────── */}
      <section className={styles.testimonialsSection}>
        <div className={styles.sectionEyebrow}>WHAT PEOPLE SAY</div>
        <h2 className={styles.sectionHeadline} style={{ marginBottom: "4rem" }}>
          Trusted by local shops &amp; independent business owners.
        </h2>
        <div className={styles.testimonialsGrid}>
          {[
            { quote: "VGR helped our local bakery move into the digital age. He designed a beautiful, easy-to-use custom ordering site that our older customers have absolutely no trouble using. Highly recommended!", name: "Sarah Jenkins", role: "Owner, The Corner Bakery", initial: "S", color: "#F59E0B" },
            { quote: "I needed a simple dashboard to track inventory for my vendor stall. VGR sat down, listened to exactly what I needed, and built a UI that is so much better than the messy spreadsheets I was using.", name: "Marcus Chen", role: "Independent Retail Vendor", initial: "M", color: "#10B981" },
            { quote: "Our online boutique feels just as premium as our physical shop now. VGR's design process was clear, and he respected our brand's unique privacy needs throughout the entire project.", name: "Elena Rostova", role: "Founder, E&R Boutique", initial: "E", color: "#8B5CF6" },
          ].map((t) => (
            <div key={t.name} className={`${styles.testimonialCard} testimonial-card`}>
              <p className={styles.testimonialQuote}>&ldquo;{t.quote}&rdquo;</p>
              <div className={styles.testimonialAuthor}>
                <div className={styles.testimonialAvatar} style={{ background: t.color }}>{t.initial}</div>
                <div>
                  <p className={styles.testimonialName}>{t.name}</p>
                  <p className={styles.testimonialRole}>{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────────────── */}
      <section className={styles.cta}>
        <h2 className={styles.ctaTitle}>Let's build your digital presence.</h2>
        <p className={styles.ctaDesc}>Have a shop that needs an online storefront, or a business that needs a custom tool? Let's talk.</p>
        <Link href="/contact" className={styles.ctaBtn}>Start a Project →</Link>
      </section>

    </main>
  );
}
