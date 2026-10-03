import React, { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useI18n } from '../../i18n/i18nContext';
import { contactRepo } from '../../data/sqlite/repositories';
import { Contact } from '../../domain/types';
import {
  Users2,
  Phone,
  Mail,
  Building,
  Search,
  UserCheck,
  Plus
} from 'lucide-react';

export const ContactsView: React.FC = () => {
  const { currentUser } = useAuth();
  const { t, formatNumber } = useI18n();

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    contactRepo.getAll().then((list) => setContacts(list));
  }, []);

  const filteredContacts = contacts.filter((c) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.entity.toLowerCase().includes(q) ||
      c.position.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Users2 className="w-5 h-5 text-emerald-700" />
            <span>{t('nav.contacts')} والجهات السيادية</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            دليل الشخصيات العامة والوزراء والجهات المتعاملة مع مكتب رئيس مجلس الإدارة
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-center justify-between">
        <div className="relative w-full max-w-md">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث بالاسم، الجهة، أو المسمى الوظيفي..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 pl-8 text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
        </div>
      </div>

      {/* Contacts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredContacts.map((contact) => (
          <div
            key={contact.id}
            className="bg-white rounded-2xl border border-slate-200 hover:border-emerald-400 p-5 shadow-sm transition space-y-3"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-center font-bold text-sm">
                {contact.name.charAt(0)}
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">{contact.name}</h4>
                <p className="text-xs text-slate-500">{contact.position}</p>
              </div>
            </div>

            <div className="text-xs text-emerald-900 font-semibold bg-emerald-50/60 p-2 rounded-lg border border-emerald-100 flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
              <span>{contact.entity}</span>
            </div>

            <div className="space-y-1.5 text-xs text-slate-600 pt-1 border-t border-slate-100">
              <div className="flex items-center gap-2 font-mono">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                <span>{contact.phone}</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                <span>{contact.email}</span>
              </div>
            </div>

            {contact.notes && (
              <p className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100 italic">
                {contact.notes}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
