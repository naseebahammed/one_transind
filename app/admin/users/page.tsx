import { AddUserForm } from "@/components/admin/AddUserForm";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { Page } from "@/components/admin/Page";
import { Badge } from "@/components/admin/ui/badge";
import { Card } from "@/components/admin/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/admin/ui/table";
import { parseAdminEmails } from "@/lib/access";
import { requireAdmin } from "@/lib/guard";
import { listUsers } from "@/lib/users";
import { removeUserAction } from "./actions";

export default function Users() {
  return <Page title="Users" description="People who can sign in to One Transind with their Microsoft account."><Rows /></Page>;
}

async function Rows() {
  await requireAdmin();
  const [users, admins] = [await listUsers(), parseAdminEmails(process.env.ADMIN_EMAILS)];
  return (
    <div className="space-y-6">
      <AddUserForm />
      <Card className="gap-0 overflow-hidden py-0">
        <Table>
          <TableHeader><TableRow><TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead className="w-24" /></TableRow></TableHeader>
          <TableBody>
            {admins.map((email) => (
              <TableRow key={email}><TableCell>{email}</TableCell><TableCell><Badge>Admin</Badge></TableCell><TableCell className="text-xs text-muted-foreground">Set in ADMIN_EMAILS</TableCell></TableRow>
            ))}
            {users.map((u) => (
              <TableRow key={u.email}>
                <TableCell>{u.email}</TableCell>
                <TableCell>User</TableCell>
                <TableCell>
                  <form action={removeUserAction}>
                    <input type="hidden" name="email" value={u.email} />
                    <ConfirmButton message={`Remove ${u.email}? They will lose access on their next page load.`} size="sm">Remove</ConfirmButton>
                  </form>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
