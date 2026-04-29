"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { jwtDecode } from "jwt-decode";
import { TokenPayload } from "@/login/page";

const API_BASE_URL = `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/v1/users`;

export default function UserManagementPage() {
  const router = useRouter();
  const [users, setUsers] = useState<Array<{id: string; name: string; email: string; phone: string; address: string; role: string; department: string}>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isRopaMenuOpen, setIsRopaMenuOpen] = useState(false);
  const [navPerms, setNavPerms] = useState({ canSeeDashboard: false, canSeeDPO: false, canSeeRopa: false, canSeeUsers: true });
  
  const [filters, setFilters] = useState({
    id: "", name: "", role: "", department: "", phone: "", address: ""
  });

  const [sortConfig, setSortConfig] = useState({ key: "id", direction: "asc" });

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [pageInputValue, setPageInputValue] = useState("1");
  

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
    } else {
      const decoded = jwtDecode<TokenPayload>(token);

  
      if (!["admin", "developer","auditor"].includes((decoded.role || "").toLowerCase())) {
        router.push("/login");
        return;
      }

      setCurrentUser({
        name: decoded.sub || "Unknown User",
        role: decoded.role || "No Role"
      });

      const r = (decoded.role || "").toLowerCase();
      setNavPerms({
        canSeeDashboard: ["executive","auditor","developer"].includes(r),
        canSeeDPO:       ["dpo","auditor","developer"].includes(r),
        canSeeRopa:      ["data_owner","auditor","developer"].includes(r),
        canSeeUsers:     ["admin","developer","auditor"].includes(r),
      });
      

      fetchUsers(); 
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Array ว่างหมายถึงให้ทำงานแค่ครั้งเดียวตอนโหลดหน้า

  // 2. จัดการ Input ของ Pagination แยกต่างหาก
  useEffect(() => {
    setPageInputValue(currentPage.toString());
  }, [currentPage]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [viewingUser, setViewingUser] = useState<any>(null);
  
  // State สำหรับ Modal ลบข้อมูล
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<any>(null);

  const [formData, setFormData] = useState({
    name: "", email: "", password: "", phone: "", address: "", role: "Data Owner", department: "HR"
  });

  const getRoleBadge = (role: string) => {
    return <span className="text-slate-700 font-medium text-xs">{role}</span>;
  };

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem("token"); // ดึง Token
      const res = await fetch(API_BASE_URL, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        // 🔄 Mapping ตัวแปรจาก Backend ให้เข้ากับ Frontend ที่คุณเขียนไว้
        const formattedUsers = data.users.map((u: any) => ({
          id: u.id.toString(), // แปลง Int เป็น String เพื่อให้ Filter ทำงานได้
          name: u.username,
          email: u.email,
          phone: u.phone_number,
          address: u.address,
          role: u.role,
          department: u.department
        }));
        setUsers(formattedUsers);
      } else {
        if(res.status === 401) router.push("/login"); // Token หมดอายุ
      }
    } catch (error) {
      console.error("Failed to fetch users", error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredUsers = users.filter(user => {
    const matchId = user.id.toLowerCase().includes(filters.id.toLowerCase());
    const matchName = user.name.toLowerCase().includes(filters.name.toLowerCase()) || user.email.toLowerCase().includes(filters.name.toLowerCase());
    const matchAddress = user.address.toLowerCase().includes(filters.address.toLowerCase());
    const matchPhone = user.phone.includes(filters.phone);
    const matchRole = filters.role === "" || user.role === filters.role;
    const matchDept = filters.department === "" || user.department === filters.department;
    return matchId && matchName && matchAddress && matchPhone && matchRole && matchDept;
  });

  const sortedUsers = [...filteredUsers].sort((a, b) => {
    const { key, direction } = sortConfig;
    // Special-case: sort `id` as integer
    if (key === 'id') {
      const numA = parseInt((a as any).id || '0', 10) || 0;
      const numB = parseInt((b as any).id || '0', 10) || 0;
      if (numA < numB) return direction === 'asc' ? -1 : 1;
      if (numA > numB) return direction === 'asc' ? 1 : -1;
      return 0;
    }

    let valA = (a as any)[key] ? String((a as any)[key]).toLowerCase() : "";
    let valB = (b as any)[key] ? String((b as any)[key]).toLowerCase() : "";

    if (valA < valB) return direction === "asc" ? -1 : 1;
    if (valA > valB) return direction === "asc" ? 1 : -1;
    return 0;
  });

  const totalItems = sortedUsers.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const currentUsers = sortedUsers.slice(startIndex, endIndex);

  const handleSort = (key: string) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
    setCurrentPage(1);
  };

  const renderSortIcon = (columnKey: string) => {
    const isActive = sortConfig.key === columnKey;
    const isAsc = isActive && sortConfig.direction === "asc";

    if (!isActive) {
      return (
        <svg className="w-3.5 h-3.5 text-slate-400 opacity-40 ml-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
        </svg>
      );
    }
    if (isAsc) {
      return (
        <svg className="w-3.5 h-3.5 text-blue-600 ml-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
        </svg>
      );
    }
    return (
      <svg className="w-3.5 h-3.5 text-blue-600 ml-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
      </svg>
    );
  };

  const handleFilterChange = (column: string, value: string) => {
    setFilters(prev => ({ ...prev, [column]: value }));
    setCurrentPage(1); 
  };

  const handleResetFilters = () => {
    setFilters({ id: "", name: "", role: "", department: "", phone: "", address: "" });
    setSortConfig({ key: "id", direction: "asc" });
    setCurrentPage(1);
  };
  
  const handleAddNewClick = () => {
    setEditingUser(null);
    setFormData({ name: "", email: "", password: "", phone: "", address: "", role: "Data Owner", department: "HR" });
    setIsModalOpen(true);
  };

  const handleEditClick = (user: any) => {
    setEditingUser(user);
    setFormData({ ...user, password: "" });
    setIsModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem("token");
    
    // 🔄 Mapping กลับไปให้ตรงกับ Backend Schema
    const payload: any = {
      username: formData.name,
      email: formData.email,
      phone_number: formData.phone,
      address: formData.address,
      department: formData.department,
      role: formData.role,
    };

    try {
      if (editingUser) {
        // PUT: แก้ไขผู้ใช้
        if (formData.password) payload.password = formData.password; // ส่งไปเฉพาะถ้ามีการพิมพ์แก้
        
        const res = await fetch(`${API_BASE_URL}/${editingUser.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });
        if (res.ok) fetchUsers(); // Refresh ตาราง
      } else {
        // POST: สร้างผู้ใช้ใหม่
        payload.password = formData.password; // สร้างใหม่ต้องมีรหัสผ่าน
        const res = await fetch(`${API_BASE_URL}/create`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });
        if (res.ok) fetchUsers(); // Refresh ตาราง
      }
      setIsModalOpen(false);
    } catch (error) {
      console.error("Save user failed", error);
    }
  };

  // ฟังก์ชันเปิด Modal ลบ
  const handleDeleteClick = (user: any) => {
    setUserToDelete(user);
    setIsDeleteModalOpen(true);
  };

  // ฟังก์ชันยืนยันการลบ
  const confirmDelete = async () => {
    if (userToDelete) {
      const token = localStorage.getItem("token");
      try {
        const res = await fetch(`${API_BASE_URL}/${userToDelete.id}`, {
          method: "DELETE",
          headers: { "Authorization": `Bearer ${token}` }
        });
        if (res.ok) {
          fetchUsers();
          setIsDeleteModalOpen(false);
          setUserToDelete(null);
        }
      } catch (error) {
        console.error("Delete failed", error);
      }
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    router.push("/login");
  };

  return (
    <div className="h-screen flex flex-col font-sans overflow-hidden bg-slate-50">
      
      {/* 1. Top Navbar */}
      <header className="w-full h-14 bg-slate-900 text-white flex items-center justify-between px-6 shadow-md z-30 shrink-0">
        <div className="flex items-center">
          <span className="text-lg font-bold tracking-wider">RoPA <span className="text-blue-400">2077</span></span>
        </div>
        
        <div className="relative">
          <button aria-label="เมนูผู้ใช้งาน" title="User Menu" onClick={() => setIsProfileOpen(!isProfileOpen)} className="flex items-center gap-2 hover:bg-slate-800 p-1.5 rounded-lg transition-colors focus:outline-none">
             <div className="text-right hidden sm:block">
               <p className="text-xs font-semibold text-slate-100">{currentUser?.name}</p>
               <p className="text-[10px] text-slate-400">{currentUser?.role}</p>
             </div>
             <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold shadow-sm text-xs border border-slate-700">SA</div>
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

      {/* Container ด้านล่าง (Sidebar + Main Content) */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* 2. Sidebar */}
        <aside className={`relative bg-white border-r border-slate-200 flex flex-col z-20 transition-all duration-300 ease-in-out ${isSidebarOpen ? 'w-56' : 'w-0'}`}>
          <div className="overflow-hidden w-full h-full">
            <div className="w-56 flex flex-col h-full pt-4">
              <nav className="flex-1 px-3 space-y-1">
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
                <div className="bg-slate-50 rounded-lg overflow-hidden border border-slate-100 mb-1">
                  <button aria-label="สลับเมนู RoPA Record" title="RoPA Record Menu" onClick={() => setIsRopaMenuOpen(!isRopaMenuOpen)} className="w-full flex items-center justify-between px-3 py-2.5 text-slate-600 font-medium hover:bg-slate-100 transition-colors text-xs">
                    <div className="flex items-center">
                      <svg className="w-4 h-4 mr-2.5 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                      RoPA Record
                    </div>
                    <svg className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isRopaMenuOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </button>
                  {isRopaMenuOpen && (
                    <div className="flex flex-col pb-1">
                      <Link aria-label="ดูข้อมูล Controller" title="Controller Menu" href="/ropa/controller" className="w-full text-left pl-10 pr-3 py-2 text-xs font-medium transition-colors text-slate-600 hover:text-slate-800 hover:bg-slate-100 block">Controller</Link>
                      <Link aria-label="ดูข้อมูล Processor" title="Processor Menu" href="/ropa/processor" className="w-full text-left pl-10 pr-3 py-2 text-xs font-medium transition-colors text-slate-600 hover:text-slate-800 hover:bg-slate-100 block">Processor</Link>
                    </div>
                  )}
                </div>
                )}

                {navPerms.canSeeUsers && (
                <Link aria-label="ไปที่หน้าจัดการผู้ใช้งาน" title="User Management" href="/users" className="flex items-center px-3 py-2.5 bg-blue-50 text-blue-700 rounded-lg font-medium transition-colors text-xs">
                  <svg className="w-4 h-4 mr-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
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
            <svg className={`w-3.5 h-3.5 transition-transform duration-300 ${!isSidebarOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </aside>

        {/* 3. Main Content */}
        <main className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50">
          <div className="flex-1 overflow-auto p-6 relative">
            
            {/* Header Area */}
            <div className="mb-5">
              <div className="flex items-center text-[11px] text-slate-500 mb-2">
                <Link aria-label="ไปที่หน้าแรก" title="Home" href="/dashboard" className="hover:text-blue-600 transition-colors">Home</Link>
                <span className="mx-1.5">/</span>
                <span className="text-slate-800 font-medium">User Management</span>
              </div>
              
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-3">
                <div>
                  <h1 className="text-xl font-bold text-slate-800 mb-1">User Management</h1>
                  <h2 className="text-xs text-slate-500">รายชื่อผู้ใช้งานระบบ - จัดการข้อมูล สร้างบัญชีใหม่ และกำหนดสิทธิ์การเข้าถึง</h2>
                </div>
                <button aria-label="สร้างบัญชีผู้ใช้ใหม่" title="Add User" onClick={handleAddNewClick} className="flex items-center justify-center px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors shadow-sm w-fit">
                  <svg className="w-3.5 h-3.5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  สร้างบัญชี
                </button>
              </div>
            </div>

            {/* Table Section */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col">
              <div className="overflow-x-auto">
                <table className="w-full table-fixed text-left text-xs text-slate-600 whitespace-nowrap">
                  <thead className="bg-slate-50 border-b border-slate-200 select-none">
                    <tr>
                      <th className="w-[14.28%] px-2 py-2.5 align-top overflow-hidden">
                        <div 
                          className="flex items-center font-semibold text-slate-700 mb-1.5 cursor-pointer hover:text-blue-600 transition-colors group"
                          onClick={() => handleSort('id')}
                        >
                          <span className="truncate">รหัส (ID)</span>
                          {renderSortIcon('id')}
                        </div>
                        <input aria-label="ค้นหาด้วยรหัส" title="Search by ID" type="text" placeholder="ค้นหา ID..." value={filters.id} onChange={(e) => handleFilterChange('id', e.target.value)} onClick={(e) => e.stopPropagation()} className="w-full text-[10px] px-1.5 py-1 border border-slate-300 rounded outline-none focus:border-blue-500 bg-white" />
                      </th>
                      <th className="w-[14.28%] px-2 py-2.5 align-top overflow-hidden">
                        <div 
                          className="flex items-center font-semibold text-slate-700 mb-1.5 cursor-pointer hover:text-blue-600 transition-colors group"
                          onClick={() => handleSort('name')}
                        >
                          <span className="truncate">ชื่อผู้ใช้งาน</span>
                          {renderSortIcon('name')}
                        </div>
                        <input aria-label="ค้นหาด้วยชื่อหรืออีเมล" title="Search by Name/Email" type="text" placeholder="ค้นหาชื่อ..." value={filters.name} onChange={(e) => handleFilterChange('name', e.target.value)} onClick={(e) => e.stopPropagation()} className="w-full text-[10px] px-1.5 py-1 border border-slate-300 rounded outline-none focus:border-blue-500 bg-white" />
                      </th>
                      <th className="w-[14.28%] px-2 py-2.5 align-top overflow-hidden">
                        <div 
                          className="flex items-center font-semibold text-slate-700 mb-1.5 cursor-pointer hover:text-blue-600 transition-colors group"
                          onClick={() => handleSort('phone')}
                        >
                          <span className="truncate">เบอร์โทรศัพท์</span>
                          {renderSortIcon('phone')}
                        </div>
                        <input aria-label="ค้นหาด้วยเบอร์โทรศัพท์" title="Search by Phone" type="text" placeholder="ค้นหาเบอร์..." value={filters.phone} onChange={(e) => handleFilterChange('phone', e.target.value)} onClick={(e) => e.stopPropagation()} className="w-full text-[10px] px-1.5 py-1 border border-slate-300 rounded outline-none focus:border-blue-500 bg-white" />
                      </th>
                      <th className="w-[14.28%] px-2 py-2.5 align-top overflow-hidden">
                        <div 
                          className="flex items-center font-semibold text-slate-700 mb-1.5 cursor-pointer hover:text-blue-600 transition-colors group"
                          onClick={() => handleSort('address')}
                        >
                          <span className="truncate">ที่อยู่</span>
                          {renderSortIcon('address')}
                        </div>
                        <input aria-label="ค้นหาด้วยที่อยู่" title="Search by Address" type="text" placeholder="ค้นหาที่อยู่..." value={filters.address} onChange={(e) => handleFilterChange('address', e.target.value)} onClick={(e) => e.stopPropagation()} className="w-full text-[10px] px-1.5 py-1 border border-slate-300 rounded outline-none focus:border-blue-500 bg-white" />
                      </th>
                      <th className="w-[14.28%] px-2 py-2.5 align-top overflow-hidden">
                        <div 
                          className="flex items-center font-semibold text-slate-700 mb-1.5 cursor-pointer hover:text-blue-600 transition-colors group"
                          onClick={() => handleSort('role')}
                        >
                          <span className="truncate">บทบาท</span>
                          {renderSortIcon('role')}
                        </div>
                        <select aria-label="กรองด้วยบทบาท" title="Filter by Role" value={filters.role} onChange={(e) => handleFilterChange('role', e.target.value)} onClick={(e) => e.stopPropagation()} className="w-full text-[10px] px-1 py-1 border border-slate-300 rounded outline-none focus:border-blue-500 bg-white cursor-pointer">
                          <option value="">ทั้งหมด</option>
                          <option value="Admin">Admin</option>
                          <option value="DPO">DPO</option>
                          <option value="Data Owner">Data Owner</option>
                          <option value="Auditor">Auditor</option>
                          <option value="Executive">Executive</option>
                        </select>
                      </th>
                      <th className="w-[14.28%] px-2 py-2.5 align-top overflow-hidden">
                        <div 
                          className="flex items-center font-semibold text-slate-700 mb-1.5 cursor-pointer hover:text-blue-600 transition-colors group"
                          onClick={() => handleSort('department')}
                        >
                          <span className="truncate">แผนก</span>
                          {renderSortIcon('department')}
                        </div>
                        <select aria-label="กรองด้วยแผนก" title="Filter by Department" value={filters.department} onChange={(e) => handleFilterChange('department', e.target.value)} onClick={(e) => e.stopPropagation()} className="w-full text-[10px] px-1 py-1 border border-slate-300 rounded outline-none focus:border-blue-500 bg-white cursor-pointer">
                          <option value="">ทั้งหมด</option>
                          <option value="HR">HR</option>
                          <option value="IT">IT</option>
                          <option value="Compliance">Compliance</option>
                          <option value="Marketing">Marketing</option>
                          <option value="Sales">Sales</option>
                          <option value="External">External</option>
                          <option value="Executive">Executive</option>
                        </select>
                      </th>
                      <th className="w-[14.28%] px-2 py-2.5 align-top text-center overflow-hidden">
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
                    {currentUsers.length > 0 ? currentUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-b-0">
                        <td className="px-2 py-2 truncate" title={user.id}>{user.id}</td>
                        <td className="px-2 py-2 overflow-hidden">
                          <div className="flex items-center w-full">

                            <div className="truncate w-full">
                              <div className="font-semibold text-slate-800 truncate" title={user.name}>{user.name}</div>
                              <div className="text-[10px] text-slate-500 truncate" title={user.email}>{user.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-2 py-2 truncate" title={user.phone}>{user.phone}</td>
                        <td className="px-2 py-2 truncate" title={user.address}>{user.address}</td>
                        <td className="px-2 py-2 truncate" title={user.role}>{getRoleBadge(user.role)}</td>
                        <td className="px-2 py-2 truncate" title={user.department}>{user.department}</td>
                        <td className="px-2 py-2 text-center">
                          <button aria-label={`ดูข้อมูลของ ${user.name}`} title="ดูข้อมูล" onClick={() => setViewingUser(user)} className="text-slate-400 hover:text-emerald-600 mx-0.5 p-1 transition-colors">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                          </button>
                          <button aria-label={`แก้ไขข้อมูลของ ${user.name}`} title="แก้ไข" onClick={() => handleEditClick(user)} className="text-slate-400 hover:text-blue-600 mx-0.5 p-1 transition-colors">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                          </button>
                          <button aria-label={`ลบข้อมูลของ ${user.name}`} title="ลบ" onClick={() => handleDeleteClick(user)} className="text-slate-400 hover:text-red-600 mx-0.5 p-1 transition-colors">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={7} className="px-2 py-6 text-center text-slate-500">ไม่พบข้อมูลที่ค้นหา</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-2.5 border-t border-slate-200 bg-white text-[11px] text-slate-600">
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
          </div>
        </main>
      </div>

      {/* Modal (ดูข้อมูลทั้งหมด) */}
      {viewingUser && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-100 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-5 py-3 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-sm font-bold text-slate-800">ข้อมูลผู้ใช้งาน</h3>
              <button aria-label="ปิดหน้าต่าง" title="Close" onClick={() => setViewingUser(null)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-5 text-xs">
              <div className="flex items-center mb-5">
                 <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm mr-3">
                    {viewingUser.name.charAt(0)}
                 </div>
                 <div>
                    <h4 className="font-bold text-slate-800 text-sm">{viewingUser.name}</h4>
                    <p className="text-slate-500">{viewingUser.email}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">ID: {viewingUser.id}</p>
                 </div>
              </div>
              <div className="space-y-3">
                 <div className="grid grid-cols-2 gap-y-3 gap-x-3">
                    <div>
                       <p className="text-slate-500 font-medium mb-0.5">เบอร์โทรศัพท์</p>
                       <p className="text-slate-800">{viewingUser.phone || "-"}</p>
                    </div>
                    <div>
                       <p className="text-slate-500 font-medium mb-0.5">บทบาท</p>
                       <p className="text-slate-800">{viewingUser.role}</p>
                    </div>
                    <div>
                       <p className="text-slate-500 font-medium mb-0.5">แผนก</p>
                       <p className="text-slate-800">{viewingUser.department}</p>
                    </div>
                 </div>
                 <div className="pt-3 border-t border-slate-100">
                    <p className="text-slate-500 font-medium mb-0.5">ที่อยู่</p>
                    <p className="text-slate-800">{viewingUser.address || "-"}</p>
                 </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal (เพิ่ม / แก้ไข) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-100 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-5 py-3 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-sm font-bold text-slate-800">
                {editingUser ? "แก้ไขข้อมูลผู้ใช้งาน" : "สร้างผู้ใช้งานใหม่"}
              </h3>
              <button aria-label="ปิดหน้าต่าง" title="Close Modal" onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <form onSubmit={handleSaveUser} className="p-5 space-y-3 text-xs">
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label htmlFor="user_name" className="block font-medium text-slate-700 mb-1">ชื่อ-นามสกุล</label>
                  <input id="user_name" aria-label="กรอกชื่อและนามสกุล" title="ชื่อ-นามสกุล" placeholder="เช่น สมชาย ใจดี" type="text" required className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:border-blue-500 outline-none" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
                </div>
                <div>
                  <label htmlFor="user_email" className="block font-medium text-slate-700 mb-1">อีเมล</label>
                  <input id="user_email" aria-label="กรอกอีเมล" title="อีเมล" placeholder="example@email.com" type="email" required className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:border-blue-500 outline-none" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} />
                </div>
                <div>
                  <label htmlFor="user_phone" className="block font-medium text-slate-700 mb-1">เบอร์โทรศัพท์</label>
                  <input id="user_phone" aria-label="กรอกเบอร์โทรศัพท์" title="เบอร์โทรศัพท์" placeholder="08x-xxx-xxxx" type="text" required className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:border-blue-500 outline-none" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} />
                </div>
                <div>
                  <label htmlFor="user_address" className="block font-medium text-slate-700 mb-1">ที่อยู่</label>
                  <textarea id="user_address" aria-label="กรอกที่อยู่" title="ที่อยู่" placeholder="รายละเอียดที่อยู่..." rows={2} className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:border-blue-500 outline-none resize-none" value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})} />
                </div>
                {!editingUser && (
                  <div>
                    <label htmlFor="user_password" className="block font-medium text-slate-700 mb-1">รหัสผ่านเริ่มต้น</label>
                    <input id="user_password" aria-label="ตั้งรหัสผ่านเริ่มต้น" title="รหัสผ่าน" placeholder="ตั้งรหัสผ่าน..." type="password" required className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:border-blue-500 outline-none" value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="user_role" className="block font-medium text-slate-700 mb-1">บทบาท</label>
                    <select id="user_role" aria-label="เลือกบทบาท" title="บทบาท" className="w-full px-2 py-1.5 border border-slate-300 rounded focus:border-blue-500 outline-none bg-white cursor-pointer" value={formData.role} onChange={(e) => setFormData({...formData, role: e.target.value})}>
                      <option value="Data Owner">Data Owner</option>
                      <option value="DPO">DPO / Compliance</option>
                      <option value="Admin">System Admin</option>
                      <option value="Auditor">Auditor</option>
                      <option value="Executive">Executive</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="user_dept" className="block font-medium text-slate-700 mb-1">แผนก</label>
                    <select id="user_dept" aria-label="เลือกแผนก" title="แผนก" className="w-full px-2 py-1.5 border border-slate-300 rounded focus:border-blue-500 outline-none bg-white cursor-pointer" value={formData.department} onChange={(e) => setFormData({...formData, department: e.target.value})}>
                      <option value="HR">HR</option>
                      <option value="Marketing">Marketing</option>
                      <option value="Sales">Sales</option>
                      <option value="IT">IT</option>
                      <option value="Compliance">Compliance</option>
                      <option value="External">External</option>
                      <option value="Executive">Executive</option>
                      <option value="Blank">-</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="mt-3 flex justify-end space-x-2 border-t border-slate-100 pt-3">
                <button aria-label="ยกเลิก" title="Cancel" type="button" onClick={() => setIsModalOpen(false)} className="px-3 py-1.5 font-medium text-slate-600 bg-white border border-slate-300 rounded hover:bg-slate-50 transition-colors">
                  ยกเลิก
                </button>
                <button aria-label="บันทึกข้อมูล" title="Save User" type="submit" className="px-3 py-1.5 font-medium text-white bg-blue-600 rounded hover:bg-blue-700 shadow-sm transition-colors">
                  {editingUser ? "บันทึก" : "สร้างบัญชี"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* Modal: Confirm Delete User */}
      {/* ========================================== */}
      {isDeleteModalOpen && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-100 p-4">
              <div className="bg-white rounded-lg shadow-xl w-full max-w-70 p-5 animate-in fade-in zoom-in-95 duration-200">
                  <p className="text-sm text-slate-700 mb-5 leading-relaxed text-center">
                      คุณต้องการลบผู้ใช้งาน <br/><span className="font-bold">{userToDelete?.name}</span> ใช่หรือไม่?
                  </p>
                  <div className="flex space-x-2">
                      <button aria-label="ยกเลิกการลบ" onClick={() => setIsDeleteModalOpen(false)} className="flex-1 px-3 py-2 bg-slate-100 text-slate-700 font-bold text-xs rounded-md hover:bg-slate-200 transition-colors">
                          ยกเลิก
                      </button>
                      <button aria-label="ยืนยันการลบ" onClick={confirmDelete} className="flex-1 px-3 py-2 bg-[#e60000] text-white font-bold text-xs rounded-md hover:bg-red-700 transition-colors shadow-sm">
                          ยืนยัน
                      </button>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
}

function setItems(sortedData: any[]) {
  throw new Error("Function not implemented.");
}
