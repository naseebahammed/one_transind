import { CompanyForm } from "@/components/admin/CompanyForm";
import { Page } from "@/components/admin/Page";
import { listSectors } from "@/lib/sectors";

export default function NewCompany() {
  return <Page title="Add company" description="Create a new company record."><Form /></Page>;
}

async function Form() {
  return <CompanyForm sectors={await listSectors()} />;
}
