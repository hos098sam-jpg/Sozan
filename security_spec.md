# Security Specification — منصة المتفلسفة التعليمية (`sozan.pages.dev`)

1. **Zero-Trust Authentication (`src/main.tsx`, `src/auth.ts`, `LoginPage.tsx`, `AuthModal.tsx`, `SignupPage.tsx`)**:
   - All `window.fetch` static-hosting auth/enrollment/video-auth spoofing and hardcoded client admin passwords are removed.
   - Plaintext passwords are never stored in `User` objects, `localStorage`, or Firestore.
   - Public registration strictly sets `role: "student"`, `status: "active"`, `schoolYear: "الصف الأول الثانوي"`, `enrolledCourseIds: []`, `walletBalance: 0`.
2. **Firestore Security Rules (`firestore.rules`)**:
   - `users/{userId}`: `get` restricted to owner/admin/teacher/linked parent; `list` restricted to admin/teacher; client `create`/`update` cannot modify `role`, `status`, `enrolledCourseIds`, `walletBalance`, or store `password`.
   - `admins/{uid}`: read-only allowlist.
   - `al_motafalsifa_data/{docId}`: zero unauthenticated writes; public `get` allowed ONLY on catalog/settings (`courses`, `settings`, `competitions`, `notifications`, `bundles`); `users`, `users_chunk_*`, `accessCodes`, `submissions`, `exams`, `coupons`, `support_chats` locked strictly to verified Admin/Teacher.
   - `isEmailVerifiedAdmin()` requires `request.auth.token.email_verified == true`.
   - Default-deny catch-all rule (`match /{document=**} { allow read, write: if false; }`).
3. **Payment & Enrollment Integrity (`src/App.tsx`, `CourseDetailView.tsx`)**:
   - URL query parameters (`?payment_status=success`) never grant course enrollment on the client.
   - Pending transfer orders are created with `status == 'Pending'` and verified by Admin/Teacher or backend webhook.
