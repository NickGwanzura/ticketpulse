# Organizer onboarding due diligence

## Purpose

TicketPulse uses a light-touch organizer profile to understand who is listing events and how to contact them. The process is guided by the Reserve Bank of Zimbabwe (RBZ) 2025 AML/CFT/CPF guidance and POTRAZ data-protection requirements. These references inform our risk controls; they do not imply that TicketPulse has been classified or endorsed by either authority. Confirm TicketPulse's specific regulatory obligations with Zimbabwean counsel and its payment partners.

## Current baseline in the app

Organizer signup collects an account name, email, password, and WhatsApp contact. Organizer email verification is required before the user can proceed, and an admin separately approves organizer accounts. The onboarding profile now adds:

- organizer type: individual/sole trader, registered business, or community/other organisation;
- city and country;
- optional business or group name;
- optional website or social page for review;
- the existing optional public profile description.

The admin organizer list shows these details alongside email verification, contact information, approval state, and event history. WhatsApp is currently format-checked, not verified by OTP. This is a basic profile review, not identity-document verification or a declaration that full regulated customer due diligence has been completed.

The admin list also shows a profile completeness score out of 100. It awards points for an account name (15), verified email (20), a valid-looking WhatsApp number (20), organizer type (15), location (15), description (5), review reference link (5), and business/group name when applicable (5; not applicable to an individual). The score does not verify identity, phone ownership, legal status, or compliance and must not be used as an automatic approval threshold.

## Keep the first step simple

Do not request an ID scan, proof of address, company documents, date of birth, tax number, bank account, selfie, or biometric data during ordinary signup. Keep the first step to the account details above. For a specific concern, a payment-provider requirement, or a higher-risk case, request only the additional evidence needed to resolve that case and explain why it is needed.

Before releasing a payout, use the payout review process to confirm the settlement details are consistent with the organizer's account or registered organisation. Any new document collection or automated identity check should be designed and reviewed separately before it is introduced.

## Privacy and handling

- Use organizer information only for account contact, event-account review, event support, public-profile features the organizer chooses, and necessary payment or compliance checks.
- Keep private review material out of public media storage. Restrict access to staff who need it and log administrative review decisions.
- Set a retention period for any additional evidence and delete it when it is no longer needed, unless a legal or payment-partner obligation requires retention.
- Review hosting, processor agreements, and cross-border data handling before collecting identity documents or biometrics.
- Update this process and the privacy notice if collection purposes, fields, recipients, or retention practices change.

## Regulatory references

- [RBZ AML/CFT/CPF Guideline No. 01-2025/BSSFS](https://www.rbz.co.zw/documents/bank_sup/Guidelines_/AML_CFT_CPF_GUIDELINE_-_June_2025.pdf) describes risk-based customer due diligence for reporting institutions, including identification, verification, business purpose, authority to act, ownership/control, and enhanced review for higher-risk cases. Whether and how particular provisions apply to TicketPulse depends on its legal role and payment arrangements.
- [POTRAZ Cyber and Data Protection Act, 2021](https://www.potraz.gov.zw/wp-content/uploads/2022/02/Data-Protection-Act-5-of-2021.pdf) requires personal data to be relevant and not excessive for its purpose and not retained longer than necessary.
- [POTRAZ S.I. 155 of 2024](https://www.potraz.gov.zw/wp-content/uploads/2025/02/sI-155-of-2024-Cyber-and-Data-Protection-Normal_240913_1250178.pdf) sets out data-controller licensing, security, and related data-protection requirements. Check applicable licensing, DPO, processor, and cross-border handling obligations before adding more sensitive data.
- [Pesepay merchant onboarding guidance](https://developers.pesepay.com/getting-started/onboarding/) is a provider-specific reference only; it lists different documents for personal and corporate merchant registration and should not be treated as a universal TicketPulse organizer requirement.

## Review checklist for admins

1. Confirm the account email is verified and the supplied WhatsApp number is present.
2. Review organizer type, city/country, optional business/group name, public reference, and event history.
3. If details conflict or a payment partner or risk review needs more, contact the organizer and record what was requested and why.
4. Keep organizer approval, email verification, and any later identity or payout checks as distinct decisions.
