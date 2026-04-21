# Security Specification - LinkHeart

## Data Invariants

- **Users**: A user document is only accessible by its owner (identified by the document ID matching the Auth UID).
- **Help Requests**:
    - Creation requires authentication.
    - `userId` must match `request.auth.uid`.
    - `status` must be `open` on creation.
    - `createdAt` must be correctly set to `request.time`.
    - Updates are allowed if:
        - The user is the owner (`userId` matches).
        - OR the user is a helper (authenticated) changing `status` from `open` to `matched`.
- **Transactions/Logs/Appointments/etc.** (Sub-collections of User): Strict owner-only access.

## The "Dirty Dozen" Payloads (Targeting HelpRequests)

1.  **Identity Spoofing**: Creating a request with `userId: "others-uid"`.
2.  **State Shortcut**: Creating a request with `status: "completed"`.
3.  **Resource Poisoning**: Document ID with 1MB junk string (handled by path variable hardening in rules).
4.  **Temporal Integrity**: Creating a request with `createdAt` set to 5 years in the future.
5.  **Illegal Field Injection**: Updating a request with `isVerified: true`.
6.  **Unauthorized Update**: Helper trying to change `userName` of a request they don't own.
7.  **Unauthorized State Jump**: Helper trying to change `status` from `matched` to `open` (reverting).
8.  **Unauthorized Delete**: Helper trying to delete a request they didn't create.
9.  **Unverified User Write**: User with `email_verified: false` trying to create a request (if policy mandates verification).
10. **Shadow Key Update**: Using `updateDoc` to add `arbitraryKey: 123` to a help request.
11. **Balance Manipulation**: Trying to update `walletBalance` in another user's profile.
12. **Status Poisoning**: Updating `status` to a value Not in the enum (e.g., `status: "broken"`).

## The Test Runner (Plan)

We will use `@firebase/rules-unit-testing` or similar if available, but since I cannot run tests in the environment conveniently without a full setup, I will focus on the logic in the rules.

*Note: In this environment, I'll generate the rules that prevent these.*
