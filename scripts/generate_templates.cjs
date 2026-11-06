const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

// 1. Data Definitions

// Sheet 1: Classes_Grades
const classesHeaders = [
  'class_id',
  'section_code',
  'class_name_ar',
  'stage',
  'grade_level',
  'track',
  'room_number',
  'max_capacity',
  'academic_year',
  'is_active'
];

const classesArabicLabels = [
  'معرف الفصل (Primary Key)',
  'رمز الشعبة / الفصل',
  'اسم الفصل بالعربية',
  'المرحلة الدراسية (kindergarten/primary/middle/high)',
  'الصف الدراسي (KG1/KG2/Grade 1...Grade 12)',
  'المسار التعليمي (arabic-a/arabic-b)',
  'رقم القاعة / الغرفة',
  'السعة الاستيعابية القصوى',
  'العام الدراسي (YYYY-YYYY)',
  'الحالة (true/false)'
];

const classesSampleRows = [
  [
    'CLS-G1-A',
    'G1-A',
    'الصف الأول (أ) - براعم الفصحى',
    'primary',
    'Grade 1',
    'arabic-a',
    '101',
    25,
    '2026-2027',
    true
  ],
  [
    'CLS-G1-B',
    'G1-B',
    'الصف الأول (ب) - رواد القراءة',
    'primary',
    'Grade 1',
    'arabic-a',
    '102',
    25,
    '2026-2027',
    true
  ],
  [
    'CLS-G2-A',
    'G2-A',
    'الصف الثاني (أ) - عباقرة البيان',
    'primary',
    'Grade 2',
    'arabic-a',
    '103',
    28,
    '2026-2027',
    true
  ],
  [
    'CLS-KG2-A',
    'KG2-A',
    'روضة ثانية (أ) - سنابل الضاد',
    'kindergarten',
    'KG2',
    'arabic-a',
    'K01',
    20,
    '2026-2027',
    true
  ]
];

// Sheet 2: Teachers
const teachersHeaders = [
  'teacher_id',
  'national_id',
  'first_name',
  'last_name',
  'full_name_ar',
  'full_name_en',
  'email',
  'phone_number',
  'gender',
  'department',
  'subject_specialization',
  'assigned_classes',
  'employment_status',
  'hire_date'
];

const teachersArabicLabels = [
  'معرف المعلم (Primary Key)',
  'رقم الهوية الوطنية / الإقامة',
  'الاسم الأول',
  'اسم العائلة',
  'الاسم الكامل بالعربية',
  'الاسم الكامل بالإنجليزية',
  'البريد الرسمي للمؤسسة (Supabase Auth)',
  'رقم الهاتف الجوال (مع مفتاح الدولة)',
  'الجنس (male/female)',
  'القسم الأكاديمي',
  'التخصص الدراسي الدقيق',
  'الفصول المسندة (مفصولة بفواصل e.g. CLS-G1-A, CLS-G1-B)',
  'الحالة الوظيفية (active/on_leave/resigned)',
  'تاريخ التعيين (YYYY-MM-DD)'
];

const teachersSampleRows = [
  [
    'TCH-1001',
    '1092837461',
    'مريم',
    'السعيد',
    'أ. مريم عبد العزيز السعيد',
    'Maryam Abdulaziz Al-Saeed',
    'maryam.saeed@school.edu.sa',
    '+966501234567',
    'female',
    'Arabic Language',
    'القراءة الصوتية والتأسيس اللغوي',
    'CLS-G1-A, CLS-G1-B',
    'active',
    '2023-08-20'
  ],
  [
    'TCH-1002',
    '1083746592',
    'طارق',
    'المنصور',
    'أ. طارق عبد الله المنصور',
    'Tariq Abdullah Al-Mansoor',
    'tariq.mansoor@school.edu.sa',
    '+966559876543',
    'male',
    'Arabic Language',
    'النحو العربي والبلاغة',
    'CLS-G2-A',
    'active',
    '2022-09-01'
  ],
  [
    'TCH-1003',
    '1074635291',
    'سعاد',
    'المهدي',
    'أ. سعاد محمد المهدي',
    'Souad Mohamed Al-Mahdi',
    'souad.mahdi@school.edu.sa',
    '+966567890123',
    'female',
    'Early Childhood',
    'رياض الأطفال وأنشطة الطفولة المبكرة',
    'CLS-KG2-A',
    'active',
    '2024-01-15'
  ]
];

