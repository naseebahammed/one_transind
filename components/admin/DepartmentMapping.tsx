import { createDepartment, deleteDepartment, linkDepartment } from "@/app/admin/employees/actions";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { DepartmentLinkSelect } from "@/components/admin/DepartmentLinkSelect";
import { Button } from "@/components/admin/ui/button";
import { Card } from "@/components/admin/ui/card";
import { Input } from "@/components/admin/ui/input";
import { NativeSelect } from "@/components/admin/ui/native-select";
import { listCompanies } from "@/lib/companies";
import { listDepartments, listSourceNames } from "@/lib/employee-records";

/** The two admin cards: create departments under companies, then link each staff-file department text to one. */
export async function DepartmentMapping() {
  const [companies, departments, names] = await Promise.all([listCompanies(), listDepartments(), listSourceNames()]);
  const groups = companies.map((c) => ({ company: c.name, departments: departments.filter((d) => d.companyId === c.id) })).filter((g) => g.departments.length);
  return (
    <>
      <Card className="space-y-3 p-4">
        <h2 className="font-semibold">Departments by company</h2>
        <form action={createDepartment} className="flex flex-wrap items-center gap-2">
          <NativeSelect name="companyId" required aria-label="Company"><option value="">Company</option>{companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</NativeSelect>
          <Input name="name" required maxLength={80} placeholder="New department name" aria-label="New department name" className="max-w-xs" />
          <Button type="submit">Add department</Button>
        </form>
        {groups.length ? groups.map((g) => (
          <div key={g.company} className="text-sm">
            <p className="font-medium">{g.company}</p>
            <ul className="mt-1 flex flex-wrap gap-2">{g.departments.map((d) => (
              <li key={d.id}>
                <form action={deleteDepartment} className="flex items-center gap-1 rounded-md border px-2 py-1">
                  <input type="hidden" name="id" value={d.id} />{d.name}
                  <ConfirmButton message={`Remove ${d.name}? Staff-file departments linked to it become unlinked.`} variant="ghost" size="icon-xs" aria-label={`Remove ${d.name}`}>×</ConfirmButton>
                </form>
              </li>
            ))}</ul>
          </div>
        )) : <p className="text-sm text-muted-foreground">No departments yet.</p>}
      </Card>
      <Card className="space-y-3 p-4">
        <h2 className="font-semibold">Link staff-file departments</h2>
        <p className="text-sm text-muted-foreground">Choose the department each name from the Excel files counts under. Several spellings can share one department. Unlinked ones show as Unassigned on the HR page.</p>
        {names.length ? (
          <table className="w-full text-sm">
            <thead><tr className="text-left"><th>Name in staff file</th><th className="w-20">People</th><th className="w-72">Department</th></tr></thead>
            <tbody>{names.map((n) => (
              <tr key={n.name} className="border-t">
                <td className="py-1">{n.name || "(blank)"}</td><td>{n.people}</td>
                <td><form action={linkDepartment}><input type="hidden" name="name" value={n.name} /><DepartmentLinkSelect value={n.departmentId} groups={groups} /></form></td>
              </tr>
            ))}</tbody>
          </table>
        ) : <p className="text-sm text-muted-foreground">Upload the staff lists first.</p>}
      </Card>
    </>
  );
}
