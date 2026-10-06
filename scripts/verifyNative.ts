/**
 * Native Binding Compatibility Verification Script
 * Validates that better-sqlite3 native bindings load and run correctly without needing a C++ compiler.
 */

import Database from 'better-sqlite3';

function verifyNative(): void {
  try {
    const db = new Database(':memory:');
    const row = db.prepare('SELECT sqlite_version() as version').get() as { version: string };
    db.close();

    console.log('======================================================================');
    console.log('✅ فحص توافق محرك SQLite الأصلي (Native SQLite Verification)');
    console.log('======================================================================');
    console.log(`📌 إصدار Node.js الحالي:   ${process.version}`);
    console.log(`📌 نظام التشغيل (Platform): ${process.platform}`);
    console.log(`📌 معمارية المعالج (Arch):  ${process.arch}`);
    console.log(`📌 إصدار محرك SQLite:       ${row.version}`);
    console.log('✨ حالة محرك البيانات:      جاهز للعمل بكفاءة تامة بدون إنترنت أو أدوات تجميع (Compiler-Free)');
    console.log('======================================================================');
    process.exit(0);
  } catch (err: any) {
    console.error('======================================================================');
    console.error('❌ خطأ فادح: فشل تحميل وحدة الربط الأصلية لقاعدة البيانات (better-sqlite3)');
    console.error('======================================================================');
    console.error(`📌 الخطأ الداخلي: ${err.message}`);
    console.error(`📌 إصدار Node.js الحالي: ${process.version}`);
    console.error(`📌 نظام التشغيل: ${process.platform} | المعمارية: ${process.arch}`);
    console.error('\n⚠️  تنبيه هام حول بيئة التشغيل المغلقة (Air-Gapped Requirements):');
    console.error('الحزم المجهزة مسبقاً (Prebuilt Binaries) تدعم الأنظمة التالية حصراً:');
    console.error('  - منصات: Linux (glibc/musl), Windows (win32), macOS (darwin)');
    console.error('  - المعماريات: x64 (Intel/AMD 64-bit), arm64 (ARM 64-bit)');
    console.error('  - إصدارات Node.js المدعومة: Node.js 18.x, 20.x, 22.x LTS');
    console.error('💡 الحل: تأكد من أن جهاز الخادم يعمل بنفس نظام ومعمارية وإصدار Node الرئيسي الذي بُنيت عليه الحزمة.');
    console.error('======================================================================');
    process.exit(1);
  }
}

verifyNative();
