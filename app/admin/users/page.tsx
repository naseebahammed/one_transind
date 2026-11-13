import { AccessSelect, AddUserForm } from "@/components/admin/AddUserForm";
import { Button } from "@/components/admin/ui/button";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { Page } from "@/components/admin/Page";
import { Badge } from "@/components/admin/ui/badge";
import { Card } from "@/components/admin/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/admin/ui/table";
import { requireAdmin } from "@/lib/guard";
import { adminEmails } from "@/lib/server-config";
import { listUsers } from "@/lib/users";
import { removeUserAction, setUserAccessAction } from "./actions";

export default function Users() {
  return <Page title="Users" description="People who can sign in to One Transind with their Microsoft account, and which pages each can open. Administrators always see everything."><Rows /></Page>;
}

async function Rows() {
  await requireAdmin();
  const [users, admins] = [await listUsers(), adminEmails()];
  return (
    <div className="space-y-6">
      <AddUserForm />
      <Card flush>
        <Table>
          <TableHeader><TableRow><TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead className="w-24" /></TableRow></TableHeader>
          <TableBody>
            {admins.map((email) => (
              <TableRow key={email}><TableCell>{email}</TableCell><TableCell><Badge>Admin</Badge></TableCell><TableCell className="text-xs text-muted-foreground">Set in ADMIN_EMAILS</TableCell></TableRow>
            ))}
            {users.map((u) => (
              <TableRow key={u.email}>
                <TableCell>{u.email}</TableCell>
                <TableCell>
                  <form action={setUserAccessAction} className="flex items-center gap-2">
                    <input type="hidden" name="email" value={u.email} />
                    <AccessSelect defaultValue={u.access} />
                    <Button type="submit" size="sm" variant="outline">Save</Button>
                  </form>
                </TableCell>
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
