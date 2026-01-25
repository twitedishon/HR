import React, { useEffect, useState } from "react";
import { 
  GraduationCap, 
  User, 
  Laptop, 
  Code2, 
  Users, 
  ClipboardList, 
  Grid3X3, 
  BarChart3, 
  Star,
  Briefcase,
  Search,
  UserCheck,
  Phone,
  UserPlus,
  Loader2,
} from "lucide-react";
import { supabase } from "../../lib/supabaseClient";

const ApproverCareerGuidance = () => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        const authRaw = localStorage.getItem("HRMSS_AUTH_SESSION");
        const auth = authRaw ? JSON.parse(authRaw) : null;
        
        // Match the logic used in EmployeeDashboard.jsx for robust ID extraction
        const userId = String(auth?.user_id || auth?.id || auth?.userId || "").trim();

        if (!userId) {
          setLoading(false);
          return;
        }

        // Try to get profile info
        const { data, error } = await supabase
            .from("hrmss_profiles")
            .select("designation, department")
            .eq("user_id", userId)
            .maybeSingle();

        if (error) throw error;

        setProfile({
          designation: data?.designation || "Admin",
          department: data?.department || "Administration",
        });
      } catch (err) {
        console.error("Error fetching career profile:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  if (loading) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin text-purple-600" size={40} />
        <p className="text-sm font-bold text-slate-500 uppercase tracking-widest italic">Loading Matrix...</p>
      </div>
    );
  }

  const designation = profile?.designation?.toLowerCase() || "";
  const department = profile?.department?.toLowerCase() || "";
  
  // Check if user is in a technology role (AI, Intern, Developer, UI/UX, etc.)
  const isTechRole = 
    designation.includes("ai") || 
    designation.includes("intern") || 
    designation.includes("developer") || 
    designation.includes("ui/ux") ||
    department.includes("technology") ||
    department.includes("engineering") ||
    department.includes("product");

  const matrixData = !isTechRole ? [
    { icon: Briefcase, color: "text-purple-600", title: "Talent Acquisition - Manager", exp: "7+" },
    { icon: Users, color: "text-blue-500", title: "Talent Acquisition - Team Lead", exp: "4.5+" },
    { icon: Search, color: "text-teal-500", title: "Talent Acquisition Specialist", exp: "3+" },
    { icon: UserCheck, color: "text-orange-500", title: "Talent Acquisition Executive", exp: "1 - 2.5yr" },
    { icon: Phone, color: "text-blue-600", title: "IT Recruiter", exp: "> 1yr" },
    { icon: UserPlus, color: "text-purple-500", title: "Trainee IT Recruiter", exp: "Fresher" },
  ] : [
    { icon: GraduationCap, color: "text-purple-600", title: "Trainee Developer (Intern / Student)", exp: "0 to 6 months" },
    { icon: User, color: "text-blue-500", title: "Junior Developer (Fresher)", exp: "0 to 1 year" },
    { icon: Laptop, color: "text-teal-500", title: "Software Developer", exp: "1 to 2 years" },
    { icon: Code2, color: "text-green-600", title: "Senior Software Developer", exp: "3 to 5 years" },
    { icon: Users, color: "text-orange-500", title: "Team Lead", exp: "5 to 7 years" },
    { icon: ClipboardList, color: "text-indigo-600", title: "Delivery Manager", exp: "7+ Years" },
    { icon: Grid3X3, color: "text-blue-700", title: "Solution / Technical Architect", exp: "9+ years" },
    { icon: BarChart3, color: "text-blue-500", title: "Product Owner / Product Manager", exp: "9+ years" },
    { icon: Star, color: "text-yellow-500", title: "Head of Engineering / CTO", exp: "12+ years" },
  ];

  return (
    <div className="p-6 md:p-10 animate-in fade-in slide-in-from-bottom-5 duration-700">
      {/* Header Section */}
      <div className="max-w-6xl mx-auto mb-12 text-center md:text-left">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-black text-[#1e3a8a] tracking-tight">
              Designation & Experience Matrix
            </h1>
            <p className="text-slate-500 mt-2 font-medium">
              Twite AI Technologies • <span className="text-purple-600 font-bold">{!isTechRole ? "Talent Acquisition" : "Technology"} Division</span>
            </p>
          </div>
        </div>
      </div>

      {/* Card Grid */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
        {matrixData.map((row, idx) => (
          <div 
            key={idx} 
            className="group bg-white rounded-[24px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 hover:shadow-2xl hover:shadow-purple-100 transition-all duration-300 hover:-translate-y-1 relative overflow-hidden"
          >
            {/* Subtle Gradient background on hover */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-50 rounded-full -mr-16 -mt-16 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

            <div className="flex gap-5 relative z-10">
              {/* Primary Icon */}
              <div className="flex flex-col gap-4">
                <div className={`w-14 h-14 rounded-2xl ${row.color.replace('text', 'bg')}/10 ${row.color} flex items-center justify-center`}>
                  <row.icon size={28} strokeWidth={2.5} />
                </div>
                {/* Visual Connector Line (Only for Tech paths) */}
                {isTechRole && idx < matrixData.length - 1 && (
                  <div className="mx-auto w-0.5 h-full bg-slate-50 min-h-[20px]"></div>
                )}
              </div>

              {/* Text Details */}
              <div className="flex-1 pt-1">
                <h3 className="text-[19px] font-bold text-[#1e293b] leading-tight group-hover:text-purple-700 transition-colors">
                  {row.title}
                </h3>
                
                <div className="mt-4 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-slate-50 text-slate-400 flex items-center justify-center">
                      {!isTechRole ? <Briefcase size={16} /> : <Laptop size={16} />}
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest leading-none mb-1">Relevant Experience</p>
                      <p className="text-sm font-bold text-slate-700">{row.exp}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Status Indicator Bar */}
              <div className="w-1 rounded-full bg-slate-50 h-10 my-auto group-hover:bg-purple-200 transition-colors"></div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer Branding */}
      <div className="mt-16 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-50 border border-slate-100">
           <Star className="text-yellow-500" size={12} fill="currentColor" />
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">TWITE HRMS PROFESSIONAL GROWTH FRAMEWORK</p>
        </div>
      </div>
    </div>
  );
};

export default ApproverCareerGuidance;
