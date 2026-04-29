"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { jwtDecode } from "jwt-decode";
import { TokenPayload } from "../login/page";

// ==========================================
// TypeScript Interfaces
// ==========================================
export interface RopaData {
  id?: string;
  record_type?: string;
  request_type?: string; // ประเภทคำขอ
  activity_name?: string;
  purpose?: string;
  department?: string;
  data_subject_category?: string;
  data_subject?: string;
  collected_personal_data?: string;
  collected_data?: string;
  legal_basis?: string;
  status?: string;
  created_at?: string;
  created_by?: string;
  updated_at?: string;
  updated_by?: string;
  approved_by?: string;
  controller_info?: string;
  processor_name?: string;
  controller_address?: string;
  data_type?: string;
  collection_format?: string;
  is_direct_from_subject?: string;
  is_direct_from_controller?: string;
  indirect_source_detail?: string;
  minor_under_10?: string;
  minor_10_to_20?: string;
  cb_is_transferred?: string;
  cb_is_intra_group?: string;
  cb_transfer_method?: string;
  cb_destination_standard?: string;
  rp_storage_format?: string;
  rp_storage_method?: string;
  rp_retention_period?: string;
  rp_access_rights?: string;
  rp_destruction_method?: string;
  disclosure_without_consent?: string;
  dsar_rejection_record?: string;
  sec_organizational?: string;
  sec_technical?: string;
  sec_physical?: string;
  sec_access_control?: string;
  sec_user_responsibility?: string;
  sec_audit_trail?: string;
  rejection_reason?: string;
  submitted_date?: string;
  recorder_email?: string;
  recorder_phone?: string;
  recorder_address?: string;
  [key: string]: any;
}

const API_BASE_URL = `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/v1/dpo`;

// ==========================================
// Helper Functions: จัดการวันที่ พ.ศ.
// ==========================================
const parseThaiDate = (dateStr?: string) => {
  if (!dateStr || dateStr === "-") return new Date(0);
  const parts = dateStr.split(" ");
  if (parts.length < 1) return new Date(0);

  const dateParts = parts[0].split("/");
  if (dateParts.length !== 3) return new Date(0);

  const d = parseInt(dateParts[0], 10);
  const m = parseInt(dateParts[1], 10);
  let y = parseInt(dateParts[2], 10);

  if (y > 2500) y -= 543;

  let hr = 0,
    min = 0,
    sec = 0;
  if (parts.length > 1) {
    const timeParts = parts[1].split(":");
    hr = parseInt(timeParts[0], 10) || 0;
    min = parseInt(timeParts[1], 10) || 0;
    sec = parseInt(timeParts[2], 10) || 0;
  }

  return new Date(y, m - 1, d, hr, min, sec);
};

const isWithinDateRange = (
  dateStr: string | undefined,
  dateRange: string,
  exactDate: string,
) => {
  if (dateRange === "ทั้งหมด") return true;
  if (!dateStr || dateStr === "-") return false;

  const recordDate = parseThaiDate(dateStr);
  const now = new Date();

  if (dateRange === "ระบุวัน" && exactDate) {
    const exact = new Date(exactDate);
    return (
      recordDate.getDate() === exact.getDate() &&
      recordDate.getMonth() === exact.getMonth() &&
      recordDate.getFullYear() === exact.getFullYear()
    );
  }

  if (dateRange === "วันนี้") {
    return (
      recordDate.getDate() === now.getDate() &&
      recordDate.getMonth() === now.getMonth() &&
      recordDate.getFullYear() === now.getFullYear()
    );
  }
  if (dateRange === "สัปดาห์นี้") {
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    return recordDate >= startOfWeek && recordDate <= endOfWeek;
  }
  if (dateRange === "เดือนนี้") {
    return (
      recordDate.getMonth() === now.getMonth() &&
      recordDate.getFullYear() === now.getFullYear()
    );
  }
  if (dateRange === "ปีนี้") {
    return recordDate.getFullYear() === now.getFullYear();
  }
  return true;
};

