# Threat Modeling & Security Hardening

FoodRescue utilizes a robust multi-layered security architecture:

## Implemented Mitigations
1. **Broken Access Control & IDOR:** All requests verify organization memberships server-side using explicit SQLAlchemy session checks (`verify_org_membership`).
2. **Argon2id Hashing:** Password hashes use salt and key stretching parameters optimized to block modern hardware-accelerated dictionary attacks.
3. **Claim Concurrency:** Race conditions are mitigated via database row-level locking (`with_for_update()`), ensuring that concurrent requests to claim the same donation yield exactly one success.
4. **QR Code Replay Rejection:** QR handoffs use single-use tokens tracked in `custody_events`. A used token is immediately flagged and subsequent attempts are blocked.
