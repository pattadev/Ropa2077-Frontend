"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { jwtDecode } from "jwt-decode"; // ใช้งาน jwtDecode

// 🛠️ กำหนด Interface สำหรับ Payload ที่อยู่ใน JWT Token
export interface TokenPayload {
    sub: string;
    role: string;
    user_id: number;
    email?: string;
    phone_number?: string;
    address?: string;
    department?: string;
    exp: number;
}

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [keepLoggedIn, setKeepLoggedIn] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsLoading(true);
        setErrorMessage("");

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/v1/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });

            if (!res.ok) {
                throw new Error("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
            }

            const data = await res.json();

            // บันทึก Token และ User Information ลง Local Storage
            localStorage.setItem("token", data.access_token);
            localStorage.setItem("user", JSON.stringify(data.user));

            // 🌟 1. แกะ JWT Token เพื่อดึง Role
            try {
                const decodedToken = jwtDecode<TokenPayload>(data.access_token);
                // ดึง Role ออกมา (หรือถ้า Backend ใส่ role ไว้ใน data.user ด้วย ก็สามารถใช้ fallback ได้)
                const userRole = decodedToken.role || data.user?.role; 

                // 🌟 2. ทำ Role-Based Routing ส่งไปหน้าที่เตรียมไว้ 5 roles
                switch (userRole) {
                    case "admin":
                        router.push("/users");
                        break;
                    case "dpo":
                        router.push("/dpo");
                        break;
                    case "data_owner":
                        router.push("/ropa/controller");
                        break;
                    case "executive":
                        router.push("/dashboard");
                        break;
                    case "auditor":
                        router.push("/ropa/controller");
                        break;
                    case "developer":
                        router.push("/users");
                        break;
                    default:

                        router.push("/ropa"); 
                        break;
                }

            } catch (decodeError) {
                console.error("Token decoding failed:", decodeError);

                router.push("/");
            }

        } catch (error) {
            if (error instanceof Error) {
                setErrorMessage(error.message);
            } else {
                setErrorMessage("เกิดข้อผิดพลาดที่ไม่สามารถระบุได้");
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex bg-slate-50 font-sans">
            {/* ฝั่งซ้าย: Branding & System Info */}
            <div className="hidden lg:flex lg:w-1/4 bg-slate-900 flex-col p-8 text-left relative overflow-hidden">
                <div className="absolute top-[-10%] left-[-10%] w-64 h-64 bg-blue-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-64 h-64 bg-cyan-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20"></div>
                <div className="flex flex-col h-full w-full z-10 text-white animate-in fade-in slide-in-from-bottom-4 duration-700">

                    {/* ส่วนบน: หัวข้อและคำแนะนำ */}
                    <div>
                        <h1 className="text-2xl font-bold tracking-wider mb-2">RoPA 2077</h1>
                        <h2 className="text-x font-medium text-blue-300 mb-4">
                            Management Platform
                        </h2>
                        <div className="w-full h-0.5 bg-blue-900 mb-4 rounded-full"></div>

                        <span className="text-x font-medium block mb-1">คำแนะนำ</span>
                        <p className="text-sm text-slate-300">
                            ระบบจัดการบันทึกรายการประมวลผลข้อมูลส่วนบุคคลตาม PDPA
                        </p>
                    </div>
                    <div className="mt-auto">
                        <span className="text-sm font-bold text-slate-400 block mb-2 border-t border-slate-700 pt-4">ติดต่อ</span>
                        <div className="text-xs text-slate-300 space-y-1">
                            <p>Email - admin@netbay.co.th</p>
                            <p>Line - @netbay</p>
                            <p>โทรศัพท์ - 02-xxx-xxxx</p>
                        </div>
                    </div>

                </div>
            </div>

            {/* ฝั่งขวา: Login Form */}
            <div className="w-full lg:w-2/3 flex justify-center items-center p-4 relative">
                <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-sm border border-slate-200">

                    <div className="mb-6">
                        <h2 className="text-2xl font-bold text-slate-900 mb-1 text-center">เข้าสู่ระบบ</h2>
                        <p className="text-xs text-slate-500 text-center">กรุณากรอกข้อมูลเพื่อเข้าสู่ระบบ</p>
                    </div>

                    {/* แสดงข้อความ Error */}
                    {errorMessage && (
                        <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs rounded-r-lg">
                            {errorMessage}
                        </div>
                    )}

                    <form onSubmit={handleLogin} className="space-y-4">

                        {/* Email Field */}
                        <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1" htmlFor="email">
                                Email
                            </label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none transition-all text-slate-900 bg-slate-50 focus:bg-white"
                                placeholder="name@company.com"
                                required
                            />
                        </div>

                        {/* Password Field */}
                        <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1" htmlFor="password">
                                Password
                            </label>
                            <div className="relative">
                                <input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none transition-all text-slate-900 bg-slate-50 focus:bg-white pr-10"
                                    placeholder="••••••••"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                                >
                                    {showPassword ? (
                                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                        </svg>
                                    ) : (
                                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Keep me logged in */}
                        <div className="flex items-center justify-between pt-1">
                            <div className="flex items-center">
                                <input
                                    id="remember"
                                    type="checkbox"
                                    checked={keepLoggedIn}
                                    onChange={(e) => setKeepLoggedIn(e.target.checked)}
                                    className="h-3.5 w-3.5 text-blue-600 focus:ring-blue-500 border-slate-300 rounded cursor-pointer"
                                />
                                <label htmlFor="remember" className="ml-2 block text-xs text-slate-700 cursor-pointer">
                                    จำการเข้าสู่ระบบ
                                </label>
                            </div>
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={isLoading}
                            className={`w-full text-white bg-slate-900 text-sm font-semibold py-2.5 px-4 mt-2 rounded-lg shadow-sm transition-all duration-200 flex justify-center items-center ${isLoading ? "bg-blue-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-900 hover:shadow"
                                }`}
                        >
                            {isLoading ? (
                                <>
                                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    กำลังเข้าสู่ระบบ...
                                </>
                            ) : (
                                "เข้าสู่ระบบ"
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}