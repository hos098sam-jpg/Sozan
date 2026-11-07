import React, { useState } from 'react';
import {
  Users,
  UserPlus,
  X,
  Copy,
  Trash2,
  Edit,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  ClipboardCheck,
  BookOpen,
  ShieldCheck,
  KeyRound,
  Phone,
} from 'lucide-react';
import type { AssistantSpecialty, User } from '../types';
import {
  saveUsers,
  saveSingleUserToServer,
  addDeletedUserId,
  deleteUserFromServer,
} from '../data/initialData';
import { deleteUserFromFirestore, db } from '../auth';
import { doc, setDoc } from 'firebase/firestore';

interface Props {
  isOpen: boolean;
  teacher: User;
  allUsers: User[];
  onUpdateUsers: (users: User[]) => void;
  onClose: () => void;
}

export const ASSISTANT_SPECIALTIES: {
  id: AssistantSpecialty;
  label: string;
  shortLabel: string;
  desc: string;
  badgeColor: string;
  icon: React.FC<{ className?: string }>;
}[] = [
  {
    id: 'student_support',
    label: 'مسؤول عن الرد على الطلاب',
    shortLabel: 'الرد على الطلاب 💬',
    desc: 'يدخل فقط على قسم رسائل واستفسارات الطلاب والدعم الفني والمنتدى للرد عليهم دون عرض أي قسم آخر.',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    icon: MessageSquare,
  },
  {
    id: 'essay_grading',
    label: 'مسؤول عن تصحيح المقالي',
    shortLabel: 'تصحيح المقالي ✍️',
    desc: 'يدخل فقط على قسم تصحيح الأسئلة المقالية ومراجعة إجابات طلاب المدرس ورصد الدرجات دون عرض أي قسم آخر.',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
    icon: ClipboardCheck,
  },
  {
    id: 'content_management',
    label: 'مسؤول عن إضافة الدروس والمحتوى',
    shortLabel: 'إضافة الدروس والمحتوى 📚',
    desc: 'يدخل فقط على قسم إدارة كورسات المدرس وإضافة الدروس والفيديوهات وملفات PDF والامتحانات دون عرض أي قسم آخر.',
    badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    icon: BookOpen,
  },
];

export const getAssistantSpecialtyMeta = (specialty?: AssistantSpecialty) => {
  return (
    ASSISTANT_SPECIALTIES.find((s) => s.id === specialty) || ASSISTANT_SPECIALTIES[0]
  );
};

