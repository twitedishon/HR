import { ArrowUpRight } from "lucide-react";

const SAGE = "#89AF8E";

function hexToRgb(hex) {
  const h = hex.replace("#", "").trim();
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const num = parseInt(full, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}
function rgba(hex, a) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

export default function StatCard({ title, value, subtitle, onClick, active }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-2xl p-4 shadow-sm ring-1 transition hover:shadow"
      style={{
        backgroundColor: active ? rgba(SAGE, 0.18) : rgba(SAGE, 0.10),
        borderColor: "transparent",
        boxShadow: active
          ? `0 0 0 3px ${rgba(SAGE, 0.25)}, 0 1px 2px rgba(0,0,0,0.05)`
          : `0 1px 2px rgba(0,0,0,0.05)`,
        // ring color (tailwind ring-1 uses box-shadow; we override via outline style)
        // but keep ring-1 for layout, and visually do it with border here:
        border: `1px solid ${active ? rgba(SAGE, 0.55) : rgba(SAGE, 0.30)}`,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-slate-600">{title}</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
          <p className="mt-1 text-xs text-slate-600">{subtitle}</p>
        </div>

        <span
          className="mt-1 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold"
          style={{
            backgroundColor: active ? rgba(SAGE, 0.22) : "rgba(148,163,184,0.12)",
            color: active ? "rgb(15, 62, 26)" : "rgb(71, 85, 105)",
            border: `1px solid ${active ? rgba(SAGE, 0.45) : "rgba(148,163,184,0.20)"}`,
          }}
        >
          View <ArrowUpRight size={14} />
        </span>
      </div>
    </button>
  );
}