export default function DpoApprovalPage() {
  const router = useRouter();

  // Layout States
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isRopaMenuOpen, setIsRopaMenuOpen] = useState(false);
  const [navPerms, setNavPerms] = useState({
    canSeeDashboard: false,
    canSeeDPO: true,
    canSeeRopa: false,
    canSeeUsers: false,
  });

  // Page States
  const [currentTab, setCurrentTab] = useState("Pending");

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<RopaData | null>(null);
  const [dpoRemark, setDpoRemark] = useState("");

  // Data States
  const [tasks, setTasks] = useState<RopaData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>({ name: "", role: "" });
  // Filters & Sorting
  const [filters, setFilters] = useState({
    id: "",
    activity_name: "",
    record_type: "",
    created_by: "",
    date_range: "ทั้งหมด",
    exact_date: "",
  });
  const [sortConfig, setSortConfig] = useState({
    key: "submitted_date",
    direction: "desc",
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [pageInputValue, setPageInputValue] = useState("1");

  // Confirm modal state
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    action: "Approved" | "Rejected" | null;
  }>({ open: false, action: null });

  // Alert modal state (แทน alert())
  const [alertModal, setAlertModal] = useState({ open: false, message: "" });

  const fetchTasks = async (tokenStr: string) => {
    setIsLoading(true);
    try {
      const safeBaseUrl = API_BASE_URL.endsWith("/")
        ? API_BASE_URL
        : `${API_BASE_URL}/`;
      const url = `${safeBaseUrl}records`;

      const res = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenStr}`,
        },
      });

      if (res.ok) {
        const data = await res.json();

        setTasks(Array.isArray(data) ? data : []);
      } else {
        if (res.status === 401) {
          router.push("/login");
        } else {
          console.error("Failed to fetch DPO records", res.status);
          setTasks([]); // ป้องกัน Error หากไม่มีข้อมูล 404
        }
      }
    } catch (error) {
      console.error("Fetch DPO Error:", error);
      setTasks([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setPageInputValue(currentPage.toString());
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
    } else {
      try {
        const decoded = jwtDecode<TokenPayload>(token);

        // 🔒 Route Guard: เฉพาะ DPO และ Auditor เท่านั้นเข้าหน้านี้ได้
        const role = (decoded.role || "").toString();
        const allowedRoles = ["DPO", "Auditor", "developer"];
        const isAllowed = allowedRoles.some(
          (r) => role.toLowerCase() === r.toLowerCase(),
        );
        if (!isAllowed) {
          router.push("/login");
          return;
        }

        setCurrentUser({
          name: decoded.sub || "Unknown User",
          role: decoded.role || "No Role",
        });

        // 🔒 Sidebar visibility per role
        const r = (decoded.role || "").toLowerCase();
        setNavPerms({
          canSeeDashboard: ["executive", "auditor", "developer"].includes(r),
          canSeeDPO: ["dpo", "auditor", "developer"].includes(r),
          canSeeRopa: ["data_owner", "auditor", "developer"].includes(r),
          canSeeUsers: ["admin", "developer", "auditor"].includes(r),
        });
        fetchTasks(token);
      } catch (err) {
        router.push("/login");
      }
    }
  }, []); // [] เพื่อให้รันแค่ครั้งเดียวตอนโหลดหน้าเว็บ

  useEffect(() => {
    setPageInputValue(currentPage.toString());
  }, [currentPage]);

  // Active Data Logic (กรองตาม Tab ปัจจุบัน)
  const activeData = tasks.filter((item) => item.status === currentTab);

  // Filter & Sort
  const filteredData = activeData.filter((item) => {
    const matchId = String(item.id || "")
      .toLowerCase()
      .includes(filters.id.toLowerCase());
    const matchActivity = (item.activity_name || "")
      .toLowerCase()
      .includes(filters.activity_name.toLowerCase());
    const matchType =
      filters.record_type === "" || item.record_type === filters.record_type;
    const matchCreator = (item.created_by || "")
      .toLowerCase()
      .includes(filters.created_by.toLowerCase());
    const matchDate = isWithinDateRange(
      item.submitted_date || item.created_at,
      filters.date_range,
      filters.exact_date,
    );

    return matchId && matchActivity && matchType && matchCreator && matchDate;
  });

  const sortedData = [...filteredData].sort((a, b) => {
    const { key, direction } = sortConfig;
    if (key === "id") {
      const numA = parseInt((a as any).id || "0", 10) || 0;
      const numB = parseInt((b as any).id || "0", 10) || 0;
      if (numA < numB) return direction === "asc" ? -1 : 1;
      if (numA > numB) return direction === "asc" ? 1 : -1;
      return 0;
    }
    if (key === "submitted_date" || key === "created_at") {
      const dateA = parseThaiDate(a[key]).getTime();
      const dateB = parseThaiDate(b[key]).getTime();
      return direction === "asc" ? dateA - dateB : dateB - dateA;
    }

    let valA = a[key] ? String(a[key]).toLowerCase() : "";
    let valB = b[key] ? String(b[key]).toLowerCase() : "";

    if (valA < valB) return direction === "asc" ? -1 : 1;
    if (valA > valB) return direction === "asc" ? 1 : -1;
    return 0;
  });

  const totalItems = sortedData.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const currentRecords = sortedData.slice(startIndex, endIndex);

  const handleSort = (key: string) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc")
      direction = "desc";
    setSortConfig({ key, direction });
    setCurrentPage(1);
  };

  const renderSortIcon = (columnKey: string) => {
    const isActive = sortConfig.key === columnKey;
    const isAsc = isActive && sortConfig.direction === "asc";
    if (!isActive)
      return (
        <svg
          className="w-3 h-3 text-slate-400 opacity-40 ml-1.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 9l4-4 4 4m0 6l-4 4-4-4"
          />
        </svg>
      );
    if (isAsc)
      return (
        <svg
          className="w-3 h-3 text-blue-600 ml-1.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2.5}
            d="M5 15l7-7 7 7"
          />
        </svg>
      );
    return (
      <svg
        className="w-3 h-3 text-blue-600 ml-1.5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2.5}
          d="M19 9l-7 7-7-7"
        />
      </svg>
    );
  };

  const handleFilterChange = (column: string, value: string) => {
    setFilters((prev) => ({ ...prev, [column]: value }));
    setCurrentPage(1);
  };

  const handleResetFilters = () => {
    setFilters({
      id: "",
      activity_name: "",
      record_type: "",
      created_by: "",
      date_range: "ทั้งหมด",
      exact_date: "",
    });
    setSortConfig({ key: "submitted_date", direction: "desc" });
    setCurrentPage(1);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    router.push("/login");
  };

  const openReviewModal = (record: RopaData) => {
    setSelectedRecord(record);
    setDpoRemark(record.rejection_reason || "");
    setIsModalOpen(true);
  };

  const handleApprovalAction = async (
    actionStatus: "Approved" | "Rejected",
  ) => {
    if (!selectedRecord) return;

    // 1. ตรวจสอบเงื่อนไข: หากตีกลับ ต้องใส่เหตุผล
    if (actionStatus === "Rejected" && dpoRemark.trim() === "") {
      setAlertModal({
        open: true,
        message:
          "กรุณาระบุหมายเหตุหรือเหตุผลในการตีกลับ เพื่อให้ผู้ลงบันทึกนำไปแก้ไข",
      });
      return; // หยุดการทำงาน ไม่แสดง Confirm Modal
    }

    // 2. เมื่อผ่านเงื่อนไข ให้แสดง Confirm Modal ทันที
    // และนำส่วนของการยิง API ออกไปไว้ใน handleConfirmApproval
    setConfirmModal({ open: true, action: actionStatus });
  };

  const handleConfirmApproval = async () => {
    const actionStatus = confirmModal.action;
    if (!actionStatus || !selectedRecord) return;

    // ✅ ปิด Confirm Modal ทันทีที่กดยืนยัน
    setConfirmModal({ open: false, action: null });

    setIsLoading(true);
    const token = localStorage.getItem("token");
    const safeBaseUrl = API_BASE_URL.endsWith("/")
      ? API_BASE_URL
      : `${API_BASE_URL}/`;

    try {
      if (actionStatus === "Approved") {
        // ยิง API อนุมัติ
        const res = await fetch(
          `${safeBaseUrl}records/${selectedRecord.id}/approve`,
          {
            method: "PUT",
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        if (!res.ok) throw new Error("อนุมัติไม่สำเร็จ");
      } else {
        // ยิง API ตีกลับ (แนบเหตุผลไปด้วย)
        const url = new URL(
          `${safeBaseUrl}records/${selectedRecord.id}/reject`,
        );
        url.searchParams.append("rejection_reason", dpoRemark);

        const res = await fetch(url.toString(), {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("ตีกลับไม่สำเร็จ");
      }

      setIsModalOpen(false);
      setDpoRemark("");
        if (token) fetchTasks(token);
    } catch (error) {
      console.error("Action failed:", error);
      alert("เกิดข้อผิดพลาดในการทำรายการ");
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case "Approved":
        return (
          <span className="px-2 py-1  text-emerald-600 text-[10px] font-bold rounded-md border border-emerald-200">
            Approved
          </span>
        );
      case "Pending":
        return (
          <span className="px-2 py-1  text-amber-600 text-[10px] font-bold rounded-md border border-amber-200">
            Pending
          </span>
        );
      case "Rejected":
        return (
          <span className="px-2 py-1  text-red-600 text-[10px] font-bold rounded-md border border-red-200">
            Rejected
          </span>
        );
      default:
        return (
          <span className="px-2 py-1  text-slate-600 text-[10px] font-bold rounded-md border border-slate-200">
            {status || "-"}
          </span>
        );
    }
  };

  return (
    <div className="h-screen flex flex-col font-sans overflow-hidden bg-slate-50">
      {/* 1. Top Navbar */}
      <header className="w-full h-14 bg-slate-900 text-white flex items-center justify-between px-6 shadow-md z-30 shrink-0">
        <div className="flex items-center">
          <span className="text-lg font-bold tracking-wider">
            RoPA <span className="text-blue-400">2077</span>
          </span>
        </div>

        <div className="relative">
          <button
            aria-label="เมนูผู้ใช้งาน"
            title="User Menu"
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="flex items-center gap-2 hover:bg-slate-800 p-1.5 rounded-lg transition-colors focus:outline-none"
          >
            <div className="text-right hidden sm:block">
              <p className="text-xs font-semibold text-slate-100">
                {currentUser.name}
              </p>
              <p className="text-[10px] text-slate-400">{currentUser.role}</p>
            </div>
            <div className="w-7 h-7 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold shadow-sm text-xs border border-slate-700">
              DP
            </div>
            <svg
              className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isProfileOpen ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {isProfileOpen && (
            <div className="absolute right-0 mt-2 w-40 bg-white rounded-lg shadow-lg border border-slate-100 py-1 z-50">
              <button
                aria-label="ออกจากระบบ"
                title="Logout"
                onClick={handleLogout}
                className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 flex items-center transition-colors font-medium"
              >
                <svg
                  className="w-3.5 h-3.5 mr-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
                ออกจากระบบ
              </button>
            </div>
          )}
        </div>
      </header>

      {/* 2. Container */}
      <div className="flex-1 flex overflow-hidden relative">
        <aside
          className={`relative bg-white border-r border-slate-200 flex flex-col z-20 transition-all duration-300 ease-in-out ${isSidebarOpen ? "w-56" : "w-0"}`}
        >
          <div className="overflow-hidden w-full h-full">
            <div className="w-56 flex flex-col h-full pt-4">
              <nav className="flex-1 space-y-0.5 px-3">
                {navPerms.canSeeDashboard && (
                  <Link
                    aria-label="ไปที่หน้าแดชบอร์ด"
                    title="Dashboard"
                    href="/dashboard"
                    className="flex items-center px-3 py-2.5 text-slate-600 hover:bg-slate-50 hover:text-blue-600 rounded-lg font-medium transition-colors text-xs mb-1"
                  >
                    <svg
                      className="w-4 h-4 mr-2.5 opacity-70"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6z"
                      />
                    </svg>
                    Dashboard
                  </Link>
                )}

                {navPerms.canSeeDPO && (
                  <Link
                    aria-label="DPO Workspace"
                    title="DPO Workspace"
                    href="/dpo"
                    className="flex items-center px-3 py-2.5 bg-blue-50 text-blue-700 rounded-lg font-medium transition-colors text-xs mb-1"
                  >
                    <svg
                      className="w-4 h-4 mr-2.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    DPO Approval
                  </Link>
                )}

                {navPerms.canSeeRopa && (
                  <div className="bg-slate-50 rounded-lg overflow-hidden border border-slate-100">
                    <button
                      aria-label="สลับเมนู RoPA Record"
                      title="RoPA Record Menu"
                      onClick={() => setIsRopaMenuOpen(!isRopaMenuOpen)}
                      className="w-full flex items-center justify-between px-3 py-2.5 text-slate-600 font-medium hover:bg-slate-100 transition-colors text-xs"
                    >
                      <div className="flex items-center">
                        <svg
                          className="w-4 h-4 mr-2.5 opacity-70"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                        RoPA Record
                      </div>
                      <svg
                        className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isRopaMenuOpen ? "rotate-180" : ""}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </button>
                    {isRopaMenuOpen && (
                      <div className="flex flex-col pb-1">
                        <Link
                          aria-label="ดูข้อมูล Controller"
                          title="Controller Menu"
                          href="/ropa/controller"
                          className="w-full text-left pl-10 pr-3 py-2 text-xs font-medium transition-colors text-slate-600 hover:text-slate-800 hover:bg-slate-100 block"
                        >
                          Controller
                        </Link>
                        <Link
                          aria-label="ดูข้อมูล Processor"
                          title="Processor Menu"
                          href="/ropa/processor"
                          className="w-full text-left pl-10 pr-3 py-2 text-xs font-medium transition-colors text-slate-600 hover:text-slate-800 hover:bg-slate-100 block"
                        >
                          Processor
                        </Link>
                      </div>
                    )}
                  </div>
                )}

                {navPerms.canSeeUsers && (
                  <Link
                    aria-label="ไปที่หน้าผู้ใช้งาน"
                    title="User Management"
                    href="/users"
                    className="flex items-center px-3 py-2.5 text-slate-600 hover:bg-slate-50 hover:text-blue-600 rounded-lg font-medium transition-colors text-xs mt-1"
                  >
                    <svg
                      className="w-4 h-4 mr-2.5 opacity-70"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                      />
                    </svg>
                    User Management
                  </Link>
                )}
              </nav>
            </div>
          </div>
          <button
            aria-label="ซ่อน/แสดง แถบเมนูด้านข้าง"
            title="Toggle Sidebar"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="absolute -right-3.5 top-1/2 -translate-y-1/2 w-7 h-7 bg-white text-slate-400 rounded-full flex items-center justify-center border border-slate-200 shadow-sm hover:text-blue-600 hover:bg-slate-50 transition-all z-40"
          >
            <svg
              className={`w-3.5 h-3.5 transition-transform duration-300 ${!isSidebarOpen ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
        </aside>

        {/* 3. Main Content */}
        <main className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50">
          <div className="flex-1 overflow-auto p-6 relative">
            {/* Header Area */}
            <div className="mb-5">
              <div className="flex items-center text-[11px] text-slate-500 mb-2 font-medium">
                <Link
                  aria-label="หน้าแรก"
                  title="Home"
                  href="/dashboard"
                  className="hover:text-blue-600 transition-colors"
                >
                  Home
                </Link>
                <span className="mx-1.5">/</span>
                <span className="text-slate-800 font-bold">DPO Approval</span>
              </div>

              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-3 mb-4">
                <div>
                  <h1 className="text-xl font-bold text-slate-800 mb-1">
                    DPO Approval Workspace
                  </h1>
                  <h2 className="text-xs text-slate-500">
                    ตรวจสอบและอนุมัติกิจกรรมการประมวลผลข้อมูล (RoPA) จาก Data
                    Owner
                  </h2>
                </div>
              </div>

              <div className="flex space-x-6 border-b border-slate-200 px-2">
                <button
                  aria-label="แท็บรอตรวจสอบ"
                  title="Pending Tab"
                  onClick={() => {
                    setCurrentTab("Pending");
                    setCurrentPage(1);
                    handleResetFilters();
                  }}
                  className={`pb-2 text-sm font-bold transition-colors relative ${currentTab === "Pending" ? "text-blue-600" : "text-slate-400 hover:text-slate-600"}`}
                >
                  รอตรวจสอบ (Pending)
                  {currentTab === "Pending" && (
                    <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-t-md"></span>
                  )}
                  {tasks.filter((t) => t.status === "Pending").length > 0 && (
                    <span className="ml-1.5 px-1.5 py-0.5 bg-red-100 text-red-600 text-[10px] rounded-full">
                      {tasks.filter((t) => t.status === "Pending").length}
                    </span>
                  )}
                </button>
                <button
                  aria-label="แท็บอนุมัติแล้ว"
                  title="Approved Tab"
                  onClick={() => {
                    setCurrentTab("Approved");
                    setCurrentPage(1);
                    handleResetFilters();
                  }}
                  className={`pb-2 text-sm font-bold transition-colors relative ${currentTab === "Approved" ? "text-emerald-600" : "text-slate-400 hover:text-slate-600"}`}
                >
                  อนุมัติแล้ว (Approved)
                  {currentTab === "Approved" && (
                    <span className="absolute bottom-0 left-0 w-full h-0.5 bg-emerald-600 rounded-t-md"></span>
                  )}
                </button>
                <button
                  aria-label="แท็บตีกลับ"
                  title="Rejected Tab"
                  onClick={() => {
                    setCurrentTab("Rejected");
                    setCurrentPage(1);
                    handleResetFilters();
                  }}
                  className={`pb-2 text-sm font-bold transition-colors relative ${currentTab === "Rejected" ? "text-red-600" : "text-slate-400 hover:text-slate-600"}`}
                >
                  ตีกลับ (Rejected)
                  {currentTab === "Rejected" && (
                    <span className="absolute bottom-0 left-0 w-full h-0.5 bg-red-600 rounded-t-md"></span>
                  )}
                </button>
              </div>
            </div>

            {/* Table Section */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col">
              <div className="overflow-x-auto">
                <table className="w-full table-fixed text-left text-xs text-slate-600 whitespace-nowrap">
                  <thead className="bg-slate-50 border-b border-slate-200 select-none">
                    <tr>
                      <th className="w-[8%] px-2 py-2.5 align-top overflow-hidden">
                        <div
                          className="font-semibold text-slate-700 mb-1.5 truncate cursor-pointer hover:text-blue-600 flex items-center"
                          onClick={() => handleSort("id")}
                        >
                          รหัส {renderSortIcon("id")}
                        </div>
                        <input
                          type="text"
                          aria-label="ค้นหารหัส"
                          title="ค้นหารหัส"
                          placeholder="ค้นหา..."
                          value={filters.id}
                          onChange={(e) =>
                            handleFilterChange("id", e.target.value)
                          }
                          onClick={(e) => e.stopPropagation()}
                          className="w-full text-[10px] px-1.5 py-1 border border-slate-300 rounded outline-none focus:border-blue-500 bg-white"
                        />
                      </th>
                      <th className="w-[10%] px-2 py-2.5 align-top overflow-hidden">
                        <div
                          className="font-semibold text-slate-700 mb-1.5 truncate cursor-pointer hover:text-blue-600 flex items-center"
                          onClick={() => handleSort("record_type")}
                        >
                          ประเภท {renderSortIcon("record_type")}
                        </div>
                        <select
                          aria-label="กรองข้อมูลตามประเภท"
                          title="Filter by Type"
                          value={filters.record_type}
                          onChange={(e) =>
                            handleFilterChange("record_type", e.target.value)
                          }
                          onClick={(e) => e.stopPropagation()}
                          className="w-full text-[10px] px-1.5 py-1 border border-slate-300 rounded outline-none focus:border-blue-500 bg-white cursor-pointer"
                        >
                          <option value="">ทั้งหมด</option>
                          <option value="Controller">Controller</option>
                          <option value="Processor">Processor</option>
                        </select>
                      </th>
                      <th className="w-[25%] px-2 py-2.5 align-top overflow-hidden">
                        <div
                          className="font-semibold text-slate-700 mb-1.5 truncate cursor-pointer hover:text-blue-600 flex items-center"
                          onClick={() => handleSort("activity_name")}
                        >
                          กิจกรรมประมวลผล {renderSortIcon("activity_name")}
                        </div>
                        <input
                          type="text"
                          aria-label="ค้นหาชื่อกิจกรรม"
                          title="ค้นหาชื่อกิจกรรม"
                          placeholder="ค้นหาชื่อกิจกรรม..."
                          value={filters.activity_name}
                          onChange={(e) =>
                            handleFilterChange("activity_name", e.target.value)
                          }
                          onClick={(e) => e.stopPropagation()}
                          className="w-full text-[10px] px-1.5 py-1 border border-slate-300 rounded outline-none focus:border-blue-500 bg-white"
                        />
                      </th>
                      <th className="w-[20%] px-2 py-2.5 align-top overflow-hidden">
                        <div
                          className="font-semibold text-slate-700 mb-1.5 truncate cursor-pointer hover:text-blue-600 flex items-center"
                          onClick={() => handleSort("created_by")}
                        >
                          ผู้ส่งคำขออนุมัติ {renderSortIcon("created_by")}
                        </div>
                        <input
                          type="text"
                          aria-label="ค้นหาผู้ส่ง"
                          title="ค้นหาผู้ส่ง"
                          placeholder="ค้นหาผู้ส่ง..."
                          value={filters.created_by}
                          onChange={(e) =>
                            handleFilterChange("created_by", e.target.value)
                          }
                          onClick={(e) => e.stopPropagation()}
                          className="w-full text-[10px] px-1.5 py-1 border border-slate-300 rounded outline-none focus:border-blue-500 bg-white"
                        />
                      </th>
                      <th className="w-[15%] px-2 py-2.5 align-top overflow-hidden">
                        <div
                          className="font-semibold text-slate-700 mb-1.5 truncate cursor-pointer hover:text-blue-600 flex items-center"
                          onClick={() => handleSort("submitted_date")}
                        >
                          วันที่ส่ง {renderSortIcon("submitted_date")}
                        </div>
                        <div className="flex flex-col gap-1">
                          <select
                            aria-label="กรองข้อมูลตามช่วงเวลา"
                            title="Filter by date range"
                            value={filters.date_range}
                            onChange={(e) =>
                              handleFilterChange("date_range", e.target.value)
                            }
                            onClick={(e) => e.stopPropagation()}
                            className="w-full text-[10px] px-1.5 py-1 border border-slate-300 rounded outline-none focus:border-blue-500 bg-white cursor-pointer"
                          >
                            <option value="ทั้งหมด">เวลาทั้งหมด</option>
                            <option value="วันนี้">วันนี้</option>
                            <option value="สัปดาห์นี้">สัปดาห์นี้</option>
                            <option value="เดือนนี้">เดือนนี้</option>
                            <option value="ปีนี้">ปีนี้</option>
                            <option value="ระบุวัน">ระบุวัน...</option>
                          </select>
                          {filters.date_range === "ระบุวัน" && (
                            <input
                              type="date"
                              aria-label="ระบุวันที่ต้องการกรอง"
                              title="ระบุวัน"
                              placeholder="ระบุวัน"
                              value={filters.exact_date}
                              onChange={(e) =>
                                handleFilterChange("exact_date", e.target.value)
                              }
                              onClick={(e) => e.stopPropagation()}
                              className="w-full text-[10px] px-1.5 py-1 border border-slate-300 rounded outline-none focus:border-blue-500 bg-white"
                            />
                          )}
                        </div>
                      </th>
                      <th className="w-[12%] px-2 py-2.5 align-top text-center overflow-hidden">
                        <div className="font-semibold text-slate-700 mb-1.5 truncate">
                          สถานะ
                        </div>
                      </th>
                      <th className="w-[10%] px-2 py-2.5 align-top text-center overflow-hidden">
                        <div className="font-semibold text-slate-700 mb-1.5 truncate">
                          จัดการ
                        </div>
                        <div className="flex flex-col items-center mt-1">
                          <button
                            aria-label="ล้างตัวกรองทั้งหมด"
                            title="Reset Filters"
                            onClick={handleResetFilters}
                            className="flex items-center text-[10px] font-medium text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-1.5 py-1 rounded transition-colors"
                          >
                            <svg
                              className="w-3 h-3 mr-1"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                              />
                            </svg>
                            Reset
                          </button>
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {currentRecords.length > 0 ? (
                      currentRecords.map((record) => (
                        <tr
                          key={record.id}
                          className="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-b-0"
                        >
                          <td
                            className="px-2 py-2 truncate font-medium"
                            title={record.id}
                          >
                            {record.id}
                          </td>
                          <td className="px-2 py-2 truncate">
                            <span
                              className={`px-2 py-0.5 rounded text-[9px] font-bold ${record.record_type === "Controller" ? " text-indigo-600 border border-indigo-200" : " text-fuchsia-600 border border-fuchsia-200"}`}
                            >
                              {record.record_type}
                            </span>
                          </td>
                          <td className="px-2 py-2 overflow-hidden">
                            <div className="truncate w-full">
                              <div
                                className="font-semibold text-slate-800 truncate"
                                title={record.activity_name}
                              >
                                {record.activity_name}
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span
                                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${record.request_type === "ลบรายการ" ? "bg-red-50 text-red-600 border-red-100" : record.request_type === "แก้ไข" ? "bg-amber-50 text-amber-600 border-amber-100" : "bg-blue-50 text-blue-600 border-blue-100"}`}
                                >
                                  {record.request_type}
                                </span>
                                <div
                                  className="text-[10px] text-slate-500 truncate"
                                  title={
                                    record.data_subject_category ||
                                    record.data_subject
                                  }
                                >
                                  หมวดหมู่:{" "}
                                  {record.data_subject_category ||
                                    record.data_subject}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-2 py-2 truncate">
                            <span className="text-slate-800 font-medium">
                              {record.created_by} ({record.department})
                            </span>
                          </td>
                          <td className="px-2 py-2 text-[10px] text-slate-500 truncate">
                            {record.submitted_date || record.created_at}
                          </td>
                          <td className="px-2 py-2 text-center truncate">
                            {getStatusBadge(record.status)}
                          </td>
                          <td className="px-2 py-2 text-center">
                            <button
                              aria-label="ตรวจประเมิน"
                              title="ตรวจประเมิน (Review)"
                              onClick={() => openReviewModal(record)}
                              className={`mx-0.5 p-1.5 rounded transition-colors text-xs font-bold flex items-center justify-center w-full ${currentTab === "Pending" ? "bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200" : "text-slate-500 hover:text-blue-600 hover:bg-slate-100"}`}
                            >
                              {currentTab === "Pending"
                                ? "ตรวจประเมิน"
                                : "ดูรายละเอียด"}
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-2 py-8 text-center text-slate-500"
                        >
                          ไม่พบข้อมูลที่ต้องตรวจสอบ
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-2.5 border-t border-slate-200 bg-white text-[11px] text-slate-600 shrink-0">
                <div className="flex items-center space-x-3 mb-2 sm:mb-0">
                  <div className="flex items-center space-x-1.5">
                    <span>Items per page:</span>
                    <select
                      aria-label="เลือกจำนวนรายการต่อหน้า"
                      title="Items per page"
                      value={itemsPerPage}
                      onChange={(e) => {
                        setItemsPerPage(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      className="border border-slate-300 rounded px-1 py-0.5 outline-none focus:border-blue-500 bg-white text-slate-700 cursor-pointer"
                    >
                      <option value={5}>5</option>
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                    </select>
                  </div>
                  <span>
                    {totalItems > 0 ? `${startIndex + 1}-${endIndex}` : "0"} of{" "}
                    {totalItems} items
                  </span>
                </div>
                <div className="flex items-center space-x-1">
                  <button
                    aria-label="หน้าแรก"
                    title="First page"
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className="p-0.5 rounded hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11 19l-7-7 7-7M18 19l-7-7 7-7"
                      />
                    </svg>
                  </button>
                  <button
                    aria-label="หน้าก่อนหน้า"
                    title="Previous page"
                    onClick={() =>
                      setCurrentPage((prev) => Math.max(prev - 1, 1))
                    }
                    disabled={currentPage === 1}
                    className="p-0.5 rounded hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 19l-7-7 7-7"
                      />
                    </svg>
                  </button>
                  <div className="flex items-center space-x-1.5 px-1">
                    <input
                      type="text"
                      aria-label="ไปที่หน้าเลขที่"
                      title="Page number"
                      placeholder="1"
                      value={pageInputValue}
                      onChange={(e) => {
                        if (
                          e.target.value === "" ||
                          /^[0-9]+$/.test(e.target.value)
                        )
                          setPageInputValue(e.target.value);
                      }}
                      onBlur={() => {
                        let val = parseInt(pageInputValue, 10);
                        if (isNaN(val) || val < 1) val = 1;
                        if (val > totalPages) val = totalPages;
                        setCurrentPage(val);
                        setPageInputValue(val.toString());
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          let val = parseInt(pageInputValue, 10);
                          if (isNaN(val) || val < 1) val = 1;
                          if (val > totalPages) val = totalPages;
                          setCurrentPage(val);
                          setPageInputValue(val.toString());
                          (e.target as HTMLInputElement).blur();
                        }
                      }}
                      className="w-8 text-center border border-slate-300 rounded py-0.5 outline-none focus:border-blue-500 bg-white font-medium"
                    />
                    <span>of {totalPages} pages</span>
                  </div>
                  <button
                    aria-label="หน้าถัดไป"
                    title="Next page"
                    onClick={() =>
                      setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                    }
                    disabled={currentPage === totalPages || totalPages === 0}
                    className="p-0.5 rounded hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </button>
                  <button
                    aria-label="หน้าสุดท้าย"
                    title="Last page"
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages || totalPages === 0}
                    className="p-0.5 rounded hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 5l7 7-7 7M5 5l7 7-7 7"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* ========================================== */}
      {/* Modal: DPO Review Activity */}
      {/* ========================================== */}
      {isModalOpen && selectedRecord && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
            <div className="px-5 py-3 border-b border-slate-200 flex justify-between items-center bg-slate-50 shrink-0">
              <h3 className="text-sm font-bold text-slate-800 flex items-center">
                <svg
                  className="w-4 h-4 mr-2 text-blue-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                รายละเอียดข้อมูลกิจกรรมประมวลผลส่วนบุคคล (RoPA Record)
              </h3>
              <button
                aria-label="ปิดหน้าต่าง"
                title="Close Modal"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="p-5 text-xs overflow-y-auto bg-white space-y-4">
              {/* Header Info */}
              <div className="pb-3 border-b border-slate-200 flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h4 className="font-bold text-slate-800 text-lg">
                      {selectedRecord.activity_name}
                    </h4>
                    {getStatusBadge(selectedRecord.status)}
                  </div>
                  <div className="flex items-center gap-1.5 mb-2 mt-0.5">
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${selectedRecord.request_type === "ลบรายการ" ? "bg-red-50 text-red-600 border-red-100" : selectedRecord.request_type === "แก้ไข" ? "bg-amber-50 text-amber-600 border-amber-100" : "bg-blue-50 text-blue-600 border-blue-100"}`}
                    >
                      {selectedRecord.request_type || "สร้างรายการใหม่"}
                    </span>
                    <p className="text-slate-600 text-xs truncate">
                      {selectedRecord.purpose}
                    </p>
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium">
                    รหัส: {selectedRecord.id} &bull; ประเภท:{" "}
                    {selectedRecord.record_type}
                  </p>
                </div>
                <div className="text-right text-[10px] text-slate-500 bg-slate-50 p-2 rounded border border-slate-100">
                  <p>
                    <span className="font-medium text-slate-700">
                      ผู้ส่งคำขอ:
                    </span>{" "}
                    {selectedRecord.created_by} ({selectedRecord.department})
                  </p>
                  <p>
                    <span className="font-medium text-slate-700">
                      วันที่ส่ง:
                    </span>{" "}
                    {selectedRecord.submitted_date || selectedRecord.created_at}
                  </p>
                </div>
              </div>

              {/* Read Only Data - Section 1 */}
              <div>
                <h5 className="font-bold text-slate-700 mb-2 border-l-4 border-blue-500 pl-2">
                  1. ข้อมูลผู้ควบคุมและผู้ลงบันทึก
                </h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-100">
                  {selectedRecord.record_type === "Controller" ? (
                    <div className="sm:col-span-2">
                      <p className="text-slate-400 font-medium text-[10px] mb-0.5">
                        ข้อมูลเกี่ยวกับผู้ควบคุมข้อมูลส่วนบุคคล
                      </p>
                      <p className="text-slate-800 font-medium">
                        {selectedRecord.controller_info || "-"}
                      </p>
                    </div>
                  ) : (
                    <>
                      <div>
                        <p className="text-slate-400 font-medium text-[10px] mb-0.5">
                          ชื่อผู้ประมวลผลข้อมูลส่วนบุคคล
                        </p>
                        <p className="text-slate-800 font-medium">
                          {selectedRecord.processor_name || "-"}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-400 font-medium text-[10px] mb-0.5">
                          ที่อยู่ผู้ควบคุมข้อมูลส่วนบุคคล
                        </p>
                        <p className="text-slate-800 font-medium">
                          {selectedRecord.controller_address || "-"}
                        </p>
                      </div>
                    </>
                  )}
                  <div>
                    <p className="text-slate-400 font-medium text-[10px] mb-0.5">
                      {selectedRecord.record_type === "Processor"
                        ? "ชื่อผู้ลงบันทึก ROPA / DPO (ของฝั่ง Processor)"
                        : "ชื่อผู้ลงบันทึก ROPA / DPO"}
                    </p>
                    <p className="text-slate-800 font-medium">
                      {selectedRecord.created_by}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400 font-medium text-[10px] mb-0.5">
                      Email
                    </p>
                    <p className="text-slate-800 font-medium">
                      {selectedRecord.recorder_email}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400 font-medium text-[10px] mb-0.5">
                      เบอร์โทร
                    </p>
                    <p className="text-slate-800 font-medium">
                      {selectedRecord.recorder_phone}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400 font-medium text-[10px] mb-0.5">
                      ที่อยู่
                    </p>
                    <p className="text-slate-800 font-medium">
                      {selectedRecord.recorder_address}
                    </p>
                  </div>
                </div>
              </div>

              {/* Read Only Data - Section 2 */}
              <div>
                <h5 className="font-bold text-slate-700 mb-2 border-l-4 border-blue-500 pl-2">
                  2. รายละเอียดของข้อมูลที่จัดเก็บ
                </h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <div>
                    <p className="text-slate-400 font-medium text-[10px] mb-0.5">
                      หมวดหมู่เจ้าของข้อมูล
                    </p>
                    <p className="text-slate-800 font-medium">
                      {selectedRecord.data_subject_category ||
                        selectedRecord.data_subject ||
                        "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400 font-medium text-[10px] mb-0.5">
                      ประเภทของข้อมูล
                    </p>
                    <p className="text-slate-800 font-medium">
                      {selectedRecord.data_type || "-"}
                    </p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-slate-400 font-medium text-[10px] mb-0.5">
                      ข้อมูลส่วนบุคคลที่จัดเก็บ
                    </p>
                    <p className="text-slate-800 font-medium">
                      {selectedRecord.collected_personal_data ||
                        selectedRecord.collected_data ||
                        "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400 font-medium text-[10px] mb-0.5">
                      วิธีการได้มาซึ่งข้อมูล
                    </p>
                    <p className="text-slate-800 font-medium">
                      {selectedRecord.collection_format || "-"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Read Only Data - Section 3 */}
              <div>
                <h5 className="font-bold text-slate-700 mb-2 border-l-4 border-blue-500 pl-2">
                  3. แหล่งที่มา และ ฐานความชอบด้วยกฎหมาย
                </h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <div>
                    <p className="text-slate-400 font-medium text-[10px] mb-0.5">
                      {selectedRecord.record_type === "Controller"
                        ? "รับจากเจ้าของข้อมูลโดยตรงหรือไม่?"
                        : "รับจากผู้ควบคุมโดยตรงหรือไม่?"}
                    </p>
                    <p className="text-slate-800 font-medium">
                      {selectedRecord.record_type === "Controller"
                        ? selectedRecord.is_direct_from_subject === "true"
                          ? "ใช่ (รับโดยตรง)"
                          : "ไม่ใช่ (รับจากแหล่งอื่น)"
                        : selectedRecord.is_direct_from_controller === "true"
                          ? "ใช่ (รับโดยตรง)"
                          : "ไม่ใช่ (รับจากแหล่งอื่น)"}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400 font-medium text-[10px] mb-0.5">
                      กรณีแหล่งอื่น (ระบุแหล่งที่มา)
                    </p>
                    <p className="text-slate-800 font-medium">
                      {selectedRecord.indirect_source_detail || "-"}
                    </p>
                  </div>
                  <div className="sm:col-span-2 border-t border-slate-200 pt-2">
                    <p className="text-slate-400 font-medium text-[10px] mb-0.5">
                      ฐานในการประมวลผล (Legal Basis)
                    </p>
                    <p className="text-slate-800 font-medium bg-white border border-slate-200 px-2 py-1 rounded inline-block">
                      {selectedRecord.legal_basis || "-"}
                    </p>
                  </div>
                  {selectedRecord.record_type === "Controller" && (
                    <>
                      <div>
                        <p className="text-slate-400 font-medium text-[10px] mb-0.5">
                          การขอความยินยอมผู้เยาว์ อายุไม่เกิน 10 ปี
                        </p>
                        <p className="text-slate-800 font-medium">
                          {selectedRecord.minor_under_10 || "-"}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-400 font-medium text-[10px] mb-0.5">
                          การขอความยินยอมผู้เยาว์ อายุ 10 - 20 ปี
                        </p>
                        <p className="text-slate-800 font-medium">
                          {selectedRecord.minor_10_to_20 || "-"}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Read Only Data - Section 4 */}
              <div>
                <h5 className="font-bold text-slate-700 mb-2 border-l-4 border-blue-500 pl-2">
                  4. การส่งข้อมูลต่างประเทศ และ นโยบายการจัดเก็บ
                </h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <div>
                    <p className="text-slate-400 font-medium text-[10px] mb-0.5">
                      ส่งหรือโอนไปต่างประเทศ?
                    </p>
                    <p className="text-slate-800 font-medium">
                      {selectedRecord.cb_is_transferred === "true"
                        ? "มี"
                        : "ไม่มี"}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400 font-medium text-[10px] mb-0.5">
                      ส่งให้บริษัทในเครือต่างประเทศ?
                    </p>
                    <p className="text-slate-800 font-medium">
                      {selectedRecord.cb_is_intra_group === "true"
                        ? "ใช่"
                        : "ไม่ใช่"}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400 font-medium text-[10px] mb-0.5">
                      วิธีการโอนข้อมูล
                    </p>
                    <p className="text-slate-800 font-medium">
                      {selectedRecord.cb_transfer_method || "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400 font-medium text-[10px] mb-0.5">
                      มาตรฐานประเทศปลายทาง
                    </p>
                    <p className="text-slate-800 font-medium">
                      {selectedRecord.cb_destination_standard || "-"}
                    </p>
                  </div>
                  <div className="sm:col-span-2 border-t border-slate-200 pt-2">
                    <p className="text-slate-400 font-medium text-[10px] mb-0.5">
                      วิธีการเก็บรักษาข้อมูล
                    </p>
                    <p className="text-slate-800 font-medium">
                      {selectedRecord.rp_storage_method || "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400 font-medium text-[10px] mb-0.5">
                      ระยะเวลาเก็บรักษา
                    </p>
                    <p className="text-slate-800 font-medium">
                      {selectedRecord.rp_retention_period || "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400 font-medium text-[10px] mb-0.5">
                      สิทธิ/วิธีการเข้าถึงข้อมูล
                    </p>
                    <p className="text-slate-800 font-medium">
                      {selectedRecord.rp_access_rights || "-"}
                    </p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-slate-400 font-medium text-[10px] mb-0.5">
                      วิธีทำลายข้อมูลเมื่อสิ้นสุด
                    </p>
                    <p className="text-slate-800 font-medium">
                      {selectedRecord.rp_destruction_method || "-"}
                    </p>
                  </div>
                  {selectedRecord.record_type === "Controller" && (
                    <>
                      <div className="sm:col-span-2 border-t border-slate-200 pt-2">
                        <p className="text-slate-400 font-medium text-[10px] mb-0.5">
                          การเปิดเผยข้อมูลส่วนบุคคลที่ได้รับยกเว้นไม่ต้องขอความยินยอม
                        </p>
                        <p className="text-slate-800 font-medium">
                          {selectedRecord.disclosure_without_consent || "-"}
                        </p>
                      </div>
                      <div className="sm:col-span-2">
                        <p className="text-slate-400 font-medium text-[10px] mb-0.5">
                          การปฏิเสธคำขอการใช้สิทธิของเจ้าของข้อมูลส่วนบุคคล
                          (DSAR Rejection)
                        </p>
                        <p className="text-slate-800 font-medium">
                          {selectedRecord.dsar_rejection_record || "-"}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Read Only Data - Section 5 */}
              <div>
                <h5 className="font-bold text-slate-700 mb-2 border-l-4 border-blue-500 pl-2">
                  5. มาตรการความมั่นคงปลอดภัย
                </h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <div>
                    <p className="text-slate-400 font-medium text-[10px] mb-0.5">
                      มาตรการเชิงองค์กร
                    </p>
                    <p className="text-slate-800 font-medium">
                      {selectedRecord.sec_organizational || "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400 font-medium text-[10px] mb-0.5">
                      มาตรการเชิงเทคนิค
                    </p>
                    <p className="text-slate-800 font-medium">
                      {selectedRecord.sec_technical || "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400 font-medium text-[10px] mb-0.5">
                      มาตรการทางกายภาพ
                    </p>
                    <p className="text-slate-800 font-medium">
                      {selectedRecord.sec_physical || "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400 font-medium text-[10px] mb-0.5">
                      การควบคุมการเข้าถึงข้อมูล
                    </p>
                    <p className="text-slate-800 font-medium">
                      {selectedRecord.sec_access_control || "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400 font-medium text-[10px] mb-0.5">
                      การกำหนดหน้าที่ผู้ใช้งาน
                    </p>
                    <p className="text-slate-800 font-medium">
                      {selectedRecord.sec_user_responsibility || "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400 font-medium text-[10px] mb-0.5">
                      มาตรการตรวจสอบย้อนหลัง (Audit Trail)
                    </p>
                    <p className="text-slate-800 font-medium">
                      {selectedRecord.sec_audit_trail || "-"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* DPO ACTION AREA */}
            <div className="border-t border-slate-200 bg-slate-100 p-5 shrink-0">
              <label
                htmlFor="dpo_remark"
                className="block font-bold text-slate-800 mb-2 text-xs"
              >
                ส่วนของ DPO:{" "}
                <span className="font-normal text-slate-600 text-[11px] ml-1">
                  (กรุณาระบุหมายเหตุหรือเหตุผล หากต้องการตีกลับเอกสาร)
                </span>
              </label>
              <textarea
                id="dpo_remark"
                aria-label="หมายเหตุจาก DPO"
                title="DPO Remarks"
                rows={2}
                value={dpoRemark}
                onChange={(e) => setDpoRemark(e.target.value)}
                disabled={selectedRecord.status === "Approved"}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none resize-none mb-3 disabled:bg-slate-200 text-black "
                placeholder="ระบุความเห็น ข้อเสนอแนะ หรือเหตุผลที่ตีกลับเอกสาร..."
              />

              <div className="flex justify-end space-x-2">
                <button
                  aria-label="ปิดหน้าต่าง"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors shadow-sm"
                >
                  ปิดหน้าต่าง
                </button>

                {selectedRecord.status !== "Approved" && (
                  <>
                    <button
                      aria-label="ตีกลับรายการ"
                      onClick={() => handleApprovalAction("Rejected")}
                      className="px-4 py-2 text-xs font-bold text-red-600 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 transition-colors shadow-sm"
                    >
                      ตีกลับ (Reject)
                    </button>
                    <button
                      aria-label="อนุมัติรายการ"
                      onClick={() => handleApprovalAction("Approved")}
                      className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 rounded-md hover:bg-emerald-700 transition-colors shadow-md"
                    >
                      อนุมัติ (Approve)
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Alert Modal (แทน alert()) ── */}
      {alertModal.open && (
        <div className="fixed inset-0 z-9999 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setAlertModal({ open: false, message: "" })}
          />
          <div className="relative bg-white rounded-xl shadow-xl border border-slate-200 w-80 p-6 z-10">
            <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-6 h-6 text-amber-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                />
              </svg>
            </div>
            <h3 className="text-sm font-bold text-slate-800 text-center mb-2">
              กรุณาระบุเหตุผล
            </h3>
            <p className="text-xs text-slate-500 text-center mb-6 leading-relaxed">
              กรุณาระบุหมายเหตุหรือเหตุผลในการตีกลับ
              <br />
              เพื่อให้ผู้ลงบันทึกนำไปแก้ไข
            </p>
            <button
              onClick={() => setAlertModal({ open: false, message: "" })}
              className="w-full px-4 py-2 text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 rounded-md transition-colors"
            >
              รับทราบ
            </button>
          </div>
        </div>
      )}

      {/* ── Custom Confirm Modal ── */}
      {confirmModal.open && (
        <div className="fixed inset-0 z-9999 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setConfirmModal({ open: false, action: null })}
          />
          {/* Dialog */}
          <div className="relative bg-white rounded-xl shadow-xl border border-slate-200 w-80 p-6 z-10">
            {/* Icon */}
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 ${confirmModal.action === "Approved" ? "bg-emerald-50" : "bg-red-50"}`}
            >
              {confirmModal.action === "Approved" ? (
                <svg
                  className="w-6 h-6 text-emerald-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              ) : (
                <svg
                  className="w-6 h-6 text-red-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                  />
                </svg>
              )}
            </div>
            <h3 className="text-sm font-bold text-slate-800 text-center mb-1">
              {confirmModal.action === "Approved"
                ? "ยืนยันการอนุมัติ"
                : "ยืนยันการตีกลับ"}
            </h3>
            <p className="text-xs text-slate-500 text-center mb-6">
              คุณต้องการ{" "}
              <span
                className={`font-bold ${confirmModal.action === "Approved" ? "text-emerald-600" : "text-red-500"}`}
              >
                {confirmModal.action === "Approved" ? "อนุมัติ" : "ตีกลับ"}
              </span>{" "}
              รายการนี้ใช่หรือไม่?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmModal({ open: false, action: null })}
                className="flex-1 px-4 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleConfirmApproval}
                className={`flex-1 px-4 py-2 text-xs font-bold text-white rounded-md transition-colors shadow-sm ${confirmModal.action === "Approved" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-500 hover:bg-red-600"}`}
              >
                {confirmModal.action === "Approved" ? "อนุมัติ" : "ตีกลับ"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
