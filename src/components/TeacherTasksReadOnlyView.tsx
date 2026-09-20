import React, { useState, useEffect } from 'react';
import { UserProfile, TeacherTask } from '../types';
import { getTeacherTasks, toggleTeacherTaskCompleted, syncTeacherTasksFromCloud } from '../storage';
import { 
  ListTodo, 
  CheckCircle, 
  Clock, 
  Lock, 
  Calendar, 
  UserCheck, 
  Check, 
  Sparkles,
  AlertCircle
} from 'lucide-react';

interface TeacherTasksReadOnlyViewProps {
  currentTeacher: UserProfile;
  onTaskStatusToggled?: () => void;
}

export const TeacherTasksReadOnlyView: React.FC<TeacherTasksReadOnlyViewProps> = ({
  currentTeacher,
  onTaskStatusToggled,
}) => {
  const [tasks, setTasks] = useState<TeacherTask[]>([]);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'completed'>('all');
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const loadTasks = async () => {
    const allTasks = getTeacherTasks();
    const myTasks = allTasks.filter(t => t.teacherId === currentTeacher.id);
    setTasks(myTasks);

    try {
      const cloudTasks = await syncTeacherTasksFromCloud();
      const myCloudTasks = cloudTasks.filter(t => t.teacherId === currentTeacher.id);
      setTasks(myCloudTasks);
    } catch (e) {}
  };

  useEffect(() => {
    loadTasks();
  }, [currentTeacher.id]);

  const handleToggle = async (task: TeacherTask) => {
    setTogglingId(task.id);
    try {
      const updated = await toggleTeacherTaskCompleted(task.id, currentTeacher.id);
      if (updated) {
        setTasks(prev => prev.map(t => (t.id === task.id ? updated : t)));
        onTaskStatusToggled?.();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setTogglingId(null);
    }
  };

  const filteredTasks = tasks.filter(t => {
    if (filterStatus === 'pending') return !t.completed;
    if (filterStatus === 'completed') return t.completed;
    return true;
  });

  const pendingCount = tasks.filter(t => !t.completed).length;
  const completedCount = tasks.filter(t => t.completed).length;

  return (
    <div id="teacher-tasks-readonly-view" className="space-y-6">
      {/* Read-Only Top Header */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-blue-900 via-indigo-950 to-slate-900 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 border border-blue-800/40">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-xs font-bold border border-blue-400/30 flex items-center gap-1">
              <Lock className="w-3 h-3 text-amber-400" />
              عرض للقراءة فقط (Read-Only)
            </span>
            <span className="text-xs text-blue-200">صلاحيات المعلم الرسمية</span>
          </div>
          <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
            <ListTodo className="w-6 h-6 text-blue-400" />
            التكليفات والمهام المسندة إليك
          </h2>
          <p className="text-xs text-blue-100/80 mt-1">
            قائمة المهام والتوجيهات المعتمدة الصادرة لك من الإدارة العليا ورئيس القسم لمتابعة تنفيذها بدقة.
          </p>
        </div>

        {/* Status Counters */}
        <div className="flex items-center gap-3">
          <div className="px-3.5 py-2 rounded-xl bg-white/10 border border-white/15 text-center">
            <div className="text-[10px] text-blue-200 font-semibold">قيد التنفيذ</div>
            <div className="text-base font-black text-amber-300">{pendingCount}</div>
          </div>
          <div className="px-3.5 py-2 rounded-xl bg-white/10 border border-white/15 text-center">
            <div className="text-[10px] text-blue-200 font-semibold">المكتملة</div>
            <div className="text-base font-black text-emerald-300">{completedCount}</div>
          </div>
        </div>
      </div>

      {/* Strict Policy Notice */}
      <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200/80 flex items-start gap-3">
        <Lock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-800 leading-relaxed">
          <span className="font-bold">قواعد وضوابط إدارة المهام:</span> لا يملك المعلم أي صلاحية لإضافة، تعديل، أو حذف المهام، ولا تعديل صفوفه ومراحله (محصورة في الإدارة ورئيس القسم). الإجراء المتاح لك حصرياً هو النقر على زر <span className="font-bold text-teal-800 underline">[تحديد كمكتمل]</span> فور إنجاز التكليف.
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              filterStatus === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
            }`}
          >
            جميع التكليفات ({tasks.length})
          </button>
          <button
            onClick={() => setFilterStatus('pending')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              filterStatus === 'pending' ? 'bg-white text-amber-700 shadow-sm' : 'text-slate-500'
            }`}
          >
            المتبقية قيد التنفيذ ({pendingCount})
          </button>
          <button
            onClick={() => setFilterStatus('completed')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              filterStatus === 'completed' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'
            }`}
          >
            المكتملة ({completedCount})
          </button>
        </div>
      </div>

      {/* Tasks List */}
      {filteredTasks.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-sm">
          <ListTodo className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-700">لا توجد مهام مسندة إليك حالياً في هذا القسم</h3>
          <p className="text-xs text-slate-400 mt-1">
            عمل رائع وموفق! ستظهر هنا أي تكليفات أو توجيهات جديدة فور إسنادها لك من قِبل الإدارة ورئيس القسم.
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
                id={`teacher-task-card-${task.id}`}
                className={`p-5 rounded-2xl border transition-all flex flex-col justify-between ${
                  task.completed
                    ? 'bg-emerald-50/40 border-emerald-200'
                    : 'bg-white border-slate-200 shadow-sm hover:border-blue-300'
                }`}
              >
                <div>
                  {/* Top Badges */}
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${priorityBadge.color}`}>
                        {priorityBadge.label}
                      </span>
                      <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                        <UserCheck className="w-3 h-3 text-indigo-600" />
                        المسند: {task.assignedBy} ({task.assignedByRole === 'super_admin' ? 'الإدارة العليا' : 'رئيس القسم'})
                      </span>
                    </div>

                    {task.completed && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                        <Check className="w-3 h-3" /> تم الإنجاز
                      </span>
                    )}
                  </div>

                  {/* Task Title */}
                  <h4 className={`text-sm font-bold ${task.completed ? 'text-slate-500 line-through' : 'text-slate-900'}`}>
                    {task.title}
                  </h4>

                  {/* Task Instructions */}
                  {task.description && (
                    <p className="text-xs text-slate-600 mt-2.5 leading-relaxed whitespace-pre-line bg-slate-50 p-3 rounded-xl border border-slate-100">
                      {task.description}
                    </p>
                  )}

                  {/* Due Date & Completion Date */}
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                    {task.dueDate && (
                      <div className="flex items-center gap-1 text-slate-600">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        <span>تاريخ الاستحقاق: <strong className="text-slate-700">{task.dueDate}</strong></span>
                      </div>
                    )}
                    {task.completed && task.completedAt && (
                      <div className="flex items-center gap-1 text-emerald-700">
                        <CheckCircle className="w-3 h-3 text-emerald-600" />
                        <span>أنجزت في: {task.completedAt}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Single Action Button: [تحديد كمكتمل] */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end">
                  <button
                    id={`toggle-complete-btn-${task.id}`}
                    onClick={() => handleToggle(task)}
                    disabled={togglingId === task.id}
                    className={`w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-sm ${
                      task.completed
                        ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                        : 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-emerald-600/20'
                    }`}
                  >
                    {task.completed ? (
                      <>
                        <CheckCircle className="w-4 h-4 text-emerald-600" />
                        <span>إلغاء التحديد (إعادة للتنفيذ)</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>تحديد كمكتمل</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
