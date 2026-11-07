import { Course, CourseLesson, LessonVideo, CourseExam, User } from '../types';

const COMPLETED_VIDEOS_STORAGE_KEY_PREFIX = 'qalb_alam_completed_videos_';

/**
 * Gets the record of completed videos from localStorage + user state
 */
export function getCompletedVideos(userId?: string): Record<string, boolean> {
  const result: Record<string, boolean> = {};
  
  if (typeof window !== 'undefined') {
    try {
      const key = `${COMPLETED_VIDEOS_STORAGE_KEY_PREFIX}${userId || 'guest'}`;
      const raw = localStorage.getItem(key);
      if (raw) {
        Object.assign(result, JSON.parse(raw));
      }
    } catch (e) {
      console.warn('Error reading completed videos from storage:', e);
    }
  }

  return result;
}

/**
 * Checks if a specific video has been completed
 */
export function isVideoCompleted(videoId: string, currentUser?: User | null): boolean {
  if (!videoId) return false;
  
  // 1. Check user state if available
  if (currentUser?.completedVideos && currentUser.completedVideos[videoId]) {
    return true;
  }

  // 2. Check local storage
  const stored = getCompletedVideos(currentUser?.id);
  return Boolean(stored[videoId]);
}

/**
 * Marks a video as completed and syncs with state / storage
 */
export function markVideoCompleted(
  videoId: string,
  currentUser?: User | null,
  onUpdateUser?: (updated: User) => void
): Record<string, boolean> {
  if (!videoId) return {};

  const currentRecords = getCompletedVideos(currentUser?.id);
  const updatedRecords = { ...currentRecords, [videoId]: true };

  if (typeof window !== 'undefined') {
    try {
      const key = `${COMPLETED_VIDEOS_STORAGE_KEY_PREFIX}${currentUser?.id || 'guest'}`;
      localStorage.setItem(key, JSON.stringify(updatedRecords));
      
      // Dispatch event so any listening UI updates instantaneously
      window.dispatchEvent(
        new CustomEvent('qalb_alam_video_completed', {
          detail: { videoId, userId: currentUser?.id },
        })
      );
    } catch (e) {
      console.warn('Error saving completed video to storage:', e);
    }
  }

  // If we have an active logged-in user and an updater callback, sync back to App state
  if (currentUser && onUpdateUser) {
    const updatedUser: User = {
      ...currentUser,
      completedVideos: {
        ...(currentUser.completedVideos || {}),
        [videoId]: true,
      },
    };
    onUpdateUser(updatedUser);
  }

  return updatedRecords;
}

/**
 * Finds or pairs the dedicated quiz for a given lesson video
 */
export function getVideoQuiz(
  lesson: CourseLesson,
  video: LessonVideo,
  videoIndex: number
): CourseExam | undefined {
  // 1. Directly attached quiz on video
  if (video.quiz) return video.quiz;

  // 2. Attached quiz by quizId
  if (video.quizId && lesson.exams) {
    const found = lesson.exams.find((e) => e.id === video.quizId);
    if (found) return found;
  }

  // 3. Exam matching video ID pattern
  if (lesson.exams) {
    const matchingById = lesson.exams.find(
      (e) => e.id === `quiz_${video.id}` || e.id === video.id
    );
    if (matchingById) return matchingById;

    // 4. Exam matching exact video title
    const matchingByTitle = lesson.exams.find(
      (e) => e.lessonTitle === video.title || e.title.includes(video.title)
    );
    if (matchingByTitle) return matchingByTitle;

    // 5. Fallback: pair by 1-to-1 index if exams exist in the lesson
    if (lesson.exams[videoIndex]) {
      return lesson.exams[videoIndex];
    }
  }

  return undefined;
}

/**
 * Checks if a video's quiz is unlocked
 * Rule: Quiz unlocks ONLY after the video itself is completed (watched)
 */
export function isLessonVideoQuizUnlocked(
  course: Course,
  lesson: CourseLesson,
  videoIndex: number,
  currentUser: User | null
): boolean {
  if (currentUser?.role === 'admin' || currentUser?.role === 'teacher') {
    return true;
  }

  // Video itself must be unlocked
  if (!isLessonVideoUnlocked(course, lesson, videoIndex, currentUser)) {
    return false;
  }

  const video = lesson.videos?.[videoIndex];
  if (!video) return false;

  // Video MUST be marked as completed/watched
  return isVideoCompleted(video.id, currentUser);
}

