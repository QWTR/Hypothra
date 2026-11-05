# Trailboard demo fixture

Trailboard is a synthetic route-planning product for this repository's tests.
Visitors can create a fake account, save a route, and inspect a mock premium offer.
The desktop signup path works. The mobile signup button is deliberately broken.
The location-denial path must fall back to manual route entry.

This server uses Node's built-in HTTP module. It has no database, real users,
external requests, outgoing email, or real payment processing. All records are
in-memory test data. Never enter real credentials.
