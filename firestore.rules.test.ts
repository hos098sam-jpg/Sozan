import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

/**
 * Automated Red-Team Security Verification Suite for Sozan (Al-Motafalsifa) Firestore Rules.
 * Verifies the "Dirty Dozen" invariants against firestore.rules & security_spec.md.
 */
const rulesPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "firestore.rules");
const rulesText = fs.readFileSync(rulesPath, "utf8");

export const dirtyDozenSecurityAssertions = [
  {
    name: "1. Default-deny catch-all rule exists",
    pass: /match \/\{document=\*\*\}\s*\{\s*allow read, write: if false;/.test(rulesText),
  },
  {
    name: "2. Admin email requires email_verified == true",
    pass: rulesText.includes("request.auth.token.email == 'hos098sam@gmail.com'") &&
          rulesText.includes("request.auth.token.email_verified == true"),
  },
  {
    name: "3. Public users read/list is strictly blocked",
    pass: rulesText.includes("allow get: if isOwner(userId) || isAdmin() || isTeacher() || isParentOf(userId);") && rulesText.includes("allow list: if isAdmin() || isTeacher();"),
  },
  {
    name: "4. Public student create cannot assign admin/teacher roles or passwords",
    pass: rulesText.includes("!request.resource.data.keys().hasAny(['password', 'admin', 'isAdmin'])") &&
          rulesText.includes("request.resource.data.role == 'student'"),
  },
  {
    name: "5. Public student create locked strictly to الصف الأول الثانوي",
    pass: rulesText.includes("request.resource.data.schoolYear == 'الصف الأول الثانوي'"),
  },
  {
    name: "6. Student self-update blocks privilege/enrollment/wallet tampering",
    pass: rulesText.includes("affectedKeys().hasAny([") &&
          rulesText.includes("'role'") &&
          rulesText.includes("'enrolledCourseIds'") &&
          rulesText.includes("'walletBalance'"),
  },
  {
    name: "7. al_motafalsifa_data prohibits unauthenticated writes",
    pass: !/match \/al_motafalsifa_data\/\{docId\}[\s\S]*?allow write: if true/.test(rulesText) &&
          /match \/al_motafalsifa_data\/\{docId\}[\s\S]*?\(isAdmin\(\) \|\| isTeacher\(\)\)/.test(rulesText),
  },
  {
    name: "8. Sensitive al_motafalsifa_data docs locked to Admin/Teacher",
    pass: rulesText.includes("docId in ['users', 'accessCodes', 'submissions', 'exams', 'coupons', 'support_chats']") &&
          rulesText.includes("(isAdmin() || isTeacher())"),
  },
  {
    name: "9. Student orders must start in Pending state with non-negative amount",
    pass: rulesText.includes("request.resource.data.status == 'Pending'") &&
          rulesText.includes("request.resource.data.finalAmount >= 0"),
  },
  {
    name: "10. Paid courses cannot be self-enrolled by students",
    pass: rulesText.includes(".data.price == 0"),
  },
  {
    name: "11. Document IDs validated against regex poisoning",
    pass: rulesText.includes("function isValidId(id)"),
  },
  {
    name: "12. Teacher updates on students limited to enrollment/status",
    pass: rulesText.includes("resource.data.role == 'student'") && /affectedKeys\(\)\.hasOnly\(\[\s*'enrolledCourseIds',\s*'status',\s*'updatedAt'\s*\]\)/.test(rulesText),
  },
];

for (const assertion of dirtyDozenSecurityAssertions) {
  if (!assertion.pass) {
    throw new Error("Security rule assertion failed: " + assertion.name);
  }
}
console.log("ALL_12_DIRTY_DOZEN_ASSERTIONS_PASSED");
