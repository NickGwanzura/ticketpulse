import Image from "next/image"

const SLIDES = [
  { src: "/images/home-hero/concert.jpg", alt: "Outdoor concert in Zimbabwe" },
  { src: "/images/home-hero/dinner.jpg", alt: "Elegant outdoor dinner in Zimbabwe" },
  { src: "/images/home-hero/conference.jpg", alt: "Professional conference in Zimbabwe" },
  { src: "/images/home-hero/marathon.jpg", alt: "City marathon in Zimbabwe" },
] as const

export default function HeroBackgroundSlideshow({ bright = false }: { bright?: boolean }) {
  return (
    <div className={`absolute inset-0 z-0 overflow-hidden ${bright ? "tp-hero-bright" : "bg-navy"}`} aria-hidden="true">
      {SLIDES.map((slide, index) => (
        <div
          key={slide.src}
          className="tp-hero-slide absolute inset-0 opacity-0"
          style={{ animationDelay: `${index * 6}s` }}
        >
          <Image
            src={slide.src}
            alt={slide.alt}
            fill
            sizes="100vw"
            className="object-cover object-center"
          />
        </div>
      ))}

      <div className={`${bright ? "tp-hero-overlay-horizontal-bright" : "tp-hero-overlay-horizontal"} absolute inset-0`} />
      <div className={`${bright ? "tp-hero-overlay-vertical-bright" : "tp-hero-overlay-vertical"} absolute inset-0`} />

      <style>{`
        @keyframes tp-hero-crossfade {
          0%, 21% { opacity: 1; transform: scale(1.01); }
          25%, 100% { opacity: 0; transform: scale(1.065); }
        }

        .tp-hero-slide {
          animation: tp-hero-crossfade 24s cubic-bezier(0.4, 0, 0.2, 1) infinite;
          will-change: opacity, transform;
          filter: saturate(0.92) contrast(1.04);
        }

        .tp-hero-bright .tp-hero-slide {
          animation-name: tp-hero-crossfade-bright;
        }

        @keyframes tp-hero-crossfade-bright {
          0%, 21% { opacity: 0.22; transform: scale(1); }
          25%, 100% { opacity: 0; transform: scale(1.035); }
        }

        .tp-hero-overlay-horizontal {
          background: linear-gradient(90deg, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.64) 52%, rgba(0,0,0,0.48) 100%);
        }

        .tp-hero-overlay-vertical {
          background: linear-gradient(180deg, rgba(0,0,0,0.16) 0%, rgba(0,0,0,0.22) 38%, rgba(0,0,0,0.82) 100%);
        }

        .tp-hero-bright::after,
        .tp-hero-slide::after {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background: radial-gradient(circle at 50% 42%, transparent 24%, rgba(0,0,0,0.2) 100%);
        }

        .tp-hero-overlay-horizontal-bright {
          background: linear-gradient(90deg, rgba(255, 157, 0, 0.2) 0%, rgba(214, 255, 57, 0.12) 55%, rgba(248, 255, 242, 0.2) 100%);
          mix-blend-mode: screen;
        }

        .tp-hero-overlay-vertical-bright {
          background: linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.12) 56%, rgba(248,255,242,0.56) 100%);
        }

        @media (max-width: 639px) {
          .tp-hero-slide { animation: none; display: none; }
          .tp-hero-slide:first-child { display: block; opacity: 1; transform: none; }
          .tp-hero-overlay-horizontal {
            background: linear-gradient(90deg, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.64) 52%, rgba(0,0,0,0.48) 100%);
          }
          .tp-hero-overlay-vertical {
            background: linear-gradient(180deg, rgba(0,0,0,0.12) 0%, rgba(0,0,0,0.34) 62%, rgba(0,0,0,0.78) 100%);
          }
          .tp-hero-bright .tp-hero-slide { animation: tp-hero-crossfade-bright 24s ease-in-out infinite; display: block; }
          .tp-hero-bright .tp-hero-slide:first-child { opacity: 0.22; }
          .tp-hero-overlay-horizontal-bright {
            background: linear-gradient(90deg, rgba(255, 157, 0, 0.18) 0%, rgba(214, 255, 57, 0.1) 100%);
          }
          .tp-hero-overlay-vertical-bright {
            background: linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.12) 55%, rgba(248,255,242,0.62) 100%);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .tp-hero-slide { animation: none; opacity: 0; transform: none; }
          .tp-hero-slide:first-child { opacity: 1; }
          .tp-hero-bright .tp-hero-slide:first-child { opacity: 0.22; }
        }
      `}</style>
    </div>
  )
}
