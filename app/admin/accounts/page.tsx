import { AccountsList } from "@/components/admin/AccountsList";
import { Page } from "@/components/admin/Page";
import { listAccounts } from "@/lib/accounts";

export default function Accounts() {
  return <Page title="Chart of accounts" description="Every main account and its sub ledger accounts."><Rows /></Page>;
}

async function Rows() {
  return <AccountsList rows={await listAccounts()} />;
}
