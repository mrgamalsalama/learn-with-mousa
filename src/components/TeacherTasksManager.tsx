import React, { useState, useEffect } from 'react';
import { UserProfile, TeacherTask } from '../types';
import { getTeacherTasks, saveTeacherTask, deleteTeacherTask, toggleTeacherTaskCompleted, syncTeacherTasksFromCloud } from '../storage';
import { canManageTeacherTasks } from '../utils/permissions';
import { 
  ListTodo, 
  Plus, 
  Trash2, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  Search, 
  Filter, 
  Calendar, 
  User, 
  ShieldCheck, 
  Sparkles,
  Check
} from 'lucide-react';

interface TeacherTasksManagerProps {
  actorUser: UserProfile;
  teachers: UserProfile[];
  onTasksUpdated?: () => void;
}

export const TeacherTasksManager: React.FC<TeacherTasksManagerProps> = ({
  actorUser,
  teachers,
  onTasksUpdated,
}) => {
  const [tasks, setTasks] = useState<TeacherTask[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [filterTeacherId, setFilterTeacherId] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [taskToDelete, setTaskToDelete] = useState<TeacherTask | null>(null);

  // Form State
  const [formTeacherId, setFormTeacherId] = useState<string>('');
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPriority, setFormPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [formDueDate, setFormDueDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const isAuthorized = canManageTeacherTasks(actorUser);

  const loadTasks = async () => {
    const list = getTeacherTasks();
    setTasks(list);
    try {
      const cloudList = await syncTeacherTasksFromCloud();
      setTasks(cloudList);
    } catch (e) {}
  };

  useEffect(() => {
    loadTasks();
    if (teachers.length > 0 && !formTeacherId) {
      setFormTeacherId(teachers[0].id);
    }
  }, [teachers]);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTeacherId || !formTitle.trim()) {
      setFormError('يرجى تحديد المعلم وكتابة عنوان المهمة.');
      return;
    }

    const assignedTeacher = teachers.find(t => t.id === formTeacherId);

    const newTask: TeacherTask = {
      id: 'task_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      teacherId: formTeacherId,
      teacherName: assignedTeacher ? assignedTeacher.name : 'معلم',
      title: formTitle.trim(),
      description: formDescription.trim() || undefined,
      priority: formPriority,
      dueDate: formDueDate || undefined,
      completed: false,
      assignedBy: actorUser.name,
      assignedByRole: actorUser.role === 'super_admin' ? 'super_admin' : 'hod',
      createdAt: new Date().toISOString(),
    };

    setIsSubmitting(true);
    setFormError(null);

    try {
      const res = await saveTeacherTask(newTask, actorUser);
      if (res.error) {
        setFormError(res.error.message || 'حدث خطأ أثناء حفظ المهمة.');
      } else {
        setTasks(prev => [newTask, ...prev]);
        setIsCreateModalOpen(false);
        setFormTitle('');
        setFormDescription('');
        setFormDueDate('');
        onTasksUpdated?.();
      }
    } catch (err: any) {
      setFormError(err.message || 'فشل إسناد المهمة.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTask = async () => {
    if (!taskToDelete) return;
    try {
      await deleteTeacherTask(taskToDelete.id, actorUser);
      setTasks(prev => prev.filter(t => t.id !== taskToDelete.id));
      setTaskToDelete(null);
      onTasksUpdated?.();
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleCompleted = async (task: TeacherTask) => {
    const updated = await toggleTeacherTaskCompleted(task.id, actorUser.id);
    if (updated) {
      setTasks(prev => prev.map(t => (t.id === task.id ? updated : t)));
      onTasksUpdated?.();
    }
  };

  // Filtering
  const filteredTasks = tasks.filter(t => {
    if (filterTeacherId !== 'all' && t.teacherId !== filterTeacherId) return false;
    if (filterStatus === 'pending' && t.completed) return false;
    if (filterStatus === 'completed' && !t.completed) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = t.title.toLowerCase().includes(q);
      const matchDesc = t.description?.toLowerCase().includes(q) || false;
      const matchTeacher = t.teacherName?.toLowerCase().includes(q) || false;
      if (!matchTitle && !matchDesc && !matchTeacher) return false;
    }
    return true;
  });

  const pendingCount = tasks.filter(t => !t.completed).length;
  const completedCount = tasks.filter(t => t.completed).length;

  return (
    <div id="teacher-tasks-manager" className="space-y-6">
      {/* Top Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-teal-900 via-emerald-950 to-slate-950 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 border border-teal-800/40">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full bg-teal-500/20 text-teal-300 text-xs font-bold border border-teal-400/30">
              إدارة التكليفات والمهام الرسمية
            </span>
            <span className="text-xs text-teal-200">خاص بالإدارة ورئيس القسم 🔒</span>
          </div>
          <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
            <ListTodo className="w-6 h-6 text-teal-400" />
            إدارة مهام وتكليفات المعلمين
          </h2>
          <p className="text-xs text-teal-100/80 mt-1">
            إسناد التكليفات الرسمية ومتابعة تنفيذها دورياً مع حظر المعلم من تعديل أو حذف المهام.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            id="open-create-task-modal-btn"
            onClick={() => setIsCreateModalOpen(true)}
            disabled={!isAuthorized}
            className="px-4 py-2.5 bg-teal-500 hover:bg-teal-600 active:bg-teal-700 text-slate-950 rounded-xl text-xs font-extrabold shadow-lg shadow-teal-500/20 flex items-center gap-2 transition-all disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            إضافة مهمة جديدة للمعلم
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-slate-500">إجمالي التكليفات</div>
            <div className="text-2xl font-black text-slate-900 mt-1">{tasks.length}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
            <ListTodo className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-amber-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-amber-700">قيد التنفيذ والمتابعة</div>
            <div className="text-2xl font-black text-amber-600 mt-1">{pendingCount}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-emerald-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-emerald-700">المهام المنجزة</div>
            <div className="text-2xl font-black text-emerald-600 mt-1">{completedCount}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <CheckCircle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="flex-1 w-full md:w-auto relative">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="بحث في التكليفات أو اسم المعلم..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pr-9 pl-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:border-teal-500 transition-all"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Filter by Teacher */}
          <select
            value={filterTeacherId}
            onChange={e => setFilterTeacherId(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:border-teal-500"
          >
            <option value="all">جميع المعلمين</option>
            {teachers.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>

          {/* Filter by Status */}
          <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-3 py-1 rounded-lg transition-all ${
                filterStatus === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
              }`}
            >
              الكل
            </button>
            <button
              onClick={() => setFilterStatus('pending')}
              className={`px-3 py-1 rounded-lg transition-all ${
                filterStatus === 'pending' ? 'bg-white text-amber-700 shadow-sm' : 'text-slate-500'
              }`}
            >
              قيد التنفيذ
            </button>
            <button
              onClick={() => setFilterStatus('completed')}
              className={`px-3 py-1 rounded-lg transition-all ${
                filterStatus === 'completed' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'
              }`}
            >
              المكتملة
            </button>
          </div>
        </div>
      </div>

      {/* Tasks List */}
      {filteredTasks.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-sm">
          <ListTodo className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-700">لا توجد مهام تطابق البحث أو التصفية</h3>
          <p className="text-xs text-slate-400 mt-1">
            يمكنك إسناد تكليف جديد بالنقر على زر «إضافة مهمة جديدة للمعلم» بالأعلى.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredTasks.map(task => {
            const priorityBadge = 
              task.priority === 'high' 
                ? { label: 'عاجلة', color: 'bg-rose-100 text-rose-700 border-rose-200' }
                : task.priority === 'medium'
                ? { label: 'متوسطة', color: 'bg-amber-100 text-amber-700 border-amber-200' }
                : { label: 'عادية', color: 'bg-slate-100 text-slate-600 border-slate-200' };

            return (
              <div
                key={task.id}
                id={`task-card-${task.id}`}
                className={`p-5 rounded-2xl border transition-all flex flex-col justify-between ${
                  task.completed
                    ? 'bg-emerald-50/30 border-emerald-200'
                    : 'bg-white border-slate-200 shadow-sm hover:border-teal-300'
                }`}
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${priorityBadge.color}`}>
                        {priorityBadge.label}
                      </span>
                      <span className="text-[11px] font-semibold text-teal-800 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-100 flex items-center gap-1">
                        <User className="w-3 h-3 text-teal-600" />
                        {task.teacherName || 'معلم'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      {/* Delete Task Button - Exclusively for Admin / HOD */}
                      <button
                        id={`delete-task-${task.id}`}
                        onClick={() => setTaskToDelete(task)}
                        title="حذف المهمة (حصري للإدارة ورئيس القسم)"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Task Title & Description */}
                  <h4 className={`text-sm font-bold mt-1 ${task.completed ? 'text-slate-500 line-through' : 'text-slate-900'}`}>
                    {task.title}
                  </h4>

                  {task.description && (
                    <p className="text-xs text-slate-600 mt-2 leading-relaxed whitespace-pre-line bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                      {task.description}
                    </p>
                  )}
                </div>

                {/* Card Footer */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
                  <div className="space-y-1 text-[11px] text-slate-500">
                    <div className="flex items-center gap-1">
                      <span className="font-semibold text-slate-700">المسند:</span>
                      <span>{task.assignedBy}</span>
                      <span className="text-[10px] text-teal-700 font-bold">
                        ({task.assignedByRole === 'super_admin' ? 'الإدارة العليا' : 'رئيس القسم'})
                      </span>
                    </div>
                    {task.dueDate && (
                      <div className="flex items-center gap-1 text-slate-600">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        <span>الاستحقاق: {task.dueDate}</span>
                      </div>
                    )}
                  </div>

                  {/* Status Toggle Button */}
                  <button
                    onClick={() => handleToggleCompleted(task)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                      task.completed
                        ? 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700'
                        : 'bg-slate-100 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 border border-slate-200'
                    }`}
                  >
                    {task.completed ? (
                      <>
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>مكتملة ✅</span>
                      </>
                    ) : (
                      <>
                        <Clock className="w-3.5 h-3.5 text-amber-500" />
                        <span>قيد التنفيذ</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Task Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div
            id="create-task-modal"
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="px-6 py-5 bg-gradient-to-r from-teal-800 to-emerald-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
                  <ListTodo className="w-5 h-5 text-teal-300" />
                </div>
                <div>
                  <h3 className="text-base font-bold">إسناد مهمة جديدة للمعلم</h3>
                  <p className="text-xs text-teal-100">توجيه وتكليف رسمي من الإدارة العليا أو رئيس القسم</p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-teal-100 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateTask} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
                  {formError}
                </div>
              )}

              {/* Select Teacher */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  المعلم المكلف بالمهمة *
                </label>
                <select
                  value={formTeacherId}
                  onChange={e => setFormTeacherId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none focus:border-teal-500"
                  required
                >
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.username})
                    </option>
                  ))}
                </select>
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  عنوان المهمة *
                </label>
                <input
                  type="text"
                  placeholder="مثال: إعداد بنك أسئلة الوعي الصوتي للصف الأول"
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:border-teal-500"
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  تفاصيل وتعليمات التكليف
                </label>
                <textarea
                  rows={3}
                  placeholder="اكتب التوجيهات والملاحظات المطلوب مراعاتها بدقة..."
                  value={formDescription}
                  onChange={e => setFormDescription(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:border-teal-500 resize-none"
                />
              </div>

              {/* Priority & Due Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    درجة الأولوية
                  </label>
                  <select
                    value={formPriority}
                    onChange={e => setFormPriority(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-teal-500"
                  >
                    <option value="low">عادية 🟢</option>
                    <option value="medium">متوسطة 🟡</option>
                    <option value="high">عاجلة 🔴</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    تاريخ الاستحقاق (اختياري)
                  </label>
                  <input
                    type="date"
                    value={formDueDate}
                    onChange={e => setFormDueDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              {/* Footer Buttons */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 rounded-xl"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-md shadow-teal-600/20 flex items-center gap-1.5 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  {isSubmitting ? 'جارٍ الإسناد...' : 'إسناد المهمة للمعلم'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Delete Dialog */}
      {taskToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6">
            <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4 border border-rose-100">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 text-center">
              تأكيد حذف المهمة
            </h3>
            <p className="text-xs text-slate-600 text-center mt-2 leading-relaxed">
              هل أنت متأكد من رغبتك في حذف المهمة: <span className="font-bold text-slate-800">«{taskToDelete.title}»</span>؟
              <br />
              <span className="text-rose-600 font-semibold">تنويه: صلاحية الحذف محصورة في الإدارة ورئيس القسم.</span>
            </p>

            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setTaskToDelete(null)}
                className="px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
              >
                تراجع
              </button>
              <button
                type="button"
                onClick={handleDeleteTask}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-600/20 transition-all"
              >
                تأكيد الحذف
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
