import DocumentManager from "../../components/DocumentManager.jsx";

export default function AdminDocuments() {
  return (
    <DocumentManager
      title="Admin Documents"
      subtitle="Upload and manage admin documents"
      accent="blue"
      role="admin"
      categoryOptions={["Payslip", "HR Policy", "Payroll", "Reports", "Other"]}
    />
  );
}

