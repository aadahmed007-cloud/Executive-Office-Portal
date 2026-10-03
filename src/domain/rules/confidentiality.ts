import { ConfidentialityLevel, User, Correspondence, Directive, Meeting, Notification } from '../types';

export function isConfidential(level: ConfidentialityLevel): boolean {
  return level === 'confidential' || level === 'top_secret';
}

export function canAccessItem(user: User, level: ConfidentialityLevel): boolean {
  if (level === 'normal') return true;
  return user.can_view_confidential;
}

export function maskConfidentialCorrespondence(item: Correspondence, user: User): Correspondence {
  if (canAccessItem(user, item.confidentiality)) {
    return item;
  }
  return {
    ...item,
    subject: '[معاملة سرية - محجوبة بقرار رئاسي]',
    summary: 'محتوى هذه المعاملة مصنف بدرجة سرية عالية ومقتصر على المصرح لهم رسمياً.',
    source_or_dest_entity: '[جهة سيادية / محجوبة]'
  };
}

export function maskConfidentialDirective(item: Directive, user: User): Directive {
  if (canAccessItem(user, item.confidentiality)) {
    return item;
  }
  return {
    ...item,
    title: '[تكليف سري رئاسي مشفر]',
    instruction: 'تفاصيل التكليف محجوبة لعدم كفاية الصلاحية الأمنية.',
    assigned_person: '[مكلف محجوب]'
  };
}

export function maskConfidentialMeeting(item: Meeting, user: User): Meeting {
  if (canAccessItem(user, item.confidentiality)) {
    return item;
  }
  return {
    ...item,
    title: '[اجتماع خاص عالي السرية]',
    location: '[مكان مخصص مغلق]',
    notes: undefined
  };
}

export function maskNotification(notif: Notification, user: User): Notification {
  if (canAccessItem(user, notif.confidentiality)) {
    return notif;
  }
  return {
    ...notif,
    title: '[إشعار سري]',
    body: 'تم استلام معاملة سرية تتطلب تصريحاً أمنياً للاطلاع على محتواها.'
  };
}
