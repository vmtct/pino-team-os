// PAP-2219 / SCH-STUDENT-MGMT: map the three BO inputs to the Core birth profile contract.
type BirthPrecision = "UNKNOWN" | "YEAR_ONLY" | "YEAR_MONTH" | "FULL_DATE";

export type StudentBirthProfilePatch = {
  birthDay: number | null;
  birthMonth: number | null;
  birthYear: number | null;
  birthPrecision: BirthPrecision;
  expectedVersion: number;
};

export function studentBirthProfilePatch(
  parts: { birthDay: string; birthMonth: string; birthYear: string },
  expectedVersion: number,
): StudentBirthProfilePatch {
  const { birthDay: day, birthMonth: month, birthYear: year } = parts;
  if ((day && !/^\d{1,2}$/.test(day)) ||
      (month && !/^\d{1,2}$/.test(month)) ||
      (year && !/^\d{4}$/.test(year))) {
    throw new Error("Vui lòng nhập ngày sinh theo định dạng dd, mm, yyyy.");
  }
  if ((day && !month) || ((day || month) && !year)) {
    throw new Error("Cần nhập năm trước khi thêm tháng, và nhập tháng trước khi thêm ngày.");
  }

  const birthPrecision = day ? "FULL_DATE" : month ? "YEAR_MONTH" : year ? "YEAR_ONLY" : "UNKNOWN";
  return {
    birthDay: day ? Number(day) : null,
    birthMonth: month ? Number(month) : null,
    birthYear: year ? Number(year) : null,
    birthPrecision,
    expectedVersion,
  };
}
