import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Brain,
  Heart,
  RotateCcw,
  Plus,
  Search,
  Download,
  Upload,
  Trash2,
  Calendar as CalendarIcon,
  List,
  BarChart2,
  ChevronLeft,
  ChevronRight,
  Save,
  CheckCircle2,
  Sunrise,
  Palette,
  Check,
  ArrowRight,
  X,
  Menu,
  XCircle,
  LogIn,
  LogOut,
  User as UserIcon,
} from "lucide-react";

// --- Firebase Imports ---
import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInAnonymously,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  User,
  signInWithCustomToken,
} from "firebase/auth";
import {
  getFirestore,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";

// --- Types ---
type RecordType = "MorningPage" | "BrainDump" | "Emotion" | "Retrospective";
type ThemeType = "pink" | "blue" | "green" | "purple";
type ViewMode = "list" | "calendar" | "stats";
const window = globalThis as any;

interface MindRecord {
  id: string;
  date: string; // YYYY-MM-DD
  type: RecordType;
  title: string;
  content: string;
  metadata?: {
    mood?: number; // 1-5
    tags?: string[];
  };
  createdAt?: any;
}

// --- Theme Config ---
const themes: Record<
  ThemeType,
  {
    name: string;
    primary: string;
    bgSoft: string;
    bgCard: string;
    btn: string;
    btnHover: string;
    ring: string;
    border: string;
    lightText: string;
    sidebarBg: string;
  }
> = {
  pink: {
    name: "블라썸 핑크",
    primary: "text-rose-500",
    bgSoft: "bg-rose-50",
    bgCard: "bg-rose-100",
    btn: "bg-rose-400",
    btnHover: "hover:bg-rose-500",
    ring: "focus:ring-rose-200",
    border: "border-rose-200",
    lightText: "text-rose-400",
    sidebarBg: "bg-rose-50/95",
  },
  blue: {
    name: "스카이 블루",
    primary: "text-sky-600",
    bgSoft: "bg-sky-50",
    bgCard: "bg-sky-100",
    btn: "bg-sky-400",
    btnHover: "hover:bg-sky-500",
    ring: "focus:ring-sky-200",
    border: "border-sky-200",
    lightText: "text-sky-400",
    sidebarBg: "bg-sky-50/95",
  },
  green: {
    name: "민트 그린",
    primary: "text-emerald-600",
    bgSoft: "bg-emerald-50",
    bgCard: "bg-emerald-100",
    btn: "bg-emerald-400",
    btnHover: "hover:bg-emerald-500",
    ring: "focus:ring-emerald-200",
    border: "border-emerald-200",
    lightText: "text-emerald-400",
    sidebarBg: "bg-emerald-50/95",
  },
  purple: {
    name: "라벤더 퍼플",
    primary: "text-violet-600",
    bgSoft: "bg-violet-50",
    bgCard: "bg-violet-100",
    btn: "bg-violet-400",
    btnHover: "hover:bg-violet-500",
    ring: "focus:ring-violet-200",
    border: "border-violet-200",
    lightText: "text-violet-400",
    sidebarBg: "bg-violet-50/95",
  },
};

// --- Utils ---
const formatDate = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const getTypeLabel = (type: RecordType) => {
  switch (type) {
    case "MorningPage":
      return "모닝 페이지";
    case "BrainDump":
      return "브레인 덤프";
    case "Emotion":
      return "감정 일지";
    case "Retrospective":
      return "회고";
  }
};

const getTypeColor = (type: RecordType) => {
  switch (type) {
    case "MorningPage":
      return "bg-orange-400";
    case "BrainDump":
      return "bg-purple-400";
    case "Emotion":
      return "bg-rose-400";
    case "Retrospective":
      return "bg-blue-400";
  }
};

const getTypeIcon = (type: RecordType, size = 18) => {
  switch (type) {
    case "MorningPage":
      return <Sunrise size={size} />;
    case "BrainDump":
      return <Brain size={size} />;
    case "Emotion":
      return <Heart size={size} />;
    case "Retrospective":
      return <RotateCcw size={size} />;
  }
};

// --- Main Component ---
export default function App() {
  // Global State
  const [user, setUser] = useState<User | null>(null);
  const [records, setRecords] = useState<MindRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<ThemeType>("pink");

  // View State
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // UI State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<MindRecord | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<string>("");

  // Filter State
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<RecordType | "All">("All");

  // Firebase Setup
  const [db, setDb] = useState<any>(null);
  const [auth, setAuth] = useState<any>(null);
  const [appId, setAppId] = useState<string>("default");

  // --- Initialization ---
  useEffect(() => {
    const savedTheme = localStorage.getItem("mind-note-theme") as ThemeType;
    if (savedTheme && themes[savedTheme]) setTheme(savedTheme);

    const firebaseConfig = {
      apiKey: "AIzaSyC1JEbkjksLdtQ45RTxrtEdK8F1SiISf_o",
      authDomain: "naheeria.firebaseapp.com",
      projectId: "naheeria",
      storageBucket: "naheeria.firebasestorage.app",
      messagingSenderId: "1044931479246",
      appId: "1:1044931479246:web:3487b435986f1b6e63729f",
      measurementId: "G-S295B6MGXC",
    };
    const _app = initializeApp(firebaseConfig);
    const _auth = getAuth(_app);
    const _db = getFirestore(_app);
    const _appId = window.__app_id || "default-app-id";

    setAuth(_auth);
    setDb(_db);
    setAppId(_appId);

    const initAuth = async () => {
      // If token provided by system
      if (window.__initial_auth_token) {
        await signInWithCustomToken(_auth, window.__initial_auth_token);
      } else {
        // Default to anonymous, but allow Google later
        // We wait for user action for Google login
        const currentUser = _auth.currentUser;
        if (!currentUser) {
          await signInAnonymously(_auth);
        }
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(_auth, (u) => {
      setUser(u);
      if (u) setLoading(false);
      else setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // --- Google Login ---
  const handleGoogleLogin = async () => {
    if (!auth) return;
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      setIsSidebarOpen(false);
      alert("구글 계정으로 로그인되었습니다! 데이터가 안전하게 저장됩니다.");
    } catch (error: any) {
      console.error(error);
      alert("로그인 중 오류가 발생했습니다: " + error.message);
    }
  };

  const handleLogout = async () => {
    if (!auth) return;
    if (
      confirm(
        "로그아웃 하시겠습니까? 익명 사용자일 경우 데이터가 사라질 수 있습니다."
      )
    ) {
      await signOut(auth);
      await signInAnonymously(auth); // Fallback to guest
      setIsSidebarOpen(false);
    }
  };

  // --- Data Fetching ---
  useEffect(() => {
    if (!user || !db) return;
    const q = collection(
      db,
      "artifacts",
      appId,
      "users",
      user.uid,
      "mind_records"
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loaded = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as MindRecord[];
      loaded.sort(
        (a, b) =>
          b.date.localeCompare(a.date) ||
          (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
      );
      setRecords(loaded);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user, db, appId]);

  // --- Actions ---
  const handleSave = async (data: any, existingId?: string) => {
    if (!user || !db) return;
    const colRef = collection(
      db,
      "artifacts",
      appId,
      "users",
      user.uid,
      "mind_records"
    );
    try {
      if (existingId) {
        await updateDoc(
          doc(
            db,
            "artifacts",
            appId,
            "users",
            user.uid,
            "mind_records",
            existingId
          ),
          data
        );
      } else {
        await addDoc(colRef, { ...data, createdAt: serverTimestamp() });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async () => {
    if (!user || !db || !deleteConfirmId) return;
    await deleteDoc(
      doc(
        db,
        "artifacts",
        appId,
        "users",
        user.uid,
        "mind_records",
        deleteConfirmId
      )
    );
    setDeleteConfirmId(null);
  };

  const handleExportCSV = () => {
    const header = ["ID", "Date", "Type", "Title", "Content", "Mood", "Tags"];
    const rows = records.map((r) => [
      r.id,
      r.date,
      getTypeLabel(r.type),
      `"${r.title.replace(/"/g, '""')}"`,
      `"${r.content.replace(/"/g, '""')}"`,
      r.metadata?.mood || "",
      r.metadata?.tags?.join(",") || "",
    ]);
    const csvContent = [
      header.join(","),
      ...rows.map((row) => row.join(",")),
    ].join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `mind_notes_${formatDate(new Date())}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setIsSidebarOpen(false);
  };

  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !user || !db) return;

    const file = e.target.files[0];
    const reader = new FileReader();

    setImportStatus("읽는 중...");

    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const rows = text.split("\n");
        // Remove BOM and Header
        const dataRows = rows.slice(1);

        const batch = writeBatch(db);
        let count = 0;

        for (const row of dataRows) {
          if (!row.trim()) continue;

          // Simple CSV parse (handling quotes slightly better)
          // Note: This is a basic parser. Complex CSVs might need a library.
          // Fallback split if match fails (simplified for robust usage)
          // Actually, for this specific export format, let's use a custom splitter
          // ID, Date, Type(Korean), Title, Content, Mood, Tags

          // A safer regex for CSV:
          const values: string[] = [];
          let current = "";
          let inQuote = false;
          for (let i = 0; i < row.length; i++) {
            const char = row[i];
            if (char === '"') {
              inQuote = !inQuote;
            } else if (char === "," && !inQuote) {
              values.push(current);
              current = "";
            } else {
              current += char;
            }
          }
          values.push(current);

          if (values.length < 5) continue;

          // Map Korean Type to Enum
          let type: RecordType = "BrainDump";
          if (values[2].includes("모닝")) type = "MorningPage";
          else if (values[2].includes("감정")) type = "Emotion";
          else if (values[2].includes("회고")) type = "Retrospective";

          // Cleanup Quotes
          const clean = (s: string) =>
            s ? s.replace(/^"|"$/g, "").replace(/""/g, '"') : "";

          const newDocRef = doc(
            collection(
              db,
              "artifacts",
              appId,
              "users",
              user.uid,
              "mind_records"
            )
          );
          batch.set(newDocRef, {
            date: clean(values[1]),
            type: type,
            title: clean(values[3]),
            content: clean(values[4]),
            metadata: {
              mood: values[5] ? parseInt(values[5]) : undefined,
              tags: values[6] ? clean(values[6]).split(",") : [],
            },
            createdAt: serverTimestamp(),
          });
          count++;
        }

        if (count > 0) {
          await batch.commit();
          alert(`${count}개의 기록을 성공적으로 복구했습니다!`);
          setImportStatus("");
          setIsSidebarOpen(false);
        } else {
          alert("복구할 데이터가 없거나 형식이 올바르지 않습니다.");
          setImportStatus("");
        }
      } catch (err) {
        console.error(err);
        alert("파일을 처리하는 중 오류가 발생했습니다.");
        setImportStatus("");
      }
    };
    reader.readAsText(file);
  };

  // --- Helper Logic ---
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const matchesSearch =
        r.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.content.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = filterType === "All" || r.type === filterType;
      const matchesDate =
        viewMode === "calendar" && selectedDate
          ? r.date === selectedDate
          : true;
      return matchesSearch && matchesType && matchesDate;
    });
  }, [records, searchTerm, filterType, viewMode, selectedDate]);

  const groupedRecords = useMemo(() => {
    const groups: { [key: string]: MindRecord[] } = {};
    filteredRecords.forEach((r) => {
      if (!groups[r.date]) groups[r.date] = [];
      groups[r.date].push(r);
    });
    return groups;
  }, [filteredRecords]);

  const getDaysInMonth = (year: number, month: number) =>
    new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) =>
    new Date(year, month, 1).getDay();
  const handlePrevMonth = () =>
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1)
    );
  const handleNextMonth = () =>
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1)
    );

  const monthlyRecords = useMemo(() => {
    const y = currentDate.getFullYear();
    const m = String(currentDate.getMonth() + 1).padStart(2, "0");
    return records.filter((r) => r.date.startsWith(`${y}-${m}`));
  }, [records, currentDate]);

  const moodStats = useMemo(() => {
    const moods = [0, 0, 0, 0, 0];
    let count = 0;
    monthlyRecords
      .filter((r) => r.type === "Emotion" && r.metadata?.mood)
      .forEach((r) => {
        moods[r.metadata!.mood! - 1]++;
        count++;
      });
    const maxMoodIndex = moods.indexOf(Math.max(...moods));
    return { counts: moods, maxMood: maxMoodIndex + 1, total: count };
  }, [monthlyRecords]);

  const typeStats = useMemo(() => {
    const counts: any = {
      MorningPage: 0,
      BrainDump: 0,
      Emotion: 0,
      Retrospective: 0,
    };
    monthlyRecords.forEach((r) => (counts[r.type] = (counts[r.type] || 0) + 1));
    return { counts };
  }, [monthlyRecords]);

  const currentTheme = themes[theme];

  if (loading)
    return (
      <div
        className={`flex items-center justify-center min-h-screen ${currentTheme.bgSoft}`}
      >
        <div
          className={`animate-bounce font-bold text-xl ${currentTheme.primary}`}
        >
          마음 정리 중...
        </div>
      </div>
    );

  return (
    <div
      className={`min-h-screen font-sans text-slate-700 pb-20 selection:${currentTheme.bgCard} ${currentTheme.bgSoft} relative overflow-x-hidden`}
    >
      {/* Sidebar Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm animate-in fade-in"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar Drawer */}
      <div
        className={`fixed top-0 left-0 bottom-0 w-72 z-50 transform transition-transform duration-300 ease-in-out shadow-2xl ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        } ${currentTheme.sidebarBg} backdrop-blur-md`}
      >
        <div className="p-6 h-full flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Brain size={24} className={currentTheme.primary} /> 메뉴
            </h2>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="p-2 hover:bg-black/5 rounded-full"
            >
              <X size={20} className="text-slate-500" />
            </button>
          </div>

          <div className="flex-1 space-y-6 overflow-y-auto">
            {/* User Profile */}
            <div className="bg-white/50 p-4 rounded-xl border border-white/20">
              <div className="flex items-center gap-3 mb-2">
                <div
                  className={`p-2 rounded-full bg-white ${currentTheme.primary}`}
                >
                  <UserIcon size={18} />
                </div>
                <div className="flex-1 overflow-hidden">
                  <p className="text-xs font-bold text-slate-500 uppercase">
                    현재 계정
                  </p>
                  <p className="text-sm font-bold text-slate-800 truncate">
                    {user?.isAnonymous
                      ? "게스트 (저장 안됨)"
                      : user?.email || "Google 사용자"}
                  </p>
                </div>
              </div>
              {user?.isAnonymous ? (
                <button
                  onClick={handleGoogleLogin}
                  className="w-full flex items-center justify-center gap-2 py-2 bg-white text-slate-700 text-sm font-bold rounded-lg shadow-sm hover:bg-slate-50 transition-colors"
                >
                  <LogIn size={14} /> Google 로그인/연동
                </button>
              ) : (
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-2 py-2 bg-slate-200 text-slate-600 text-sm font-bold rounded-lg hover:bg-slate-300 transition-colors"
                >
                  <LogOut size={14} /> 로그아웃
                </button>
              )}
            </div>

            {/* View Modes */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                보기 모드
              </label>
              {[
                { id: "list", label: "리스트 보기", icon: List },
                { id: "calendar", label: "캘린더 보기", icon: CalendarIcon },
                { id: "stats", label: "월간 리포트", icon: BarChart2 },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setViewMode(item.id as ViewMode);
                    setIsSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${
                    viewMode === item.id
                      ? `bg-white shadow-sm ${currentTheme.primary}`
                      : "text-slate-600 hover:bg-white/50"
                  }`}
                >
                  <item.icon size={18} /> {item.label}
                </button>
              ))}
            </div>

            {/* Filters */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                기록 필터
              </label>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    "All",
                    "MorningPage",
                    "BrainDump",
                    "Emotion",
                    "Retrospective",
                  ] as const
                ).map((t) => (
                  <button
                    key={t}
                    onClick={() => {
                      setFilterType(t);
                      setIsSidebarOpen(false);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      filterType === t
                        ? "bg-slate-800 text-white border-slate-800"
                        : "bg-white/50 text-slate-600 border-transparent hover:bg-white"
                    }`}
                  >
                    {t === "All" ? "전체" : getTypeLabel(t)}
                  </button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                데이터 관리
              </label>
              <button
                onClick={() => {
                  setIsThemeModalOpen(true);
                  setIsSidebarOpen(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-600 hover:bg-white/50 transition-all font-medium"
              >
                <Palette size={18} /> 테마 변경
              </button>
              <button
                onClick={handleExportCSV}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-600 hover:bg-white/50 transition-all font-medium"
              >
                <Download size={18} /> CSV 백업 (내보내기)
              </button>
              <label className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-600 hover:bg-white/50 transition-all font-medium cursor-pointer">
                <Upload size={18} />
                <span>{importStatus || "CSV 복구 (가져오기)"}</span>
                <input
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleImportCSV}
                  disabled={!!importStatus}
                />
              </label>
            </div>
          </div>

          <div className="pt-6 border-t border-black/5 text-center text-xs text-slate-400">
            마음 정리 노트 v2.0 (Pro)
          </div>
        </div>
      </div>

      {/* Header */}
      <header
        className={`sticky top-0 z-10 bg-white/90 backdrop-blur-md border-b px-4 py-3 shadow-sm ${currentTheme.border}`}
      >
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className={`p-2 rounded-xl transition-colors hover:bg-slate-100 text-slate-600 relative`}
            >
              <Menu size={24} />
              {user?.isAnonymous && (
                <div className="absolute top-2 right-2 w-2 h-2 bg-red-400 rounded-full ring-2 ring-white"></div>
              )}
            </button>
            <h1 className="text-lg font-bold text-slate-800">
              {viewMode === "list"
                ? "나의 기록"
                : viewMode === "calendar"
                ? "캘린더"
                : "월간 리포트"}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsSearchOpen(!isSearchOpen)}
              className={`p-2 text-slate-400 hover:${currentTheme.primary} rounded-full transition-colors`}
            >
              {isSearchOpen ? (
                <XCircle size={24} className={currentTheme.primary} />
              ) : (
                <Search size={22} />
              )}
            </button>
            <button
              onClick={() => {
                setEditingRecord(null);
                setIsModalOpen(true);
              }}
              className={`text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-lg transition-all flex items-center gap-2 active:scale-95 ${currentTheme.btn} ${currentTheme.btnHover}`}
            >
              <Plus size={20} />
              <span className="hidden sm:inline">기록하기</span>
            </button>
          </div>
        </div>

        {/* Search Bar Dropdown */}
        {isSearchOpen && (
          <div className="max-w-3xl mx-auto mt-3 animate-in slide-in-from-top-2 fade-in duration-200">
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                size={16}
              />
              <input
                type="text"
                placeholder="제목이나 내용으로 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`w-full pl-9 pr-4 py-2.5 bg-slate-50 border rounded-xl text-sm focus:outline-none focus:ring-2 transition-all ${currentTheme.border} ${currentTheme.ring}`}
                autoFocus
              />
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-4 py-6">
        {/* STATS VIEW */}
        {viewMode === "stats" && (
          <div className="animate-in fade-in zoom-in-95 duration-300 space-y-6">
            <div className="flex items-center justify-between mb-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
              <button
                onClick={handlePrevMonth}
                className="p-1 hover:bg-slate-100 rounded-full"
              >
                <ChevronLeft size={20} />
              </button>
              <h2 className="text-lg font-bold text-slate-800">
                {currentDate.getFullYear()}년 {currentDate.getMonth() + 1}월
              </h2>
              <button
                onClick={handleNextMonth}
                className="p-1 hover:bg-slate-100 rounded-full"
              >
                <ChevronRight size={20} />
              </button>
            </div>

            {monthlyRecords.length === 0 ? (
              <div className="text-center py-20 text-slate-400 bg-white rounded-3xl border border-slate-100">
                데이터가 없어요.
              </div>
            ) : (
              <>
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 relative overflow-hidden">
                  <div
                    className={`absolute top-0 left-0 w-full h-2 ${currentTheme.bgCard}`}
                  ></div>
                  <h3 className="text-slate-500 font-bold text-sm mb-6 flex items-center gap-2">
                    <Heart size={16} className="text-rose-400" /> 이번 달의 기분
                  </h3>
                  <div className="flex items-center justify-around mb-8">
                    <div className="text-center">
                      <div className="text-5xl mb-2 filter drop-shadow-md">
                        {
                          ["❓", "😡", "😢", "😐", "🙂", "🥰"][
                            moodStats.total > 0 ? moodStats.maxMood : 0
                          ]
                        }
                      </div>
                      <p className="text-xs font-bold text-slate-400">
                        주요 감정
                      </p>
                    </div>
                    <div className="w-px h-16 bg-slate-100"></div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-slate-700 mb-1">
                        {moodStats.total}회
                      </div>
                      <p className="text-xs font-bold text-slate-400">
                        총 기록
                      </p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {moodStats.counts.map((count, idx) => (
                      <div key={idx} className="flex items-center gap-3">
                        <span className="text-xl w-6 text-center">
                          {["😡", "😢", "😐", "🙂", "🥰"][idx]}
                        </span>
                        <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              [
                                "bg-red-400",
                                "bg-blue-400",
                                "bg-slate-400",
                                "bg-yellow-400",
                                "bg-pink-400",
                              ][idx]
                            }`}
                            style={{
                              width: `${
                                moodStats.total
                                  ? (count / moodStats.total) * 100
                                  : 0
                              }%`,
                            }}
                          ></div>
                        </div>
                        <span className="text-xs font-bold text-slate-400 w-8 text-right">
                          {count}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                  <h3 className="text-slate-500 font-bold text-sm mb-6 flex items-center gap-2">
                    <Brain size={16} className="text-purple-400" /> 기록 습관
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    {Object.entries(typeStats.counts).map(
                      ([type, count]: [string, any]) => (
                        <div
                          key={type}
                          className="p-3 bg-slate-50 rounded-2xl flex items-center justify-between border border-slate-100"
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className={`p-1.5 rounded-lg text-white ${getTypeColor(
                                type as RecordType
                              )}`}
                            >
                              {getTypeIcon(type as RecordType, 14)}
                            </div>
                            <span className="text-xs font-bold text-slate-600">
                              {getTypeLabel(type as RecordType).split(" ")[0]}
                            </span>
                          </div>
                          <span className="text-sm font-bold text-slate-800">
                            {count}회
                          </span>
                        </div>
                      )
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* CALENDAR VIEW */}
        {viewMode === "calendar" && (
          <div className="animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 mb-6">
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={handlePrevMonth}
                  className="p-2 hover:bg-slate-50 rounded-full text-slate-400 hover:text-slate-800"
                >
                  <ChevronLeft size={20} />
                </button>
                <h2 className="text-xl font-bold text-slate-800">
                  {currentDate.getFullYear()}.{" "}
                  {String(currentDate.getMonth() + 1).padStart(2, "0")}
                </h2>
                <button
                  onClick={handleNextMonth}
                  className="p-2 hover:bg-slate-50 rounded-full text-slate-400 hover:text-slate-800"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
              <div className="grid grid-cols-7 mb-2 text-center">
                {["일", "월", "화", "수", "목", "금", "토"].map((d, i) => (
                  <div
                    key={d}
                    className={`text-xs font-bold ${
                      i === 0 ? "text-red-400" : "text-slate-400"
                    }`}
                  >
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({
                  length: getFirstDayOfMonth(
                    currentDate.getFullYear(),
                    currentDate.getMonth()
                  ),
                }).map((_, i) => (
                  <div key={`empty-${i}`} className="aspect-square"></div>
                ))}
                {Array.from({
                  length: getDaysInMonth(
                    currentDate.getFullYear(),
                    currentDate.getMonth()
                  ),
                }).map((_, i) => {
                  const d = i + 1;
                  const dateStr = `${currentDate.getFullYear()}-${String(
                    currentDate.getMonth() + 1
                  ).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                  const hasRecords = records.filter((r) => r.date === dateStr);
                  const isSelected = selectedDate === dateStr;
                  const isToday = dateStr === formatDate(new Date());
                  return (
                    <button
                      key={d}
                      onClick={() =>
                        setSelectedDate(isSelected ? null : dateStr)
                      }
                      className={`aspect-square rounded-xl relative flex flex-col items-center justify-center transition-all ${
                        isSelected
                          ? `${
                              currentTheme.bgCard
                            } ring-2 ring-inset ${currentTheme.ring.replace(
                              "focus:",
                              ""
                            )}`
                          : "hover:bg-slate-50"
                      } ${
                        isToday
                          ? "font-bold text-slate-900 bg-slate-50"
                          : "text-slate-600"
                      }`}
                    >
                      <span
                        className={`text-sm ${
                          isToday ? currentTheme.primary : ""
                        }`}
                      >
                        {d}
                      </span>
                      <div className="flex gap-0.5 mt-1">
                        {hasRecords.slice(0, 3).map((r, idx) => (
                          <div
                            key={idx}
                            className={`w-1 h-1 rounded-full ${getTypeColor(
                              r.type
                            )}`}
                          ></div>
                        ))}
                        {hasRecords.length > 3 && (
                          <div className="w-1 h-1 rounded-full bg-slate-300"></div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
            {selectedDate && (
              <div className="flex items-center justify-between mb-2 px-1">
                <h3 className="font-bold text-slate-700">
                  {selectedDate.split("-")[2]}일의 기록{" "}
                  <span className="text-slate-400 text-sm font-normal">
                    ({filteredRecords.length})
                  </span>
                </h3>
                <button
                  onClick={() => setSelectedDate(null)}
                  className="text-xs text-slate-400 hover:text-slate-600 flex items-center"
                >
                  <X size={12} /> 필터 해제
                </button>
              </div>
            )}
          </div>
        )}

        {/* LIST VIEW */}
        {(viewMode === "list" || viewMode === "calendar") && (
          <div className="space-y-8">
            {Object.keys(groupedRecords).length === 0 ? (
              <div className="text-center py-10 opacity-50">
                <p className="text-slate-400 text-sm">표시할 기록이 없어요.</p>
              </div>
            ) : (
              Object.keys(groupedRecords)
                .sort((a, b) => b.localeCompare(a))
                .map((date) => (
                  <div
                    key={date}
                    className="animate-in fade-in slide-in-from-bottom-2 duration-300"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <CalendarIcon
                        size={14}
                        className={currentTheme.primary}
                      />
                      <h2 className="text-sm font-bold text-slate-500">
                        {date}
                      </h2>
                      {date === formatDate(new Date()) && (
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${currentTheme.bgCard} ${currentTheme.primary}`}
                        >
                          Today
                        </span>
                      )}
                    </div>
                    <div className="space-y-3">
                      {groupedRecords[date].map((record) => (
                        <div
                          key={record.id}
                          onClick={() => {
                            setEditingRecord(record);
                            setIsModalOpen(true);
                          }}
                          className={`group bg-white rounded-2xl p-4 shadow-sm border border-slate-100 hover:shadow-md transition-all cursor-pointer relative overflow-hidden hover:${currentTheme.border}`}
                        >
                          <div
                            className={`absolute top-0 left-0 w-1 h-full ${getTypeColor(
                              record.type
                            ).replace("text", "bg")}`}
                          />
                          <div className="flex justify-between items-start mb-2 pl-3">
                            <div
                              className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold border bg-slate-50 text-slate-600 border-slate-100`}
                            >
                              {getTypeIcon(record.type, 12)}
                              {getTypeLabel(record.type)}
                            </div>
                            {record.type === "Emotion" &&
                              record.metadata?.mood && (
                                <div className="text-lg">
                                  {
                                    ["😡", "😢", "😐", "🙂", "🥰"][
                                      record.metadata.mood - 1
                                    ]
                                  }
                                </div>
                              )}
                          </div>
                          <div className="pl-3">
                            {record.title && (
                              <h3 className="font-bold text-slate-800 mb-1">
                                {record.title}
                              </h3>
                            )}
                            <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed whitespace-pre-line">
                              {record.content}
                            </p>
                          </div>
                          <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteConfirmId(record.id);
                              }}
                              className="p-2 bg-white/90 rounded-full text-slate-400 hover:text-red-500 shadow-sm"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
            )}
          </div>
        )}
      </main>

      {/* Editor Modal */}
      {isModalOpen && (
        <EntryModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          initialData={editingRecord}
          onSave={handleSave}
          theme={currentTheme}
        />
      )}

      {/* Theme Modal */}
      {isThemeModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-xs w-full">
            <h3 className="text-lg font-bold text-slate-800 mb-4">테마 선택</h3>
            <div className="grid grid-cols-2 gap-3">
              {(Object.keys(themes) as ThemeType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    setTheme(t);
                    localStorage.setItem("mind-note-theme", t);
                    setIsThemeModalOpen(false);
                  }}
                  className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                    theme === t
                      ? `ring-2 ring-offset-2 ${themes[t].ring.replace(
                          "focus:",
                          ""
                        )} border-transparent`
                      : "border-slate-100 hover:bg-slate-50"
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-full ${themes[t].btn}`}
                  ></div>
                  <span className="text-xs font-medium text-slate-600">
                    {themes[t].name}
                  </span>
                </button>
              ))}
            </div>
            <button
              onClick={() => setIsThemeModalOpen(false)}
              className="w-full mt-6 py-2.5 text-sm font-medium text-slate-500 hover:bg-slate-50 rounded-xl"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-bold text-slate-800 mb-2">기록 삭제</h3>
            <p className="text-sm text-slate-500 mb-6">
              정말로 이 기록을 지우시겠어요?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                취소
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-red-100 text-red-600 hover:bg-red-200"
              >
                삭제하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Entry Modal Component ---
function EntryModal({ isOpen, onClose, initialData, onSave, theme }: any) {
  const [type, setType] = useState<RecordType>(
    initialData?.type || "MorningPage"
  );
  const [date, setDate] = useState(initialData?.date || formatDate(new Date()));
  const [title, setTitle] = useState(initialData?.title || "");
  const [content, setContent] = useState(initialData?.content || "");
  const [mood, setMood] = useState(initialData?.metadata?.mood || 3);
  const [kptKeep, setKptKeep] = useState("");
  const [kptProblem, setKptProblem] = useState("");
  const [kptTry, setKptTry] = useState("");
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const debounceTimer = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (!initialData) {
      setType("MorningPage");
      setDate(formatDate(new Date()));
      setTitle("");
      setContent("");
      setMood(3);
      setKptKeep("");
      setKptProblem("");
      setKptTry("");
    } else {
      setType(initialData.type);
      setDate(initialData.date);
      setTitle(initialData.title);
      setContent(initialData.content);
      setMood(initialData.metadata?.mood || 3);
      if (initialData.type === "Retrospective") {
        const sections = initialData.content.split("\n\n");
        sections.forEach((sec: string) => {
          if (sec.startsWith("## Keep"))
            setKptKeep(sec.replace("## Keep\n", ""));
          else if (sec.startsWith("## Problem"))
            setKptProblem(sec.replace("## Problem\n", ""));
          else if (sec.startsWith("## Try"))
            setKptTry(sec.replace("## Try\n", ""));
        });
      }
    }
  }, [initialData, isOpen]);

  const getFinalContent = () =>
    type === "Retrospective"
      ? `## Keep\n${kptKeep.trim()}\n\n## Problem\n${kptProblem.trim()}\n\n## Try\n${kptTry.trim()}`
      : content.trim();

  const handleSubmit = async () => {
    await onSave(
      {
        date,
        type,
        title: title.trim(),
        content: getFinalContent(),
        metadata: type === "Emotion" ? { mood } : {},
      },
      initialData?.id
    );
    onClose();
  };

  useEffect(() => {
    const isAutoSaveType = type === "MorningPage" || type === "BrainDump";
    const hasContent =
      type === "Retrospective" ? kptKeep || kptProblem || kptTry : content;
    if (isAutoSaveType && hasContent && initialData?.id) {
      setIsAutoSaving(true);
      // @ts-ignore
      if (debounceTimer.current)
        clearTimeout(debounceTimer.current as unknown as number);
      debounceTimer.current = setTimeout(async () => {
        await onSave(
          { date, type, title, content: getFinalContent(), metadata: {} },
          initialData.id
        );
        setIsAutoSaving(false);
      }, 3000);
    }
    return () => {
      // @ts-ignore
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current as unknown as number);
      }
    };
  }, [content, kptKeep, kptProblem, kptTry, type, initialData?.id]);

  const tabs: { id: RecordType; label: string; icon: any }[] = [
    { id: "MorningPage", label: "모닝", icon: Sunrise },
    { id: "BrainDump", label: "덤프", icon: Brain },
    { id: "Emotion", label: "감정", icon: Heart },
    { id: "Retrospective", label: "회고", icon: RotateCcw },
  ];

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="bg-slate-50 p-2 grid grid-cols-4 gap-1 border-b border-slate-100">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setType(t.id)}
              className={`flex flex-col items-center justify-center py-2.5 rounded-xl transition-all duration-300 ${
                type === t.id
                  ? `bg-white shadow-sm text-slate-800 ring-1 ring-black/5 scale-100`
                  : "text-slate-400 hover:bg-slate-100 scale-95"
              }`}
            >
              <t.icon
                size={18}
                className={`mb-1 ${type === t.id ? theme.primary : ""}`}
              />
              <span className="text-[10px] font-bold">{t.label}</span>
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-bold text-slate-400 mb-1 ml-1">
                날짜
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={`w-full bg-slate-50 border-none rounded-xl text-sm font-semibold text-slate-700 py-2.5 px-3 ${theme.ring}`}
              />
            </div>
            {type === "Emotion" && (
              <div className="flex-1">
                <label className="block text-xs font-bold text-slate-400 mb-1 ml-1">
                  오늘의 기분
                </label>
                <div className="flex justify-between bg-slate-50 rounded-xl p-2">
                  {[1, 2, 3, 4, 5].map((m) => (
                    <button
                      key={m}
                      onClick={() => setMood(m)}
                      className={`text-lg transition-transform hover:scale-125 ${
                        mood === m
                          ? "scale-125 drop-shadow-md"
                          : "opacity-40 grayscale"
                      }`}
                    >
                      {["😡", "😢", "😐", "🙂", "🥰"][m - 1]}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div>
            <input
              type="text"
              placeholder={
                type === "MorningPage"
                  ? "오늘 아침의 다짐 (선택)"
                  : type === "BrainDump"
                  ? "핵심 주제 (선택)"
                  : type === "Emotion"
                  ? "감정의 이름"
                  : "회고 제목"
              }
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full text-lg font-bold placeholder:text-slate-300 border-none focus:ring-0 px-0 py-1"
            />
            <div
              className={`h-0.5 w-10 rounded-full mt-1 ${theme.bgCard.replace(
                "100",
                "300"
              )}`}
            ></div>
          </div>
          <div className="relative">
            {type === "Retrospective" ? (
              <div className="space-y-4">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-2 mb-2 text-blue-600 font-bold text-xs">
                    <Check size={14} /> Keep
                  </div>
                  <textarea
                    className="w-full bg-transparent border-none p-0 text-sm min-h-[60px] resize-none focus:ring-0 text-slate-700 placeholder:text-slate-300"
                    placeholder="좋았던 점"
                    value={kptKeep}
                    onChange={(e) => setKptKeep(e.target.value)}
                  />
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-2 mb-2 text-red-500 font-bold text-xs">
                    <Brain size={14} /> Problem
                  </div>
                  <textarea
                    className="w-full bg-transparent border-none p-0 text-sm min-h-[60px] resize-none focus:ring-0 text-slate-700 placeholder:text-slate-300"
                    placeholder="아쉬운 점"
                    value={kptProblem}
                    onChange={(e) => setKptProblem(e.target.value)}
                  />
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-2 mb-2 text-green-600 font-bold text-xs">
                    <ArrowRight size={14} /> Try
                  </div>
                  <textarea
                    className="w-full bg-transparent border-none p-0 text-sm min-h-[60px] resize-none focus:ring-0 text-slate-700 placeholder:text-slate-300"
                    placeholder="시도할 점"
                    value={kptTry}
                    onChange={(e) => setKptTry(e.target.value)}
                  />
                </div>
              </div>
            ) : (
              <textarea
                placeholder={
                  type === "MorningPage"
                    ? "일어나자마자 드는 생각들을 자유롭게 적어보세요..."
                    : type === "BrainDump"
                    ? "머릿속 복잡한 생각들을 모두 쏟아내세요..."
                    : "오늘 느꼈던 감정과 그 이유를 자세히 적어보세요."
                }
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full h-64 resize-none border-none focus:ring-0 p-0 text-slate-600 leading-7 placeholder:text-slate-300 bg-transparent text-base"
              />
            )}
          </div>
        </div>
        <div className="p-4 border-t border-slate-50 flex items-center justify-between bg-white">
          <div
            className={`text-xs font-medium h-4 flex items-center gap-1 ${theme.lightText}`}
          >
            {isAutoSaving && (
              <>
                <span className="animate-spin">
                  <RotateCcw size={10} />
                </span>
                저장 중...
              </>
            )}
            {!isAutoSaving &&
              (type === "BrainDump" || type === "MorningPage") &&
              initialData && (
                <span className="text-slate-300 flex items-center gap-1">
                  <CheckCircle2 size={10} /> 자동 저장 됨
                </span>
              )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-50 transition-colors"
            >
              취소
            </button>
            <button
              onClick={handleSubmit}
              className={`px-6 py-2.5 rounded-xl text-sm font-bold text-white shadow-lg active:scale-95 transition-all flex items-center gap-2 ${theme.btn} ${theme.btnHover} shadow-slate-200`}
            >
              <Save size={16} />
              저장완료
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
