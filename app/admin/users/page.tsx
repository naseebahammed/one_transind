import { AddUserForm } from "@/components/admin/AddUserForm";
import { Page } from "@/components/admin/Page";
import { UsersDirectory } from "@/components/admin/UsersDirectory";
import { requireAdmin } from "@/lib/guard";
import { adminEmails } from "@/lib/server-config";
import { listUsers } from "@/lib/users";

export const metadata = { title: "Users · One Transind" };

export default function Users() {
  return (
    <Page
      title="Users & permissions"
      description="Manage who can sign in with Microsoft Entra and choose which executive modules each person can open."
    >
      <Rows />
    </Page>
  );
}

async function Rows() {
  await requireAdmin();
  const [users, admins] = await Promise.all([listUsers(), adminEmails()]);
  return (
    <div className="space-y-6">
      <AddUserForm />
      <UsersDirectory admins={admins} users={users} />
    </div>
  );
}
