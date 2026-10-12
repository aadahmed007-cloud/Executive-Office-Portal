import React, { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useI18n } from '../../i18n/i18nContext';
import {
  Users,
  UserPlus,
  ShieldAlert,
  KeyRound,
  UserCheck,
  UserX,
  Copy,
  Check,
  AlertTriangle,
  RefreshCw,
  Search,
  Lock,
  Shield,
  Clock,
  X
} from 'lucide-react';

interface ManagedUser {
  id: string;
  username: string;
  name: string;
  title: string;
  department_id: string;
  email: string;
  role: 'CHAIRMAN' | 'SECRETARY' | 'ADMIN';
  can_view_confidential: boolean;
  must_change_password: boolean;
  is_disabled: boolean;
  avatar?: string | null;
  created_at: string;
  last_login_at?: string | null;
}

export const UsersManagementView: React.FC = () => {
  const { currentUser } = useAuth();
  const { t, formatDate, formatNumber } = useI18n();

  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editUser, setEditUser] = useState<ManagedUser | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    action: 'disable' | 'enable' | 'reset-password' | 'save-edit';
    user: ManagedUser;
    typedPhrase?: string;
  } | null>(null);

  // New password reveal state
  const [revealedPasswordData, setRevealedPasswordData] = useState<{
    username: string;
    name: string;
    tempPass: string;
    isNewUser: boolean;
  } | null>(null);
  const [copiedPass, setCopiedPass] = useState(false);

  // Form states
  const [createForm, setCreateForm] = useState({
    username: '',
    name: '',
    title: '',
    email: '',
    role: 'SECRETARY' as 'CHAIRMAN' | 'SECRETARY' | 'ADMIN',
    department_id: 'dept-exec',
    can_view_confidential: false
  });

  const [editForm, setEditForm] = useState({
    name: '',
    title: '',
    email: '',
    role: 'SECRETARY' as 'CHAIRMAN' | 'SECRETARY' | 'ADMIN',
    can_view_confidential: false,
    confirmation_phrase: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchUsers = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/admin/users', {
        headers: {
          'X-Requested-With': 'XMLHttpRequest'
        },
        credentials: 'same-origin'
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'فشل تحميل بيانات المستخدمين');
      }
      const data = await res.json();
      setUsers(data);
    } catch (err: any) {
      setErrorMessage(err.message || 'حدث خطأ أثناء تحميل المستخدمين');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        credentials: 'same-origin',
        body: JSON.stringify(createForm)
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'تعذر إنشاء الحساب');
      }

      setIsCreateModalOpen(false);
      setCreateForm({
        username: '',
        name: '',
        title: '',
        email: '',
        role: 'SECRETARY',
        department_id: 'dept-exec',
        can_view_confidential: false
      });
      setRevealedPasswordData({
        username: data.user.username,
        name: data.user.name,
        tempPass: data.temporary_password,
        isNewUser: true
      });
      setSuccessMessage(`تم إنشاء حساب المستخدم (@${data.user.username}) بنجاح`);
      await fetchUsers();
    } catch (err: any) {
      setErrorMessage(err.message || 'فشلت عملية إنشاء المستخدم');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditModal = (u: ManagedUser) => {
    setEditUser(u);
    setEditForm({
      name: u.name,
      title: u.title,
      email: u.email,
      role: u.role,
      can_view_confidential: u.can_view_confidential,
      confirmation_phrase: ''
    });
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUser) return;

    const isSecurityChanged =
      editForm.role !== editUser.role ||
      editForm.can_view_confidential !== editUser.can_view_confidential;

    if (isSecurityChanged && editForm.confirmation_phrase !== 'تأكيد التعديل الأمني') {
      setErrorMessage('تعديل الصلاحيات أو الرتبة يتطلب كتابة عبارة التأكيد بدقة: "تأكيد التعديل الأمني"');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/admin/users/${editUser.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        credentials: 'same-origin',
        body: JSON.stringify(editForm)
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'تعذر تعديل بيانات الحساب');
      }

      setEditUser(null);
      setSuccessMessage(`تم تحديث بيانات المستخدم (@${data.user.username}) بنجاح`);
      await fetchUsers();
    } catch (err: any) {
      setErrorMessage(err.message || 'فشلت عملية تحديث المستخدم');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDisableUser = async (user: ManagedUser) => {
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/admin/users/${user.id}/disable`, {
        method: 'POST',
        headers: {
          'X-Requested-With': 'XMLHttpRequest'
        },
        credentials: 'same-origin'
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'تعذر تعطيل الحساب');
      }

      setConfirmModal(null);
      setSuccessMessage(`تم تعطيل الحساب (@${user.username}) بنجاح وإلغاء جلساته`);
      await fetchUsers();
    } catch (err: any) {
      setErrorMessage(err.message || 'فشلت عملية تعطيل الحساب');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEnableUser = async (user: ManagedUser) => {
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/admin/users/${user.id}/enable`, {
        method: 'POST',
        headers: {
          'X-Requested-With': 'XMLHttpRequest'
        },
        credentials: 'same-origin'
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'تعذر تفعيل الحساب');
      }

      setConfirmModal(null);
      setSuccessMessage(`تم إعادة تفعيل الحساب (@${user.username}) بنجاح`);
      await fetchUsers();
    } catch (err: any) {
      setErrorMessage(err.message || 'فشلت عملية تفعيل الحساب');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async (user: ManagedUser) => {
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/admin/users/${user.id}/reset-password`, {
        method: 'POST',
        headers: {
          'X-Requested-With': 'XMLHttpRequest'
        },
        credentials: 'same-origin'
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'تعذر إعادة تعيين كلمة المرور');
      }

      setConfirmModal(null);
      setRevealedPasswordData({
        username: user.username,
        name: user.name,
        tempPass: data.temporary_password,
        isNewUser: false
      });
      setSuccessMessage(`تمت إعادة تعيين كلمة المرور للمستخدم (@${user.username}) بنجاح`);
      await fetchUsers();
    } catch (err: any) {
      setErrorMessage(err.message || 'فشلت عملية إعادة تعيين كلمة المرور');
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPass(true);
    setTimeout(() => setCopiedPass(false), 2500);
  };

  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      u.name.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.title.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Banner & Control Actions */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-slate-900 text-emerald-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">إدارة المستخدمين وحسابات النظام</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                إدارة دورة حياة الحسابات وتصاريح الاطلاع الأمني وتعيين كلمات المرور المؤقتة لمسؤولي النظام
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            onClick={fetchUsers}
            disabled={isLoading}
            className="p-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            title="تحديث قائمة الحسابات"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex-1 md:flex-initial px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>إضافة مستخدم جديد</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-rose-500 hover:text-rose-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-500 hover:text-emerald-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
        <Search className="w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="البحث بالاسم أو اسم المستخدم أو البريد الإلكتروني أو المسمى الوظيفي..."
          className="w-full text-xs text-slate-800 bg-transparent focus:outline-none"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} className="text-xs text-slate-400 hover:text-slate-600">
            مسح
          </button>
        )}
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <th className="py-3 px-4">المستخدم</th>
                <th className="py-3 px-4">اسم الدخول</th>
                <th className="py-3 px-4">الدور الوظيفي</th>
                <th className="py-3 px-4">التصريح الأمني</th>
                <th className="py-3 px-4">الحالة</th>
                <th className="py-3 px-4">آخر نشاط</th>
                <th className="py-3 px-4 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    جاري تحميل المستخدمين...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    لا يوجد مستخدمون مطابقون للبحث
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isSelf = u.id === currentUser?.id;
                  const isLastAdmin =
                    u.role === 'ADMIN' &&
                    users.filter((item) => item.role === 'ADMIN' && !item.is_disabled).length <= 1;

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{u.name}</div>
                        <div className="text-[11px] text-slate-500">{u.title}</div>
                        <div className="text-[10px] text-slate-400">{u.email}</div>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-700 dir-ltr text-right">
                        @{u.username}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            u.role === 'CHAIRMAN'
                              ? 'bg-amber-100 text-amber-800 border border-amber-300'
                              : u.role === 'SECRETARY'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-slate-800 text-slate-100 border border-slate-700'
                          }`}
                        >
                          {u.role === 'CHAIRMAN'
                            ? 'رئيس مجلس الإدارة'
                            : u.role === 'SECRETARY'
                            ? 'السكرتير التنفيذي'
                            : 'مسؤول النظم (IT)'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {u.can_view_confidential ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                            <Shield className="w-3 h-3 text-rose-600" />
                            مصرّح سري
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">عادي فقط</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {u.is_disabled ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full">
                            <UserX className="w-3 h-3" />
                            معطّل
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                            <UserCheck className="w-3 h-3" />
                            نشط
                          </span>
                        )}
                        {u.must_change_password && !u.is_disabled && (
                          <div className="text-[10px] text-amber-600 font-semibold mt-0.5">
                            بانتظار تغيير كلمة المرور
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-500 text-[11px]">
                        {u.last_login_at ? (
                          <div className="flex items-center gap-1 text-slate-600">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>{new Date(u.last_login_at).toLocaleDateString('ar-EG')}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400">لم يسجل بعد</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                          {/* Edit button */}
                          <button
                            onClick={() => openEditModal(u)}
                            className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium transition cursor-pointer"
                            title="تعديل البيانات والصلاحيات"
                          >
                            تعديل
                          </button>

                          {/* Reset password button */}
                          <button
                            onClick={() => setConfirmModal({ action: 'reset-password', user: u })}
                            className="px-2 py-1 rounded bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-[11px] font-medium transition cursor-pointer flex items-center gap-1"
                            title="إعادة تعيين كلمة المرور وإنشاء كلمة مرور مؤقتة"
                          >
                            <KeyRound className="w-3 h-3" />
                            <span>تصفير</span>
                          </button>

                          {/* Enable / Disable toggle button */}
                          {u.is_disabled ? (
                            <button
                              onClick={() => setConfirmModal({ action: 'enable', user: u })}
                              className="px-2 py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[11px] font-medium transition cursor-pointer flex items-center gap-1"
                            >
                              <UserCheck className="w-3 h-3" />
                              <span>تفعيل</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => setConfirmModal({ action: 'disable', user: u })}
                              disabled={isSelf || isLastAdmin}
                              className={`px-2 py-1 rounded text-[11px] font-medium transition flex items-center gap-1 ${
                                isSelf || isLastAdmin
                                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                  : 'bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 cursor-pointer'
                              }`}
                              title={
                                isSelf
                                  ? 'لا يمكن للمسؤول تعطيل حسابه'
                                  : isLastAdmin
                                  ? 'لا يمكن تعطيل آخر مسؤول نظام نشط'
                                  : 'تعطيل الحساب فوراً وإلغاء جميع جلساته'
                              }
                            >
                              <UserX className="w-3 h-3" />
                              <span>تعطيل</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: Create User Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-lg bg-white rounded-2xl border border-slate-300 shadow-2xl p-6 text-slate-900">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-emerald-700" />
                <h3 className="font-bold text-base">إضافة مستخدم جديد للنظام</h3>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4 pt-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  اسم الدخول (Username) <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={createForm.username}
                  onChange={(e) => setCreateForm({ ...createForm, username: e.target.value.toLowerCase() })}
                  placeholder="مثال: ahmed_ali أو sec.khaled"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-600 focus:outline-none font-mono dir-ltr"
                />
                <span className="text-[10px] text-slate-500">
                  3-32 حرفاً إنجليزياً صغيراً، أرقام، شرطة، شرطة سفلية، نقطة.
                </span>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  الاسم الكامل <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  placeholder="مثال: أحمد عبد الرحمن مصطفى"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  المسمى الوظيفي <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={createForm.title}
                  onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                  placeholder="مثال: سكرتير أول مكتب رئيس مجلس الإدارة"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  البريد الإلكتروني الداخلي <span className="text-rose-600">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value.toLowerCase() })}
                  placeholder="ahmed.ali@postal.internal"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-600 focus:outline-none font-mono dir-ltr"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  الدور الوظيفي <span className="text-rose-600">*</span>
                </label>
                <select
                  value={createForm.role}
                  onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as any })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-600 focus:outline-none bg-white"
                >
                  <option value="SECRETARY">السكرتير التنفيذي (SECRETARY)</option>
                  <option value="CHAIRMAN">رئيس مجلس الإدارة (CHAIRMAN)</option>
                  <option value="ADMIN">مسؤول النظم والشبكات (ADMIN)</option>
                </select>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <input
                    type="checkbox"
                    checked={createForm.can_view_confidential}
                    onChange={(e) => setCreateForm({ ...createForm, can_view_confidential: e.target.checked })}
                    className="w-4 h-4 text-emerald-700 rounded focus:ring-emerald-600"
                  />
                  <div>
                    <span className="font-bold text-slate-800">منح تصريح الاطلاع على المعاملات والاجتماعات السرية</span>
                    <p className="text-[10px] text-slate-500">
                      يسمح للمستخدم بالاطلاع على المذكرات والتكليفات ذات التصنيف السري.
                    </p>
                  </div>
                </label>
              </div>

              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] leading-relaxed">
                ℹ️ سيتم توليد كلمة مرور عشوائية مؤقتة وعرضها لك لمرة واحدة فقط لنسخها وتسليمها للمستخدم. سيلزم المستخدم بتغييرها فور الدخول.
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold disabled:opacity-50"
                >
                  {isSubmitting ? 'جاري الإنشاء...' : 'إنشاء المستخدم وتوليد كلمة المرور'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Edit User Modal */}
      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-lg bg-white rounded-2xl border border-slate-300 shadow-2xl p-6 text-slate-900">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="font-bold text-base">تعديل بيانات المستخدم: {editUser.name}</h3>
                <span className="text-[11px] font-mono text-slate-500">(@{editUser.username})</span>
              </div>
              <button onClick={() => setEditUser(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4 pt-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">الاسم الكامل</label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">المسمى الوظيفي</label>
                <input
                  type="text"
                  required
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">البريد الإلكتروني</label>
                <input
                  type="email"
                  required
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value.toLowerCase() })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-600 focus:outline-none font-mono dir-ltr"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">الدور الوظيفي</label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value as any })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-600 focus:outline-none bg-white"
                >
                  <option value="SECRETARY">السكرتير التنفيذي (SECRETARY)</option>
                  <option value="CHAIRMAN">رئيس مجلس الإدارة (CHAIRMAN)</option>
                  <option value="ADMIN">مسؤول النظم والشبكات (ADMIN)</option>
                </select>
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <input
                    type="checkbox"
                    checked={editForm.can_view_confidential}
                    onChange={(e) => setEditForm({ ...editForm, can_view_confidential: e.target.checked })}
                    className="w-4 h-4 text-emerald-700 rounded focus:ring-emerald-600"
                  />
                  <div>
                    <span className="font-bold text-slate-800">تصريح الاطلاع على السري</span>
                    <p className="text-[10px] text-slate-500">
                      تعديل هذا الخيار سيبطل فوراً جميع جلسات المستخدم النشطة.
                    </p>
                  </div>
                </label>
              </div>

              {/* Typed Confirmation Phrase if modifying role or clearance */}
              {(editForm.role !== editUser.role || editForm.can_view_confidential !== editUser.can_view_confidential) && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-300 space-y-2">
                  <div className="flex items-center gap-2 text-rose-800 font-bold">
                    <ShieldAlert className="w-4 h-4" />
                    <span>تأكيد الإجراء الأمني المشدد</span>
                  </div>
                  <p className="text-[11px] text-rose-700 leading-relaxed">
                    أنت على وشك تغيير الرتبة أو التصريح الأمني. لحماية الحساب من التعديل العرضي، اكتب العبارة التالية في الحقل أدناه:
                  </p>
                  <div className="p-2 rounded bg-white border border-rose-200 font-mono font-bold text-center text-rose-900 select-all">
                    تأكيد التعديل الأمني
                  </div>
                  <input
                    type="text"
                    required
                    value={editForm.confirmation_phrase}
                    onChange={(e) => setEditForm({ ...editForm, confirmation_phrase: e.target.value })}
                    placeholder="اكتب العبارة المطابقة تماماً هنا"
                    className="w-full px-3 py-2 border border-rose-300 rounded-xl focus:ring-2 focus:ring-rose-600 focus:outline-none text-center font-bold"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditUser(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold disabled:opacity-50"
                >
                  {isSubmitting ? 'جاري الحفظ...' : 'حفظ التعديلات'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Confirmation Dialog (Disable / Enable / Reset Password) */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white rounded-2xl border border-slate-300 shadow-2xl p-6 text-slate-900 text-xs">
            <div className="flex items-center gap-3 mb-4">
              <div
                className={`p-3 rounded-2xl ${
                  confirmModal.action === 'disable'
                    ? 'bg-rose-100 text-rose-700'
                    : confirmModal.action === 'reset-password'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-emerald-100 text-emerald-700'
                }`}
              >
                {confirmModal.action === 'disable' ? (
                  <UserX className="w-6 h-6" />
                ) : confirmModal.action === 'reset-password' ? (
                  <KeyRound className="w-6 h-6" />
                ) : (
                  <UserCheck className="w-6 h-6" />
                )}
              </div>
              <div>
                <h3 className="font-bold text-sm">
                  {confirmModal.action === 'disable'
                    ? 'تأكيد تعطيل الحساب'
                    : confirmModal.action === 'reset-password'
                    ? 'تأكيد تصفير كلمة المرور'
                    : 'تأكيد إعادة تفعيل الحساب'}
                </h3>
                <span className="text-slate-500 font-mono">@{confirmModal.user.username}</span>
              </div>
            </div>

            <p className="text-slate-600 leading-relaxed mb-4">
              {confirmModal.action === 'disable' &&
                `هل أنت متأكد من رغبتك في تعطيل حساب "${confirmModal.user.name}"؟ سيتم منع تسجيل الدخول فوراً وإنهاء وإبطال كافة جلسات العمل النشطة له على الفور.`}
              {confirmModal.action === 'enable' &&
                `هل ترغب في إعادة تفعيل حساب "${confirmModal.user.name}"؟ سيتمكن المستخدم من تسجيل الدخول مجدداً.`}
              {confirmModal.action === 'reset-password' &&
                `سيتم توليد كلمة مرور عشوائية جديدة للمستخدم "${confirmModal.user.name}"، وإلغاء جميع جلسات العمل الحالية فوراً، وفرض تغيير كلمة المرور عند تسجيل دخوله القادم.`}
            </p>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => {
                  if (confirmModal.action === 'disable') handleDisableUser(confirmModal.user);
                  else if (confirmModal.action === 'enable') handleEnableUser(confirmModal.user);
                  else if (confirmModal.action === 'reset-password') handleResetPassword(confirmModal.user);
                }}
                className={`px-5 py-2 rounded-xl text-white font-bold transition ${
                  confirmModal.action === 'disable'
                    ? 'bg-rose-700 hover:bg-rose-800'
                    : confirmModal.action === 'reset-password'
                    ? 'bg-amber-700 hover:bg-amber-800'
                    : 'bg-emerald-700 hover:bg-emerald-800'
                }`}
              >
                {isSubmitting ? 'جاري التنفيذ...' : 'تأكيد الإجراء'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Revealed Password Modal (Show ONCE) */}
      {revealedPasswordData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl border-2 border-amber-500 shadow-2xl p-6 text-slate-900 text-xs">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-200">
              <div className="p-2.5 rounded-xl bg-amber-100 text-amber-800">
                <KeyRound className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900">
                  {revealedPasswordData.isNewUser ? 'كلمة المرور المؤقتة للحساب الجديد' : 'كلمة المرور الجديدة بعد التصفير'}
                </h3>
                <span className="text-slate-500 font-mono">@{revealedPasswordData.username} - {revealedPasswordData.name}</span>
              </div>
            </div>

            <div className="my-5 p-4 rounded-xl bg-slate-900 text-white space-y-3">
              <div className="text-[11px] text-slate-400">كلمة المرور المؤقتة (معروضة لمرة واحدة فقط):</div>
              <div className="flex items-center justify-between gap-3 bg-slate-950 p-3 rounded-lg border border-slate-800">
                <code className="text-base font-mono text-emerald-400 select-all font-bold tracking-wider">
                  {revealedPasswordData.tempPass}
                </code>
                <button
                  type="button"
                  onClick={() => copyToClipboard(revealedPasswordData.tempPass)}
                  className="px-3 py-1.5 rounded-md bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
                >
                  {copiedPass ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedPass ? 'تم النسخ' : 'نسخ'}</span>
                </button>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 text-[11px] leading-relaxed flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold">تنبيه أمني هام جداً:</strong>
                لن يتم عرض كلمة المرور هذه مرة أخرى نهائياً، ولن تسجل في أي سجلات أو ملفات على الخادم. يرجى نسخها الآن وتسليمها للمستخدم عبر قناة آمنة. سيُطلب من المستخدم إجبارياً تغييرها عند أول تسجيل دخول.
              </div>
            </div>

            <div className="flex justify-end pt-4 mt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setRevealedPasswordData(null)}
                className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold transition cursor-pointer"
              >
                فهمت ذلك، تم حفظ كلمة المرور
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
