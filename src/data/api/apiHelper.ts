/**
 * Safe API response parser and error categorizer.
 * Never throws on non-JSON or HTML bodies; provides distinct Arabic error diagnostics.
 */

export interface ParsedApiResponse<T = any> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
  code?: string;
  technicalDetails?: string;
}

export async function parseApiResponse<T = any>(response: Response): Promise<ParsedApiResponse<T>> {
  const status = response.status;
  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const isHtml = contentType.includes('text/html');

  let bodyData: any = null;
  let textBody = '';

  try {
    textBody = await response.text();
    if (isJson && textBody.trim().length > 0) {
      bodyData = JSON.parse(textBody);
    }
  } catch {
    // Ignore text parse errors
  }

  if (response.ok) {
    return {
      ok: true,
      status,
      data: bodyData as T
    };
  }

  let errorMessage = '';
  const errorCode = bodyData?.code;

  if (status === 401) {
    errorMessage = bodyData?.error || 'اسم المستخدم أو كلمة المرور غير صحيحة';
  } else if (status === 403) {
    if (errorCode === 'MUST_CHANGE_PASSWORD') {
      errorMessage = 'يجب تغيير كلمة المرور الأولية قبل متابعة استخدام النظام';
    } else {
      errorMessage = bodyData?.error || 'تم رفض الطلب: حماية ضد التزوير أو عدم تطابق مصدر الطلب';
    }
  } else if (status === 429 || status === 423) {
    errorMessage = bodyData?.error || 'تم إغلاق الحساب أو كبح محاولات تسجيل الدخول مؤقتاً لتكرار المحاولات الخاطئة';
  } else if (status === 404) {
    errorMessage = isHtml
      ? 'استجاب الخادم بصفحة ويب غير متوقعة بدلاً من الواجهة البرمجية'
      : (bodyData?.error || 'المسار البرمجي المطلوب غير متوفر على الخادم');
  } else if (status >= 500) {
    errorMessage = bodyData?.error || 'حدث خطأ داخلي في الخادم أثناء معالجة الطلب';
  } else if (isHtml) {
    errorMessage = 'استجاب الخادم بصفحة غير متوقعة بدلاً من الواجهة البرمجية';
  } else {
    errorMessage = bodyData?.error || `فشل الطلب مع رمز الحالة ${status}`;
  }

  return {
    ok: false,
    status,
    error: errorMessage,
    code: errorCode,
    technicalDetails: `HTTP ${status} (${response.statusText || 'Error'}) - Content-Type: ${contentType || 'none'}`
  };
}
