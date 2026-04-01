export type ExerciseInstruction = {
  image?: string; // path under /exercises/
  tips: string;
};

const exerciseInstructions: Record<string, ExerciseInstruction> = {
  "באנץ' פרס": {
    image: '/exercises/bench-press.jpg',
    tips: 'שכב על הספסל עם גב ישר ורגליים שטוחות על הרצפה. אחז בבר ברוחב רחב מהכתפיים. הורד את הבר לחזה בשליטה ודחוף חזרה למעלה. שמור על כתפיים מוצמדות לספסל לאורך כל התנועה.',
  },
  'סקוואט': {
    image: '/exercises/squat.jpg',
    tips: 'עמוד ברוחב כתפיים, בהונות מעט פונות החוצה. שמור על גב ישר וחזה גבוה. הורד את הגוף כאילו אתה יושב על כיסא, ברכיים עוקבות אחרי הבהונות. ירד לפחות עד לזווית 90°.',
  },
  'דדליפט': {
    image: '/exercises/deadlift.jpg',
    tips: 'עמוד עם רגליים ברוחב ירכיים, בר מעל כפות הרגליים. כופף ברכיים ואחז בבר. שמור גב ישר, חזה גבוה. דחוף את הרצפה ממך כשאתה עולה — אל תמשוך בגב.',
  },
  'שכיבות סמיכה': {
    image: '/exercises/push-up.jpg',
    tips: 'ידיים ברוחב כתפיים, גוף ישר מהראש לעקבים. הורד את החזה לרצפה בשליטה ודחוף חזרה. אל תניח את הירכיים לשקוע.',
  },
  'מתח': {
    image: '/exercises/pull-up.jpg',
    tips: 'אחז בבר בגריפ רחב, כפות ידיים פונות קדימה. משוך את עצמך למעלה עד שהסנטר מעל הבר. רד בשליטה מלאה. הימנע מנדנוד.',
  },
  'לחיצת כתפיים': {
    image: '/exercises/shoulder-press.jpg',
    tips: 'שב עם גב ישר, אחז בבר/דמבלים בגובה הכתפיים. דחוף ישר למעלה עד יישור מלא של הידיים. הורד בשליטה. אל תקמר את הגב.',
  },
  'כפיפות מרפק': {
    image: '/exercises/bicep-curl.jpg',
    tips: 'עמוד ישר עם דמבל בכל יד. כף יד פונה קדימה. כופף את המרפק ומשוך את הדמבל לכתף. שמור על מרפקים צמודים לגוף. הורד לאט.',
  },
  'פשיטות תלת ראשי': {
    image: '/exercises/tricep-extension.jpg',
    tips: 'אחז בפולי גבוה או ברבל. שמור על מרפקים קרובים לראש. יישר את הידיים לחלוטין וחזור לאט. שמור שהמרפקים לא יזוזו.',
  },
};

export const getExerciseInstruction = (name: string): ExerciseInstruction | null =>
  exerciseInstructions[name.trim()] ?? null;
