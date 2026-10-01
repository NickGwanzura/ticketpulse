# Gupshup WhatsApp ticket bot

TicketPulse's WhatsApp adapter is wired for the existing Spiritus Gupshup app
for outbound text, ticket PDFs, images, and inbound ticket-checkout conversations.
OpenWA, WACRM, and Twilio are no longer supported by the application.

## Dokploy configuration

Set these service variables in Dokploy. Keep API keys and webhook secrets in
Dokploy's secret environment fields; do not commit them or paste them into chat.

```text
GUPSHUP_API_KEY=<Gupshup account API key>
GUPSHUP_APP_ID=<Gupshup app ID>
GUPSHUP_APP_NAME=Spiritus
GUPSHUP_SOURCE=263777816368
GUPSHUP_WEBHOOK_SECRET=<random secret, at least 32 characters>
WHATSAPP_COUNTRY_CODE=263
```

`GUPSHUP_SOURCE` is digits-only international format. The supplied sender
`0777816368` normalizes to `263777816368`. Use the exact application name and
registered sender shown in Gupshup if they differ from these values.

## Inbound webhook

In the Gupshup app's Webhooks settings, set the callback URL to:

```text
https://admin.ticketpulse.tech/api/webhooks/gupshup/whatsapp?token=<GUPSHUP_WEBHOOK_SECRET>
```

The endpoint checks the high-entropy token and configured app name, acknowledges
callbacks immediately, and processes text replies after the response. Gupshup
recommends allowlisting its callback IPs; request the current IP list from
Gupshup support and restrict ingress at the hosting/network layer where possible.

## WhatsApp policy limits

The ticket bot replies to a customer-initiated conversation. Gupshup/WhatsApp
free-form text and media are limited to the active customer-service window;
outside it, messages require an approved template and applicable opt-in. Ticket
PDF delivery may therefore fail if sent after the window closes. Bulk review
follow-ups are intentionally paused until TicketPulse has approved Gupshup
templates and explicit WhatsApp opt-in tracking. Email review follow-ups remain
available.

Gupshup's send API returning `submitted` means the provider accepted the send
request; it is not proof that WhatsApp delivered the message. Delivery-status
callbacks are acknowledged but are not currently used to update order delivery
records.
