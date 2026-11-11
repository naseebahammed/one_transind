import { addStaffDepartmentAction, deleteDepartment, renameDepartmentAction } from "@/app/admin/employees/actions";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { Button } from "@/components/admin/ui/button";
import { Card, CardContent } from "@/components/admin/ui/card";
import { Input } from "@/components/admin/ui/input";
import { NativeSelect } from "@/components/admin/ui/native-select";
import { listDepartments, listSourceNames } from "@/lib/employee-records";

/** A company's departments: choose one of the names found in the staff lists to add it, and rename it afterwards. */
export async function CompanyDepartments({ companyId }: { companyId: number }) {
  const [all, names] = await Promise.all([listDepartments(), listSourceNames()]);
  const departments = all.filter((d) => d.companyId === companyId), available = names.filter((n) => n.departmentId === null);
  return (
    <Card>
      <CardContent className="space-y-3">
        <h2 className="text-sm font-medium">Departments</h2>
        {departments.length === 0 && <p className="text-sm text-muted-foreground">No departments yet.</p>}
        <ul className="space-y-2">{departments.map((d) => (
          <li key={d.id} className="flex flex-wrap items-center gap-2">
            <form action={renameDepartmentAction} className="flex items-center gap-2">
              <input type="hidden" name="id" value={d.id} />
              <Input name="name" defaultValue={d.name} required maxLength={80} aria-label={`Name of ${d.name}`} className="w-72" />
              <Button type="submit" variant="outline" size="sm">Save name</Button>
            </form>
            <form action={deleteDepartment}>
              <input type="hidden" name="id" value={d.id} />
              <ConfirmButton message={`Remove ${d.name}? Staff-file departments linked to it become unlinked.`} variant="ghost" size="sm">Remove</ConfirmButton>
            </form>
          </li>
        ))}</ul>
        {available.length ? (
          <form action={addStaffDepartmentAction} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="companyId" value={companyId} />
            <NativeSelect name="name" required aria-label="Department from the staff lists" className="max-w-sm">
              <option value="">Choose a department from the staff lists</option>
              {available.map((n) => <option key={n.name} value={n.name}>{n.name} ({n.people})</option>)}
            </NativeSelect>
            <Button type="submit">Add to company</Button>
          </form>
        ) : <p className="text-sm text-muted-foreground">Every department in the staff lists is already added to a company.</p>}
      </CardContent>
    </Card>
  );
}
