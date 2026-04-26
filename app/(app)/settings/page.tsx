import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        title="Settings"
        description="Configuration for this private instance."
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Account" description="Owner of this instance" />
          <CardBody>
            <Row label="Email" value="benh2477@proton.me" />
            <Row label="Auth" value="Not configured" hint="TODO: add auth provider" />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Security" description="Protections for sensitive data" />
          <CardBody>
            <Row label="MFA" value="Not configured" hint="TODO: enforce for secure records" />
            <Row label="Encryption" value="Not configured" hint="TODO: KMS-backed envelope encryption" />
            <Row label="Audit log" value="Not configured" hint="TODO: record every decrypt/read" />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Data" description="Storage backend" />
          <CardBody>
            <Row label="Database" value="Mock (in-memory)" hint="TODO: wire Supabase" />
            <Row label="File storage" value="Not configured" hint="TODO: private bucket for invoices" />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Region" description="Accounting context" />
          <CardBody>
            <Row label="Base currency" value="AUD" />
            <Row label="Tax year" value="FY25-26 (Australia)" />
          </CardBody>
        </Card>
      </div>
    </>
  );
}

function Row({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex items-start justify-between py-2 border-b border-border last:border-0">
      <div className="text-sm text-subtle">{label}</div>
      <div className="text-right">
        <div className="text-sm text-foreground">{value}</div>
        {hint ? <div className="text-xs text-subtle mt-0.5">{hint}</div> : null}
      </div>
    </div>
  );
}
