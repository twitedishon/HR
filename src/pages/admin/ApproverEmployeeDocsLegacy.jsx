import { useMemo, useRef, useState } from "react";
import {
  UploadCloud,
  FileText,
  Download,
  Trash2,
  Eye,
  Search,
  Grid,
  List,
} from "lucide-react";

/* ---------------- Utils ---------------- */
const formatBytes = (bytes) => {
  if (!bytes && bytes !== 0) return "-";
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), sizes.length - 1);
  const val = bytes / Math.pow(1024, i);
  return `${val.toFixed(val >= 10 || i === 0 ? 0 : 1)} ${sizes[i]}`;
};

const getFileType = (file) => {
  const t = file?.type || "";
  if (t.includes("pdf")) return "PDF";
  if (t.includes("image")) return "IMAGE";
  if (t.includes("word")) return "WORD";
  if (t.includes("excel")) return "EXCEL";
  return "FILE";
};

const badgeColor = (type) => {
  if (type === "PDF") return "bg-red-50 text-red-700";
  if (type === "IMAGE") return "bg-blue-50 text-blue-700";
  if (type === "WORD") return "bg-indigo-50 text-indigo-700";
  if (type === "EXCEL") return "bg-green-50 text-green-700";
  return "bg-gray-100 text-gray-700";
};

/* ---------------- Component ---------------- */
export default function Documents() {
  const fileRef = useRef(null);

  const [docs, setDocs] = useState([]);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Offer Letter");
  const [file, setFile] = useState(null);
  const [search, setSearch] = useState("");
  const [view, setView] = useState("table"); // table | grid

  /* ---------------- Actions ---------------- */
  const pickFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.[^/.]+$/, ""));
  };

  const upload = () => {
    if (!file || !title) return alert("Title & file required");
    const doc = {
      id: crypto.randomUUID(),
      title,
      category,
      fileName: file.name,
      size: file.size,
      type: getFileType(file),
      url: URL.createObjectURL(file),
      date: new Date().toLocaleString(),
    };
    setDocs((p) => [doc, ...p]);
    setTitle("");
    setFile(null);
    fileRef.current.value = "";
  };

  const remove = (id) => setDocs((p) => p.filter((d) => d.id !== id));

  const filtered = useMemo(() => {
    return docs.filter(
      (d) =>
        d.title.toLowerCase().includes(search.toLowerCase()) ||
        d.fileName.toLowerCase().includes(search.toLowerCase())
    );
  }, [docs, search]);

  /* ---------------- UI ---------------- */
  return (
    <section className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Document Management</h1>
          <p className="text-sm text-gray-500">
            Securely upload, manage & download employee documents
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setView("table")}
            className={`p-2 rounded-lg border ${
              view === "table" ? "bg-blue-600 text-white" : "bg-white"
            }`}
          >
            <List size={16} />
          </button>
          <button
            onClick={() => setView("grid")}
            className={`p-2 rounded-lg border ${
              view === "grid" ? "bg-blue-600 text-white" : "bg-white"
            }`}
          >
            <Grid size={16} />
          </button>
        </div>
      </div>

      {/* Upload Box */}
      <div className="bg-white rounded-2xl border shadow-sm p-6">
        <div
          onClick={() => fileRef.current.click()}
          className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer hover:border-blue-500 transition"
        >
          <UploadCloud className="mx-auto text-blue-600" />
          <p className="font-semibold mt-2">Click to upload document</p>
          <p className="text-xs text-gray-500">PDF, Image, Word, Excel</p>
        </div>

        {file && (
          <div className="mt-4 flex items-center justify-between bg-gray-50 p-3 rounded-xl">
            <div>
              <div className="font-medium">{file.name}</div>
              <div className="text-xs text-gray-500">{formatBytes(file.size)}</div>
            </div>
            <button onClick={() => setFile(null)} className="text-xs underline">
              Remove
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Document title"
            className="rounded-xl border px-3 py-2 text-sm"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-xl border px-3 py-2 text-sm"
          >
            <option>Offer Letter</option>
            <option>Payslip</option>
            <option>Appointment Letter</option>
            <option>HR Policy</option>
            <option>Other</option>
          </select>
          <button
            onClick={upload}
            className="rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700"
          >
            Upload Document
          </button>
        </div>

        <input type="file" ref={fileRef} className="hidden" onChange={pickFile} />
      </div>

      {/* Search */}
      <div className="flex items-center gap-2">
        <Search size={16} className="text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search documents..."
          className="w-full md:w-72 rounded-xl border px-3 py-2 text-sm"
        />
      </div>

      {/* LIST VIEW */}
      {view === "table" && (
        <div className="bg-white rounded-2xl border overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-4 py-3 text-left">Document</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Size</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan="4" className="text-center py-10 text-gray-500">
                    No documents found
                  </td>
                </tr>
              )}
              {filtered.map((d) => (
                <tr key={d.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex gap-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-semibold ${badgeColor(
                          d.type
                        )}`}
                      >
                        {d.type}
                      </span>
                      <div>
                        <div className="font-semibold">{d.title}</div>
                        <div className="text-xs text-gray-500">{d.fileName}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">{d.category}</td>
                  <td className="px-4 py-3">{formatBytes(d.size)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <a href={d.url} target="_blank" rel="noreferrer">
                        <Eye size={16} />
                      </a>
                      <a href={d.url} download>
                        <Download size={16} />
                      </a>
                      <button onClick={() => remove(d.id)}>
                        <Trash2 size={16} className="text-red-600" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* GRID VIEW */}
      {view === "grid" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((d) => (
            <div key={d.id} className="bg-white border rounded-2xl p-4 shadow-sm">
              <span
                className={`inline-block mb-2 px-2 py-0.5 rounded-full text-xs font-semibold ${badgeColor(
                  d.type
                )}`}
              >
                {d.type}
              </span>
              <h3 className="font-semibold truncate">{d.title}</h3>
              <p className="text-xs text-gray-500 truncate">{d.fileName}</p>
              <p className="text-xs mt-1">{formatBytes(d.size)}</p>

              <div className="flex justify-end gap-3 mt-4">
                <a href={d.url} target="_blank" rel="noreferrer">
                  <Eye size={16} />
                </a>
                <a href={d.url} download>
                  <Download size={16} />
                </a>
                <button onClick={() => remove(d.id)}>
                  <Trash2 size={16} className="text-red-600" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-400">
        Demo UI only – integrate Supabase / backend for real storage.
      </p>
    </section>
  );
}
