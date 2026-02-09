import DocumentManager from "../../components/DocumentManager.jsx";

export default function AdminDocuments() {
  return (
    <DocumentManager
      title="Admin Documents"
      accent="blue"
      role="admin"
      categoryOptions={["Payslip", "HR Policy", "Payroll", "Reports", "Other"]}
    />
  );
}