// Sheet 3: Students
const studentsHeaders = [
  'student_id',
  'national_id',
  'first_name',
  'last_name',
  'full_name_ar',
  'gender',
  'birth_date',
  'grade_level',
  'section_code',
  'class_id',
  'track',
  'guardian_name',
  'guardian_relation',
  'guardian_phone',
  'guardian_email',
  'address',
  'status',
  'enrollment_date'
];

const studentsArabicLabels = [
  'الرقم الأكاديمي للطالب (Primary Key)',
  'رقم الهوية الوطنية / الإقامة',
  'الاسم الأول',
  'اسم العائلة',
  'الاسم الكامل بالعربية',
  'الجنس (male/female)',
  'تاريخ الميلاد (YYYY-MM-DD)',
  'الصف الدراسي (Grade 1 / Grade 2 / KG2...)',
  'رمز الشعبة (G1-A / G1-B...)',
  'معرف الفصل (Foreign Key -> Classes_Grades.class_id)',
  'المسار التعليمي (arabic-a / arabic-b)',
  'اسم ولي الأمر الكامل',
  'صلة القرابة (father/mother/guardian)',
  'رقم هاتف ولي الأمر (مع مفتاح الدولة)',
  'بريد ولي الأمر الإلكتروني',
  'عنوان السكن / المدينة والحي',
  'حالة القيد (active/transferred/graduated)',
  'تاريخ التسجيل بالمنظومة (YYYY-MM-DD)'
];

const studentsSampleRows = [
  [
    'STU-2026-001',
    '1198765432',
    'موسى',
    'الغامدي',
    'موسى عمر الغامدي',
    'male',
    '2019-03-15',
    'Grade 1',
    'G1-A',
    'CLS-G1-A',
    'arabic-a',
    'عمر عبد الله الغامدي',
    'father',
    '+966551234567',
    'omar.ghamdi@example.com',
    'الرياض - حي الياسمين',
    'active',
    '2025-09-01'
  ],
  [
    'STU-2026-002',
    '1187654321',
    'سارة',
    'الشهري',
    'سارة فهد الشهري',
    'female',
    '2019-07-22',
    'Grade 1',
    'G1-B',
    'CLS-G1-B',
    'arabic-a',
    'فهد بن سعد الشهري',
    'father',
    '+966542345678',
    'fahad.shehri@example.com',
    'جدة - حي الشاطئ',
    'active',
    '2025-09-01'
  ],
  [
    'STU-2026-003',
    '1176543210',
    'عمر',
    'العتيبي',
    'عمر يوسف العتيبي',
    'male',
    '2018-11-05',
    'Grade 2',
    'G2-A',
    'CLS-G2-A',
    'arabic-a',
    'يوسف بن ناصر العتيبي',
    'father',
    '+966533456789',
    'youssef.otaibi@example.com',
    'الدمام - حي الشاطئ الشرقي',
    'active',
    '2024-09-01'
  ],
  [
    'STU-2026-004',
    '1165432109',
    'زينب',
    'المهيدب',
    'زينب طلال المهيدب',
    'female',
    '2020-02-18',
    'KG2',
    'KG2-A',
    'CLS-KG2-A',
    'arabic-a',
    'منى عبد الرحمن السبيعي',
    'mother',
    '+966524567890',
    'mona.subaie@example.com',
    'الرياض - حي النرجس',
    'active',
    '2025-09-01'
  ]
];

// Sheet 4: Staff_Admin
const staffHeaders = [
  'staff_id',
  'national_id',
  'first_name',
  'last_name',
  'full_name',
  'email',
  'role',
  'department',
  'job_title',
  'phone_number',
  'permissions_group',
  'status',
  'hire_date'
];

const staffArabicLabels = [
  'معرف الموظف (Primary Key)',
  'رقم الهوية الوطنية / الإقامة',
  'الاسم الأول',
  'اسم العائلة',
  'الاسم الكامل بالعربية',
  'البريد الرسمي للمؤسسة (Supabase Auth)',
  'الدور الوظيفي (super_admin / school_admin / academic_coordinator / accountant / supervisor / hod)',
  'القسم الإداري',
  'المسمى الوظيفي المعتمد',
  'رقم الهاتف الجوال (مع مفتاح الدولة)',
  'مجموعة الصلاحيات (full_admin / academic_supervision / finance_readonly / student_affairs)',
  'حالة الحساب (active / inactive)',
  'تاريخ المباشرة (YYYY-MM-DD)'
];