/**
 * Checks if a lesson video is unlocked
 * Rule:
 * - First video in lesson is unlocked (if lesson is unlocked)
 * - Video N is unlocked ONLY after Video N-1 is finished AND Quiz N-1 is passed!
 */
export function isLessonVideoUnlocked(
  course: Course,
  lesson: CourseLesson,
  videoIndex: number,
  currentUser: User | null
): boolean {
  if (currentUser?.role === 'admin' || currentUser?.role === 'teacher') {
    return true;
  }

  const lessonsList = course.lessons || [];
  const lessonIndex = lessonsList.findIndex((l) => l.id === lesson.id);

  // Lesson itself must be unlocked
  if (!isCourseLessonUnlocked(course, lessonIndex >= 0 ? lessonIndex : 0, currentUser)) {
    return false;
  }

  // First video is always unlocked if lesson is unlocked
  if (videoIndex <= 0) {
    return true;
  }

  // Check previous video
  const prevVideo = lesson.videos?.[videoIndex - 1];
  if (!prevVideo) return true;

  // If previous video has a quiz, it MUST be passed!
  const prevQuiz = getVideoQuiz(lesson, prevVideo, videoIndex - 1);
  if (prevQuiz) {
    if (!isVideoCompleted(prevVideo.id, currentUser)) {
      return false;
    }
    const prevResult = currentUser?.examResults?.[prevQuiz.id];
    if (!prevResult || !prevResult.passed) {
      return false;
    }
  }

  // Only enforce strict video-to-video sequential lock if course explicitly requires it
  if (course.requireSequentialLessons) {
    if (!isVideoCompleted(prevVideo.id, currentUser)) {
      return false;
    }
  }

  return true;
}

/**
 * Checks if a lesson is 100% completed
 * Rule: All videos watched AND all quizzes passed!
 */
export function isCourseLessonCompleted(
  course: Course,
  lesson: CourseLesson,
  currentUser: User | null
): boolean {
  const videos = lesson.videos || [];
  const exams = lesson.exams || [];

  if (videos.length === 0 && exams.length === 0) {
    return true;
  }

  // Check all videos and their attached quizzes
  for (let i = 0; i < videos.length; i++) {
    const vid = videos[i];
    if (!isVideoCompleted(vid.id, currentUser)) {
      return false;
    }

    const quiz = getVideoQuiz(lesson, vid, i);
    if (quiz) {
      const result = currentUser?.examResults?.[quiz.id];
      if (!result || !result.passed) {
        return false;
      }
    }
  }

  // Check standalone lesson exams
  for (const exam of exams) {
    const result = currentUser?.examResults?.[exam.id];
    if (!result || !result.passed) {
      return false;
    }
  }

  return true;
}

/**
 * Checks if a lesson is unlocked
 * Rule:
 * - Lesson 1 (index 0) is unlocked
 * - Lesson N is unlocked ONLY after Lesson N-1 is 100% completed!
 */
export function isCourseLessonUnlocked(
  course: Course,
  lessonIndex: number,
  currentUser: User | null
): boolean {
  if (currentUser?.role === 'admin' || currentUser?.role === 'teacher') {
    return true;
  }

  if (lessonIndex <= 0) {
    return true;
  }

  const lessons = course.lessons || [];
  const prevLesson = lessons[lessonIndex - 1];
  if (!prevLesson) {
    return true;
  }

  return isCourseLessonCompleted(course, prevLesson, currentUser);
}

/**
 * Calculates completion progress statistics for a lesson
 */
