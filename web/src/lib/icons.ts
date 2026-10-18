import {
  createElement,
  forwardRef,
  type ForwardRefExoticComponent,
  type RefAttributes,
} from 'react';
import {
  ArrowDown as PhArrowDown,
  ArrowDownRight as PhArrowDownRight,
  ArrowLeft as PhArrowLeft,
  ArrowRight as PhArrowRight,
  ArrowSquareOut,
  ArrowsClockwise,
  ArrowsDownUp,
  ArrowsLeftRight,
  ArrowUp as PhArrowUp,
  ArrowUpRight as PhArrowUpRight,
  Barricade,
  Bell as PhBell,
  Briefcase,
  Buildings,
  Calendar as PhCalendar,
  CalendarBlank,
  CaretDoubleLeft,
  CaretDoubleRight,
  CaretDown,
  CaretLeft,
  CaretRight,
  CaretUp,
  ChartBar,
  ChartLine,
  ChatCircle,
  Check as PhCheck,
  CheckCircle,
  Checks,
  CheckSquare as PhCheckSquare,
  Circle as PhCircle,
  CircleNotch,
  ClipboardText as PhClipboardText,
  Clock as PhClock,
  ClockCounterClockwise,
  Confetti,
  Copy as PhCopy,
  CurrencyCircleDollar,
  CurrencyDollar,
  CursorClick,
  DotsSixVertical,
  DotsThree,
  DotsThreeVertical,
  DownloadSimple,
  Envelope,
  Eye as PhEye,
  EyeSlash as PhEyeSlash,
  File as PhFile,
  FileImage as PhFileImage,
  FileText as PhFileText,
  Fire as PhFire,
  Flag as PhFlag,
  Folder as PhFolder,
  Funnel,
  Gauge as PhGauge,
  Gear,
  GraduationCap as PhGraduationCap,
  Hourglass as PhHourglass,
  House,
  Image as PhImage,
  Info as PhInfo,
  Layout as PhLayout,
  Lifebuoy,
  Lightbulb as PhLightbulb,
  Link as PhLink,
  List as PhList,
  ListBullets,
  Lock as PhLock,
  MagnifyingGlass,
  MapPin as PhMapPin,
  Microphone,
  Moon as PhMoon,
  MusicNote,
  Paperclip as PhPaperclip,
  PaperPlaneTilt,
  PencilSimple,
  Percent as PhPercent,
  Phone as PhPhone,
  Play as PhPlay,
  Plus as PhPlus,
  PushPin as PhPushPin,
  Rocket as PhRocket,
  ShieldCheck as PhShieldCheck,
  ShieldWarning,
  SignOut,
  Sliders,
  SlidersHorizontal as PhSlidersHorizontal,
  Sparkle,
  SquaresFour,
  Stack,
  Star as PhStar,
  Sun as PhSun,
  Target as PhTarget,
  Ticket as PhTicket,
  Trash,
  Tray,
  TrendDown,
  TrendUp,
  Trophy as PhTrophy,
  UploadSimple,
  User as PhUser,
  UserCircle,
  UserPlus as PhUserPlus,
  Users as PhUsers,
  Wallet as PhWallet,
  Warning,
  WarningCircle,
  X as PhX,
  XCircle as PhXCircle,
  type Icon,
  type IconProps,
  type IconWeight,
} from '@phosphor-icons/react';

export type LucideProps = Omit<IconProps, 'weight'> & {
  strokeWidth?: number;
};

export type LucideIcon = ForwardRefExoticComponent<LucideProps & RefAttributes<SVGSVGElement>>;

function weightFromStroke(strokeWidth: number | undefined, fallback: IconWeight): IconWeight {
  if (strokeWidth == null) return fallback;
  if (strokeWidth >= 2.1) return 'regular';
  return fallback;
}

function adapt(Source: Icon, fallback: IconWeight = 'light'): LucideIcon {
  return forwardRef<SVGSVGElement, LucideProps>(function AdaptedIcon(
    { strokeWidth, size = 24, ...props },
    ref,
  ) {
    return createElement(Source, {
      ...props,
      ref,
      size,
      weight: weightFromStroke(strokeWidth, fallback),
    });
  });
}

