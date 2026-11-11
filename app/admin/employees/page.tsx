import { Page } from "@/components/admin/Page";
import { DepartmentMapping } from "@/components/admin/DepartmentMapping";
import { Card } from "@/components/admin/ui/card";
import { UploadEmployees } from "@/components/admin/UploadEmployees";

export const metadata = { title: "Staff lists · One Transind" };

export default function Employees() {
  return (
    <Page title="Staff lists" description="Upload the new-hires and the terminated or resigned lists. Re-uploading updates people by employee ID.">
      <Card className="space-y-3 p-4">
        <p className="text-sm text-muted-foreground">Columns: Emp ID, Employee Name, Joining Date, Department, Designation, NATIONALITY_DESC, RESIGN_DATE. Both files can be chosen together.</p>
        <UploadEmployees />
      </Card>
      <DepartmentMapping />
    </Page>
  );
}
