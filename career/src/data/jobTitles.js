// Job titles a partner picks when registering (their real title at the company,
// shown in the players list). It is separate from the in-game career rank.
export const JOB_TITLES = [
  { key: 'barista', label: 'باريستا (Barista)' },
  { key: 'barista_trainer', label: 'باريستا مدرب (Barista Trainer)' },
  { key: 'shift_supervisor', label: 'مشرف وردية (Shift Supervisor)' },
  { key: 'asm', label: 'مساعد مدير فرع (ASM)' },
  { key: 'store_manager', label: 'مدير فرع (Store Manager)' },
  { key: 'area_manager', label: 'مدير منطقة (Area Manager)' },
  { key: 'operations', label: 'إدارة العمليات (Operations)' },
  { key: 'training', label: 'إدارة التدريب (Training)' },
  { key: 'support_center', label: 'المكتب الرئيسي (Support Center)' },
  { key: 'other', label: 'أخرى (Other)' },
]

export function jobTitleLabel(key) {
  return (JOB_TITLES.find((t) => t.key === key) || JOB_TITLES[JOB_TITLES.length - 1]).label
}