export const TeacherAssistantsModal: React.FC<Props> = ({
  isOpen,
  teacher,
  allUsers,
  onUpdateUsers,
  onClose,
}) => {
  const [editingAssistantId, setEditingAssistantId] = useState<string | null>(null);
  const [assistantName, setAssistantName] = useState('');
  const [assistantAccountNumber, setAssistantAccountNumber] = useState('');
  const [assistantPassword, setAssistantPassword] = useState('');
  const [assistantSpecialty, setAssistantSpecialty] = useState<AssistantSpecialty>('student_support');
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  if (!isOpen) return null;

  const teacherAssistants = allUsers.filter(
    (u) =>
      (u.role === 'assistant' || u.isAssistant) &&
      (u.assistantForTeacherId === teacher.id || u.assistantForTeacherName === teacher.name)
  );

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setFeedback({ text, type });
    setTimeout(() => setFeedback(null), 3500);
  };

  const resetForm = () => {
    setEditingAssistantId(null);
    setAssistantName('');
    setAssistantAccountNumber('');
    setAssistantPassword('');
    setAssistantSpecialty('student_support');
  };

  const handleEditClick = (assistant: User) => {
    setEditingAssistantId(assistant.id);
    setAssistantName(assistant.name);
    setAssistantAccountNumber(assistant.accountNumber || assistant.phone);
    setAssistantPassword(assistant.password || '');
    setAssistantSpecialty(assistant.assistantSpecialty || 'student_support');
  };

  const handleSaveAssistant = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = assistantName.trim();
    const cleanNumber = assistantAccountNumber.trim();
    const cleanPass = assistantPassword.trim();

    if (!cleanName) {
      showToast('يرجى إدخال اسم المدرس المساعد', 'error');
      return;
    }
    if (!cleanNumber) {
      showToast('يرجى كتابة الرقم الخاص بتسجيل دخول المدرس المساعد', 'error');
      return;
    }
    if (!cleanPass) {
      showToast('يرجى كتابة كلمة المرور للمدرس المساعد', 'error');
      return;
    }

    // Check duplicate login number with other users
    const duplicate = allUsers.some(
      (u) =>
        u.id !== editingAssistantId &&
        ((u.phone && u.phone.trim() === cleanNumber) ||
          (u.accountNumber && u.accountNumber.trim() === cleanNumber))
    );
    if (duplicate) {
      showToast('هذا الرقم مسجل بالفعل لحساب آخر على المنصة، يرجى اختيار رقم مختلف', 'error');
      return;
    }

    if (editingAssistantId) {
      let updatedAssistantObj: User | null = null;
      const updatedList = allUsers.map((u) => {
        if (u.id === editingAssistantId) {
          updatedAssistantObj = {
            ...u,
            name: cleanName,
            phone: cleanNumber,
            accountNumber: cleanNumber,
            password: cleanPass,
            role: 'assistant',
            isAssistant: true,
            assistantSpecialty,
            assistantForTeacherId: teacher.id,
            assistantForTeacherName: teacher.name,
            subject: teacher.subject || 'مادة عامة',
            specialty: teacher.specialty || 'عام',
            schoolYear: teacher.schoolYear || 'الصف الثالث الثانوي',
            status: 'active',
          };
          return updatedAssistantObj;
        }
        return u;
      });

      onUpdateUsers(updatedList);
      saveUsers(updatedList);
      if (updatedAssistantObj) {
        saveSingleUserToServer(updatedAssistantObj).catch(() => {});
        setDoc(doc(db, 'users', editingAssistantId), updatedAssistantObj, { merge: true }).catch(() => {});
      }
      showToast('تم تحديث بيانات وتخصص المدرس المساعد بنجاح ✅');
      resetForm();
    } else {
      const newAssistant: User = {
        id: `assistant-${Date.now()}`,
        name: cleanName,
        phone: cleanNumber,
        accountNumber: cleanNumber,
        password: cleanPass,
        parentPhone: '',
        schoolYear: teacher.schoolYear || 'الصف الثالث الثانوي',
        role: 'assistant',
        isAssistant: true,
        assistantSpecialty,
        assistantForTeacherId: teacher.id,
        assistantForTeacherName: teacher.name,
        subject: teacher.subject || 'مادة عامة',
        specialty: teacher.specialty || 'عام',
        status: 'active',
        registeredAt: new Date().toISOString().split('T')[0],
      };

      const updatedList = [...allUsers, newAssistant];
      onUpdateUsers(updatedList);
      saveUsers(updatedList);
      saveSingleUserToServer(newAssistant).catch(() => {});
      setDoc(doc(db, 'users', newAssistant.id), newAssistant, { merge: true }).catch(() => {});
      showToast(`تمت إضافة المدرس المساعد (${cleanName}) بنجاح! يمكنه الدخول الآن بالرقم والباسورد ✅`);
      resetForm();
    }
  };

  const handleDeleteAssistant = (assistant: User) => {
    addDeletedUserId(assistant.id);
    if (assistant.phone) addDeletedUserId(assistant.phone);
    if (assistant.accountNumber) addDeletedUserId(assistant.accountNumber);

    const updatedList = allUsers.filter((u) => u.id !== assistant.id);
    onUpdateUsers(updatedList);
    saveUsers(updatedList);
    deleteUserFromServer(assistant.id).catch(() => {});
    deleteUserFromFirestore(assistant.id).catch(() => {});
    if (editingAssistantId === assistant.id) {
      resetForm();
    }
    showToast(`تم حذف حساب المدرس المساعد (${assistant.name}) نهائياً`, 'error');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-xs animate-fadeIn overflow-y-auto"
      dir="rtl"
    >
      <div className="bg-white border border-slate-200 rounded-[32px] w-full max-w-3xl shadow-2xl p-5 sm:p-8 space-y-6 max-h-[92vh] overflow-y-auto my-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20 shrink-0">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-black text-slate-900">
                  إضافة وإدارة المدرسين المساعدين
                </h3>
                <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                  المدرس: {teacher.name}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">
                حدد تخصص المدرس المساعد ورقم الدخول وكلمة المرور، وعند تسجيل دخوله سيتم توجيهه فقط إلى القسم المخصص له دون عرض أي شيء آخر.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer shrink-0 transition-colors"
            title="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toast Feedback */}
        {feedback && (
          <div
            className={`p-3.5 rounded-2xl border text-xs font-black flex items-center gap-2.5 ${
              feedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
        )}

        {/* Form to Add / Edit Assistant */}
        <form
          onSubmit={handleSaveAssistant}
          className="p-5 rounded-3xl bg-slate-50 border border-slate-200/90 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-indigo-600" />
              <span>
                {editingAssistantId
                  ? 'تعديل بيانات المدرس المساعد'
                  : 'إضافة مدرس مساعد جديد لهذا المدرس'}
              </span>
            </h4>
            {editingAssistantId && (
              <button
                type="button"
                onClick={resetForm}
                className="text-xs font-black text-indigo-600 hover:underline cursor-pointer"
              >
                + إلغاء التعديل وإضافة مساعد جديد
              </button>
            )}
          </div>

          {/* Assistant Name, Login Number, Password */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-black text-slate-700 mb-1">
                اسم المدرس المساعد *
              </label>
              <input
                type="text"
                required
                value={assistantName}
                onChange={(e) => setAssistantName(e.target.value)}
                placeholder="مثال: أ. أحمد طارق (مساعد)"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
              />
            </div>

            <div>
              <label className="block text-xs font-black text-slate-700 mb-1">
                رقم الدخول للحساب (الذي سيسجل به) *
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={assistantAccountNumber}
                  onChange={(e) => setAssistantAccountNumber(e.target.value)}
                  placeholder="مثال: 01012345678 أو 5001"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-xs font-mono font-black focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                  dir="ltr"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-black text-slate-700 mb-1">
                كلمة المرور (الباسورد) *
              </label>
              <input
                type="text"
                required
                value={assistantPassword}
                onChange={(e) => setAssistantPassword(e.target.value)}
                placeholder="اكتب كلمة المرور..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-xs font-mono font-black focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                dir="ltr"
              />
            </div>
          </div>

          {/* Specialty Selection */}
          <div className="space-y-2">
            <label className="block text-xs font-black text-slate-700">
              تحديد تخصص المدرس المساعد (القسم الذي سيفتح له فقط عند تسجيل الدخول) *
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {ASSISTANT_SPECIALTIES.map((spec) => {
                const Icon = spec.icon;
                const isSelected = assistantSpecialty === spec.id;
                return (
                  <button
                    key={spec.id}
                    type="button"
                    onClick={() => setAssistantSpecialty(spec.id)}
                    className={`p-3.5 rounded-2xl border-2 text-right transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-600/20'
                        : 'bg-white hover:bg-slate-100/80 text-slate-800 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                          isSelected ? 'bg-white/20 text-white' : 'bg-indigo-50 text-indigo-600'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <span
                        className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                          isSelected
                            ? 'bg-amber-400 text-slate-950'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {isSelected ? 'محدد ✓' : 'اختر التخصص'}
                      </span>
                    </div>
                    <div>
                      <div className="text-xs font-black">{spec.label}</div>
                      <p
                        className={`text-[10px] mt-1 leading-relaxed ${
                          isSelected ? 'text-indigo-100' : 'text-slate-500'
                        }`}
                      >
                        {spec.desc}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="submit"
              className="px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs shadow-md shadow-indigo-600/20 flex items-center gap-2 cursor-pointer transition-all"
            >
              <UserPlus className="w-4 h-4" />
              <span>
                {editingAssistantId ? 'حفظ تعديلات المساعد' : 'إضافة وحفظ حساب المدرس المساعد'}
              </span>
            </button>
          </div>
        </form>

        {/* List of Existing Assistants for this Teacher */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>المدرسون المساعدون المسجلون مع ({teacher.name})</span>
            </h4>
            <span className="text-xs font-black px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
              {teacherAssistants.length} مساعد
            </span>
          </div>

          {teacherAssistants.length === 0 ? (
            <div className="p-8 rounded-3xl border border-dashed border-slate-300 bg-slate-50/50 text-center space-y-1">
              <p className="text-xs font-black text-slate-600">
                لا يوجد مدرسون مساعدون مضافون لهذا المدرس حتى الآن
              </p>
              <p className="text-[11px] text-slate-400">
                استخدم النموذج بالأعلى لإضافة مدرس مساعد وتحديد تخصصه ورقم الدخول والباسورد.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {teacherAssistants.map((assistant) => {
                const specMeta = getAssistantSpecialtyMeta(assistant.assistantSpecialty);
                const loginNum = assistant.accountNumber || assistant.phone;
                return (
                  <div
                    key={assistant.id}
                    className="p-4 rounded-2xl border border-slate-200 bg-white shadow-2xs flex flex-col justify-between gap-3"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h5 className="text-sm font-black text-slate-900">{assistant.name}</h5>
                          <span
                            className={`inline-block mt-1 text-[10px] font-black px-2.5 py-0.5 rounded-full border ${specMeta.badgeColor}`}
                          >
                            {specMeta.shortLabel}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleEditClick(assistant)}
                            className="p-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 transition-colors cursor-pointer"
                            title="تعديل بيانات المساعد"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteAssistant(assistant)}
                            className="p-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors cursor-pointer"
                            title="حذف حساب المساعد"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500 font-bold flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            <span>رقم الدخول:</span>
                          </span>
                          <div className="flex items-center gap-1">
                            <span
                              className="font-mono font-black text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200"
                              dir="ltr"
                            >
                              {loginNum}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(loginNum);
                                showToast('تم نسخ رقم دخول المساعد');
                              }}
                              className="p-1 text-slate-400 hover:text-indigo-600 cursor-pointer"
                              title="نسخ الرقم"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-slate-500 font-bold flex items-center gap-1">
                            <KeyRound className="w-3 h-3" />
                            <span>الباسورد:</span>
                          </span>
                          <span
                            className="font-mono font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100"
                            dir="ltr"
                          >
                            {assistant.password || '—'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-[10px] text-slate-500 font-bold border-t border-slate-100 pt-2">
                      يفتح له فقط: <span className="text-slate-800 font-black">{specMeta.label}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
