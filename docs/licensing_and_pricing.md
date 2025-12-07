# Licensing and Pricing

This document is the single authoritative specification for licensing, seats, and pricing for the platform. All other documents should reference this page when describing licensing or pricing behaviors.

## Licensing model
- **Organisations and users**
  - Every real user belongs to an Organisation.
  - Licensing is seat-based at the Organisation level; the product is sold to businesses only with no personal or free tiers.
  - Guests are invited collaborators and never consume seats.

- **Suites**
  - **Vendor Suite**: seller-focused tools (RevenueForge, seller ValueSphere, seller side of Engagement Rooms, seller dashboards).
  - **Buyer Suite**: buyer-focused tools (ProcurePath, buyer ValueSphere, buyer side of Engagement Rooms, RFX tooling).
  - **Both Suites**: users who require both perspectives (RevOps, Enablement, Executive stakeholders).
  - **Guest**: invited collaborator with limited access; no seat consumed.

- **Seat limits per Organisation**
  - `seatLimits.vendorSuite`
  - `seatLimits.buyerSuite`
  - `seatLimits.bothSuites`
  - **Total seats** = `vendorSuite + buyerSuite + bothSuites`.
  - Guests never consume seats.

## Pricing (USD, billed monthly)
- Vendor Suite seat: **$150 / user / month**
- Buyer Suite seat: **$190 / user / month**
- Both Suites seat: **$250 / user / month**
- Guests: **$0** (invited only)

## 200-seat threshold logic
- When `totalSeats ≤ 200`:
  - Self-serve seat purchase and adjustment is allowed.
- When `totalSeats > 200`:
  - Organisation must **Contact Sales** for a tailored quote.
  - The system records the request but does not automatically apply seat changes.

## Examples
- Example A: 50 Vendor + 30 Buyer + 20 Both = 100 total seats → `50×$150 + 30×$190 + 20×$250 = $28,700 / month`.
- Example B: 120 Vendor + 40 Buyer + 10 Both = 170 total seats → `120×$150 + 40×$190 + 10×$250 = $37,900 / month`.
- Example C: 180 Vendor + 30 Buyer + 15 Both = 225 total seats → `180×$150 + 30×$190 + 15×$250 = $47,700 / month` (exceeds 200 seats → Contact Sales required).
