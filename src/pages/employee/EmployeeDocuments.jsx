import DocumentManager from "../../components/DocumentManager.jsx";

export default function EmployeeDocuments() {
  return (
    <DocumentManager
      title="My Documents"
      subtitle="Upload and manage your documents"
      accent="slate"
      role="employee"

      categoryOptions={[
        "All Educational Certificates (PDF)",
        "All Previous Companies Relieving Letters (PDF)",
        "Last 3 Months Pay Slips (PDF - merged or individual)",
        "Current Company Offer Letter (PDF)",
        "Voter ID (PDF / Image)",
        "PAN Card (PDF / Image)",
        "Passport Size Photograph (JPG / PNG)",
        "Aadhaar Card (PDF / Image - Mask Aadhaar number if required)",
        "Last Three Months Bank Statements (PDF)",
        "Other",
      ]}
    />
  );
}
