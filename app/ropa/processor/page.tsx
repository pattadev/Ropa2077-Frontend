//app/ropa/processor /page.tsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { jwtDecode } from "jwt-decode";

// ==========================================
// TypeScript Interfaces
// ==========================================
export interface RopaData {
  id?: number | string;
  record_type?: string;
  request_type?: string; 
  activity_name?: string;
  purpose?: string;
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
  cb_section_28_exception?: string;
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

const API_BASE_URL = `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/v1/ropa`;

// ==========================================
// Helper Functions: จัดการวันที่ พ.ศ.
// ==========================================
const parseThaiDate = (dateStr?: string) => {
  if (!dateStr || dateStr === "-") return new Date(0);
  
  if (dateStr.includes('-') && dateStr.includes('T')) {
      const parsed = new Date(dateStr);
      if (!isNaN(parsed.getTime())) return parsed;
  }

  const parts = dateStr.split(' ');
  if (parts.length < 1) return new Date(0);
  
  const dateParts = parts[0].split('/');
  if (dateParts.length !== 3) return new Date(0);
  
  const d = parseInt(dateParts[0], 10);
  const m = parseInt(dateParts[1], 10);
  let y = parseInt(dateParts[2], 10);
  
  if (y > 2500) y -= 543; 
  
  let hr = 0, min = 0, sec = 0;
  if (parts.length > 1) {
    const timeParts = parts[1].split(':');
    hr = parseInt(timeParts[0], 10) || 0;
    min = parseInt(timeParts[1], 10) || 0;
    sec = parseInt(timeParts[2], 10) || 0;
  }
  
  return new Date(y, m - 1, d, hr, min, sec);
};

const isWithinDateRange = (dateStr: string | undefined, dateRange: string, exactDate: string) => {
  if (dateRange === "ทั้งหมด") return true;
  if (!dateStr || dateStr === "-") return false;

  const recordDate = parseThaiDate(dateStr);
  const now = new Date();

  if (dateRange === "ระบุวัน" && exactDate) {
    const exact = new Date(exactDate);
    return recordDate.getDate() === exact.getDate() &&
           recordDate.getMonth() === exact.getMonth() &&
           recordDate.getFullYear() === exact.getFullYear();
  }

  if (dateRange === "วันนี้") {
    return recordDate.getDate() === now.getDate() &&
           recordDate.getMonth() === now.getMonth() &&
           recordDate.getFullYear() === now.getFullYear();
  }
  if (dateRange === "สัปดาห์นี้") {
     const startOfWeek = new Date(now);
     startOfWeek.setDate(now.getDate() - now.getDay()); 
     startOfWeek.setHours(0,0,0,0);
     const endOfWeek = new Date(startOfWeek);
     endOfWeek.setDate(startOfWeek.getDate() + 6); 
     endOfWeek.setHours(23,59,59,999);
     return recordDate >= startOfWeek && recordDate <= endOfWeek;
  }
  if (dateRange === "เดือนนี้") {
    return recordDate.getMonth() === now.getMonth() &&
           recordDate.getFullYear() === now.getFullYear();
  }
  if (dateRange === "ปีนี้") {
    return recordDate.getFullYear() === now.getFullYear();
  }
  return true;
};

export default function RoPARecordPage() {
  const router = useRouter();

  // 🛠️ User & Auth States
  const [currentUser, setCurrentUser] = useState<any>({ name: "", email: "", phone: "", address: "", role: "", department: ""});
  const [token, setToken] = useState<string>("");
  const [isAuditor, setIsAuditor] = useState(false);
  const [navPerms, setNavPerms] = useState({ canSeeDashboard: false, canSeeDPO: false, canSeeRopa: true, canSeeUsers: false });
  const [isLoading, setIsLoading] = useState(false); 

  // Layout States
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isRopaMenuOpen, setIsRopaMenuOpen] = useState(true);

  // Page States
  const currentMenu = "Processor";
  const [currentTab, setCurrentTab] = useState("Activities");

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("add");
  const [selectedRecord, setSelectedRecord] = useState<RopaData | null>(null);

  // Delete Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<RopaData | null>(null);