const staffSampleRows = [
  [
    'STF-001',
    '1012345678',
    'عبد الله',
    'الراشد',
    'أ. عبد الله محمد الراشد',
    'principal@school.edu.sa',
    'school_admin',
    'Executive Administration',
    'مدير عام المدرسة',
    '+966500112233',
    'full_admin',
    'active',
    '2020-08-01'
  ],
  [
    'STF-002',
    '1023456789',
    'أحمد',
    'المنصوري',
    'د. أحمد فهد المنصوري',
    'academic.coord@school.edu.sa',
    'academic_coordinator',
    'Academic Supervision',
    'المنسق الأكاديمي ورئيس قسم اللغة العربية',
    '+966502233445',
    'academic_supervision',
    'active',
    '2021-09-01'
  ],
  [
    'STF-003',
    '1034567890',
    'خالد',
    'التميمي',
    'أ. خالد بن إبراهيم التميمي',
    'finance@school.edu.sa',
    'accountant',
    'Financial Affairs',
    'المحاسب المالي ورئيس الحسابات',
    '+966503344556',
    'finance_readonly',
    'active',
    '2022-01-10'
  ],
  [
    'STF-004',
    '1045678901',
    'نورة',
    'القحطاني',
    'أ. نورة صالح القحطاني',
    'supervisor@school.edu.sa',
    'supervisor',
    'Student Affairs',
    'مشرفة التوجيه والإرشاد الطلابي',
    '+966504455667',
    'student_affairs',
    'active',
    '2023-08-15'
  ]
];

// Sheet 5: Lookups_Instructions
const lookupsHeaders = [
  'lookup_category',
  'valid_code_value',
  'label_ar',
  'applicable_sheet',
  'notes_and_rules'
];

const lookupsArabicLabels = [
  'تصنيف القيمة (Lookup Category)',
  'القيمة البرمجية في قاعدة البيانات (Value Code)',
  'المسمى العربي المقابل',
  'ورقة العمل المرتبطة',
  'ملاحظات وقواعد التحقق الإلزامية'
];

const lookupsRows = [
  // Gender
  ['gender', 'male', 'ذكر', 'Students, Teachers', 'يكتب بأحرف صغيرة lowercase'],
  ['gender', 'female', 'أنثى', 'Students, Teachers', 'يكتب بأحرف صغيرة lowercase'],
  
  // Student Status
  ['student_status', 'active', 'مقيد / نشط', 'Students', 'الطالب منتظم في الدراسة'],
  ['student_status', 'transferred', 'منقول', 'Students', 'انتقل إلى مدرسة أخرى'],
  ['student_status', 'graduated', 'متخرج', 'Students', 'أتم المرحلة الدراسية بنجاح'],
  
  // Teacher Employment Status
  ['employment_status', 'active', 'على رأس العمل', 'Teachers, Staff_Admin', 'الحساب مفعل ويمتلك صلاحيات'],
  ['employment_status', 'on_leave', 'في إجازة رسمية', 'Teachers', 'معلق مؤقتاً خلال فترة الإجازة'],
  ['employment_status', 'resigned', 'مستقيل / منتهي العقد', 'Teachers, Staff_Admin', 'ملف مؤرشف دون حذف السجلات التاريخية'],
  
  // Staff Roles
  ['staff_role', 'school_admin', 'مدير مدرسة', 'Staff_Admin', 'صلاحية الإدارة المدرسية الكاملة للمؤسسة'],
  ['staff_role', 'academic_coordinator', 'منسق أكاديمي / رئيس قسم', 'Staff_Admin', 'إشراف على المعلمين والمناهج والدرجات'],
  ['staff_role', 'accountant', 'محاسب مالي', 'Staff_Admin', 'إدارة الرسوم والاشتراكات'],
  ['staff_role', 'supervisor', 'مشرف تربوي / إداري', 'Staff_Admin', 'متابعة الحضور والغياب وسلوكيات الطلاب'],
  ['staff_role', 'super_admin', 'مشرف عام المنظومة', 'Staff_Admin', 'صلاحيات عليا على مستوى جميع المدارس'],
  ['staff_role', 'hod', 'رئيس قسم (HOD)', 'Staff_Admin', 'متابعة كشوف الدرجات والواجبات'],
  
  // Stages
  ['stage', 'kindergarten', 'مرحلة رياض الأطفال', 'Classes_Grades', 'تشمل KG1 و KG2 و KG3'],
  ['stage', 'primary', 'المرحلة الابتدائية', 'Classes_Grades', 'تشمل من الصف الأول إلى السادس'],
  ['stage', 'middle', 'المرحلة المتوسطة', 'Classes_Grades', 'تشمل من الصف السابع إلى التاسع'],
  ['stage', 'high', 'المرحلة الثانوية', 'Classes_Grades', 'تشمل من الصف العاشر إلى الثاني عشر'],
  
  // Tracks
  ['track', 'arabic-a', 'ناطقين بالعربية (Arabic A)', 'Classes_Grades, Students', 'المنهج المتقدم الفصيح'],
  ['track', 'arabic-b', 'ناطقين بغيرها (Arabic B)', 'Classes_Grades, Students', 'المنهج التأسيسي الميسر'],
  
  // Date and Phone Rules
  ['formatting_rules', 'YYYY-MM-DD', 'صيغة التاريخ الدولية الموحدة', 'All Sheets', 'مثال: 2019-03-15 (يمنع استخدام DD/MM/YYYY لتجنب أخطاء التحويل)'],
  ['formatting_rules', '+E.164 Phone', 'صيغة أرقام الهواتف الدولية', 'All Sheets', 'مثال: +966501234567 مع علامة + ومفتاح الدولة بدون مسافات أو أصفار بادئة'],
  ['formatting_rules', 'Foreign Key Class', 'معرف الفصل class_id', 'Students -> Classes_Grades', 'يجب أن يتطابق class_id في ورقة الطلاب تماماً مع class_id المسجل في ورقة Classes_Grades']
];

