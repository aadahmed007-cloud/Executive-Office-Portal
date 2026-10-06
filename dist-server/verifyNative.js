// scripts/verifyNative.ts
import Database from "better-sqlite3";
function verifyNative() {
  try {
    const db = new Database(":memory:");
    const row = db.prepare("SELECT sqlite_version() as version").get();
    db.close();
    console.log("======================================================================");
    console.log("\u2705 \u0641\u062D\u0635 \u062A\u0648\u0627\u0641\u0642 \u0645\u062D\u0631\u0643 SQLite \u0627\u0644\u0623\u0635\u0644\u064A (Native SQLite Verification)");
    console.log("======================================================================");
    console.log(`\u{1F4CC} \u0625\u0635\u062F\u0627\u0631 Node.js \u0627\u0644\u062D\u0627\u0644\u064A:   ${process.version}`);
    console.log(`\u{1F4CC} \u0646\u0638\u0627\u0645 \u0627\u0644\u062A\u0634\u063A\u064A\u0644 (Platform): ${process.platform}`);
    console.log(`\u{1F4CC} \u0645\u0639\u0645\u0627\u0631\u064A\u0629 \u0627\u0644\u0645\u0639\u0627\u0644\u062C (Arch):  ${process.arch}`);
    console.log(`\u{1F4CC} \u0625\u0635\u062F\u0627\u0631 \u0645\u062D\u0631\u0643 SQLite:       ${row.version}`);
    console.log("\u2728 \u062D\u0627\u0644\u0629 \u0645\u062D\u0631\u0643 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A:      \u062C\u0627\u0647\u0632 \u0644\u0644\u0639\u0645\u0644 \u0628\u0643\u0641\u0627\u0621\u0629 \u062A\u0627\u0645\u0629 \u0628\u062F\u0648\u0646 \u0625\u0646\u062A\u0631\u0646\u062A \u0623\u0648 \u0623\u062F\u0648\u0627\u062A \u062A\u062C\u0645\u064A\u0639 (Compiler-Free)");
    console.log("======================================================================");
    process.exit(0);
  } catch (err) {
    console.error("======================================================================");
    console.error("\u274C \u062E\u0637\u0623 \u0641\u0627\u062F\u062D: \u0641\u0634\u0644 \u062A\u062D\u0645\u064A\u0644 \u0648\u062D\u062F\u0629 \u0627\u0644\u0631\u0628\u0637 \u0627\u0644\u0623\u0635\u0644\u064A\u0629 \u0644\u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A (better-sqlite3)");
    console.error("======================================================================");
    console.error(`\u{1F4CC} \u0627\u0644\u062E\u0637\u0623 \u0627\u0644\u062F\u0627\u062E\u0644\u064A: ${err.message}`);
    console.error(`\u{1F4CC} \u0625\u0635\u062F\u0627\u0631 Node.js \u0627\u0644\u062D\u0627\u0644\u064A: ${process.version}`);
    console.error(`\u{1F4CC} \u0646\u0638\u0627\u0645 \u0627\u0644\u062A\u0634\u063A\u064A\u0644: ${process.platform} | \u0627\u0644\u0645\u0639\u0645\u0627\u0631\u064A\u0629: ${process.arch}`);
    console.error("\n\u26A0\uFE0F  \u062A\u0646\u0628\u064A\u0647 \u0647\u0627\u0645 \u062D\u0648\u0644 \u0628\u064A\u0626\u0629 \u0627\u0644\u062A\u0634\u063A\u064A\u0644 \u0627\u0644\u0645\u063A\u0644\u0642\u0629 (Air-Gapped Requirements):");
    console.error("\u0627\u0644\u062D\u0632\u0645 \u0627\u0644\u0645\u062C\u0647\u0632\u0629 \u0645\u0633\u0628\u0642\u0627\u064B (Prebuilt Binaries) \u062A\u062F\u0639\u0645 \u0627\u0644\u0623\u0646\u0638\u0645\u0629 \u0627\u0644\u062A\u0627\u0644\u064A\u0629 \u062D\u0635\u0631\u0627\u064B:");
    console.error("  - \u0645\u0646\u0635\u0627\u062A: Linux (glibc/musl), Windows (win32), macOS (darwin)");
    console.error("  - \u0627\u0644\u0645\u0639\u0645\u0627\u0631\u064A\u0627\u062A: x64 (Intel/AMD 64-bit), arm64 (ARM 64-bit)");
    console.error("  - \u0625\u0635\u062F\u0627\u0631\u0627\u062A Node.js \u0627\u0644\u0645\u062F\u0639\u0648\u0645\u0629: Node.js 18.x, 20.x, 22.x LTS");
    console.error("\u{1F4A1} \u0627\u0644\u062D\u0644: \u062A\u0623\u0643\u062F \u0645\u0646 \u0623\u0646 \u062C\u0647\u0627\u0632 \u0627\u0644\u062E\u0627\u062F\u0645 \u064A\u0639\u0645\u0644 \u0628\u0646\u0641\u0633 \u0646\u0638\u0627\u0645 \u0648\u0645\u0639\u0645\u0627\u0631\u064A\u0629 \u0648\u0625\u0635\u062F\u0627\u0631 Node \u0627\u0644\u0631\u0626\u064A\u0633\u064A \u0627\u0644\u0630\u064A \u0628\u064F\u0646\u064A\u062A \u0639\u0644\u064A\u0647 \u0627\u0644\u062D\u0632\u0645\u0629.");
    console.error("======================================================================");
    process.exit(1);
  }
}
verifyNative();
