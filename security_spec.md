# Security Specification — البرنامج الإسلامي الذهبي Firestore Rules

## 1. Data Invariants
1. **Default Deny Catch-All**: Unmatched paths (`/{document=**}`) deny all `read` and `write` operations.
2. **Email-Verified Identity & Path Ownership**: Every read and write on `/users/{userId}` and its subcollections (`testResults`, `bookmarks`) requires `request.auth != null`, `request.auth.token.email_verified == true`, `isValidId(userId)`, and `request.auth.uid == userId`.
3. **Master Gate Relational Sync on Subcollections**: Every write on `/users/{userId}/testResults/{resultId}` and `/users/{userId}/bookmarks/{bookmarkId}` verifies the parent user document exists (`exists(/databases/$(database)/documents/users/$(userId))`) and binds `incoming().uid == request.auth.uid == userId`.
4. **Strict Key & Type Schema Validation**: All writes validate exact required and allowed field sets (`hasAll` + `hasOnly`), string `.size()` bounds, integer ranges (`1 <= lastReadSurah <= 114`, `1 <= lastReadPage <= 604`, `0 <= score <= 100`), and regex-hardened IDs (`^[a-zA-Z0-9_\-]+$`).
5. **Temporal Integrity & Immutable Fields**: `createdAt` must equal `request.time` on creation and remain immutable (`incoming().createdAt == existing().createdAt`) on update; `uid` is immutable after creation; `updatedAt` must equal `request.time` on update.
6. **Action-Based Updates**: Updates on `/users/{userId}` are explicitly partitioned into named actions (`isSyncReadingAction()`, `isUpdatePreferencesAction()`, `isFullSyncAction()`) each guarded by `affectedKeys().hasOnly(...)` and `isValidUserSyncState(incoming())`.
7. **Secure List Queries**: `allow list` on `testResults` and `bookmarks` explicitly evaluates `resource.data.uid == request.auth.uid && request.auth.uid == userId`, never trusting client query filters alone and avoiding `get()` inside `list`.

## 2. The "Dirty Dozen" Attack Payloads (All Must Fail with PERMISSION_DENIED)
1. **Unauthenticated Read/Write**: Read or write `/users/u1` with `auth == null`.
2. **Unverified Email Write**: Authenticated user `u1` with `email_verified: false` attempts creating `/users/u1`.
3. **Cross-User Spoofing (`uid` mismatch)**: User `attacker` attempts creating `/users/victim` with `uid: "attacker"`.
4. **Body UID Poisoning**: User `u1` creates `/users/u1` with payload `uid: "otherUser"`.
5. **Shadow / Ghost Field Injection**: User `u1` sends `isAdmin: true` or `role: "admin"` inside `/users/u1`.
6. **Document ID Poisoning**: User `u1` writes `/users/u1/bookmarks/bad.id$123` violating `isValidId()`.
7. **Out-of-Bounds String (Denial of Wallet)**: User `u1` writes `displayName` with 500 characters (> 120 max).
8. **Out-of-Range Numeric State**: User `u1` writes `lastReadSurah: 999` or `score: 250` or `lastReadPage: 0`.
9. **Client-Forged Timestamp (`createdAt`)**: User `u1` creates `/users/u1` with `createdAt: "2020-01-01T00:00:00Z"` instead of `serverTimestamp()`.
10. **Immutable Field Mutation**: User `u1` updates `/users/u1` changing `createdAt` or `uid`.
11. **Orphaned Subcollection Write**: User `u1` attempts creating `/users/u1/testResults/r1` before `/users/u1` exists.
12. **Blanket Collection List**: User `u1` attempts listing `/users` root collection or `/users/u2/bookmarks`.
