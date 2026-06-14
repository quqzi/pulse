// User-facing "what's new" highlights. Bilingual inline so the popup respects
// the language setting without bloating the i18n dictionaries. Newest first;
// CHANGELOG[0].version drives the "show once per release" logic in WhatsNew.
export interface ChangelogEntry {
  version: string; // bump this when adding a new entry → existing users see the popup once
  date: string; // YYYY-MM-DD
  title: { en: string; th: string };
  items: { en: string; th: string }[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '1.2',
    date: '2026-06-14',
    title: { en: 'Music, faster setup & your profile', th: 'เพลง ตั้งค่าง่ายขึ้น และโปรไฟล์ของคุณ' },
    items: [
      {
        en: 'Play study music while the timer runs — paste a YouTube, Spotify or SoundCloud link and it plays right on the page.',
        th: 'เปิดเพลงระหว่างจับเวลาได้แล้ว วางลิงก์ YouTube, Spotify หรือ SoundCloud แล้วเล่นบนหน้าได้เลย',
      },
      {
        en: 'Build a whole template in seconds — ask any AI for your subjects and topics, then paste the result to import them all at once.',
        th: 'สร้างเทมเพลตทั้งชุดได้ในไม่กี่วินาที ให้ AI ช่วยลิสต์วิชาและหัวข้อ แล้ววางเพื่อนำเข้าทีเดียว',
      },
      {
        en: 'Edit your profile in Settings — change your display name, and your password if you have an account.',
        th: 'แก้ไขโปรไฟล์ได้ในหน้าตั้งค่า เปลี่ยนชื่อที่แสดง และเปลี่ยนรหัสผ่านได้ถ้ามีบัญชี',
      },
    ],
  },
  {
    version: '1.1',
    date: '2026-06-13',
    title: { en: 'Polish & performance', th: 'ปรับความลื่นไหลและประสิทธิภาพ' },
    items: [
      {
        en: 'Install Pulse to your home screen — it now works like a real app, even offline.',
        th: 'ติดตั้ง Pulse ลงหน้าโฮมได้แล้ว ใช้งานเหมือนแอปจริง แม้ออฟไลน์',
      },
      {
        en: 'Faster first load — fixed the brief flash of unstyled content.',
        th: 'โหลดครั้งแรกเร็วขึ้น แก้อาการหน้ากะพริบก่อนสไตล์โหลด',
      },
      {
        en: 'Schedule now fits properly on iPad and tablets in portrait.',
        th: 'หน้าตารางแสดงผลพอดีบน iPad และแท็บเล็ตแนวตั้งแล้ว',
      },
      {
        en: 'New bottom-sheet “More” menu on mobile, with quick icons.',
        th: 'เมนู “เพิ่มเติม” บนมือถือเปลี่ยนเป็นชีตด้านล่างพร้อมไอคอนลัด',
      },
      {
        en: 'Math 1 & Math 2 added to the TCAS and Medicine subject templates.',
        th: 'เพิ่มคณิต 1 และ คณิต 2 ในเทมเพลตวิชา TCAS และ แพทย์',
      },
      {
        en: 'Cleaner glass panels and tidier template screens.',
        th: 'แผงกระจกดูสะอาดขึ้น และหน้าจอเทมเพลตเป็นระเบียบขึ้น',
      },
    ],
  },
];

export const LATEST_VERSION = CHANGELOG[0].version;
