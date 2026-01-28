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
    { icon: UserPlus, color: "text-purple-500", title: "Trainee IT Recruiter", exp: "Fresher" },
    { icon: Phone, color: "text-blue-600", title: "IT Recruiter", exp: "> 1yr" },
    { icon: UserCheck, color: "text-orange-500", title: "Talent Acquisition Executive", exp: "1 - 2.5yr" },
    { icon: Search, color: "text-teal-500", title: "Talent Acquisition Specialist", exp: "3+" },
    { icon: Users, color: "text-blue-500", title: "Talent Acquisition - Team Lead", exp: "4.5+" },
    { icon: Briefcase, color: "text-purple-600", title: "Talent Acquisition - Manager", exp: "7+" },
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

  const rungCount = matrixData.length;
  const rungGap = 85;
  const topOffset = 30;
  const ladderHeight = topOffset + Math.max(0, rungCount - 1) * rungGap + 80;

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

      {/* Career Ladder */}
      <div className="max-w-6xl mx-auto py-10">
        <div className="relative flex justify-center">
          {/* Blue Ladder Structure */}
          <div className="absolute left-0 top-0 w-48" style={{ height: `${ladderHeight}px` }}>
            {/* Left vertical beam */}
            <div className="absolute left-0 top-0 w-8 h-full bg-blue-500 rounded-lg shadow-md" />
            {/* Right vertical beam */}
            <div className="absolute right-0 top-0 w-8 h-full bg-blue-500 rounded-lg shadow-md" />
            {/* Rungs */}
            {[...Array(rungCount)].map((_, i) => {
              const currentStep = matrixData.slice().reverse()[i];
              const isSeniorSoftwareDev = currentStep?.title.toLowerCase().includes("senior software developer");
              const rungNumber = String(rungCount - i).padStart(2, "0");

              return (
                <div
                  key={i}
                  className="absolute left-0 w-full h-8 bg-blue-400 rounded-full shadow-md flex items-center justify-between px-2"
                  style={{ top: `${topOffset + i * rungGap}px` }}
                >
                  {/* Number on left side of rung */}
                  <span className="text-white font-bold text-xs">{rungNumber}</span>

                  {/* Employee position indicator on ladder rung */}
                  {isSeniorSoftwareDev && (
                    <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center border-2 border-white shadow-md">
                      <User size={12} className="text-white" />
                    </div>
                  )}

                  {/* Empty space on right if no employee indicator */}
                  {!isSeniorSoftwareDev && <div className="w-6 h-6"></div>}
                </div>
              );
            })}
          </div>

          {/* Steps and Captions */}
          <div className="relative w-full max-w-2xl pl-32" style={{ height: `${ladderHeight}px` }}>
            {matrixData.slice().reverse().map((row, idx) => {
              const originalIdx = matrixData.length - 1 - idx;
              const step = String(originalIdx + 1).padStart(2, "0");
              const palette = [
                { circle: "#A78BFA", dot: "#8B5CF6" },
                { circle: "#F87171", dot: "#EF4444" },
                { circle: "#EC4899", dot: "#E879F9" },
                { circle: "#FBBF24", dot: "#F59E0B" },
                { circle: "#FCD34D", dot: "#FACC15" },
              ];
              const tone = palette[originalIdx % palette.length];

              return (
                <div
                  key={originalIdx}
                  className="absolute flex items-center"
                  style={{
                    top: `${topOffset + idx * rungGap - 16}px`,
                    width: "100%",
                    justifyContent: "flex-start",
                  }}
                >
                  {/* Circular Step on the ladder */}
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center shadow-lg"
                    style={{ backgroundColor: tone.circle, marginLeft: "-24px" }}
                  >
                    <span className="text-white font-bold text-lg">{step}</span>
                  </div>

                  {/* Caption to the right */}
                  <div className="flex items-center ml-8 flex-grow">
                    <div
                      className="w-3 h-3 rounded-full mr-3"
                      style={{ backgroundColor: tone.dot }}
                    />
                    <div>
                      <h3 className="font-bold text-gray-800 text-lg">{row.title}</h3>
                      <p className="text-sm text-gray-600">{row.exp}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
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
