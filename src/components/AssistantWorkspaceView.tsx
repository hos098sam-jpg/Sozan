import React, { useState } from 'react';
import {
  LogOut,
  MessageSquare,
  ClipboardCheck,
  BookOpen,
  ShieldCheck,
  GraduationCap,
} from 'lucide-react';
import type { AppView, Course, User } from '../types';
import { getAssistantSpecialtyMeta } from './TeacherAssistantsModal';
import { TeacherPermissionsDashboard } from './TeacherPermissionsDashboard';
import { AdminSupportChatTab } from './AdminSupportChatTab';
import { ForumView } from './ForumView';
import { WalletGatewayAdminTab } from './WalletGatewayAdminTab';
import { TeacherStudentsPage } from './TeacherStudentsPage';

interface Props {
  assistant: User;
  allCourses: Course[];
  allUsers: User[];
  onUpdateCourses: (courses: Course[]) => void;
  onUpdateUsers: (users: User[]) => void;
  onNavigate: (view: AppView) => void;
  onLogout: () => void;
}

export const AssistantWorkspaceView: React.FC<Props> = ({
  assistant,
  allCourses,
  allUsers,
  onUpdateCourses,
  onUpdateUsers,
  onNavigate,
  onLogout,
}) => {
  const specialty = assistant.assistantSpecialty || 'student_support';
  const specMeta = getAssistantSpecialtyMeta(specialty);
  const SpecIcon = specMeta.icon;

  // Resolve the parent teacher object so the assistant operates strictly on that teacher's courses/students
  const parentTeacher: User =
    allUsers.find(
      (u) =>
        u.role === 'teacher' &&
        !u.isAssistant &&
        (u.id === assistant.assistantForTeacherId ||
          (assistant.assistantForTeacherName && u.name === assistant.assistantForTeacherName))
    ) || {
      id: assistant.assistantForTeacherId || assistant.id,
      name: assistant.assistantForTeacherName || assistant.name,
      phone: assistant.phone,
      parentPhone: '',
      schoolYear: assistant.schoolYear || 'الصف الثالث الثانوي',
      subject: assistant.subject || 'مادة عامة',
      specialty: assistant.specialty || 'عام لجميع الشعب',
      role: 'teacher',
      registeredAt: assistant.registeredAt,
    };

  const [supportSubView, setSupportSubView] = useState<'tickets' | 'forum' | 'receipts' | 'parent_reports'>('tickets');

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col" dir="rtl">
      {/* Focused Isolated Top Header — Only shows Assistant Info & Logout */}
      <header className="bg-slate-950 text-white border-b border-slate-800 sticky top-0 z-40 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600/30 border border-indigo-400/40 flex items-center justify-center text-amber-300 shrink-0 shadow-md">
              <SpecIcon className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950">
                  بوابة المدرس المساعد • {specMeta.label}
                </span>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-200 border border-indigo-400/30 flex items-center gap-1">
                  <GraduationCap className="w-3.5 h-3.5" />
                  <span>تابع للمدرس: {parentTeacher.name}</span>
                </span>
              </div>
              <h1 className="text-lg sm:text-xl font-black mt-1">
                مرحباً بك، {assistant.name}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-auto">
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
              <ShieldCheck className="w-4 h-4" />
              <span>صلاحية مخصصة: {specMeta.shortLabel} فقط</span>
            </div>

            <button
              type="button"
              onClick={onLogout}
              className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs flex items-center gap-2 cursor-pointer transition-all shadow-md"
            >
              <LogOut className="w-4 h-4" />
              <span>تسجيل الخروج</span>
            </button>
          </div>
        </div>
      </header>

      {/* Isolated Workspace Content Based Strictly on Assistant Specialty */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
        {specialty === 'student_support' && (
          <div className="space-y-6 animate-fadeIn">
            {/* Switch between Direct Support Messages, Forum Questions, Payment Receipts, & Parent Reports */}
            <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-emerald-600" />
                  <span>بوابة المتابعة والدعم ومراجعة الإيصالات ({parentTeacher.name})</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  يمكنك الرد على محادثات الطلاب، مراجعة وتفعيل إيصالات الدفع، أو إرسال تقارير أولياء الأمور بضغطة زر.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 bg-slate-100 p-1.5 rounded-2xl self-start lg:self-auto">
                <button
                  type="button"
                  onClick={() => setSupportSubView('tickets')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    supportSubView === 'tickets'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  رسائل الدعم المباشرة 💬
                </button>
                <button
                  type="button"
                  onClick={() => setSupportSubView('receipts')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    supportSubView === 'receipts'
                      ? 'bg-amber-500 text-slate-950 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  مراجعة إيصالات الدفع 🧾
                </button>
                <button
                  type="button"
                  onClick={() => setSupportSubView('parent_reports')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    supportSubView === 'parent_reports'
                      ? 'bg-teal-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  تقارير ولي الأمر (واتساب) 📲
                </button>
                <button
                  type="button"
                  onClick={() => setSupportSubView('forum')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    supportSubView === 'forum'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  أسئلة المنتدى العلمي 🎓
                </button>
              </div>
            </div>

            {supportSubView === 'tickets' ? (
              <AdminSupportChatTab adminName={`${assistant.name} (مساعد ${parentTeacher.name})`} />
            ) : supportSubView === 'receipts' ? (
              <WalletGatewayAdminTab
                courses={allCourses}
                students={allUsers.filter((u) => u.role === 'student')}
                initialSubTab="orders"
              />
            ) : supportSubView === 'parent_reports' ? (
              <TeacherStudentsPage
                currentTeacher={parentTeacher}
                allCourses={allCourses}
                allStudents={allUsers}
                onNavigate={onNavigate}
              />
            ) : (
              <ForumView
                currentUser={{
                  ...assistant,
                  role: 'teacher',
                  name: `${assistant.name} (مساعد ${parentTeacher.name})`,
                }}
                onOpenAuth={() => {}}
              />
            )}
          </div>
        )}

        {specialty === 'essay_grading' && (
          <div className="space-y-5 animate-fadeIn">
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs flex items-center justify-between gap-4">
              <div>
                <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                  <ClipboardCheck className="w-5 h-5 text-amber-600" />
                  <span>قسم تصحيح الأسئلة المقالية لطلاب ({parentTeacher.name})</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  راجع إجابات الطلاب المقالية (النصية أو المصورة أو الصوتية) واعتمد الدرجات والتعليقات النموذجية.
                </p>
              </div>
            </div>

            <TeacherPermissionsDashboard
              currentTeacher={parentTeacher}
              allCourses={allCourses}
              allStudents={allUsers}
              onUpdateCourses={onUpdateCourses}
              onUpdateStudents={onUpdateUsers}
              onNavigate={onNavigate}
              onLogout={onLogout}
              lockedAssistantMode="essay_grading"
            />
          </div>
        )}

        {specialty === 'content_management' && (
          <div className="space-y-5 animate-fadeIn">
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs flex items-center justify-between gap-4">
              <div>
                <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-indigo-600" />
                  <span>قسم إضافة وإدارة الدروس والمحتوى للمدرس ({parentTeacher.name})</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  يمكنك إضافة وتعديل الكورسات ورفع الدروس والفيديوهات وملفات الـ PDF والامتحانات الخاصة بالمدرس فقط.
                </p>
              </div>
            </div>

            <TeacherPermissionsDashboard
              currentTeacher={parentTeacher}
              allCourses={allCourses}
              allStudents={allUsers}
              onUpdateCourses={onUpdateCourses}
              onUpdateStudents={onUpdateUsers}
              onNavigate={onNavigate}
              onLogout={onLogout}
              lockedAssistantMode="content_management"
            />
          </div>
        )}
      </main>
    </div>
  );
};
