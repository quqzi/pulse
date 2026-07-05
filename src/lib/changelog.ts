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
    version: '1.4',
    date: '2026-07-05',
    title: { en: 'A readiness score you can trust & a brand-new notes editor', th: 'คะแนนความพร้อมที่เชื่อถือได้ และตัวแก้ไขโน้ตโฉมใหม่' },
    items: [
      {
        en: 'Exam readiness now counts your logged mock scores and weighs recent attempts more, so improvement actually shows. New subjects no longer drag your score down.',
        th: 'ความพร้อมสอบนับคะแนนข้อสอบจำลองที่คุณบันทึกไว้แล้ว และให้น้ำหนักครั้งล่าสุดมากกว่า พัฒนาการจึงเห็นชัด วิชาใหม่ไม่ฉุดคะแนนอีกต่อไป',
      },
      {
        en: 'Notes got an Obsidian-style editor — one pane where headings, bold, lists and checkboxes render live as you type. Tap a checkbox to tick it right in the note.',
        th: 'โน้ตได้ตัวแก้ไขสไตล์ Obsidian — หน้าเดียวที่หัวข้อ ตัวหนา รายการ และเช็กบ็อกซ์แสดงผลสดขณะพิมพ์ แตะเช็กบ็อกซ์เพื่อติ๊กได้เลยในโน้ต',
      },
      {
        en: 'Switch language from the sidebar or the More menu — no trip to Settings needed.',
        th: 'สลับภาษาได้จากแถบด้านข้างหรือเมนูเพิ่มเติม ไม่ต้องเข้าไปที่การตั้งค่า',
      },
      {
        en: 'Quick-settings gears on the Timer and Schedule pages — change pomodoro lengths, study hours and rest days right where you use them.',
        th: 'เฟืองตั้งค่าด่วนบนหน้าจับเวลาและตาราง — ปรับความยาวโพโมโดโร เวลาอ่าน และวันพักได้ตรงจุดที่ใช้งาน',
      },
      {
        en: 'Tap the goal on the dashboard to change your daily study target instantly.',
        th: 'แตะเป้าหมายบนแดชบอร์ดเพื่อเปลี่ยนเป้าการอ่านรายวันได้ทันที',
      },
      {
        en: 'Using Pulse without an account? A sign-in shortcut now lives in the sidebar so you can sync your data anytime.',
        th: 'ใช้ Pulse โดยไม่มีบัญชี? มีทางลัดเข้าสู่ระบบในแถบด้านข้างแล้ว ซิงค์ข้อมูลได้ทุกเมื่อ',
      },
    ],
  },
  {
    version: '1.3',
    date: '2026-07-04',
    title: { en: 'Smarter import, live notes & a friendlier start', th: 'นำเข้าฉลาดขึ้น โน้ตแบบสด และเริ่มต้นง่ายขึ้น' },
    items: [
      {
        en: 'AI import got smarter — preview every card or question before importing, duplicates are flagged automatically, and messy AI replies (extra text, letter answers) now just work.',
        th: 'นำเข้าด้วย AI ฉลาดขึ้น ดูตัวอย่างการ์ดหรือโจทย์ก่อนนำเข้า ระบบติดป้ายรายการซ้ำให้อัตโนมัติ และคำตอบจาก AI ที่ไม่เป๊ะ (มีข้อความเกิน ตอบเป็นตัวอักษร) ก็ใช้ได้เลย',
      },
      {
        en: 'Mock exam results now save to Scores automatically, per subject.',
        th: 'ผลข้อสอบจำลองบันทึกเข้าหน้าคะแนนให้อัตโนมัติ แยกตามวิชา',
      },
      {
        en: 'Notes preview updates instantly while you type — no more switching between Write and Preview.',
        th: 'ตัวอย่างโน้ตอัปเดตทันทีขณะพิมพ์ ไม่ต้องสลับระหว่างเขียนกับดูตัวอย่างอีกแล้ว',
      },
      {
        en: 'New? The dashboard now shows a short get-started checklist so you always know the next step.',
        th: 'ผู้ใช้ใหม่? หน้าแดชบอร์ดมีเช็กลิสต์เริ่มต้นสั้น ๆ ให้รู้ว่าต้องทำอะไรต่อ',
      },
      {
        en: 'Logged a session by mistake? Today’s sessions now show on the dashboard — delete with one tap (with undo).',
        th: 'บันทึกเซสชันผิด? เซสชันวันนี้แสดงบนแดชบอร์ดแล้ว ลบได้ในแตะเดียว (กดย้อนกลับได้)',
      },
      {
        en: 'On computers, pop-ups now open as proper centered dialogs instead of a phone-style bottom sheet.',
        th: 'บนคอมพิวเตอร์ ป๊อปอัปเปิดเป็นกล่องกลางจอแบบเต็มรูปแบบ แทนชีตแบบมือถือ',
      },
    ],
  },
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