export const AlertCircle = adapt(WarningCircle);
export const AlertTriangle = adapt(Warning);
export const ArrowDown = adapt(PhArrowDown);
export const ArrowDownRight = adapt(PhArrowDownRight);
export const ArrowLeft = adapt(PhArrowLeft);
export const ArrowRight = adapt(PhArrowRight);
export const ArrowRightLeft = adapt(ArrowsLeftRight);
export const ArrowUp = adapt(PhArrowUp);
export const ArrowUpDown = adapt(ArrowsDownUp);
export const ArrowUpRight = adapt(PhArrowUpRight);
export const BarChart3 = adapt(ChartBar);
export const Bell = adapt(PhBell);
export const BriefcaseBusiness = adapt(Briefcase);
export const Building2 = adapt(Buildings);
export const Calendar = adapt(PhCalendar);
export const CalendarClock = adapt(PhCalendar);
export const CalendarDays = adapt(CalendarBlank);
export const CalendarRange = adapt(PhCalendar);
export const ChartSpline = adapt(ChartLine);
export const Check = adapt(PhCheck);
export const CheckCheck = adapt(Checks);
export const CheckCircle2 = adapt(CheckCircle);
export const CheckSquare = adapt(PhCheckSquare);
export const ChevronDown = adapt(CaretDown);
export const ChevronLeft = adapt(CaretLeft);
export const ChevronRight = adapt(CaretRight);
export const ChevronUp = adapt(CaretUp);
export const ChevronsLeft = adapt(CaretDoubleLeft);
export const ChevronsRight = adapt(CaretDoubleRight);
export const Circle = adapt(PhCircle);
export const CircleDollarSign = adapt(CurrencyCircleDollar);
export const ClipboardCheck = adapt(PhClipboardText);
export const Clock = adapt(PhClock);
export const Clock3 = adapt(PhClock);
export const Construction = adapt(Barricade);
export const Copy = adapt(PhCopy);
export const DollarSign = adapt(CurrencyDollar);
export const Download = adapt(DownloadSimple);
export const ExternalLink = adapt(ArrowSquareOut);
export const Eye = adapt(PhEye);
export const EyeOff = adapt(PhEyeSlash);
export const File = adapt(PhFile);
export const FileImage = adapt(PhFileImage);
export const FileText = adapt(PhFileText);
export const Filter = adapt(Funnel);
export const Flag = adapt(PhFlag);
export const Flame = adapt(PhFire);
export const Folder = adapt(PhFolder);
export const Gauge = adapt(PhGauge);
export const GraduationCap = adapt(PhGraduationCap);
export const GripVertical = adapt(DotsSixVertical);
export const History = adapt(ClockCounterClockwise);
export const Home = adapt(House);
export const Hourglass = adapt(PhHourglass);
export const ImagePlus = adapt(PhImage);
export const Inbox = adapt(Tray);
export const Info = adapt(PhInfo);
export const Layers = adapt(Stack);
export const LayoutGrid = adapt(SquaresFour);
export const LayoutList = adapt(ListBullets);
export const LayoutTemplate = adapt(PhLayout);
export const LifeBuoy = adapt(Lifebuoy);
export const Lightbulb = adapt(PhLightbulb);
export const Link2 = adapt(PhLink);
export const List = adapt(PhList);
export const ListTodo = adapt(PhCheckSquare);
export const Loader2 = adapt(CircleNotch);
export const Lock = adapt(PhLock);
export const LogOut = adapt(SignOut);
export const Mail = adapt(Envelope);
export const MapPin = adapt(PhMapPin);
export const Menu = adapt(PhList);
export const MessageSquare = adapt(ChatCircle);
export const Mic = adapt(Microphone);
export const Moon = adapt(PhMoon);
export const MoreHorizontal = adapt(DotsThree);
export const MoreVertical = adapt(DotsThreeVertical);
export const MousePointerClick = adapt(CursorClick);
export const Music2 = adapt(MusicNote);
export const PartyPopper = adapt(Confetti);
export const Paperclip = adapt(PhPaperclip);
export const Pencil = adapt(PencilSimple);
export const Percent = adapt(PhPercent);
export const Phone = adapt(PhPhone);
export const Play = adapt(PhPlay);
export const Plus = adapt(PhPlus);
export const PushPin = adapt(PhPushPin);
export const RefreshCw = adapt(ArrowsClockwise);
export const Rocket = adapt(PhRocket);
export const Search = adapt(MagnifyingGlass);
export const Send = adapt(PaperPlaneTilt);
export const Settings = adapt(Gear);
export const Settings2 = adapt(Sliders);
export const ShieldAlert = adapt(ShieldWarning);
export const ShieldCheck = adapt(PhShieldCheck);
export const SlidersHorizontal = adapt(PhSlidersHorizontal);
export const Sparkles = adapt(Sparkle);
export const Star = adapt(PhStar);
export const Sun = adapt(PhSun);
export const Target = adapt(PhTarget);
export const Ticket = adapt(PhTicket);
export const Trash2 = adapt(Trash);
export const TrendingDown = adapt(TrendDown);
export const TrendingUp = adapt(TrendUp);
export const Trophy = adapt(PhTrophy);
export const Upload = adapt(UploadSimple);
export const User = adapt(PhUser);
export const UserPlus = adapt(PhUserPlus);
export const UserRound = adapt(UserCircle);
export const Users = adapt(PhUsers);
export const Wallet = adapt(PhWallet);
export const X = adapt(PhX);
export const XCircle = adapt(PhXCircle);
