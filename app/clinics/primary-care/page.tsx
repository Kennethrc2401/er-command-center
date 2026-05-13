import ClinicShell from '../../../components/clinic/ClinicShell'

export const metadata = {
  title: 'Primary Care Clinic - PM / EHR / Scheduler',
}

export default function PrimaryCarePage() {
  return (
    <main style={{padding: 20}}>
      <h1>Primary Care Clinic</h1>
      <ClinicShell clinicName="Primary Care Clinic" />
    </main>
  )
}
