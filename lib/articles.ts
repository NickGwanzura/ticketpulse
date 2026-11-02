export type ArticleSection = {
  heading: string
  paragraphs: string[]
  event?: { label: string; href: string }
}

export type TicketPulseArticle = {
  slug: string
  title: string
  description: string
  excerpt: string
  category: string
  publishedAt: string
  sections: ArticleSection[]
  relatedEvent?: { label: string; href: string }
}

export const ARTICLES: TicketPulseArticle[] = [
  {
    slug: "december-events-harare-2026",
    title: "December Events in Harare 2026: Four Dates to Plan Around",
    description: "Plan December in Harare with four live TicketPulse listings: Royal Musiq SA, DRACOO!, Mono No Aware and a New Year's Eve prom.",
    excerpt: "From a live music night to a New Year’s countdown, here are four December 2026 events currently listed on TicketPulse, with dates and venue details.",
    category: "December event guide",
    publishedAt: "2026-11-02T12:00:00+02:00",
    sections: [
      {
        heading: "A December calendar with different kinds of nights out",
        paragraphs: [
          "December in Harare brings a mix of live music, late-night parties and end-of-year celebrations. TicketPulse currently lists four events across the month, giving you a few different ways to plan a night out or close out 2026.",
          "Event schedules and availability can change. Check the linked event page for the latest venue, entry, age and ticket information before making plans."
        ]
      },
      {
        heading: "13 December: Royal Musiq SA at Queen of Hearts",
        paragraphs: [
          "Pregame Entertainment presents South African artist Royal Musiq SA at Queen of Hearts in Harare on Sunday, 13 December. The listing describes an evening of music and live entertainment at the venue on Hurworth Road.",
          "The event page has the current ticket phases, venue directions and organizer contact details."
        ],
        event: { label: "View Royal Musiq SA tickets and event details", href: "/events/royal-musiq-sa-at-queen-of-hearts" }
      },
      {
        heading: "19 December: DRACOO! Past Curfew Mansion Party",
        paragraphs: [
          "The DRACOO! Past Curfew Mansion Party is listed for Saturday, 19 December, with the event description placing it in Borrowdale, Harare. The exact address is to be shared by the organizer, so check the event page before travelling.",
          "The organizer describes a 4 pm to 1 am party, a smart-casual dress code and entry for guests aged 20 and over with IDs checked. Confirm the latest details on the listing."
        ],
        event: { label: "View DRACOO! tickets and event details", href: "/events/dracoo-past-curfew-mansion-party" }
      },
      {
        heading: "21 December: Mono No Aware at Beach House",
        paragraphs: [
          "Mono No Aware is scheduled at Beach House in Harare on Monday, 21 December. Its listing describes a first Harare appearance and a gathering shaped by music, movement, fashion and sets from Zimbabwean selectors.",
          "The event page shows the current schedule, venue map and ticket phases."
        ],
        event: { label: "View Mono No Aware tickets and event details", href: "/events/mono-no-aware-in-harare" }
      },
      {
        heading: "31 December: New Year's Eve Prom 2026",
        paragraphs: [
          "For the final night of the year, New Year's Eve Prom 2026 is listed at DMAC Lifestyle Center, 40 James Martin Avenue, Harare. The event description promises dinner, music, dancing, live performances, special guests and a countdown to 2027.",
          "General Admission and VIP options are shown on the TicketPulse event page. Review the current ticket details and event schedule there before booking."
        ],
        event: { label: "View New Year's Eve Prom tickets and event details", href: "/events/new-year-s-eve-prom-2026" }
      },
      {
        heading: "Choose the date that fits your plans",
        paragraphs: [
          "If you want live music, start with the 13 or 21 December listings. For a late-night party, review the age and location notes for 19 December. If you are planning an end-of-year celebration, the 31 December prom is the month’s New Year’s Eve option in this guide.",
          "Browse the full TicketPulse calendar for newly published events and check each event page for the latest ticket availability."
        ],
        event: { label: "Browse upcoming events in Zimbabwe", href: "/events" }
      }
    ]
  },
  {
    slug: "royal-musiq-sa-harare-december-2026",
    title: "Royal Musiq SA in Harare: 13 December 2026 at Queen of Hearts",
    description: "What to know about Royal Musiq SA live in Harare on 13 December 2026: the Queen of Hearts venue, organizer information and TicketPulse booking page.",
    excerpt: "Pregame Entertainment brings South African artist Royal Musiq SA to Queen of Hearts in Harare on Sunday, 13 December.",
    category: "Live music",
    publishedAt: "2026-11-02T12:00:00+02:00",
    sections: [
      {
        heading: "A December date for Harare music fans",
        paragraphs: [
          "Royal Musiq SA is scheduled to perform at Queen of Hearts in Harare on Sunday, 13 December 2026. The event is presented by Pregame Entertainment, which describes an evening of music, high energy and live entertainment.",
          "The TicketPulse listing gives the venue as Queen of Hearts on Hurworth Road and includes directions and organizer contact details."
        ]
      },
      {
        heading: "Check the event page before you go",
        paragraphs: [
          "Ticket phases and availability can change as the date approaches. Use the official TicketPulse listing to review current prices, entry options, the schedule and venue directions before booking or travelling."
        ],
        event: { label: "See the live Royal Musiq SA listing", href: "/events/royal-musiq-sa-at-queen-of-hearts" }
      }
    ],
    relatedEvent: { label: "Royal Musiq SA at Queen of Hearts", href: "/events/royal-musiq-sa-at-queen-of-hearts" }
  },
  {
    slug: "dracoo-past-curfew-harare-december-2026",
    title: "DRACOO! Past Curfew: Harare Mansion Party on 19 December",
    description: "Plan for DRACOO! Past Curfew Mansion Party in Borrowdale, Harare, on 19 December 2026. Check TicketPulse for age, venue and ticket updates.",
    excerpt: "A late-night December party in Borrowdale, with the exact address shared by the organizer. Here are the details listed so far.",
    category: "December nightlife",
    publishedAt: "2026-11-02T12:00:00+02:00",
    sections: [
      {
        heading: "A late-night party in Borrowdale",
        paragraphs: [
          "DRACOO! Past Curfew Mansion Party is listed for Saturday, 19 December 2026. The event description places the party in Borrowdale, Harare, and gives a planned window from 4 pm to 1 am.",
          "The public listing currently says the exact location is to be shared on the day. Check with the organizer through the TicketPulse event page before arranging transport."
        ]
      },
      {
        heading: "Review the entry requirements",
        paragraphs: [
          "The organizer describes a smart-casual dress code and a strict 20+ age requirement, with IDs checked at entry. Early Bird tickets are listed, while other ticket phases may open later. Confirm current entry rules and availability before purchasing."
        ],
        event: { label: "Check DRACOO! ticket availability and updates", href: "/events/dracoo-past-curfew-mansion-party" }
      }
    ],
    relatedEvent: { label: "DRACOO! Past Curfew Mansion Party", href: "/events/dracoo-past-curfew-mansion-party" }
  },
  {
    slug: "mono-no-aware-harare-december-2026",
    title: "Mono No Aware Comes to Harare on 21 December 2026",
    description: "Mono No Aware is scheduled at Beach House, Harare, on 21 December 2026. Read the event details and find tickets on TicketPulse.",
    excerpt: "The Cape Town act’s first Harare appearance is listed for Beach House, with music, movement, fashion and Zimbabwean selectors.",
    category: "Concerts and music",
    publishedAt: "2026-11-02T12:00:00+02:00",
    sections: [
      {
        heading: "First Harare appearance at Beach House",
        paragraphs: [
          "Mono No Aware is scheduled to play Beach House in Harare on Monday, 21 December 2026. The event description says the act is travelling from Cape Town for its first appearance in Harare.",
          "The listing frames the event around self-expression, movement and fashion, with music curated by selectors from Zimbabwe’s music scene."
        ]
      },
      {
        heading: "Tickets and venue details",
        paragraphs: [
          "The event page shows the current ticket phases, a map for Beach House and the latest schedule. Check that listing for availability and updates before you make plans."
        ],
        event: { label: "View Mono No Aware tickets and event details", href: "/events/mono-no-aware-in-harare" }
      }
    ],
    relatedEvent: { label: "Mono No Aware in Harare", href: "/events/mono-no-aware-in-harare" }
  },
  {
    slug: "new-years-eve-prom-harare-2026",
    title: "New Year's Eve Prom 2026 in Harare: Dinner, Dancing and a Countdown",
    description: "Celebrate New Year's Eve in Harare at the 2026 prom at DMAC Lifestyle Center on 31 December. Check TicketPulse for current tickets and details.",
    excerpt: "The New Year's Eve Prom is listed at DMAC Lifestyle Center on 31 December, with dinner, music, live performances and a countdown to 2027.",
    category: "New Year's Eve",
    publishedAt: "2026-11-02T12:00:00+02:00",
    sections: [
      {
        heading: "Welcome 2027 in Harare",
        paragraphs: [
          "New Year's Eve Prom 2026 is scheduled for Thursday, 31 December at DMAC Lifestyle Center, 40 James Martin Avenue, Harare. The event description sets out a night with dinner, music, dancing, live performances, special guests and a countdown to 2027.",
          "The published schedule runs from 6 pm on 31 December to 2 am on 1 January, Harare time."
        ]
      },
      {
        heading: "Choose your ticket and confirm the schedule",
        paragraphs: [
          "General Admission and VIP options are listed on TicketPulse. Ticket availability and event information may change, so check the live page for the latest details before you book."
        ],
        event: { label: "See New Year's Eve Prom tickets and event details", href: "/events/new-year-s-eve-prom-2026" }
      }
    ],
    relatedEvent: { label: "New Year's Eve Prom 2026", href: "/events/new-year-s-eve-prom-2026" }
  }
]
