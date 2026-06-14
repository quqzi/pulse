// User guide content — bilingual inline (like changelog.ts) so it doesn't bloat
// the i18n dictionaries. The /guide page renders these as an accordion.
export interface GuideSection {
  id: string;
  icon: string; // SVG path `d` (stroke icon, 24×24)
  title: { en: string; th: string };
  body: { en: string; th: string }[];
}

export const GUIDE: GuideSection[] = [
  {
    id: 'start',
    icon: 'M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z M4 22v-7',
    title: { en: 'Getting started', th: 'เริ่มต้นใช้งาน' },
    body: [
      {
        en: 'Pulse works two ways: as a guest (everything saved on this device) or with a free account that syncs across devices.',
        th: 'Pulse ใช้ได้สองแบบ: แบบผู้เยี่ยมชม (เก็บข้อมูลบนเครื่องนี้) หรือสมัครบัญชีฟรีเพื่อซิงค์ข้ามอุปกรณ์',
      },
      {
        en: 'You can create an account any time from Settings → Account — your guest data carries over.',
        th: 'สมัครบัญชีเมื่อไรก็ได้จาก ตั้งค่า → บัญชี ข้อมูลแบบผู้เยี่ยมชมจะถูกย้ายมาให้',
      },
      {
        en: 'Set your exam date and daily study goal in Settings so the schedule and readiness work for you.',
        th: 'ตั้งวันสอบและเป้าหมายการอ่านต่อวันในหน้าตั้งค่า เพื่อให้ตารางและคะแนนความพร้อมแม่นยำ',
      },
    ],
  },
  {
    id: 'timer',
    icon: 'M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2z M12 6v6l4 2',
    title: { en: 'Timer & focus', th: 'จับเวลาและโฟกัส' },
    body: [
      {
        en: 'Pick a subject (and topic), then Start. Pomodoro counts down work/break; Free timer counts up.',
        th: 'เลือกวิชา (และหัวข้อ) แล้วกดเริ่ม โพโมโดโรนับถอยหลังช่วงเรียน/พัก ส่วนจับเวลาอิสระนับขึ้น',
      },
      {
        en: 'Focus mode hides everything but the clock. Finishing a session logs your study time automatically.',
        th: 'โหมดโฟกัสซ่อนทุกอย่างเหลือแค่นาฬิกา เมื่อจบเซสชันระบบจะบันทึกเวลาให้อัตโนมัติ',
      },
      {
        en: 'Paste a YouTube, Spotify or SoundCloud link to play study music while the timer runs.',
        th: 'วางลิงก์ YouTube, Spotify หรือ SoundCloud เพื่อเปิดเพลงระหว่างจับเวลา',
      },
    ],
  },
  {
    id: 'subjects',
    icon: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20 M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z',
    title: { en: 'Subjects & topics', th: 'วิชาและหัวข้อ' },
    body: [
      {
        en: 'Add subjects from a template (TCAS, Medicine…) or build your own from scratch.',
        th: 'เพิ่มวิชาจากเทมเพลต (TCAS, แพทย์ …) หรือสร้างเองตั้งแต่ต้น',
      },
      {
        en: 'Use ✦ Import to paste a JSON list from any AI and create subjects + topics all at once.',
        th: 'ใช้ ✦ นำเข้า เพื่อวาง JSON จาก AI แล้วสร้างวิชาและหัวข้อทั้งหมดในครั้งเดียว',
      },
      {
        en: 'Open a subject to add topics, tick them off as you cover them, and jot quick notes.',
        th: 'เปิดวิชาเพื่อเพิ่มหัวข้อ ติ๊กเมื่ออ่านแล้ว และจดโน้ตสั้น ๆ',
      },
    ],
  },
  {
    id: 'flashcards',
    icon: 'M12 2l9 5-9 5-9-5 9-5z M3 12l9 5 9-5 M3 17l9 5 9-5',
    title: { en: 'Flashcards', th: 'แฟลชการ์ด' },
    body: [
      {
        en: "Each topic is a deck. Open it to add cards (front / back); math written as $…$ is typeset.",
        th: 'แต่ละหัวข้อคือเด็คหนึ่งชุด เปิดเพื่อเพิ่มการ์ด (หน้า/หลัง) คณิตที่เขียนเป็น $…$ จะถูกจัดรูปสวยงาม',
      },
      {
        en: 'Study flips through due cards; afterwards you pick when to review the deck again.',
        th: 'โหมดทบทวนจะพลิกการ์ดที่ถึงกำหนด แล้วให้คุณเลือกเวลาทบทวนครั้งถัดไป',
      },
      {
        en: 'Decks that are due show up on your dashboard and in the schedule sidebar.',
        th: 'เด็คที่ถึงกำหนดจะแสดงบนแดชบอร์ดและแถบข้างของตาราง',
      },
    ],
  },
  {
    id: 'schedule',
    icon: 'M3 4h18v18H3z M3 10h18 M8 2v4 M16 2v4',
    title: { en: 'Schedule', th: 'ตารางเรียน' },
    body: [
      {
        en: 'Drag on the week grid to create a study block; drag the middle to move it, the edge to resize.',
        th: 'ลากบนตารางสัปดาห์เพื่อสร้างคาบเรียน ลากตรงกลางเพื่อย้าย ลากขอบเพื่อปรับความยาว',
      },
      {
        en: 'Auto-schedule fills your week from your subjects, goals and exam date in one tap.',
        th: 'จัดตารางอัตโนมัติจะเติมทั้งสัปดาห์จากวิชา เป้าหมาย และวันสอบ ในแตะเดียว',
      },
      {
        en: 'Tune work hours, block length, rest days and subject priority in Settings → Calendar.',
        th: 'ปรับชั่วโมงเรียน ความยาวคาบ วันพัก และลำดับความสำคัญของวิชาได้ใน ตั้งค่า → ปฏิทิน',
      },
    ],
  },
  {
    id: 'exams',
    icon: 'M9 11l3 3L22 4 M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
    title: { en: 'Mock exams', th: 'สอบจำลอง' },
    body: [
      {
        en: 'Build a question bank by hand, or paste questions from an AI, then run a timed mock exam.',
        th: 'สร้างคลังข้อสอบเอง หรือวางข้อสอบจาก AI แล้วทำข้อสอบจำลองแบบจับเวลา',
      },
      {
        en: 'Your results feed the Exam Readiness score on the dashboard.',
        th: 'ผลคะแนนจะส่งผลต่อคะแนนความพร้อมสอบบนแดชบอร์ด',
      },
    ],
  },
  {
    id: 'progress',
    icon: 'M18 20V10 M12 20V4 M6 20v-6',
    title: { en: 'Progress & insights', th: 'ความคืบหน้าและข้อมูลเชิงลึก' },
    body: [
      {
        en: 'Analytics shows study trends; Journey has a streak heatmap and a session timeline.',
        th: 'หน้าวิเคราะห์แสดงแนวโน้มการอ่าน หน้าเส้นทางมีฮีตแมปสตรีคและไทม์ไลน์เซสชัน',
      },
      {
        en: 'Insights surfaces what to focus on next; Readiness blends topic coverage, recent hours and mock accuracy.',
        th: 'หน้าข้อมูลเชิงลึกบอกสิ่งที่ควรโฟกัสต่อไป คะแนนความพร้อมรวมความครอบคลุมหัวข้อ ชั่วโมงล่าสุด และความแม่นยำในการสอบ',
      },
    ],
  },
  {
    id: 'reminders',
    icon: 'M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9 M13.7 21a2 2 0 0 1-3.4 0',
    title: { en: 'Reminders & install', th: 'การเตือนและการติดตั้ง' },
    body: [
      {
        en: 'Settings → Notifications turns on study reminders — they show while Pulse is open or installed.',
        th: 'ตั้งค่า → การแจ้งเตือน เพื่อเปิดการเตือนอ่านหนังสือ — จะแสดงขณะเปิด Pulse หรือเมื่อติดตั้งแล้ว',
      },
      {
        en: 'Install Pulse to your home screen from Settings → About for a full-screen app that works offline.',
        th: 'ติดตั้ง Pulse ลงหน้าโฮมจาก ตั้งค่า → เกี่ยวกับ เพื่อใช้แบบเต็มจอและออฟไลน์ได้',
      },
      {
        en: 'On iPhone: tap Share, then "Add to Home Screen".',
        th: 'บน iPhone: แตะปุ่มแชร์ แล้วเลือก "เพิ่มไปยังหน้าจอโฮม"',
      },
    ],
  },
  {
    id: 'personalize',
    icon: 'M4 21v-7 M4 10V3 M12 21v-9 M12 8V3 M20 21v-5 M20 12V3 M1 14h6 M9 8h6 M17 16h6',
    title: { en: 'Make it yours', th: 'ปรับแต่งให้เป็นของคุณ' },
    body: [
      {
        en: 'Settings → Appearance has five themes (Vercel, Apple, Resend) in light and dark.',
        th: 'ตั้งค่า → ลักษณะ มีห้าธีม (Vercel, Apple, Resend) ทั้งโหมดสว่างและมืด',
      },
      {
        en: 'Switch between English and ไทย any time, and edit your display name in Settings → Account.',
        th: 'สลับภาษาอังกฤษและไทยได้ตลอด และแก้ไขชื่อที่แสดงได้ใน ตั้งค่า → บัญชี',
      },
    ],
  },
];
