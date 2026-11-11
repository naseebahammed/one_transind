"use client";
import { NativeSelect } from "@/components/admin/ui/native-select";

/** Saves as soon as a department is chosen. */
export function DepartmentLinkSelect({ value, groups }: { value: number | null; groups: { company: string; departments: { id: number; name: string }[] }[] }) {
  return (
    <NativeSelect name="departmentId" defaultValue={value ?? ""} onChange={(e) => e.currentTarget.form?.requestSubmit()} aria-label="Department">
      <option value="">Not linked</option>
      {groups.map((g) => <optgroup key={g.company} label={g.company}>{g.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</optgroup>)}
    </NativeSelect>
  );
}
