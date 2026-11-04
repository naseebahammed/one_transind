import { CompanyForm } from "@/components/admin/CompanyForm";
import { Page } from "@/components/admin/Page";
import { listSectors } from "@/lib/sectors";
import { listPropertyTypes } from "@/lib/property-types";

export default function NewCompany() {
  return <Page title="Add company" description="Create a new company record."><Form /></Page>;
}

async function Form() {
  const [sectors, propertyTypes] = await Promise.all([listSectors(), listPropertyTypes()]);
  return <CompanyForm sectors={sectors} propertyTypes={propertyTypes} />;
}