// Helper to construct sheet with auto-width
function createFormattedSheet(headers, arabicLabels, dataRows) {
  const aoa = [headers, arabicLabels, ...dataRows];
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Calculate column widths
  const colWidths = headers.map((col, i) => {
    let maxLen = Math.max(
      col.length,
      arabicLabels[i] ? arabicLabels[i].length * 1.5 : 10
    );
    dataRows.forEach(row => {
      const cellVal = row[i] !== undefined && row[i] !== null ? String(row[i]) : '';
      maxLen = Math.max(maxLen, cellVal.length * 1.2);
    });
    return { wch: Math.min(Math.max(Math.ceil(maxLen) + 3, 14), 45) };
  });

  ws['!cols'] = colWidths;
  return ws;
}

// 2. Generate Master Workbook
const wb = XLSX.utils.book_new();

const wsClasses = createFormattedSheet(classesHeaders, classesArabicLabels, classesSampleRows);
XLSX.utils.book_append_sheet(wb, wsClasses, 'Classes_Grades');

const wsTeachers = createFormattedSheet(teachersHeaders, teachersArabicLabels, teachersSampleRows);
XLSX.utils.book_append_sheet(wb, wsTeachers, 'Teachers');

const wsStudents = createFormattedSheet(studentsHeaders, studentsArabicLabels, studentsSampleRows);
XLSX.utils.book_append_sheet(wb, wsStudents, 'Students');

const wsStaff = createFormattedSheet(staffHeaders, staffArabicLabels, staffSampleRows);
XLSX.utils.book_append_sheet(wb, wsStaff, 'Staff_Admin');

const wsLookups = createFormattedSheet(lookupsHeaders, lookupsArabicLabels, lookupsRows);
XLSX.utils.book_append_sheet(wb, wsLookups, 'Lookups_Instructions');

// Output target files
const distDir = path.resolve(__dirname, '../public/templates');
const csvDir = path.resolve(__dirname, '../public/templates/csv');

if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });
if (!fs.existsSync(csvDir)) fs.mkdirSync(csvDir, { recursive: true });

const xlsxPath = path.join(distDir, 'school_onboarding_template.xlsx');
XLSX.writeFile(wb, xlsxPath);

// Also copy to root public for easy direct download:
fs.copyFileSync(xlsxPath, path.resolve(__dirname, '../public/school_bulk_import_template.xlsx'));

// 3. Generate Clean CSVs (for direct Supabase / PostgreSQL COPY import)
// Note: CSV 1st row has pure database column headers (no row 2) so standard psql \copy or Supabase table import works 100% out of the box!
function exportCleanCsv(headers, rows, filename) {
  const csvWb = XLSX.utils.book_new();
  const csvWs = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const csvStr = XLSX.utils.sheet_to_csv(csvWs);
  fs.writeFileSync(path.join(csvDir, filename), csvStr, 'utf8');
}

exportCleanCsv(classesHeaders, classesSampleRows, 'classes_grades.csv');
exportCleanCsv(teachersHeaders, teachersSampleRows, 'teachers.csv');
exportCleanCsv(studentsHeaders, studentsSampleRows, 'students.csv');
exportCleanCsv(staffHeaders, staffSampleRows, 'staff_admin.csv');

console.log('✅ Generated Excel template at:', xlsxPath);
console.log('✅ Generated CSV templates in:', csvDir);
