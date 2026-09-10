import { BookItem } from './types';

export const INITIAL_BOOKS: BookItem[] = [
  {
    id: 'book_interactive_demo',
    title: 'مغامرة في وادي الحروف',
    author: 'منصة تعلَّم مع موسى',
    coverUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=600&q=80',
    readUrl: '#',
    category: 'قصص تفاعلية مصورة',
    targetAge: '6-9 سنوات',
    // صفحات القصة المصورة بدقة عالية للتنقل التفاعلي
    pages: [
      'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1532012164546-f432f2e3777a?auto=format&fit=crop&w=1000&q=80'
    ],
    assignedGrades: ['grade-1', 'grade-2', 'grade-3'],
    assignedTracks: ['arabic-a', 'arabic-b'],
  },
  {
    id: 'book_bt_1',
    title: 'غطاس في بلاد الأناناس',
    author: 'مكتبة بوك تايم المفتوحة',
    coverUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=400&q=80',
    readUrl: 'https://www.booktime.org/ar',
    category: 'كتب مصورة',
    targetAge: '4-7 سنوات',
    assignedGrades: ['kg', 'grade-1'],
    assignedTracks: ['arabic-a', 'arabic-b'],
  },
  {
    id: 'book_bt_2',
    title: 'عصا المكنسة السحرية',
    author: 'مكتبة بوك تايم المفتوحة',
    coverUrl: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=400&q=80',
    readUrl: 'https://www.booktime.org/ar',
    category: 'قصص خيالية هادفة',
    targetAge: '6-9 سنوات',
    assignedGrades: ['grade-2', 'grade-3'],
    assignedTracks: ['arabic-a'],
  }
];
