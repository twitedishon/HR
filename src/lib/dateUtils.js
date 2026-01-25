const pad2 = (value) => String(value).padStart(2, "0");

const toDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return value;
  }
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
};

export const formatTimeHHMM = (value) => {
  const date = toDate(value);
  if (!date) return "-";
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
};

export const formatDDMMYYYY = (value) => {
  const date = toDate(value);
  if (!date) return "-";
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`;
};

export const formatDDMMYYYYHHMM = (value) => {
  const date = toDate(value);
  if (!date) return "-";
  return `${formatDDMMYYYY(date)} ${formatTimeHHMM(date)}`;
};

export const formatRange = ({ from, to }) => {
  if (!from && !to) return "-";
  if (!to || String(to) === String(from)) return formatDDMMYYYY(from);
  return `${formatDDMMYYYY(from)} - ${formatDDMMYYYY(to)}`;
};
