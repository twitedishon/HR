const Table = ({ columns, data }) => {
  return (
    <div className="overflow-x-auto bg-white rounded-xl shadow-sm border border-gray-100">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50 text-gray-600">
          <tr>
            {columns.map((col) => (
              <th key={col.key} className="px-4 py-2 text-left font-medium">
                {col.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 && (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-4 text-center text-gray-400"
              >
                No data available.
              </td>
            </tr>
          )}
          {data.map((row, idx) => (
            <tr
              key={idx}
              className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}
            >
              {columns.map((col) => (
                <td key={col.key} className="px-4 py-2 text-gray-700">
                  {row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Table;
