import Image from "next/image"

const SLIDES = [
  { src: "/images/home-hero/concert.jpg", alt: "Outdoor concert in Zimbabwe" },
  { src: "/images/home-hero/dinner.jpg", alt: "Elegant outdoor dinner in Zimbabwe" },
  { src: "/images/home-hero/conference.jpg", alt: "Professional conference in Zimbabwe" },
  { src: "/images/home-hero/marathon.jpg", alt: "City marathon in Zimbabwe" },
] as const

export default function HeroBackgroundSlideshow() {
  return (
    <div className="absolute inset-0 -z-10 overflow-hidden bg-navy" aria-hidden="true">
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

      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,18,35,0.88)_0%,rgba(5,18,35,0.72)_48%,rgba(5,18,35,0.46)_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,18,35,0.10)_0%,rgba(5,18,35,0.34)_62%,rgba(5,18,35,0.82)_100%)]" />

      <style>{`
        @keyframes tp-hero-crossfade {
          0%, 21% { opacity: 1; transform: scale(1); }
          25%, 100% { opacity: 0; transform: scale(1.035); }
        }

        .tp-hero-slide {
          animation: tp-hero-crossfade 24s ease-in-out infinite;
          will-change: opacity, transform;
        }

        @media (prefers-reduced-motion: reduce) {
          .tp-hero-slide { animation: none; opacity: 0; transform: none; }
          .tp-hero-slide:first-child { opacity: 1; }
        }
      `}</style>
    </div>
  )
}