  // ==========================================
  // Import Excel States
  // ==========================================
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importStatus, setImportStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [importMessage, setImportMessage] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);

  // Form State
  const [formData, setFormData] = useState<RopaData>({
    record_type: "Controller", request_type: "สร้างรายการใหม่",
    controller_info: "", processor_name: "", controller_address: "",
    activity_name: "", purpose: "", collected_personal_data: "", data_subject_category: "",
    data_type: "", collection_format: "", is_direct_from_subject: "true", is_direct_from_controller: "true", indirect_source_detail: "", legal_basis: "",
    minor_under_10: "", minor_10_to_20: "", cb_is_transferred: "false", cb_is_intra_group: "false", cb_transfer_method: "",
    cb_destination_standard: "", cb_section_28_exception: "", rp_storage_format: "", rp_storage_method: "", rp_retention_period: "",
    rp_access_rights: "", rp_destruction_method: "", disclosure_without_consent: "", dsar_rejection_record: "", sec_organizational: "",
    sec_technical: "", sec_physical: "", sec_access_control: "", sec_user_responsibility: "", sec_audit_trail: "", rejection_reason: ""
  });

  // Data States
  const [controllerData, setControllerData] = useState<RopaData[]>([]);

  // Filters & Sorting
  const [filters, setFilters] = useState({ id: "", activity_name: "", purpose: "", legal_basis: "", status: "", date_range: "ทั้งหมด", exact_date: "" });
  const [sortConfig, setSortConfig] = useState({ key: "created_at", direction: "desc" });

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [pageInputValue, setPageInputValue] = useState("1");

  useEffect(() => {
      const storedToken = localStorage.getItem("token");

      if (storedToken) {
        try {
          const decodedUser: any = jwtDecode(storedToken);
          const currentTime = Math.floor(Date.now() / 1000);
          if (decodedUser.exp && decodedUser.exp < currentTime) {
            throw new Error("Token expired");
          }

          // 🔒 Route Guard: เฉพาะ role ที่อนุญาตเท่านั้นเข้าหน้านี้ได้
          const role = (decodedUser.role || "").toString();
          const allowedRoles = ["data_owner", "auditor", "admin", "developer"];
          const isAllowed = allowedRoles.some(r => role.toLowerCase() === r.toLowerCase());
          if (!isAllowed) {
            router.push("/login");
            return;
          }

          setIsAuditor(role.toLowerCase() === "auditor" && role.toLowerCase() !== "developer");

          // 🔒 Sidebar visibility per role
          const r = role.toLowerCase();
          const canSeeDashboard  = ["executive","auditor","developer"].includes(r);
          const canSeeDPO        = ["dpo","auditor","developer"].includes(r);
          const canSeeRopa       = ["data_owner","auditor","developer"].includes(r);
          const canSeeUsers      = ["admin","developer","auditor"].includes(r);
          setNavPerms({ canSeeDashboard, canSeeDPO, canSeeRopa, canSeeUsers });
          setToken(storedToken);
          
          setCurrentUser({
            name: decodedUser.name || decodedUser.sub || "User",
            email: decodedUser.email || "-",
            role: decodedUser.role || "data_owner",
            phone: decodedUser.phone || "-",
            address: decodedUser.address || "-",
            department: decodedUser.department || decodedUser.dept || decodedUser.unit || ""
          });
          
          fetchRopaData(storedToken);
        } catch (error) {
          console.error("Token Error กรุณา Login ใหม่", error);
          handleLogout();
        }
      } else {
        router.push("/login");
      }
  }, [router]);

  const fetchRopaData = async (authToken: string) => {
    setIsLoading(true);
    try {
      const safeBaseUrl = API_BASE_URL.endsWith('/') ? API_BASE_URL : `${API_BASE_URL}/`;
      const controllerUrl = `${safeBaseUrl}processor/records`;

      const res = await fetch(controllerUrl, {
        method: "GET",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${authToken}` }
      });

      const dataJson = res.ok ? await res.json() : { records: [] };
      setControllerData(Array.isArray(dataJson.records) ? dataJson.records : []);
    } catch (error) {
      console.error("Error fetching data:", error);
      if (error instanceof Error && error.message.includes("401")) {
        localStorage.removeItem("token");
        router.push("/login");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ==========================================
  // Import Excel Handler
  // ==========================================
  const handleImportExcel = async () => {
    if (!importFile) return;
    setImportStatus("loading");
    setImportMessage("");

    try {
      const formDataUpload = new FormData();
      formDataUpload.append("file", importFile);

      const safeBaseUrl = API_BASE_URL.endsWith('/') ? API_BASE_URL : `${API_BASE_URL}/`;
      const res = await fetch(`${safeBaseUrl}processor/import`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` },
        body: formDataUpload,
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "นำเข้าข้อมูลไม่สำเร็จ");
      }

      setImportStatus("success");
      setImportMessage("นำเข้าข้อมูลสำเร็จแล้ว!");
      await fetchRopaData(token);
    } catch (err) {
      setImportStatus("error");
      setImportMessage(err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการนำเข้าข้อมูล");
    }
  };

  const openImportModal = () => {
    setImportFile(null);
    setImportStatus("idle");
    setImportMessage("");
    setIsDragOver(false);
    setIsImportModalOpen(true);
  };

  const getActiveData = () => {
    let sourceData = controllerData;

    try {
      const roleLower = (currentUser?.role || "").toString().toLowerCase();
      const isDataOwner = roleLower.includes("data") && roleLower.includes("owner");
      const userDept = (currentUser?.department || "").toString().toLowerCase();
      if (isDataOwner && userDept) {
        sourceData = sourceData.filter(item => {
          const itemDept = (item.department || item.dept || item.unit || "").toString().toLowerCase();
          return itemDept === userDept;
        });
      }
    } catch (e) {
      // ignore filtering errors and fall back to full dataset
    }

    if (!controllerData || !Array.isArray(sourceData)) return [];

    if (currentTab === "Approval") {
      return sourceData.filter(item => {
        const s = item.status?.toLowerCase();
        return s === "pending";
      });
    };
    if (currentTab === "Activities") {
      return sourceData.filter(item => {
        const s = item.status?.toLowerCase();
        return s === "approved" || s === "rejected";
      });
    }
  };

  const activeData = getActiveData();

  const filteredData = (activeData || []).filter(item => {
    const matchId = String(item.id || "").toLowerCase().includes(filters.id.toLowerCase());
    const matchActivity = (item.activity_name || "").toLowerCase().includes(filters.activity_name.toLowerCase());
    const matchPurpose = (item.purpose || "").toLowerCase().includes(filters.purpose.toLowerCase());
    const matchBasis = (item.legal_basis || "").toLowerCase().includes(filters.legal_basis.toLowerCase());
    const matchStatus = filters.status === "" || item.status === filters.status;
    const matchDate = isWithinDateRange(item.created_at, filters.date_range, filters.exact_date);

    return matchId && matchActivity && matchPurpose && matchBasis && matchStatus && matchDate;
  });

  const sortedData = [...filteredData].sort((a, b) => {
    const { key, direction } = sortConfig;
    if (key === 'id') {
      const numA = parseInt((a as any).id || '0', 10) || 0;
      const numB = parseInt((b as any).id || '0', 10) || 0;
      if (numA < numB) return direction === 'asc' ? -1 : 1;
      if (numA > numB) return direction === 'asc' ? 1 : -1;
      return 0;
    }
    if (key === 'created_at') {
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
    if (sortConfig.key === key && sortConfig.direction === "asc") direction = "desc";
    setSortConfig({ key, direction });
    setCurrentPage(1);
  };

  const renderSortIcon = (columnKey: string) => {
    const isActive = sortConfig.key === columnKey;
    const isAsc = isActive && sortConfig.direction === "asc";
    if (!isActive) return <svg className="w-3 h-3 text-slate-400 opacity-40 ml-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" /></svg>;
    if (isAsc) return <svg className="w-3 h-3 text-blue-600 ml-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" /></svg>;
    return <svg className="w-3 h-3 text-blue-600 ml-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>;
  };

  const handleFilterChange = (column: string, value: string) => {
    setFilters(prev => ({ ...prev, [column]: value }));
    setCurrentPage(1);
  };

  const handleResetFilters = () => {
    setFilters({ id: "", activity_name: "", purpose: "", legal_basis: "", status: "", date_range: "ทั้งหมด", exact_date: "" });
    setSortConfig({ key: "created_at", direction: "desc" });
    setCurrentPage(1);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    router.push("/login");
  };

  const sanitizeFormData = (data: RopaData) => {
    const sanitized = { ...data };
    Object.keys(sanitized).forEach((key) => {
      if (sanitized[key] === null || sanitized[key] === undefined) {
        sanitized[key] = "";
      }
    });
    return sanitized;
  };

  const openModal = (mode: string, record: RopaData | null = null) => {
    setModalMode(mode);
    setSelectedRecord(record);
    if (mode === 'add') {
      setFormData(
        sanitizeFormData({
        record_type: currentMenu, 
        request_type: "สร้างรายการใหม่",
        controller_info: "", processor_name: "", controller_address: "",
        activity_name: "", purpose: "", collected_personal_data: "", data_subject_category: "",
        data_type: "", collection_format: "", is_direct_from_subject: "true", is_direct_from_controller: "true", indirect_source_detail: "", legal_basis: "",
        minor_under_10: "", minor_10_to_20: "", cb_is_transferred: "false", cb_is_intra_group: "false", cb_transfer_method: "",
        cb_destination_standard: "", cb_section_28_exception: "", rp_storage_format: "", rp_storage_method: "", rp_retention_period: "",
        rp_access_rights: "", rp_destruction_method: "", disclosure_without_consent: "", dsar_rejection_record: "", sec_organizational: "",
        sec_technical: "", sec_physical: "", sec_access_control: "", sec_user_responsibility: "", sec_audit_trail: "", rejection_reason: ""
      }));
    } else if (record) {
      setFormData({ ...formData, ...record });
    }
    setIsModalOpen(true);
  };

  const handleSaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    let payload = { 
      ...formData,
      record_type: currentMenu,
      data_subject: formData.data_subject_category,
      created_by: currentUser.name,
      recorder_email: currentUser.email,
      recorder_phone: currentUser.phone || "-",
      recorder_address: currentUser.address || "-"
    };

    if (modalMode === 'edit' && selectedRecord?.status === 'Approved') {
      payload.request_type = "แก้ไข";
      payload.status = "Pending"
    } else if (modalMode === 'add') {
      payload.request_type = "สร้างรายการใหม่";
    }

    try {
      const safeBaseUrl = API_BASE_URL.endsWith('/') ? API_BASE_URL : `${API_BASE_URL}/`;
      const endpointType = "processor";
      
      let url = `${safeBaseUrl}${endpointType}`; 
      let method = "POST";

      if (modalMode === 'edit') {
        if (!selectedRecord?.id) throw new Error("ไม่พบ ID ของรายการที่ต้องการแก้ไข");
        url = `${url}/records/${selectedRecord.id}`;
        payload.status = "Pending"; 
        method = "PUT";
        delete payload.id; 
      }
      if (modalMode === 'add') {
        url = `${url}/create`;
        payload.status = "Pending"; 
        method = "POST";
        delete payload.id; 
      }
      console.log("Current Record Status:", selectedRecord?.status);
      console.log("Payload to send:", payload);
      const res = await fetch(url, {
        method: method,
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || "บันทึกข้อมูลไม่สำเร็จ");
      }

      setIsModalOpen(false);
      await fetchRopaData(token);

    } catch (error) {
      console.error("Error saving data:", error);
      alert(error instanceof Error ? error.message : "เกิดข้อผิดพลาดในการบันทึก");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteClick = (record: RopaData) => {
    setRecordToDelete(record);
    setIsDeleteModalOpen(true);
  };

  const executeDelete = async () => {
    if (!recordToDelete) return;
    setIsLoading(true);

    try {
      const safeBaseUrl = API_BASE_URL.endsWith('/') ? API_BASE_URL : `${API_BASE_URL}/`;
      const endpointType = recordToDelete.record_type === "Controller" ? "controller" : "processor";
      const baseUrlForDelete = `${safeBaseUrl}${endpointType}/records`;

      if (recordToDelete.status === 'Approved') {
        const payload = { ...recordToDelete, status: "Pending", request_type: "ลบรายการ" };
        const res = await fetch(`${baseUrlForDelete}/${recordToDelete.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error("ส่งคำขอลบไม่สำเร็จ");
      } else {
        const res = await fetch(`${baseUrlForDelete}/${recordToDelete.id}`, {
          method: "DELETE",
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });
        if (!res.ok) throw new Error("ลบข้อมูลไม่สำเร็จ");
      }
      
      setIsDeleteModalOpen(false);
      setRecordToDelete(null);
      await fetchRopaData(token); 

    } catch (error) {
      console.error("Error deleting data:", error);
      alert("เกิดข้อผิดพลาดในการลบข้อมูล");
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'Approved': return <span className="px-2 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-bold rounded-md border border-emerald-200">Approved</span>;
      case 'Pending': return <span className="px-2 py-1 bg-amber-50 text-amber-600 text-[10px] font-bold rounded-md border border-amber-200">Pending</span>;
      case 'Rejected': return <span className="px-2 py-1 bg-red-50 text-red-600 text-[10px] font-bold rounded-md border border-red-200">Rejected</span>;
      default: return <span className="px-2 py-1 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-md border border-slate-200">{status || "-"}</span>;
    }
  };


  return (
    <div className="h-screen flex flex-col font-sans overflow-hidden bg-slate-50">

      {/* 1. Top Navbar */}
      <header className="w-full h-14 bg-slate-900 text-white flex items-center justify-between px-6 shadow-md z-30 shrink-0">
        <div className="flex items-center">
          <span className="text-lg font-bold tracking-wider">RoPA <span className="text-blue-400">2077</span></span>
        </div>
        <div className="relative">
          <button aria-label="เมนูบัญชีผู้ใช้" title="User Menu" onClick={() => setIsProfileOpen(!isProfileOpen)} className="flex items-center gap-2 hover:bg-slate-800 p-1.5 rounded-lg transition-colors focus:outline-none">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-semibold text-slate-100">{currentUser?.name}</p>
              <p className="text-[10px] text-slate-400">{currentUser?.role}</p>
            </div>
            <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold shadow-sm text-xs border border-slate-700">
              {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : "U"}
            </div>
            <svg className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isProfileOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {isProfileOpen && (
            <div className="absolute right-0 mt-2 w-40 bg-white rounded-lg shadow-lg border border-slate-100 py-1 z-50">
              <button aria-label="ออกจากระบบ" title="Logout" onClick={handleLogout} className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 flex items-center transition-colors font-medium">
                <svg className="w-3.5 h-3.5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                ออกจากระบบ
              </button>
            </div>
          )}
        </div>
      </header>

      {/* 2. Container */}
      <div className="flex-1 flex overflow-hidden relative">
        <aside className={`relative bg-white border-r border-slate-200 flex flex-col z-20 transition-all duration-300 ease-in-out ${isSidebarOpen ? 'w-56' : 'w-0'}`}>
          <div className="w-full h-full">
            <div className="w-56 flex flex-col h-full pt-4">
              <nav className="flex-1 space-y-0.5 px-3">
                {navPerms.canSeeDashboard && (
                <Link aria-label="ไปที่หน้าแดชบอร์ด" title="Dashboard" href="/dashboard" className="flex items-center px-3 py-2.5 text-slate-600 hover:bg-slate-50 hover:text-blue-600 rounded-lg font-medium transition-colors text-xs mb-1">
                  <svg className="w-4 h-4 mr-2.5 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6z" /></svg>
                  Dashboard
                </Link>
                )}
                {navPerms.canSeeDPO && (
                <Link aria-label="DPO Workspace" title="DPO Workspace" href="/dpo" className="flex items-center px-3 py-2.5 text-slate-600 hover:bg-slate-50 hover:text-blue-600 rounded-lg font-medium transition-colors text-xs mb-1">
                  <svg className="w-4 h-4 mr-2.5 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  DPO Approval
                </Link>
                )}
                {navPerms.canSeeRopa && (
                <div className="bg-slate-50 rounded-lg overflow-hidden border border-slate-100">
                  <button aria-label="สลับเมนู RoPA Record" title="RoPA Record Menu" onClick={() => setIsRopaMenuOpen(!isRopaMenuOpen)} className="w-full flex items-center justify-between px-3 py-2.5 text-slate-600 font-medium hover:bg-slate-100 transition-colors text-xs">
                    <div className="flex items-center">
                      <svg className="w-4 h-4 mr-2.5 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      RoPA Record
                    </div>
                    <svg className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isRopaMenuOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </button>
                  {isRopaMenuOpen && (
                    <div className="flex flex-col pb-1">
                      <Link aria-label="ดูข้อมูล Controller" title="Controller Menu" href="/ropa/controller" className={`w-full text-left pl-10 pr-3 py-2 text-xs font-medium transition-colors block ${currentMenu === "Controller" ? "text-blue-700 bg-blue-100/50" : "text-slate-600 hover:text-slate-800 hover:bg-slate-100"}`}>Controller</Link>
                      <Link aria-label="ดูข้อมูล Processor" title="Processor Menu" href="/ropa/processor" className={`w-full text-left pl-10 pr-3 py-2 text-xs font-medium transition-colors block ${currentMenu === "Processor" ? "text-blue-700 bg-blue-100/50" : "text-slate-600 hover:text-slate-800 hover:bg-slate-100"}`}>Processor</Link>
                    </div>
                  )}
                </div>
                )}
                {navPerms.canSeeUsers && (
                <Link aria-label="ไปที่หน้าผู้ใช้งาน" title="User Management" href="/users" className="flex items-center px-3 py-2.5 text-slate-600 hover:bg-slate-50 hover:text-blue-600 rounded-lg font-medium transition-colors text-xs mt-1">
                  <svg className="w-4 h-4 mr-2.5 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                  User Management
                </Link>
                )}
              </nav>
            </div>
          </div>
          <button aria-label="ซ่อน/แสดง แถบเมนูด้านข้าง" title="Toggle Sidebar" onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="absolute -right-3.5 top-1/2 -translate-y-1/2 w-7 h-7 bg-white text-slate-400 rounded-full flex items-center justify-center border border-slate-200 shadow-sm hover:text-blue-600 hover:bg-slate-50 transition-all z-40">
            <svg className={`w-3.5 h-3.5 transition-transform duration-300 ${!isSidebarOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col h-full overflow-y-auto bg-slate-50 p-6 relative">
          <div className="mb-3">
            <div className="flex items-center text-[11px] text-slate-500 mb-2 font-medium">
              <Link aria-label="ไปหน้าแรก" title="Home" href="/dashboard" className="hover:text-blue-600 transition-colors">Home</Link>
              <span className="mx-1.5">/</span>
              <span className="text-slate-500">RoPA Record Activities</span>
              <span className="mx-1.5">/</span>
              <span className="text-slate-800 font-bold">{currentMenu}</span>
            </div>

            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-3 mb-4">
              <div>
                <h1 className="text-xl font-bold text-slate-800 mb-1">RoPA {currentMenu} Activities {currentTab === "Approval" && "Approval"}</h1>
                <h2 className="text-xs text-slate-500">จัดการและติดตามกิจกรรมประมวลผลข้อมูลส่วนบุคคล</h2>
              </div>

              {/* ==========================================
                  ปุ่ม Import Excel + เพิ่ม Activity
              ========================================== */}
              <div className={`flex items-center gap-2 ${isAuditor ? "hidden" : ""}`}>
                {/* ปุ่ม นำเข้า Excel */}
                <button
                  aria-label="นำเข้าข้อมูลจาก Excel"
                  title="Import Excel"
                  onClick={openImportModal}
                  className="flex items-center justify-center px-4 py-2 text-xs font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-700 active:bg-emerald-800 transition-colors shadow-sm w-fit"
                >
                  <svg className="w-3.5 h-3.5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  นำเข้า Excel
                </button>

                {/* ปุ่ม เพิ่ม Activity */}
                <button
                  aria-label="เพิ่มกิจกรรมใหม่"
                  title="Add Activity"
                  onClick={() => openModal('add')}
                  className="flex items-center justify-center px-4 py-2 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 active:bg-blue-800 transition-colors shadow-sm w-fit"
                >
                  <svg className="w-3.5 h-3.5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  เพิ่ม Activity
                </button>
              </div>
            </div>

            <div className="flex space-x-6 border-b border-slate-200 px-2">
              <button aria-label="แท็บกิจกรรมทั้งหมด" title="Activities Tab" onClick={() => { setCurrentTab("Activities"); setCurrentPage(1); handleResetFilters(); }} className={`pb-2 text-sm font-bold transition-colors relative ${currentTab === "Activities" ? "text-slate-800" : "text-slate-400 hover:text-slate-600"}`}>
                Activities
                {currentTab === "Activities" && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-slate-800 rounded-t-md"></span>}
              </button>
              <button aria-label="แท็บรออนุมัติ" title="Approval Tab" onClick={() => { setCurrentTab("Approval"); setCurrentPage(1); handleResetFilters(); }} className={`pb-2 text-sm font-bold transition-colors relative ${currentTab === "Approval" ? "text-slate-800" : "text-slate-400 hover:text-slate-600"}`}>
                Approval
                {currentTab === "Approval" && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-slate-800 rounded-t-md"></span>}
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
                      <div className="font-semibold text-slate-700 mb-1.5 truncate cursor-pointer hover:text-blue-600 flex items-center" onClick={() => handleSort('id')}>
                        รหัส {renderSortIcon('id')}
                      </div>
                      <input type="text" aria-label="ค้นหารหัส" title="ค้นหารหัส" placeholder="ค้นหา..." value={filters.id} onChange={(e) => handleFilterChange('id', e.target.value)} onClick={(e) => e.stopPropagation()} className="w-full text-[10px] px-1.5 py-1 border border-slate-300 rounded outline-none focus:border-blue-500 bg-white text-black" />
                    </th>
                    <th className="w-[22%] px-2 py-2.5 align-top overflow-hidden">
                      <div className="font-semibold text-slate-700 mb-1.5 truncate cursor-pointer hover:text-blue-600 flex items-center" onClick={() => handleSort('activity_name')}>
                        กิจกรรมประมวลผล {renderSortIcon('activity_name')}
                      </div>
                      <input type="text" aria-label="ค้นหาชื่อกิจกรรม" title="ค้นหาชื่อกิจกรรม" placeholder="ค้นหาชื่อกิจกรรม..." value={filters.activity_name} onChange={(e) => handleFilterChange('activity_name', e.target.value)} onClick={(e) => e.stopPropagation()} className="w-full text-[10px] px-1.5 py-1 border border-slate-300 rounded outline-none focus:border-blue-500 bg-white text-black" />
                    </th>
                    <th className="w-[20%] px-2 py-2.5 align-top overflow-hidden">
                      <div className="font-semibold text-slate-700 mb-1.5 truncate cursor-pointer hover:text-blue-600 flex items-center" onClick={() => handleSort('purpose')}>
                        วัตถุประสงค์ {renderSortIcon('purpose')}
                      </div>
                      <input type="text" aria-label="ค้นหาวัตถุประสงค์" title="ค้นหาวัตถุประสงค์" placeholder="ค้นหาวัตถุประสงค์..." value={filters.purpose} onChange={(e) => handleFilterChange('purpose', e.target.value)} onClick={(e) => e.stopPropagation()} className="w-full text-[10px] px-1.5 py-1 border border-slate-300 rounded outline-none focus:border-blue-500 bg-white text-black" />
                    </th>
                    <th className="w-[12%] px-2 py-2.5 align-top overflow-hidden">
                      <div className="font-semibold text-slate-700 mb-1.5 truncate cursor-pointer hover:text-blue-600 flex items-center" onClick={() => handleSort('legal_basis')}>
                        ฐานประมวลผล {renderSortIcon('legal_basis')}
                      </div>
                      <input type="text" aria-label="ค้นหาฐานประมวลผล" title="ค้นหาฐานประมวลผล" placeholder="ค้นหาฐาน..." value={filters.legal_basis} onChange={(e) => handleFilterChange('legal_basis', e.target.value)} onClick={(e) => e.stopPropagation()} className="w-full text-[10px] px-1.5 py-1 border border-slate-300 rounded outline-none focus:border-blue-500 bg-white text-black" />
                    </th>
                    <th className="w-[12%] px-2 py-2.5 align-top overflow-hidden">
                      <div className="font-semibold text-slate-700 mb-1.5 truncate cursor-pointer hover:text-blue-600 flex items-center" onClick={() => handleSort('status')}>
                        สถานะ {renderSortIcon('status')}
                      </div>
                      <select aria-label="กรองตามสถานะ" title="กรองตามสถานะ" value={filters.status} onChange={(e) => handleFilterChange('status', e.target.value)} onClick={(e) => e.stopPropagation()} className="w-full text-[10px] px-1.5 py-1 border border-slate-300 rounded outline-none focus:border-blue-500 bg-white cursor-pointer text-black">
                        <option value="">ทั้งหมด</option>
                        {currentTab === "Activities" ? (
                          <>
                            <option value="Approved">Approved</option>
                            <option value="Rejected">Rejected</option>
                          </>
                        ) : (
                          <option value="Pending">Pending</option>
                        )}
                      </select>
                    </th>
                    <th className="w-[18%] px-2 py-2.5 align-top overflow-hidden">
                      <div className="font-semibold text-slate-700 mb-1.5 truncate cursor-pointer hover:text-blue-600 flex items-center" onClick={() => handleSort('created_at')}>
                        ประวัติรายการ (Audit Log) {renderSortIcon('created_at')}
                      </div>
                      <div className="flex flex-col gap-1">
                        <select aria-label="กรองช่วงเวลา" title="กรองช่วงเวลา" value={filters.date_range} onChange={(e) => handleFilterChange('date_range', e.target.value)} onClick={(e) => e.stopPropagation()} className="w-full text-[10px] px-1.5 py-1 border border-slate-300 rounded outline-none focus:border-blue-500 bg-white cursor-pointer text-black">
                          <option value="ทั้งหมด">เวลาทั้งหมด</option>
                          <option value="วันนี้">วันนี้</option>
                          <option value="สัปดาห์นี้">สัปดาห์นี้</option>
                          <option value="เดือนนี้">เดือนนี้</option>
                          <option value="ปีนี้">ปีนี้</option>
                          <option value="ระบุวัน">ระบุวัน...</option>
                        </select>
                        {filters.date_range === 'ระบุวัน' && (
                          <input aria-label="เลือกวันที่ระบุ" title="เลือกวันที่" type="date" value={filters.exact_date} onChange={(e) => handleFilterChange('exact_date', e.target.value)} onClick={(e) => e.stopPropagation()} className="w-full text-[10px] px-1.5 py-1 border border-slate-300 rounded outline-none focus:border-blue-500 bg-white text-black" />
                        )}
                      </div>
                    </th>

                    <th className="w-[8%] px-2 py-2.5 align-top text-center overflow-hidden">
                      <div className="font-semibold text-slate-700 mb-1.5 truncate">จัดการ</div>
                      <div className="flex flex-col items-center mt-1">
                        <button aria-label="ล้างตัวกรองทั้งหมด" title="Reset Filters" onClick={handleResetFilters} className="flex items-center text-[10px] font-medium text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-1.5 py-1 rounded transition-colors">
                          <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                          Reset
                        </button>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {isLoading ? (
                    <tr><td colSpan={7} className="px-2 py-8 text-center text-slate-400 text-xs">กำลังโหลดข้อมูล...</td></tr>
                  ) : currentRecords.length > 0 ? currentRecords.map((record) => (
                    <tr key={record.id} className="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-b-0">
                      <td className="px-2 py-2 truncate text-slate-500 font-medium" title={`${record.id || "-"}`}>{record.id ?? "-"}</td>
                      
                      <td className="px-2 py-2 overflow-hidden">
                        <div className="truncate w-full">
                          <div className="font-semibold text-slate-800 truncate" title={record.activity_name}>{record.activity_name}</div>
                          <div className="text-[10px] text-slate-500 truncate mt-0.5" title={record.data_subject_category || record.data_subject}>หมวดหมู่: {record.data_subject_category || record.data_subject}</div>
                        </div>
                      </td>
                      <td className="px-2 py-2 truncate" title={record.purpose}>{record.purpose}</td>
                      <td className="px-2 py-2 truncate" title={record.legal_basis}>
                        <span className="bg-slate-100 px-2 py-1 rounded border border-slate-200 text-[10px]">{record.legal_basis}</span>
                      </td>
                      <td className="px-2 py-2 truncate">{getStatusBadge(record.status)}</td>
                      <td className="px-2 py-2 text-[10px] leading-tight text-slate-500 overflow-hidden">
                        <div className="truncate mb-0.5"><span className="font-medium text-slate-700">Created:</span> {record.created_at} <span className="text-slate-400 ml-0.5">by {record.created_by}</span></div>
                        <div className="truncate"><span className="font-medium text-slate-700">Updated:</span> {record.updated_at} <span className="text-slate-400 ml-0.5">by {record.updated_by}</span></div>
                      </td>
                      <td className="px-2 py-2 text-center">
                        <button aria-label="ดูข้อมูล" title="View Detail" onClick={() => openModal('view', record)} className="text-slate-400 hover:text-emerald-600 mx-0.5 p-1 transition-colors">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        </button>
                        {currentTab !== "Approval" && !isAuditor && (
                          <button aria-label="แก้ไข" title={record.status === 'Approved' ? "ขอแก้ไขรายการ" : "แก้ไข"} onClick={() => openModal('edit', record)} className="text-slate-400 hover:text-blue-600 mx-0.5 p-1 transition-colors">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                          </button>
                        )}
                        {!isAuditor && (
                        <button aria-label="ลบ" title={record.status === 'Approved' ? "ส่งคำขอลบ" : record.status === 'Pending' ? "ยกเลิกคำขอ" : "ลบรายการ"} onClick={() => handleDeleteClick(record)} className="text-slate-400 hover:text-red-600 mx-0.5 p-1 transition-colors">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                        )}
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan={7} className="px-2 py-8 text-center text-slate-500">ไม่พบข้อมูลที่ค้นหา</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-2.5 border-t border-slate-200 bg-white text-[11px] text-slate-600 shrink-0">
              <div className="flex items-center space-x-3 mb-2 sm:mb-0">
                <div className="flex items-center space-x-1.5">
                  <label htmlFor="itemsPerPageSelect">Items per page:</label>
                  <select
                    id="itemsPerPageSelect"
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
                    <option value={50}>50</option>
                  </select>
                </div>
                <span>
                  {totalItems > 0 ? `${startIndex + 1}-${endIndex}` : '0'} of {totalItems} items
                </span>
              </div>

              <div className="flex items-center space-x-1">
                <button aria-label="ไปที่หน้าแรก" title="First Page" onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="p-0.5 rounded hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7M18 19l-7-7 7-7" /></svg>
                </button>
                <button aria-label="ไปที่หน้าก่อนหน้า" title="Previous Page" onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="p-0.5 rounded hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>

                <div className="flex items-center space-x-1.5 px-1">
                  <input
                    type="text"
                    aria-label="พิมพ์เลขหน้าที่ต้องการไป"
                    title="Page Number"
                    placeholder="1"
                    value={pageInputValue}
                    onChange={(e) => {
                      if (e.target.value === "" || /^[0-9]+$/.test(e.target.value)) setPageInputValue(e.target.value);
                    }}
                    onBlur={(e) => {
                      let val = parseInt(pageInputValue, 10);
                      if (isNaN(val) || val < 1) val = 1;
                      if (val > totalPages) val = totalPages;
                      setCurrentPage(val);
                      setPageInputValue(val.toString());
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
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

                <button aria-label="ไปที่หน้าถัดไป" title="Next Page" onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages || totalPages === 0} className="p-0.5 rounded hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
                <button aria-label="ไปที่หน้าสุดท้าย" title="Last Page" onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages || totalPages === 0} className="p-0.5 rounded hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* ========================================== */}
      {/* Modal: ดูข้อมูลทั้งหมด (View)             */}
      {/* ========================================== */}
      {isModalOpen && modalMode === 'view' && selectedRecord && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
            <div className="px-5 py-3 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
              <h3 className="text-sm font-bold text-slate-800">รายละเอียดข้อมูลกิจกรรมประมวลผลส่วนบุคคล (RoPA Record)</h3>
              <button aria-label="ปิดหน้าต่าง" title="Close" onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-5 text-xs overflow-y-auto bg-white space-y-4">

              <div className="pb-3 border-b border-slate-200">
                <div className="flex items-center gap-3 mb-1">
                  <h4 className="font-bold text-slate-800 text-lg">{selectedRecord.activity_name}</h4>
                  {getStatusBadge(selectedRecord.status)}
                </div>
                <div className="flex items-center gap-1.5 mb-2 mt-0.5">
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${selectedRecord.request_type === 'ลบรายการ' ? 'bg-red-50 text-red-600 border-red-100' : selectedRecord.request_type === 'แก้ไข' ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                    {selectedRecord.request_type || "สร้างรายการใหม่"}
                  </span>
                  <p className="text-slate-600 text-xs truncate">{selectedRecord.purpose}</p>
                </div>
                <p className="text-[10px] text-slate-400 font-medium">รหัส: {selectedRecord.id} &bull; ประเภท: {currentMenu}</p>
              </div>

              {/* View Section 1 */}
              <div>
                <h5 className="font-bold text-slate-700 mb-2 border-l-4 border-blue-500 pl-2">1. ข้อมูลผู้ควบคุมและผู้ลงบันทึก</h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-100">
                  {currentMenu === "Controller" ? (
                    <div className="sm:col-span-2">
                      <p className="text-slate-400 font-medium text-[10px] mb-0.5">ข้อมูลเกี่ยวกับผู้ควบคุมข้อมูลส่วนบุคคล</p>
                      <p className="text-slate-800 font-medium">{selectedRecord.controller_info || "-"}</p>
                    </div>
                  ) : (
                    <>
                      <div>
                        <p className="text-slate-400 font-medium text-[10px] mb-0.5">ชื่อผู้ประมวลผลข้อมูลส่วนบุคคล</p>
                        <p className="text-slate-800 font-medium">{selectedRecord.processor_name || "-"}</p>
                      </div>
                      <div>
                        <p className="text-slate-400 font-medium text-[10px] mb-0.5">ที่อยู่ผู้ควบคุมข้อมูลส่วนบุคคล</p>
                        <p className="text-slate-800 font-medium">{selectedRecord.controller_address || "-"}</p>
                      </div>
                    </>
                  )}
                  <div>
                    <p className="text-slate-400 font-medium text-[10px] mb-0.5">{currentMenu === "Controller" ? "ชื่อผู้ลงบันทึก ROPA / DPO (ของฝั่ง Controller)" : "ชื่อผู้ลงบันทึก ROPA / DPO"}</p>
                    <p className="text-slate-800 font-medium">{selectedRecord.created_by || "-"}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 font-medium text-[10px] mb-0.5">Email</p>
                    <p className="text-slate-800 font-medium">{selectedRecord.recorder_email || "-"}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 font-medium text-[10px] mb-0.5">เบอร์โทร</p>
                    <p className="text-slate-800 font-medium">{selectedRecord.recorder_phone || "-"}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 font-medium text-[10px] mb-0.5">ที่อยู่</p>
                    <p className="text-slate-800 font-medium">{selectedRecord.recorder_address || "-"}</p>
                  </div>
                </div>
              </div>

              {/* View Section 2 */}
              <div>
                <h5 className="font-bold text-slate-700 mb-2 border-l-4 border-blue-500 pl-2">2. รายละเอียดของข้อมูลที่จัดเก็บ</h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <div>
                    <p className="text-slate-400 font-medium text-[10px] mb-0.5">หมวดหมู่เจ้าของข้อมูล</p>
                    <p className="text-slate-800 font-medium">{selectedRecord.data_subject_category || selectedRecord.data_subject || "-"}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 font-medium text-[10px] mb-0.5">ประเภทของข้อมูล</p>
                    <p className="text-slate-800 font-medium">{selectedRecord.data_type || "-"}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-slate-400 font-medium text-[10px] mb-0.5">ข้อมูลส่วนบุคคลที่จัดเก็บ</p>
                    <p className="text-slate-800 font-medium">{selectedRecord.collected_personal_data || selectedRecord.collected_data || "-"}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 font-medium text-[10px] mb-0.5">วิธีการได้มาซึ่งข้อมูล</p>
                    <p className="text-slate-800 font-medium">{selectedRecord.collection_format || "-"}</p>
                  </div>
                </div>
              </div>

              {/* View Section 3 */}
              <div>
                <h5 className="font-bold text-slate-700 mb-2 border-l-4 border-blue-500 pl-2">3. แหล่งที่มา และ ฐานความชอบด้วยกฎหมาย</h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <div>
                    <p className="text-slate-400 font-medium text-[10px] mb-0.5">{currentMenu === "Controller" ? "รับจากเจ้าของข้อมูลโดยตรงหรือไม่?" : "รับจากผู้ควบคุมโดยตรงหรือไม่?"}</p>
                    <p className="text-slate-800 font-medium">{currentMenu === "Controller" ? (selectedRecord.is_direct_from_subject === "true" ? "ใช่ (รับโดยตรง)" : "ไม่ใช่ (รับจากแหล่งอื่น)") : (selectedRecord.is_direct_from_Processor === "true" ? "ใช่ (รับโดยตรง)" : "ไม่ใช่ (รับจากแหล่งอื่น)")}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 font-medium text-[10px] mb-0.5">กรณีแหล่งอื่น (ระบุแหล่งที่มา)</p>
                    <p className="text-slate-800 font-medium">{selectedRecord.indirect_source_detail || "-"}</p>
                  </div>
                  <div className="sm:col-span-2 border-t border-slate-200 pt-2">
                    <p className="text-slate-400 font-medium text-[10px] mb-0.5">ฐานในการประมวลผล (Legal Basis)</p>
                    <p className="text-slate-800 font-medium">{selectedRecord.legal_basis || "-"}</p>
                  </div>
                  {currentMenu === "Controller" && (
                    <>
                      <div>
                        <p className="text-slate-400 font-medium text-[10px] mb-0.5">การขอความยินยอมผู้เยาว์ อายุไม่เกิน 10 ปี</p>
                        <p className="text-slate-800 font-medium">{selectedRecord.minor_under_10 || "-"}</p>
                      </div>
                      <div>
                        <p className="text-slate-400 font-medium text-[10px] mb-0.5">การขอความยินยอมผู้เยาว์ อายุ 10 - 20 ปี</p>
                        <p className="text-slate-800 font-medium">{selectedRecord.minor_10_to_20 || "-"}</p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* View Section 4 */}
              <div>
                <h5 className="font-bold text-slate-700 mb-2 border-l-4 border-blue-500 pl-2">4. การส่งข้อมูลต่างประเทศ และ นโยบายการจัดเก็บ</h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <div>
                    <p className="text-slate-400 font-medium text-[10px] mb-0.5">ส่งหรือโอนไปต่างประเทศ?</p>
                    <p className="text-slate-800 font-medium">{selectedRecord.cb_is_transferred === "true" ? "มี" : "ไม่มี"}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 font-medium text-[10px] mb-0.5">ส่งให้บริษัทในเครือต่างประเทศ?</p>
                    <p className="text-slate-800 font-medium">{selectedRecord.cb_is_intra_group === "true" ? "ใช่" : "ไม่ใช่"}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 font-medium text-[10px] mb-0.5">วิธีการโอนข้อมูล</p>
                    <p className="text-slate-800 font-medium">{selectedRecord.cb_transfer_method || "-"}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 font-medium text-[10px] mb-0.5">มาตรฐานประเทศปลายทาง</p>
                    <p className="text-slate-800 font-medium">{selectedRecord.cb_destination_standard || "-"}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 font-medium text-[10px] mb-0.5">ข้อยกเว้นตามมาตรา 28</p>
                    <p className="text-slate-800 font-medium">{selectedRecord.cb_section_28_exception || "-"}</p>
                  </div>
                  <div className="sm:col-span-2 border-t border-slate-200 pt-2">
                    <p className="text-slate-400 font-medium text-[10px] mb-0.5">ประเภทข้อมูลที่จัดเก็บ</p>
                    <p className="text-slate-800 font-medium">{selectedRecord.rp_storage_format || "-"}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 font-medium text-[10px] mb-0.5">วิธีการเก็บรักษาข้อมูล</p>
                    <p className="text-slate-800 font-medium">{selectedRecord.rp_storage_method || "-"}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 font-medium text-[10px] mb-0.5">ระยะเวลาเก็บรักษา</p>
                    <p className="text-slate-800 font-medium">{selectedRecord.rp_retention_period || "-"}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 font-medium text-[10px] mb-0.5">สิทธิ/วิธีการเข้าถึงข้อมูล</p>
                    <p className="text-slate-800 font-medium">{selectedRecord.rp_access_rights || "-"}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-slate-400 font-medium text-[10px] mb-0.5">วิธีทำลายข้อมูลเมื่อสิ้นสุด</p>
                    <p className="text-slate-800 font-medium">{selectedRecord.rp_destruction_method || "-"}</p>
                  </div>
                  {currentMenu === "Controller" && (
                    <>
                      <div className="sm:col-span-2 border-t border-slate-200 pt-2">
                        <p className="text-slate-400 font-medium text-[10px] mb-0.5">การเปิดเผยข้อมูลส่วนบุคคลที่ได้รับยกเว้นไม่ต้องขอความยินยอม</p>
                        <p className="text-slate-800 font-medium">{selectedRecord.disclosure_without_consent || "-"}</p>
                      </div>
                      <div className="sm:col-span-2">
                        <p className="text-slate-400 font-medium text-[10px] mb-0.5">การปฏิเสธคำขอการใช้สิทธิของเจ้าของข้อมูลส่วนบุคคล (DSAR Rejection)</p>
                        <p className="text-slate-800 font-medium">{selectedRecord.dsar_rejection_record || "-"}</p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* View Section 5 */}
              <div>
                <h5 className="font-bold text-slate-700 mb-2 border-l-4 border-blue-500 pl-2">5. มาตรการความมั่นคงปลอดภัย</h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <div>
                    <p className="text-slate-400 font-medium text-[10px] mb-0.5">มาตรการเชิงองค์กร</p>
                    <p className="text-slate-800 font-medium">{selectedRecord.sec_organizational || "-"}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 font-medium text-[10px] mb-0.5">มาตรการเชิงเทคนิค</p>
                    <p className="text-slate-800 font-medium">{selectedRecord.sec_technical || "-"}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 font-medium text-[10px] mb-0.5">มาตรการทางกายภาพ</p>
                    <p className="text-slate-800 font-medium">{selectedRecord.sec_physical || "-"}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 font-medium text-[10px] mb-0.5">การควบคุมการเข้าถึงข้อมูล</p>
                    <p className="text-slate-800 font-medium">{selectedRecord.sec_access_control || "-"}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 font-medium text-[10px] mb-0.5">การกำหนดหน้าที่ผู้ใช้งาน</p>
                    <p className="text-slate-800 font-medium">{selectedRecord.sec_user_responsibility || "-"}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 font-medium text-[10px] mb-0.5">มาตรการตรวจสอบย้อนหลัง (Audit Trail)</p>
                    <p className="text-slate-800 font-medium">{selectedRecord.sec_audit_trail || "-"}</p>
                  </div>
                </div>
              </div>

              {/* Audit Log Box */}
              <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <p className="text-blue-500 font-medium mb-0.5 text-[9px] uppercase tracking-wider">สร้างโดย (Created By)</p>
                  <p className="text-blue-900 font-bold">{selectedRecord.created_by || "-"}</p>
                  <p className="text-blue-600 text-[10px] mt-0.5">{selectedRecord.created_at || "-"}</p>
                </div>
                <div>
                  <p className="text-blue-500 font-medium mb-0.5 text-[9px] uppercase tracking-wider">แก้ไขล่าสุด (Updated By)</p>
                  <p className="text-blue-900 font-bold">{selectedRecord.updated_by || "-"}</p>
                  <p className="text-blue-600 text-[10px] mt-0.5">{selectedRecord.updated_at || "-"}</p>
                </div>
                <div>
                  <p className="text-blue-500 font-medium mb-0.5 text-[9px] uppercase tracking-wider">ผู้อนุมัติ (Approved By)</p>
                  <p className="text-blue-900 font-bold">{selectedRecord.approved_by || "ยังไม่ได้รับการอนุมัติ"}</p>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* Modal: เพิ่ม / แก้ไข                      */}
      {/* ========================================== */}
      {isModalOpen && (modalMode === 'add' || modalMode === 'edit') && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
            <div className="px-5 py-3 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
              <h3 className="text-sm font-bold text-slate-800">
                {modalMode === 'add' ? `สร้าง RoPA ${currentMenu} Activity ใหม่` : `แก้ไข RoPA ${currentMenu} Activity`}
              </h3>
              <button aria-label="ปิดหน้าต่าง" title="Close Modal" onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1 bg-white space-y-4">
              {modalMode === 'edit' && formData.status === 'Rejected' && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                  <svg className="w-4 h-4 text-red-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <h4 className="text-xs font-bold text-red-800">Rejected (ถูกตีกลับ)</h4>
                    <p className="text-[11px] text-red-600 mt-0.5"><span className="font-semibold">หมายเหตุจาก DPO:</span> {formData.rejection_reason}</p>
                    <p className="text-[9px] text-red-500 mt-0.5 italic">*หากแก้ไขและกด 'ส่งขออนุมัติ' ข้อมูลจะถูกเปลี่ยนสถานะเป็น Pending และส่งไปให้ DPO ใหม่อีกครั้ง</p>
                  </div>
                </div>
              )}

              {modalMode === 'edit' && selectedRecord?.status === 'Approved' && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
                  <svg className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <h4 className="text-xs font-bold text-blue-800">ขอแก้ไขรายการ (Request Edit)</h4>
                    <p className="text-[11px] text-blue-600 mt-0.5">คุณกำลังแก้ไขรายการที่อนุมัติแล้ว เมื่อบันทึก ระบบจะสร้างคำขอประเภท <b>"แก้ไข"</b> และส่งให้ DPO ตรวจสอบใหม่</p>
                  </div>
                </div>
              )}

              <form id="ropa-form" onSubmit={handleSaveSubmit} className="space-y-4">
                <div className="grid grid-cols-1 gap-3 text-xs">

                  {/* Form Section 1 */}
                  <fieldset className="border border-slate-200 rounded-lg p-4 bg-slate-50/50">
                    <legend className="text-xs font-bold text-slate-700 px-2 bg-slate-50 border border-slate-200 rounded">1. ข้อมูลผู้ควบคุมและผู้ลงบันทึก</legend>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-1">
                      {currentMenu === "Controller" ? (
                        <div className="md:col-span-2">
                          <label htmlFor="controller_info" className="block font-bold text-slate-700 mb-1">1. ข้อมูลเกี่ยวกับผู้ควบคุมข้อมูลส่วนบุคคล</label>
                          <input id="controller_info" aria-label="ข้อมูลเกี่ยวกับผู้ควบคุมข้อมูลส่วนบุคคล" title="ข้อมูลผู้ควบคุม" type="text" value={formData.controller_info} onChange={(e) => setFormData({ ...formData, controller_info: e.target.value })} className="w-full px-2 py-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 outline-none text-black" placeholder="ชื่อบริษัท หรือหน่วยงาน..." />
                        </div>
                      ) : (
                        <>
                          <div>
                            <label htmlFor="processor_name" className="block font-bold text-slate-700 mb-1">1. ชื่อผู้ประมวลผลข้อมูลส่วนบุคคล</label>
                            <input id="processor_name" aria-label="ชื่อผู้ประมวลผลข้อมูลส่วนบุคคล" title="ชื่อผู้ประมวลผล" type="text" required value={formData.processor_name} onChange={(e) => setFormData({ ...formData, processor_name: e.target.value })} className="w-full px-2 py-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 outline-none text-black" placeholder="ชื่อบริษัท หรือหน่วยงาน..." />
                          </div>
                          <div>
                            <label htmlFor="controller_address" className="block font-bold text-slate-700 mb-1">2. ที่อยู่ผู้ควบคุมข้อมูลส่วนบุคคล</label>
                            <input id="controller_address" aria-label="ที่อยู่ผู้ควบคุมข้อมูลส่วนบุคคล" title="ที่อยู่ผู้ควบคุม" type="text" required value={formData.controller_address} onChange={(e) => setFormData({ ...formData, controller_address: e.target.value })} className="w-full px-2 py-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 outline-none text-black" placeholder="รายละเอียดที่อยู่..." />
                          </div>
                        </>
                      )}
                      <div>
                        <label htmlFor="recorder_name" className="block font-medium text-slate-500 mb-1">{currentMenu === "Controller" ? "ชื่อผู้ลงบันทึก ROPA / DPO (ของฝั่ง Processor)" : "ชื่อผู้ลงบันทึก ROPA / DPO"}</label>
                        <input id="recorder_name" aria-label="ชื่อผู้ลงบันทึก" title="ชื่อผู้ลงบันทึก" type="text" value={currentUser.name} disabled className="w-full px-2 py-1.5 border border-slate-200 rounded bg-slate-100 text-slate-500 cursor-not-allowed" placeholder="ชื่อผู้ลงบันทึก" />
                      </div>
                      <div>
                        <label htmlFor="recorder_email" className="block font-medium text-slate-500 mb-1">Email</label>
                        <input id="recorder_email" aria-label="อีเมลผู้ลงบันทึก" title="อีเมล" type="email" value={currentUser.email} disabled className="w-full px-2 py-1.5 border border-slate-200 rounded bg-slate-100 text-slate-500 cursor-not-allowed" placeholder="อีเมล" />
                      </div>
                      <div>
                        <label htmlFor="recorder_phone" className="block font-medium text-slate-500 mb-1">เบอร์โทร</label>
                        <input id="recorder_phone" aria-label="เบอร์โทรผู้ลงบันทึก" title="เบอร์โทร" type="text" value={currentUser.phone} disabled className="w-full px-2 py-1.5 border border-slate-200 rounded bg-slate-100 text-slate-500 cursor-not-allowed" placeholder="เบอร์โทร" />
                      </div>
                      <div>
                        <label htmlFor="recorder_address" className="block font-medium text-slate-500 mb-1">ที่อยู่</label>
                        <input id="recorder_address" aria-label="ที่อยู่ผู้ลงบันทึก" title="ที่อยู่" type="text" value={currentUser.address} disabled className="w-full px-2 py-1.5 border border-slate-200 rounded bg-slate-100 text-slate-500 cursor-not-allowed" placeholder="ที่อยู่" />
                      </div>
                    </div>
                  </fieldset>

                  {/* Form Section 2 */}
                  <fieldset className="border border-slate-300 rounded-lg p-4">
                    <legend className="text-xs font-bold text-blue-700 px-2 bg-white">รายละเอียดกิจกรรมประมวลผล (Activity Details)</legend>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-1">
                      <div className="md:col-span-2">
                        <label htmlFor="activity_name" className="block font-bold text-slate-700 mb-1">{currentMenu === "Controller" ? "2" : "3"}. กิจกรรมประมวลผล (Activity Name)</label>
                        <input id="activity_name" aria-label="กิจกรรมประมวลผล" title="กิจกรรมประมวลผล" type="text" required value={formData.activity_name} onChange={(e) => setFormData({ ...formData, activity_name: e.target.value })} className="w-full px-2 py-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 outline-none text-black" placeholder="ชื่อกิจกรรม..." />
                      </div>
                      <div className="md:col-span-2">
                        <label htmlFor="purpose" className="block font-bold text-slate-700 mb-1">{currentMenu === "Controller" ? "3" : "4"}. วัตถุประสงค์ของการประมวลผล (Purpose)</label>
                        <textarea id="purpose" aria-label="วัตถุประสงค์" title="วัตถุประสงค์" rows={2} required value={formData.purpose} onChange={(e) => setFormData({ ...formData, purpose: e.target.value })} className="w-full px-2 py-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 outline-none text-black" placeholder="วัตถุประสงค์..." />
                      </div>
                      <div>
                        <label htmlFor="collected_personal_data" className="block font-bold text-slate-700 mb-1">{currentMenu === "Controller" ? "4" : "5"}. ข้อมูลส่วนบุคคลที่จัดเก็บ</label>
                        <input id="collected_personal_data" aria-label="ข้อมูลส่วนบุคคลที่จัดเก็บ" title="ข้อมูลที่จัดเก็บ" type="text" value={formData.collected_personal_data} onChange={(e) => setFormData({ ...formData, collected_personal_data: e.target.value })} className="w-full px-2 py-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 outline-none text-black" placeholder="เช่น ชื่อ, นามสกุล, เบอร์โทร..." />
                      </div>
                      <div>
                        <label htmlFor="data_subject_category" className="block font-bold text-slate-700 mb-1">{currentMenu === "Controller" ? "5" : "6"}. หมวดหมู่ของข้อมูล (Data Subject)</label>
                        <input id="data_subject_category" aria-label="หมวดหมู่ของข้อมูล" title="หมวดหมู่ข้อมูล" type="text" value={formData.data_subject_category} onChange={(e) => setFormData({ ...formData, data_subject_category: e.target.value })} className="w-full px-2 py-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 outline-none text-black" placeholder="เช่น ลูกค้า, พนักงาน..." />
                      </div>
                      <div>
                        <label htmlFor="data_type" className="block font-bold text-slate-700 mb-1">{currentMenu === "Controller" ? "6" : "7"}. ประเภทของข้อมูล</label>
                        <select id="data_type" aria-label="ประเภทของข้อมูล" title="ประเภทข้อมูล" value={formData.data_type} onChange={(e) => setFormData({ ...formData, data_type: e.target.value })} className="w-full px-2 py-1.5 border border-slate-300 rounded bg-white outline-none cursor-pointer text-black">
                          <option value="">-- เลือกประเภท --</option>
                          <option value="ข้อมูลทั่วไป">ข้อมูลทั่วไป</option>
                          <option value="ข้อมูลอ่อนไหว">ข้อมูลอ่อนไหว (Sensitive Data)</option>
                        </select>
                      </div>
                      <div>
                        <label htmlFor="collection_format" className="block font-bold text-slate-700 mb-1">{currentMenu === "Controller" ? "7" : "8"}. วิธีการได้มาซึ่งข้อมูล</label>
                        <select id="collection_format" aria-label="วิธีการได้มาซึ่งข้อมูล" title="วิธีการได้มา" value={formData.collection_format} onChange={(e) => setFormData({ ...formData, collection_format: e.target.value })} className="w-full px-2 py-1.5 border border-slate-300 rounded bg-white outline-none cursor-pointer text-black">
                          <option value="">-- เลือกวิธีการ --</option>
                          <option value="Soft File">Soft File</option>
                          <option value="Hard Copy">Hard Copy</option>
                        </select>
                      </div>
                    </div>
                  </fieldset>

                  {/* Form Section 3 */}
                  <fieldset className="border border-slate-300 rounded-lg p-4">
                    <legend className="text-xs font-bold text-blue-700 px-2 bg-white">แหล่งที่มา และ ฐานความชอบด้วยกฎหมาย</legend>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-1">
                      <div>
                        <label htmlFor="is_direct_from_subject" className="block font-bold text-slate-700 mb-1">{currentMenu === "Controller" ? "8.1 รับจากเจ้าของข้อมูลโดยตรงหรือไม่?" : "9.1 รับจากผู้ควบคุมโดยตรงหรือไม่?"}</label>
                        <select id="is_direct_from_subject" aria-label="รับจากเจ้าของข้อมูลโดยตรงหรือไม่" title="รับโดยตรงหรือไม่" value={currentMenu === "Controller" ? formData.is_direct_from_subject : formData.is_direct_from_controller} onChange={(e) => setFormData({ ...formData, [currentMenu === "Controller" ? "is_direct_from_subject" : "is_direct_from_controller"]: e.target.value })} className="w-full px-2 py-1.5 border border-slate-300 rounded bg-white outline-none cursor-pointer text-black">
                          <option value="true">ใช่ (รับโดยตรง)</option>
                          <option value="false">ไม่ใช่ (รับจากแหล่งอื่น)</option>
                        </select>
                      </div>
                      <div>
                        <label htmlFor="indirect_source_detail" className="block font-bold text-slate-700 mb-1">{currentMenu === "Controller" ? "8.2" : "9.2"} กรณีแหล่งอื่น (ระบุแหล่งที่มา)</label>
                        <input id="indirect_source_detail" aria-label="กรณีแหล่งอื่น" title="แหล่งที่มา" type="text" disabled={(currentMenu === "Controller" && formData.is_direct_from_subject === "true") || (currentMenu === "Controller" && formData.is_direct_from_controller === "true")} value={formData.indirect_source_detail} onChange={(e) => setFormData({ ...formData, indirect_source_detail: e.target.value })} className="w-full px-2 py-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 outline-none disabled:bg-slate-100" placeholder="ระบุแหล่งที่มา..." />
                      </div>
                      <div className="md:col-span-2 border-t border-slate-100 pt-2">
                        <label htmlFor="legal_basis_form" className="block font-bold text-slate-700 mb-1">{currentMenu === "Controller" ? "9" : "10"}. ฐานในการประมวลผล (Legal Basis)</label>
                        <select id="legal_basis_form" aria-label="ฐานในการประมวลผล" title="ฐานประมวลผล" required value={formData.legal_basis} onChange={(e) => setFormData({ ...formData, legal_basis: e.target.value })} className="w-full px-2 py-1.5 border border-slate-300 rounded bg-white outline-none cursor-pointer text-black">
                          <option value="">-- เลือกฐานความชอบด้วยกฎหมาย --</option>
                          <option value="Consent">Consent (ฐานความยินยอม)</option>
                          <option value="Contract">Contract (ฐานสัญญา)</option>
                          <option value="Legal Obligation">Legal Obligation (ฐานหน้าที่ตามกฎหมาย)</option>
                          <option value="Vital Interest">Vital Interest (ฐานป้องกันอันตรายต่อชีวิต)</option>
                          <option value="Public Task">Public Task (ฐานภารกิจของรัฐ)</option>
                          <option value="Legitimate Interest">Legitimate Interest (ฐานประโยชน์อันชอบธรรม)</option>
                        </select>
                      </div>
                      {currentMenu === "Controller" && (
                        <div className="md:col-span-2 border-t border-slate-100 pt-2">
                          <label className="block font-bold text-slate-700 mb-2">10. การขอความยินยอมผู้เยาว์ (Minor Consent)</label>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label htmlFor="minor_under_10" className="block text-slate-600 mb-1">10.1 อายุไม่เกิน 10 ปี</label>
                              <input id="minor_under_10" aria-label="ยินยอมผู้เยาว์อายุไม่เกิน 10 ปี" title="อายุไม่เกิน 10 ปี" type="text" value={formData.minor_under_10} onChange={(e) => setFormData({ ...formData, minor_under_10: e.target.value })} className="w-full px-2 py-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 outline-none text-black" placeholder="ระบุรายละเอียด (ถ้ามี)..." />
                            </div>
                            <div>
                              <label htmlFor="minor_10_to_20" className="block text-slate-600 mb-1">10.2 อายุ 10 - 20 ปี</label>
                              <input id="minor_10_to_20" aria-label="ยินยอมผู้เยาว์อายุ 10 ถึง 20 ปี" title="อายุ 10 ถึง 20 ปี" type="text" value={formData.minor_10_to_20} onChange={(e) => setFormData({ ...formData, minor_10_to_20: e.target.value })} className="w-full px-2 py-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 outline-none text-black" placeholder="ระบุรายละเอียด (ถ้ามี)..." />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </fieldset>

                  {/* Form Section 4 */}
                  <fieldset className="border border-slate-300 rounded-lg p-4">
                    <legend className="text-xs font-bold text-blue-700 px-2 bg-white">การส่งข้อมูลต่างประเทศ และ นโยบายการจัดเก็บ</legend>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-1">
                      <div>
                        <label htmlFor="cb_is_transferred" className="block font-bold text-slate-700 mb-1">11.1 ส่งหรือโอนไปต่างประเทศ?</label>
                        <select id="cb_is_transferred" aria-label="ส่งหรือโอนไปต่างประเทศหรือไม่" title="ส่งต่างประเทศ" value={formData.cb_is_transferred} onChange={(e) => setFormData({ ...formData, cb_is_transferred: e.target.value })} className="w-full px-2 py-1.5 border border-slate-300 rounded bg-white outline-none cursor-pointer text-black">
                          <option value="false">ไม่มี</option><option value="true">มี</option>
                        </select>
                      </div>
                      <div>
                        <label htmlFor="cb_is_intra_group" className="block font-bold text-slate-700 mb-1">11.2 ส่งให้บริษัทในเครือต่างประเทศ?</label>
                        <select id="cb_is_intra_group" aria-label="ส่งให้บริษัทในเครือต่างประเทศหรือไม่" title="ส่งบริษัทในเครือ" value={formData.cb_is_intra_group} onChange={(e) => setFormData({ ...formData, cb_is_intra_group: e.target.value })} className="w-full px-2 py-1.5 border border-slate-300 rounded bg-white outline-none cursor-pointer text-black">
                          <option value="false">ไม่ใช่</option><option value="true">ใช่</option>
                        </select>
                      </div>
                      <div>
                        <label htmlFor="cb_transfer_method" className="block font-bold text-slate-700 mb-1">11.3 วิธีการโอนข้อมูล</label>
                        <input id="cb_transfer_method" aria-label="วิธีการโอนข้อมูล" title="วิธีโอนข้อมูล" type="text" value={formData.cb_transfer_method} onChange={(e) => setFormData({ ...formData, cb_transfer_method: e.target.value })} className="w-full px-2 py-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 outline-none text-black" placeholder="วิธีการโอน..." />
                      </div>
                      <div>
                        <label htmlFor="cb_destination_standard" className="block font-bold text-slate-700 mb-1">11.4 มาตรฐานประเทศปลายทาง</label>
                        <input id="cb_destination_standard" aria-label="มาตรฐานประเทศปลายทาง" title="มาตรฐานปลายทาง" type="text" value={formData.cb_destination_standard} onChange={(e) => setFormData({ ...formData, cb_destination_standard: e.target.value })} className="w-full px-2 py-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 outline-none text-black" placeholder="มาตรฐาน..." />
                      </div>
                      <div className="sm:col-span-2">
                        <label htmlFor="cb_section_28_exception" className="block font-bold text-slate-700 mb-1">11.5 ข้อยกเว้นตามมาตรา 28</label>
                        <input id="cb_section_28_exception" aria-label="ข้อยกเว้นตามมาตรา 28" title="ข้อยกเว้นมาตรา 28" type="text" value={formData.cb_section_28_exception} onChange={(e) => setFormData({ ...formData, cb_section_28_exception: e.target.value })} className="w-full px-2 py-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 outline-none text-black" placeholder="เช่น ปฏิบัติตามกฎหมาย ความยินยอม ปฏิบัติตามสัญญาป้องกันอันตรายต่อชีวิต ประโยชน์สาธารณะที่สำคัญ" />
                      </div>

                      <div className="md:col-span-2 border-t border-slate-100 pt-2">
                        <label className="block font-bold text-slate-700 mb-1">12. นโยบายการเก็บรักษา (Retention Policy)</label>
                      </div>
                      <div>
                        <label htmlFor="rp_storage_format" className="block font-bold text-slate-700 mb-1">12.1 ประเภทข้อมูลที่จัดเก็บ</label>
                        <input id="rp_storage_format" aria-label="ประเภทข้อมูลที่จัดเก็บ" title="ประเภทข้อมูล" type="text" value={formData.rp_storage_format} onChange={(e) => setFormData({ ...formData, rp_storage_format: e.target.value })} className="w-full px-2 py-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 outline-none text-black" placeholder="soft file/hard copy เช่น ข้อมูลอิเล็กทรอนิกส์" />
                      </div>
                      <div>
                        <label htmlFor="rp_storage_method" className="block font-bold text-slate-700 mb-1">12.2 วิธีการเก็บรักษาข้อมูล</label>
                        <input id="rp_storage_method" aria-label="วิธีการเก็บรักษาข้อมูล" title="วิธีเก็บรักษา" type="text" value={formData.rp_storage_method} onChange={(e) => setFormData({ ...formData, rp_storage_method: e.target.value })} className="w-full px-2 py-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 outline-none text-black" placeholder="วิธีการเก็บ..." />
                      </div>
                      <div>
                        <label htmlFor="rp_retention_period" className="block font-bold text-slate-700 mb-1">12.3 ระยะเวลาเก็บรักษา</label>
                        <input id="rp_retention_period" aria-label="ระยะเวลาเก็บรักษา" title="ระยะเวลา" type="text" value={formData.rp_retention_period} onChange={(e) => setFormData({ ...formData, rp_retention_period: e.target.value })} className="w-full px-2 py-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 outline-none text-black" placeholder="เช่น 5 ปี หรือ ตลอดอายุสัญญา" />
                      </div>
                      <div>
                        <label htmlFor="rp_access_rights" className="block font-bold text-slate-700 mb-1">12.4 สิทธิ/วิธีการเข้าถึงข้อมูล</label>
                        <input id="rp_access_rights" aria-label="สิทธิและวิธีการเข้าถึง" title="สิทธิเข้าถึง" type="text" value={formData.rp_access_rights} onChange={(e) => setFormData({ ...formData, rp_access_rights: e.target.value })} className="w-full px-2 py-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 outline-none text-black" placeholder="ระบุสิทธิ..." />
                      </div>
                      <div className="sm:col-span-2">
                        <label htmlFor="rp_destruction_method" className="block font-bold text-slate-700 mb-1">12.5 วิธีทำลายข้อมูลเมื่อสิ้นสุด</label>
                        <input id="rp_destruction_method" aria-label="วิธีทำลายข้อมูล" title="วิธีทำลาย" type="text" value={formData.rp_destruction_method} onChange={(e) => setFormData({ ...formData, rp_destruction_method: e.target.value })} className="w-full px-2 py-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 outline-none text-black" placeholder="วิธีทำลาย..." />
                      </div>
                      
                      {currentMenu === "Controller" && (
                        <>
                          <div className="sm:col-span-2 border-t border-slate-200 pt-2">
                            <label htmlFor="disclosure_without_consent" className="block font-bold text-slate-700 mb-1">13. การเปิดเผยข้อมูลส่วนบุคคลที่ได้รับยกเว้นไม่ต้องขอความยินยอม</label>
                            <textarea id="disclosure_without_consent" aria-label="การเปิดเผยข้อมูลโดยไม่ต้องขอความยินยอม" title="เปิดเผยข้อยกเว้น" rows={2} value={formData.disclosure_without_consent} onChange={(e) => setFormData({ ...formData, disclosure_without_consent: e.target.value })} className="w-full px-2 py-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 outline-none resize-none" placeholder="ระบุรายละเอียด (ถ้ามี)..." />
                          </div>
                          <div className="sm:col-span-2">
                            <label htmlFor="dsar_rejection_record" className="block font-bold text-slate-700 mb-1">14. การปฏิเสธคำขอการใช้สิทธิของเจ้าของข้อมูลส่วนบุคคล (DSAR Rejection)</label>
                            <textarea id="dsar_rejection_record" aria-label="การปฏิเสธคำขอ" title="การปฏิเสธคำขอ" rows={2} value={formData.dsar_rejection_record} onChange={(e) => setFormData({ ...formData, dsar_rejection_record: e.target.value })} className="w-full px-2 py-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 outline-none resize-none" placeholder="ระบุรายละเอียด (ถ้ามี)..." />
                          </div>
                        </>
                      )}
                    </div>
                  </fieldset>

                  {/* Form Section 5 */}
                  <fieldset className="border border-slate-300 rounded-lg p-4">
                    <legend className="text-xs font-bold text-blue-700 px-2 bg-white">มาตรการความมั่นคงปลอดภัย (Security Measures)</legend>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-1">
                      <div>
                        <label htmlFor="sec_organizational" className="block font-bold text-slate-700 mb-1">{currentMenu === "Controller" ? "15.1" : "13.1"} มาตรการเชิงองค์กร</label>
                        <input id="sec_organizational" aria-label="มาตรการเชิงองค์กร" title="มาตรการเชิงองค์กร" type="text" value={formData.sec_organizational} onChange={(e) => setFormData({ ...formData, sec_organizational: e.target.value })} className="w-full px-2 py-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 outline-none text-black" placeholder="ระบุรายละเอียด..." />
                      </div>
                      <div>
                        <label htmlFor="sec_technical" className="block font-bold text-slate-700 mb-1">{currentMenu === "Controller" ? "15.2" : "13.2"} มาตรการเชิงเทคนิค</label>
                        <input id="sec_technical" aria-label="มาตรการเชิงเทคนิค" title="มาตรการเชิงเทคนิค" type="text" value={formData.sec_technical} onChange={(e) => setFormData({ ...formData, sec_technical: e.target.value })} className="w-full px-2 py-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 outline-none text-black" placeholder="ระบุรายละเอียด..." />
                      </div>
                      <div>
                        <label htmlFor="sec_physical" className="block font-bold text-slate-700 mb-1">{currentMenu === "Controller" ? "15.3" : "13.3"} มาตรการทางกายภาพ</label>
                        <input id="sec_physical" aria-label="มาตรการทางกายภาพ" title="มาตรการทางกายภาพ" type="text" value={formData.sec_physical} onChange={(e) => setFormData({ ...formData, sec_physical: e.target.value })} className="w-full px-2 py-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 outline-none text-black" placeholder="ระบุรายละเอียด..." />
                      </div>
                      <div>
                        <label htmlFor="sec_access_control" className="block font-bold text-slate-700 mb-1">{currentMenu === "Controller" ? "15.4" : "13.4"} การควบคุมการเข้าถึงข้อมูล</label>
                        <input id="sec_access_control" aria-label="การควบคุมการเข้าถึงข้อมูล" title="การควบคุมการเข้าถึง" type="text" value={formData.sec_access_control} onChange={(e) => setFormData({ ...formData, sec_access_control: e.target.value })} className="w-full px-2 py-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 outline-none text-black" placeholder="ระบุรายละเอียด..." />
                      </div>
                      <div>
                        <label htmlFor="sec_user_responsibility" className="block font-bold text-slate-700 mb-1">{currentMenu === "Controller" ? "15.5" : "13.5"} การกำหนดหน้าที่ผู้ใช้งาน</label>
                        <input id="sec_user_responsibility" aria-label="การกำหนดหน้าที่ผู้ใช้งาน" title="การกำหนดหน้าที่" type="text" value={formData.sec_user_responsibility} onChange={(e) => setFormData({ ...formData, sec_user_responsibility: e.target.value })} className="w-full px-2 py-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 outline-none text-black" placeholder="ระบุรายละเอียด..." />
                      </div>
                      <div>
                        <label htmlFor="sec_audit_trail" className="block font-bold text-slate-700 mb-1">{currentMenu === "Controller" ? "15.6" : "13.6"} มาตรการตรวจสอบย้อนหลัง</label>
                        <input id="sec_audit_trail" aria-label="มาตรการตรวจสอบย้อนหลัง" title="มาตรการตรวจสอบย้อนหลัง" type="text" value={formData.sec_audit_trail} onChange={(e) => setFormData({ ...formData, sec_audit_trail: e.target.value })} className="w-full px-2 py-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 outline-none text-black" placeholder="ระบุรายละเอียด..." />
                      </div>
                    </div>
                  </fieldset>
                </div>
                <div className="mt-3 flex justify-end space-x-2 border-t border-slate-100 pt-3">
                  <button aria-label="ยกเลิก" title="Cancel" type="button" onClick={() => setIsModalOpen(false)} className="px-3 py-1.5 font-medium text-slate-600 bg-white border border-slate-300 rounded hover:bg-slate-50 transition-colors">
                    ยกเลิก
                  </button>
                  <button aria-label="ส่งขออนุมัติ" title="Save Record" type="submit" className="px-3 py-1.5 font-medium text-white bg-blue-600 rounded hover:bg-blue-700 shadow-sm transition-colors">
                    {modalMode === 'edit' && selectedRecord?.status === 'Approved' ? "ส่งคำขอแก้ไข" : "ส่งขออนุมัติ"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* Modal: ยืนยันการส่งคำขอลบ               */}
      {/* ========================================== */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-70 p-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="text-center mb-5">
              <h3 className="text-sm font-bold text-slate-800 mb-2">
                {recordToDelete?.status === 'Approved' ? 'ส่งคำขอลบรายการ' : recordToDelete?.status === 'Pending' ? 'ยกเลิกคำขอ' : 'ยืนยันการลบ'}
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                {recordToDelete?.status === 'Approved'
                  ? <>คุณต้องการส่งคำขอลบ <br /><span className="font-bold">"{recordToDelete?.activity_name}"</span><br />ใช่หรือไม่? <br /><br /><span className="text-[10px] text-red-500">ระบบจะส่งคำขอลบไปยัง DPO เพื่อรอการอนุมัติ</span></>
                  : recordToDelete?.status === 'Pending'
                    ? <>คุณต้องการยกเลิกคำขอ <br /><span className="font-bold">"{recordToDelete?.activity_name}"</span><br />ใช่หรือไม่?</>
                    : <>คุณต้องการลบกิจกรรม <br /><span className="font-bold">"{recordToDelete?.activity_name}"</span><br />ใช่หรือไม่?</>}
              </p>
            </div>
            <div className="flex space-x-2">
              <button aria-label="ยกเลิก" onClick={() => setIsDeleteModalOpen(false)} className="flex-1 px-3 py-2 bg-slate-100 text-slate-700 font-bold text-xs rounded-md hover:bg-slate-200 transition-colors">
                ยกเลิก
              </button>
              <button aria-label="ยืนยัน" onClick={executeDelete} className="flex-1 px-3 py-2 bg-[#e60000] text-white font-bold text-xs rounded-md hover:bg-red-700 transition-colors shadow-sm">
                ยืนยัน
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* Modal: นำเข้าข้อมูลจาก Excel              */}
      {/* ========================================== */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="w-4" />
              <h3 className="text-sm font-bold text-slate-800">นำเข้าข้อมูลจาก Excel</h3>
              <button
                aria-label="ปิดหน้าต่าง"
                title="Close"
                onClick={() => setIsImportModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-5 space-y-4">

              {/* File Drop Zone */}
              <label
                htmlFor="excel-upload"
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragOver(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
                    setImportFile(file);
                    setImportStatus("idle");
                    setImportMessage("");
                  } else if (file) {
                    setImportStatus("error");
                    setImportMessage("รองรับเฉพาะไฟล์ .xlsx และ .xls เท่านั้น");
                  }
                }}
                className={`flex flex-col items-center justify-center w-full h-36 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-200 ${
                  isDragOver
                    ? "border-blue-400 bg-blue-50 scale-[1.01]"
                    : importFile
                    ? "border-emerald-400 bg-emerald-50"
                    : "border-slate-300 bg-slate-50 hover:border-emerald-400 hover:bg-emerald-50/50"
                }`}
              >
                {importFile ? (
                  <div className="text-center px-4">
                    <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                      <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <p className="text-xs font-bold text-emerald-700 truncate max-w-[260px]">{importFile.name}</p>
                    <p className="text-[10px] text-slate-400 mt-1">{(importFile.size / 1024).toFixed(1)} KB &bull; คลิกเพื่อเปลี่ยนไฟล์</p>
                  </div>
                ) : (
                  <div className="text-center px-4">
                    <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                      <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                    </div>
                    <p className="text-xs font-semibold text-slate-600">
                      {isDragOver ? "วางไฟล์ที่นี่..." : "คลิกหรือลากไฟล์มาวางที่นี่"}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1">รองรับ .xlsx และ .xls เท่านั้น</p>
                  </div>
                )}
                <input
                  id="excel-upload"
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setImportFile(file);
                      setImportStatus("idle");
                      setImportMessage("");
                    }
                    // Reset input value so same file can be selected again
                    e.target.value = "";
                  }}
                />
              </label>

              {/* Status Message */}
              {importMessage && (
                <div className={`text-xs rounded-lg px-3 py-2.5 flex items-center gap-2 border ${
                  importStatus === "success"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-red-50 text-red-700 border-red-200"
                }`}>
                  {importStatus === "success" ? (
                    <svg className="w-4 h-4 shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                  <span className="font-medium">{importMessage}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2 pt-1">
                <button
                  aria-label="ยกเลิก"
                  onClick={() => setIsImportModalOpen(false)}
                  className="flex-1 px-3 py-2 text-xs font-medium text-slate-600 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
                >
                  {importStatus === "success" ? "ปิด" : "ยกเลิก"}
                </button>
                <button
                  aria-label="นำเข้าข้อมูล"
                  onClick={handleImportExcel}
                  disabled={!importFile || importStatus === "loading" || importStatus === "success"}
                  className="flex-1 px-3 py-2 text-xs font-bold text-white bg-emerald-600 rounded-md hover:bg-emerald-700 active:bg-emerald-800 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                >
                  {importStatus === "loading" ? (
                    <>
                      <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                      กำลังนำเข้า...
                    </>
                  ) : importStatus === "success" ? (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      สำเร็จแล้ว
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      นำเข้าข้อมูล
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}