export function getLessonProgressStats(
  course: Course,
  lesson: CourseLesson,
  currentUser: User | null
): {
  totalSteps: number;
  completedSteps: number;
  percentage: number;
  isCompleted: boolean;
  uncompletedReason?: string;
} {
  const videos = lesson.videos || [];
  let totalSteps = 0;
  let completedSteps = 0;
  let uncompletedReason = '';

  videos.forEach((vid, idx) => {
    totalSteps += 1;
    const watched = isVideoCompleted(vid.id, currentUser);
    if (watched) {
      completedSteps += 1;
    } else if (!uncompletedReason) {
      uncompletedReason = `مشاهدة فيديو "${vid.title}"`;
    }

    const quiz = getVideoQuiz(lesson, vid, idx);
    if (quiz) {
      totalSteps += 1;
      const passed = Boolean(currentUser?.examResults?.[quiz.id]?.passed);
      if (passed) {
        completedSteps += 1;
      } else if (!uncompletedReason && watched) {
        uncompletedReason = `اجتياز كويز "${quiz.title}"`;
      }
    }
  });

  // Include any extra lesson exams
  (lesson.exams || []).forEach((exam) => {
    // Only if not already counted as video quiz
    const isAlreadyVideoQuiz = videos.some((v, i) => getVideoQuiz(lesson, v, i)?.id === exam.id);
    if (!isAlreadyVideoQuiz) {
      totalSteps += 1;
      const passed = Boolean(currentUser?.examResults?.[exam.id]?.passed);
      if (passed) {
        completedSteps += 1;
      } else if (!uncompletedReason) {
        uncompletedReason = `اجتياز امتحان "${exam.title}"`;
      }
    }
  });

  const percentage = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 100;
  const isCompleted = totalSteps === 0 || completedSteps >= totalSteps;

  return {
    totalSteps,
    completedSteps,
    percentage,
    isCompleted,
    uncompletedReason: isCompleted ? undefined : uncompletedReason,
  };
}

export interface DueVideoResult {
  lesson: CourseLesson;
  lessonIndex: number;
  video: LessonVideo;
  videoIndex: number;
  isCompleted: boolean;
  quiz?: CourseExam;
  isQuizPassed: boolean;
}

/**
 * Finds the exact video whose turn it is (الفيديو اللى عليه الدور) in the sequential curriculum
 */
export function getNextDueVideo(
  course: Course,
  currentUser: User | null
): DueVideoResult | null {
  if (!course.lessons || course.lessons.length === 0) return null;

  for (let lIdx = 0; lIdx < course.lessons.length; lIdx++) {
    const lesson = course.lessons[lIdx];
    if (!isCourseLessonUnlocked(course, lIdx, currentUser)) {
      continue;
    }

    const videos = lesson.videos || [];
    for (let vIdx = 0; vIdx < videos.length; vIdx++) {
      const vid = videos[vIdx];
      const isUnlocked = isLessonVideoUnlocked(course, lesson, vIdx, currentUser);
      if (!isUnlocked) continue;

      const isCompleted = isVideoCompleted(vid.id, currentUser);
      const quiz = getVideoQuiz(lesson, vid, vIdx);
      const quizResult = quiz ? currentUser?.examResults?.[quiz.id] : undefined;
      const isQuizPassed = Boolean(quizResult && quizResult.passed);

      // If this video is not completed, it is the one whose turn it is!
      if (!isCompleted) {
        return {
          lesson,
          lessonIndex: lIdx,
          video: vid,
          videoIndex: vIdx,
          isCompleted: false,
          quiz,
          isQuizPassed,
        };
      }

      // If video watched but quiz not passed yet, it remains the due checkpoint
      if (quiz && !isQuizPassed) {
        return {
          lesson,
          lessonIndex: lIdx,
          video: vid,
          videoIndex: vIdx,
          isCompleted: true,
          quiz,
          isQuizPassed: false,
        };
      }
    }
  }

  // Fallback: if all completed, return first video of first lesson
  const firstLesson = course.lessons[0];
  if (firstLesson && firstLesson.videos && firstLesson.videos.length > 0) {
    const v = firstLesson.videos[0];
    const quiz = getVideoQuiz(firstLesson, v, 0);
    return {
      lesson: firstLesson,
      lessonIndex: 0,
      video: v,
      videoIndex: 0,
      isCompleted: isVideoCompleted(v.id, currentUser),
      quiz,
      isQuizPassed: Boolean(quiz && currentUser?.examResults?.[quiz.id]?.passed),
    };
  }

  return null;
}
