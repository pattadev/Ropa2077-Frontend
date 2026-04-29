"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import type { ApexOptions } from "apexcharts";
interface TokenPayload {
  sub?: string;
  role?: string;
}
import { jwtDecode } from "jwt-decode";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });
const API_DASHBOARD_URL = `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/v1/dashboard/summary`;

// ==========================================
// ApexCharts Components
// ==========================================

function HorizontalBarChart({ data, colors }: { data: { name: string; count: number }[]; colors: string[] }) {
  const options: ApexOptions = {
    chart: { type: "bar", toolbar: { show: false }, fontFamily: "inherit" },
    plotOptions: { bar: { horizontal: true, borderRadius: 4, barHeight: "60%", distributed: true } },
    dataLabels: { enabled: true, style: { fontSize: "11px", fontWeight: 600 } },
    legend: { show: false },
    xaxis: {
      categories: data.map((d) => d.name),
      labels: { style: { fontSize: "11px", colors: "#64748b" } },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: { labels: { style: { fontSize: "11px", colors: "#64748b" } } },
    grid: { borderColor: "#f1f5f9", xaxis: { lines: { show: true } }, yaxis: { lines: { show: false } } },
    colors,
    tooltip: { theme: "light", y: { title: { formatter: () => "รายการ: " } } },
  };

  const series = [{ name: "รายการ", data: data.map((d) => d.count) }];

  return (
    <div className="-mx-2">
      <Chart type="bar" options={options} series={series} height={data.length * 38 + 20} />
    </div>
  );
}
    
// ==========================================
// Main Page
// ==========================================
export default function DashboardPage() {
  const router = useRouter();
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>({ name: "Loading...", role: "", initials: "" });

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isRopaMenuOpen, setIsRopaMenuOpen] = useState(false);
  const [navPerms, setNavPerms] = useState({ canSeeDashboard: true, canSeeDPO: false, canSeeRopa: false, canSeeUsers: false });

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    router.push("/login");
  };
  
  useEffect(() => {
    const fetchDashboardSummary = async () => {
      setIsLoading(true);
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          router.push("/login");
          return;
        }

        // ถอดรหัส Token เพื่อเอาชื่อผู้ใช้
        const decoded = jwtDecode<TokenPayload>(token);

        // 🔒 Route Guard: เฉพาะ Executive และ Auditor เท่านั้นเข้าหน้านี้ได้
        const role = (decoded.role || "").toString();
        const allowedRoles = ["Executive", "Auditor", "developer"];
        const isAllowed = allowedRoles.some(r => role.toLowerCase() === r.toLowerCase());
        if (!isAllowed) {
          router.push("/login");
          return;
        }

        setCurrentUser({
          name: decoded.sub || "Unknown User",
          role: decoded.role || "No Role",
          initials: (decoded.sub || "U").substring(0, 2).toUpperCase()
        });

        // 🔒 Sidebar visibility per role
        const r = (decoded.role || "").toLowerCase();
        setNavPerms({
          canSeeDashboard: ["executive","auditor","developer"].includes(r),
          canSeeDPO:       ["dpo","auditor","developer"].includes(r),
          canSeeRopa:      ["data_owner","auditor","developer"].includes(r),
          canSeeUsers:     ["admin","developer","auditor"].includes(r),
        });

        // 🎯 ยิง API ไปหา FastAPI
        const res = await fetch(API_DASHBOARD_URL, {
          headers: { "Authorization": `Bearer ${token}` }
        });

        if (res.ok) {
          const data = await res.json();
          setDashboardData(data); // เก็บข้อมูลลง State
        } else if (res.status === 401) {
          router.push("/login"); // Token หมดอายุ
        }
      } catch (error) {
        console.error("Failed to fetch dashboard data", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardSummary();
  }, [router]);



  const statCards = dashboardData?.statCards ? [
    { label: "จำนวนรายการ ROPA ทั้งหมด", value: dashboardData.statCards.total, badge: "All", cls: " text-blue-600 border border-blue-200" },
    { label: "รออนุมัติ", value: dashboardData.statCards.pending, badge: "Pending", cls: " text-amber-600 border border-amber-200" },
    { label: "อนุมัติแล้ว", value: dashboardData.statCards.approved, badge: "Approved", cls: " text-emerald-600 border border-emerald-200" },
    { label: "ถูกปฏิเสธ", value: dashboardData.statCards.rejected, badge: "Rejected", cls: " text-red-600 border border-red-200" },
  ] : [];
  
  // Build coverageDepts: { name, done, total }
  const coverageDepts: { name: string; done: number; total: number }[] = (() => {
    // ถ้ายังไม่มีข้อมูล หรือไม่มี deptData ให้ return array ว่างกลับไปก่อน
    if (!dashboardData || !Array.isArray(dashboardData.deptData)) {
      return [];
    }

    // นำ deptData ที่ได้จาก Backend มา Map ค่าใส่ UI ตรงๆ ได้เลย
    return dashboardData.deptData.map((dd: any) => {
      return {
        name: dd.name || "ไม่ระบุแผนก",
        total: Number(dd.count) || 0,          // จำนวน ROPA ทั้งหมดในแผนกนั้น
        done: Number(dd.Approved) || 0         // ดึงยอด Approved มาเป็นค่า done โดยตรง
      };
    });
})();

  return (
    <div className="h-screen flex flex-col font-sans overflow-hidden bg-slate-50">

      {/* ── Header ── */}
      <header className="w-full h-14 bg-slate-900 text-white flex items-center justify-between px-6 shadow-md z-30 shrink-0">
        <span className="text-lg font-bold tracking-wider">RoPA <span className="text-blue-400">2077</span></span>
        <div className="relative">
          <button
            aria-label="เมนูผู้ใช้งาน" title="User Menu"
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="flex items-center gap-2 hover:bg-slate-800 p-1.5 rounded-lg transition-colors focus:outline-none"
          >
            <div className="text-right hidden sm:block">
              <p className="text-xs font-semibold text-slate-100">{currentUser.name}</p>
              <p className="text-[10px] text-slate-400">{currentUser.role}</p>
            </div>
            <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold shadow-sm text-xs border border-slate-700">
              {currentUser.initials}
            </div>
            <svg className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isProfileOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {isProfileOpen && (
            <div className="absolute right-0 mt-2 w-40 bg-white rounded-lg shadow-lg border border-slate-100 py-1 z-50">
              <button aria-label="ออกจากระบบ" title="Logout" onClick={handleLogout}
                className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 flex items-center transition-colors font-medium">
                <svg className="w-3.5 h-3.5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                ออกจากระบบ
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ── Body ── */}
      <div className="flex-1 flex overflow-hidden relative">

        {/* ── Sidebar ── */}
        <aside className={`relative bg-white border-r border-slate-200 flex flex-col z-20 transition-all duration-300 ease-in-out ${isSidebarOpen ? "w-56" : "w-0"}`}>
          <div className="overflow-hidden w-full h-full">
            <div className="w-56 flex flex-col h-full pt-4">
              <nav className="flex-1 space-y-0.5 px-3">
                {navPerms.canSeeDashboard && (
                <Link aria-label="ไปที่หน้าแดชบอร์ด" title="Dashboard" href="/dashboard"
                  className="flex items-center px-3 py-2.5 bg-blue-50 text-blue-700 rounded-lg font-medium transition-colors text-xs mb-1">
                  <svg className="w-4 h-4 mr-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6z" />
                  </svg>
                  Dashboard
                </Link>
                )}
                {navPerms.canSeeDPO && (
                <Link aria-label="DPO Workspace" title="DPO Workspace" href="/dpo"
                  className="flex items-center px-3 py-2.5 text-slate-600 hover:bg-slate-50 hover:text-blue-600 rounded-lg font-medium transition-colors text-xs mb-1">
                  <svg className="w-4 h-4 mr-2.5 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  DPO Approval
                </Link>
                )}
                {navPerms.canSeeRopa && (
                <div className="bg-slate-50 rounded-lg overflow-hidden border border-slate-100">
                  <button aria-label="สลับเมนู RoPA Record" title="RoPA Record Menu"
                    onClick={() => setIsRopaMenuOpen(!isRopaMenuOpen)}
                    className="w-full flex items-center justify-between px-3 py-2.5 text-slate-600 font-medium hover:bg-slate-100 transition-colors text-xs">
                    <div className="flex items-center">
                      <svg className="w-4 h-4 mr-2.5 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      RoPA Record
                    </div>
                    <svg className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isRopaMenuOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {isRopaMenuOpen && (
                    <div className="flex flex-col pb-1">
                      <Link aria-label="ดูข้อมูล Controller" title="Controller Menu" href="/ropa/controller"
                        className="w-full text-left pl-10 pr-3 py-2 text-xs font-medium transition-colors text-slate-600 hover:text-slate-800 hover:bg-slate-100 block">
                        Controller
                      </Link>
                      <Link aria-label="ดูข้อมูล Processor" title="Processor Menu" href="/ropa/processor"
                        className="w-full text-left pl-10 pr-3 py-2 text-xs font-medium transition-colors text-slate-600 hover:text-slate-800 hover:bg-slate-100 block">
                        Processor
                      </Link>
                    </div>
                  )}
                </div>
                )}
                {navPerms.canSeeUsers && (
                <Link aria-label="ไปที่หน้าผู้ใช้งาน" title="User Management" href="/users"
                  className="flex items-center px-3 py-2.5 text-slate-600 hover:bg-slate-50 hover:text-blue-600 rounded-lg font-medium transition-colors text-xs mt-1">
                  <svg className="w-4 h-4 mr-2.5 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  User Management
                </Link>
                )}
              </nav>
            </div>
          </div>
          <button aria-label="ซ่อน/แสดง แถบเมนูด้านข้าง" title="Toggle Sidebar"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="absolute -right-3.5 top-1/2 -translate-y-1/2 w-7 h-7 bg-white text-slate-400 rounded-full flex items-center justify-center border border-slate-200 shadow-sm hover:text-blue-600 hover:bg-slate-50 transition-all z-40">
            <svg className={`w-3.5 h-3.5 transition-transform duration-300 ${!isSidebarOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </aside>

        {/* ── Main Content ── */}
        <main className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50 p-6 relative overflow-y-auto">

          {/* Breadcrumb */}
          <div className="flex items-center text-[11px] text-slate-500 mb-2 font-medium">
            <Link href="/dashboard" className="hover:text-blue-600 transition-colors">Home</Link>
            <span className="mx-1.5">/</span>
            <span className="text-slate-800 font-bold">Dashboard</span>
          </div>

          <h1 className="text-xl font-bold text-slate-800 mb-1">ROPA Dashboard</h1>
          <p className="text-xs text-slate-500 mb-5">ภาพรวมและสถิติรายการบันทึกกิจกรรมประมวลผลข้อมูลส่วนบุคคล</p>

          {/* Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            {isLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 animate-pulse">
                    <div className="h-3 bg-slate-200 rounded w-3/4 mb-3" />
                    <div className="h-8 bg-slate-200 rounded w-1/2 mb-3" />
                    <div className="h-4 bg-slate-200 rounded w-1/3" />
                  </div>
                ))
              : statCards.map((s: any) => (
                  <div key={s.label} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                    <p className="text-[11px] text-slate-500 font-medium mb-1.5">{s.label}</p>
                    <p className="text-3xl font-bold text-slate-800 leading-none mb-2">{s.value}</p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${s.cls}`}>{s.badge}</span>
                  </div>
                ))}
          </div>

          {/* Charts Row 1 — Bar charts */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
              <h2 className="text-sm font-bold text-slate-800 mb-1">จำนวนรายการแยกตามหน่วยงาน</h2>
              {isLoading ? (
                <div className="animate-pulse space-y-2 mt-2">
                  {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-4 bg-slate-200 rounded" style={{ width: `${70 - i * 10}%` }} />)}
                </div>
              ) : dashboardData?.deptData && dashboardData.deptData.length > 0 ? (
                 <HorizontalBarChart
                   data={dashboardData.deptData}
                   colors={["#2563eb","#0891b2","#7c3aed","#d97706","#16a34a","#dc2626","#64748b"]}
                 />
              ) : (
                 <div className="h-50 flex items-center justify-center text-xs text-slate-400">ไม่มีข้อมูลแผนก</div>
              )}
            </div>
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
              <h2 className="text-sm font-bold text-slate-800 mb-1">จำนวนรายการตามฐานกฎหมาย</h2>
              {isLoading ? (
                <div className="animate-pulse space-y-2 mt-2">
                  {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-4 bg-slate-200 rounded" style={{ width: `${60 - i * 8}%` }} />)}
                </div>
              ) : dashboardData?.legalData && dashboardData.legalData.length > 0 ? (
                 <HorizontalBarChart
                   data={dashboardData.legalData}
                   colors={["#2563eb","#7c3aed","#0891b2","#d97706","#16a34a"]}
                 />
              ) : (
                 <div className="h-50 flex items-center justify-center text-xs text-slate-400">ไม่มีข้อมูลฐานกฎหมาย</div>
              )}
              </div>
          </div>
            
          {/* Coverage */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <h2 className="text-sm font-bold text-slate-800 mb-3">ความครบถ้วนของข้อมูลแต่ละหน่วยงาน</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {coverageDepts.map((d) => {
                const pct = Math.round((d.done / d.total) * 100);
                const color = pct >= 90 ? "#16a34a" : pct >= 60 ? "#d97706" : "#dc2626";
                return (
                  <div key={d.name} className="bg-slate-50 rounded-lg p-3">
                    <p className="text-[11px] font-semibold text-slate-700 mb-2">{d.name}</p>
                    <div className="h-1.5 bg-slate-200 rounded-full mb-1.5">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-500">
                      <span className="font-bold text-slate-800">{d.done}/{d.total}</span>
                      <span>{pct}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </main>
      </div>
    </div>
  );
}