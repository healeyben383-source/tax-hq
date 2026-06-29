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
            <Row
              label="Auth"
              value="Supabase Auth"
              hint="Email + password sign-in"
            />
            <Row
              label="Access model"
              value="Owner-scoped (RLS)"
              hint="Every row scoped to the signed-in owner"
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Security" description="Protections for sensitive data" />
          <CardBody>
            <Row
              label="Encryption"
              value="AES-256-GCM"
              hint="Secure records encrypted at rest, masked on display"
            />
            <Row
              label="Audit log"
              value="Reveals logged"
              hint="Secure-record reveals recorded; broader coverage planned"
            />
            <Row
              label="MFA / re-auth on reveal"
              value="Deferred"
              hint="TODO: gate reveals behind a fresh re-auth / MFA challenge"
            />
            <Row
              label="Key rotation / KMS"
              value="Deferred"
              hint="TODO: single server-held key today; add KMS + rotation"
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Data" description="Storage backend" />
          <CardBody>
            <Row
              label="Database"
              value="Supabase (Postgres)"
              hint="Providers, expenses, documents, recurring, checklist, secure records"
            />
            <Row
              label="File storage"
              value="Private bucket"
              hint="Document files served via short-lived signed URLs"
            />
            <Row
              label="Exports / reporting"
              value="Deferred"
              hint="TODO: not built yet"
            />
            <Row
              label="Email ingest / OCR"
              value="Deferred"
              hint="TODO: not built yet"
            />
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
