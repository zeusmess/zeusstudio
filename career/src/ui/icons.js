// Line icons (Lucide, ISC licence) rendered as inline SVG strings.
import {
  AlarmClock,
  BadgeCheck,
  Bell,
  BookOpen,
  Briefcase,
  Building2,
  ChartColumn,
  Check,
  ChefHat,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Coffee,
  Crown,
  Download,
  Flame,
  GraduationCap,
  IdCard,
  Info,
  Link2,
  LogOut,
  Mail,
  Map,
  Megaphone,
  Medal,
  Menu,
  RefreshCw,
  Rocket,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Sparkles,
  Store,
  Target,
  ThermometerSnowflake,
  Trash2,
  TriangleAlert,
  Trophy,
  User,
  UserPlus,
  Users,
  Wrench,
  X,
} from 'lucide'

const NODES = {
  alarm: AlarmClock,
  badge: BadgeCheck,
  bell: Bell,
  book: BookOpen,
  briefcase: Briefcase,
  building: Building2,
  chart: ChartColumn,
  check: Check,
  chef: ChefHat,
  clipboardCheck: ClipboardCheck,
  clipboard: ClipboardList,
  clock: Clock,
  coffee: Coffee,
  crown: Crown,
  download: Download,
  flame: Flame,
  grad: GraduationCap,
  idCard: IdCard,
  info: Info,
  link: Link2,
  logout: LogOut,
  mail: Mail,
  map: Map,
  megaphone: Megaphone,
  medal: Medal,
  menu: Menu,
  refresh: RefreshCw,
  rocket: Rocket,
  settings: Settings,
  shield: Shield,
  shieldAlert: ShieldAlert,
  shieldCheck: ShieldCheck,
  siren: Siren,
  sparkles: Sparkles,
  store: Store,
  target: Target,
  thermo: ThermometerSnowflake,
  trash: Trash2,
  alert: TriangleAlert,
  trophy: Trophy,
  user: User,
  userPlus: UserPlus,
  users: Users,
  wrench: Wrench,
  x: X,
}

function attrs(obj) {
  return Object.entries(obj)
    .map(([k, v]) => `${k}="${String(v).replace(/"/g, '&quot;')}"`)
    .join(' ')
}

/** <svg> markup for an icon; size and colour come from the classes (currentColor). */
export function icon(name, cls = 'w-5 h-5') {
  const node = NODES[name]
  if (!node) return ''
  const inner = node.map(([tag, a]) => `<${tag} ${attrs(a)}/>`).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${cls}" aria-hidden="true" focusable="false">${inner}</svg>`
}

/** The multicolour Google "G" for the sign-in button. */
export const GOOGLE_G = `<svg viewBox="0 0 48 48" class="w-5 h-5" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>`
