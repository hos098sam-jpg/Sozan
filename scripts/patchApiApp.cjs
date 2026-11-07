const fs = require('fs');

const filePath = 'src/server/apiApp.ts';
let code = fs.readFileSync(filePath, 'utf8');

// 1. Add deleted IDs store before readDiskCourses
const oldCourseSetup = `const DEMO_COURSE_IDS = [
  'course-1821013405232',
  'course-sec2-chemistry',
  'course-sec3-mastery',
  'course-integrated-physics',
  'course-exams-chemistry',
];

function readDiskCourses(): any[] {
  ensureDataDir();
  try {
    if (fs.existsSync(COURSES_FILE)) {
      const content = fs.readFileSync(COURSES_FILE, "utf8");
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        cachedDiskCourses = parsed.filter((c: any) => c && c.id && !DEMO_COURSE_IDS.includes(c.id));
        return cachedDiskCourses;
      }
    }
  } catch (e) {
    console.warn("Could not read disk courses:", e);
    if (cachedDiskCourses !== null) return cachedDiskCourses;
  }
  cachedDiskCourses = [];
  return [];
}

function writeDiskCourses(courses: any[]): boolean {
  cachedDiskCourses = courses.filter((c: any) => c && c.id && !DEMO_COURSE_IDS.includes(c.id));
  ensureDataDir();
  fs.promises.writeFile(COURSES_FILE, JSON.stringify(cachedDiskCourses, null, 2), "utf8").catch((e) => {
    console.warn("Could not write disk courses:", e);
  });
  return true;
}`;

const newCourseSetup = `const DEMO_COURSE_IDS = [
  'course-1821013405232',
  'course-sec2-chemistry',
  'course-sec3-mastery',
  'course-integrated-physics',
  'course-exams-chemistry',
];

const DELETED_IDS_FILE = path.join(DATA_DIR, "deleted_ids.json");
interface DeletedIdsStore {
  courses: string[];
  users: string[];
}
function readDeletedIds(): DeletedIdsStore {
  ensureDataDir();
  try {
    if (fs.existsSync(DELETED_IDS_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(DELETED_IDS_FILE, "utf8"));
      return {
        courses: Array.isArray(parsed.courses) ? parsed.courses : [],
        users: Array.isArray(parsed.users) ? parsed.users : [],
      };
    }
  } catch {}
  return { courses: [], users: [] };
}
function addDeletedId(type: 'courses' | 'users', id: string) {
  if (!id) return;
  const store = readDeletedIds();
  if (!store[type].includes(id)) {
    store[type].push(id);
    ensureDataDir();
    fs.writeFileSync(DELETED_IDS_FILE, JSON.stringify(store, null, 2), "utf8");
  }
}

function readDiskCourses(): any[] {
  ensureDataDir();
  const deleted = readDeletedIds();
  try {
    if (fs.existsSync(COURSES_FILE)) {
      const content = fs.readFileSync(COURSES_FILE, "utf8");
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        cachedDiskCourses = parsed.filter((c: any) => c && c.id && !DEMO_COURSE_IDS.includes(c.id) && !deleted.courses.includes(c.id));
        return cachedDiskCourses;
      }
    }
  } catch (e) {
    console.warn("Could not read disk courses:", e);
    if (cachedDiskCourses !== null) return cachedDiskCourses;
  }
  cachedDiskCourses = [];
  return [];
}

function writeDiskCourses(courses: any[]): boolean {
  const deleted = readDeletedIds();
  cachedDiskCourses = courses.filter((c: any) => c && c.id && !DEMO_COURSE_IDS.includes(c.id) && !deleted.courses.includes(c.id));
  ensureDataDir();
  try {
    fs.writeFileSync(COURSES_FILE, JSON.stringify(cachedDiskCourses, null, 2), "utf8");
  } catch (e) {
    console.warn("Could not write disk courses:", e);
  }
  return true;
}`;

if (code.includes('function readDiskCourses(): any[] {')) {
  // Replace the readDiskCourses and writeDiskCourses
  const startIdx = code.indexOf('const DEMO_COURSE_IDS = [');
  const endIdx = code.indexOf('function readDiskExams(): any[] {');
  if (startIdx !== -1 && endIdx !== -1) {
    code = code.substring(0, startIdx) + newCourseSetup + '\n\n' + code.substring(endIdx);
    console.log('Successfully patched course persistence functions!');
  }
}

// 2. Fix app.get("/api/courses")
const oldGetCoursesMarker = 'app.get("/api/courses", async (req, res) => {';
const nextEndpointMarker = 'async function compressServerBase64Image(';

const startGetCourses = code.indexOf(oldGetCoursesMarker);
const endGetCourses = code.indexOf(nextEndpointMarker, startGetCourses);

if (startGetCourses !== -1 && endGetCourses !== -1) {
  const newGetCourses = `app.get("/api/courses", async (req, res) => {
  try {
    const diskCourses = readDiskCourses();
    const deleted = readDeletedIds();
    // Disk courses are authoritative on this server
    if (diskCourses && diskCourses.length > 0) {
      return res.json({ success: true, courses: diskCourses, deletedCourseIds: deleted.courses });
    }
    // Only fetch cloud if disk is completely empty
    const safeDb = getSafeFirestore();
    let cloudCourses: any[] = [];
    if (safeDb) {
      try {
        const docSnap = await safeDb.collection("qalbalelm_data").doc("courses").get();
        if (docSnap.exists && Array.isArray(docSnap.data()?.data)) {
          cloudCourses = docSnap.data()?.data;
        }
      } catch (e) {}
    }
    const cleanCloud = cloudCourses.filter((c: any) => c && c.id && !DEMO_COURSE_IDS.includes(c.id) && !deleted.courses.includes(c.id));
    if (cleanCloud.length > 0) {
      writeDiskCourses(cleanCloud);
    }
    res.json({ success: true, courses: cleanCloud, deletedCourseIds: deleted.courses });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Failed to load courses" });
  }
});\n\n`;

  code = code.substring(0, startGetCourses) + newGetCourses + code.substring(endGetCourses);
  console.log('Successfully patched app.get("/api/courses")!');
}

// 3. Fix app.delete("/api/courses/:id") to record in deleted_ids.json
const deleteMarker = 'app.delete("/api/courses/:id", async (req, res) => {';
const startDelete = code.indexOf(deleteMarker);
if (startDelete !== -1) {
  const insideDelete = 'const { id } = req.params;';
  const targetInside = code.indexOf(insideDelete, startDelete);
  if (targetInside !== -1) {
    code = code.substring(0, targetInside + insideDelete.length) + '\n    addDeletedId("courses", id);' + code.substring(targetInside + insideDelete.length);
    console.log('Successfully added addDeletedId to delete route!');
  }
}

// 4. Update /api/platform-data to include deletedCourseIds
const platformDataMarker = 'app.get("/api/platform-data", async (req, res) => {';
const startPlatformData = code.indexOf(platformDataMarker);
if (startPlatformData !== -1) {
  const targetReturn = 'res.json({\n      success: true,\n      courses: courses || [],';
  if (code.includes(targetReturn)) {
    code = code.replace(targetReturn, 'res.json({\n      success: true,\n      courses: courses || [],\n      deletedCourseIds: readDeletedIds().courses,');
    console.log('Successfully added deletedCourseIds to platform-data!');
  }
}

fs.writeFileSync(filePath, code, 'utf8');
console.log('Finished patching src/server/apiApp.ts!');
